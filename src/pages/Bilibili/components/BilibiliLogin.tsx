import React, { useState, useEffect, useRef } from 'react';
import { 
  Card, Button, message, Spin, Alert, Typography, Space, Steps, Image, 
  Modal, List, Avatar, Tag, Tooltip, Progress, Divider, Row, Col,
  Statistic, Timeline, Empty, Input, Select, DatePicker, Switch
} from 'antd';
import { 
  QrcodeOutlined, CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined,
  UserOutlined, HistoryOutlined, SecurityScanOutlined, MobileOutlined,
  WifiOutlined, EnvironmentOutlined, ClockCircleOutlined, EyeOutlined,
  SafetyCertificateOutlined, ExclamationCircleOutlined, InfoCircleOutlined
} from '@ant-design/icons';
import { useModel, request } from '@umijs/max';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Step } = Steps;
const { Option } = Select;
const { RangePicker } = DatePicker;

interface BilibiliAccount {
  id: string;
  dedeuserid: string;
  nickname: string;
  avatar: string;
  is_active: boolean;
  created_at: string;
  level?: number;
  vipStatus?: string;
  vipType?: string;
  follower?: number;
  following?: number;
  coins?: number;
  experience?: number;
  lastActiveTime?: string;
  accountStatus?: 'active' | 'inactive' | 'warning' | 'banned';
}

interface LoginHistory {
  id: string;
  accountId: string;
  nickname: string;
  avatar: string;
  loginTime: string;
  loginMethod: 'qrcode' | 'password' | 'sms';
  deviceInfo: {
    userAgent: string;
    ip: string;
    location?: string;
    device: string;
  };
  status: 'success' | 'failed' | 'expired';
}

interface QRCodeInfo {
  qrcode_key: string;
  url: string;
  refresh_token?: string;
}

interface LoginStats {
  totalLogins: number;
  successfulLogins: number;
  failedLogins: number;
  uniqueAccounts: number;
  lastLoginTime?: string;
}

interface BilibiliLoginProps {
  onLoginSuccess: () => void;
  accounts: BilibiliAccount[];
}

const BilibiliLogin: React.FC<BilibiliLoginProps> = ({ onLoginSuccess, accounts }) => {
  const { initialState } = useModel('@@initialState');
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');
  const [status, setStatus] = useState<string>('idle'); // idle, waiting, scanned, success, error, expired
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [loginProgress, setLoginProgress] = useState<number>(0);
  
  // 登录历史相关
  const [loginHistory, setLoginHistory] = useState<LoginHistory[]>([]);
  const [historyVisible, setHistoryVisible] = useState<boolean>(false);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [loginStats, setLoginStats] = useState<LoginStats>({
    totalLogins: 0,
    successfulLogins: 0,
    failedLogins: 0,
    uniqueAccounts: 0
  });
  
  // 设备和安全相关
  const [deviceInfo, setDeviceInfo] = useState<any>({});
  const [securityCheck, setSecurityCheck] = useState<boolean>(false);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [refreshInterval, setRefreshInterval] = useState<number>(180); // 3分钟
  
  // 过滤和搜索
  const [historyFilter, setHistoryFilter] = useState<{
    method: string;
    status: string;
    dateRange: any[];
  }>({ method: 'all', status: 'all', dateRange: [] });
  
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const refreshRef = useRef<NodeJS.Timeout | null>(null);

  // 设备信息检测
  useEffect(() => {
    const detectDevice = () => {
      const userAgent = navigator.userAgent;
      const platform = navigator.platform;
      const language = navigator.language;
      
      setDeviceInfo({
        userAgent,
        platform,
        language,
        screen: `${screen.width}x${screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        cookieEnabled: navigator.cookieEnabled,
        onlineStatus: navigator.onLine
      });
    };
    
    detectDevice();
    loadLoginHistory();
    loadLoginStats();
  }, []);
  
  // 自动刷新二维码
  useEffect(() => {
    if (autoRefresh && qrCode && status === 'waiting') {
      refreshRef.current = setTimeout(() => {
        if (status === 'waiting') {
          generateQRCode();
        }
      }, refreshInterval * 1000);
    }
    
    return () => {
      if (refreshRef.current) {
        clearTimeout(refreshRef.current);
      }
    };
  }, [qrCode, status, autoRefresh, refreshInterval]);
  
  useEffect(() => {
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
      if (refreshRef.current) {
        clearTimeout(refreshRef.current);
      }
    };
  }, [pollInterval]);

  // 加载登录历史
  const loadLoginHistory = async () => {
    try {
      setHistoryLoading(true);
      const response = await request('/api/bilibili/login-history', {
        method: 'GET',
        params: {
          ...historyFilter,
          dateRange: historyFilter.dateRange.length > 0 ? {
            start: historyFilter.dateRange[0]?.format('YYYY-MM-DD'),
            end: historyFilter.dateRange[1]?.format('YYYY-MM-DD')
          } : undefined
        }
      });
      
      if (response.success) {
        setLoginHistory(response.data || []);
      }
    } catch (error) {
      console.error('加载登录历史失败:', error);
    } finally {
      setHistoryLoading(false);
    }
  };
  
  // 加载登录统计
  const loadLoginStats = async () => {
    try {
      const response = await request('/api/bilibili/login-stats', {
        method: 'GET'
      });
      
      if (response.success) {
        setLoginStats(response.data || {
          totalLogins: 0,
          successfulLogins: 0,
          failedLogins: 0,
          uniqueAccounts: 0
        });
      }
    } catch (error) {
      console.error('加载登录统计失败:', error);
    }
  };
  
  const generateQRCode = async () => {
    if (!initialState?.currentUser) {
      setStatus('error');
      setStatusMessage('请先登录系统');
      return;
    }

    setLoading(true);
    setStatus('waiting');
    setCurrentStep(0);
    setLoginProgress(0);
    setStatusMessage('正在生成二维码...');

    try {
      // 安全检查
      if (securityCheck) {
        setStatusMessage('正在进行安全检查...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      const result = await request('/api/bilibili/generate-qrcode', {
        method: 'POST',
        data: {
          deviceInfo: JSON.stringify(deviceInfo)
        }
      });
      
      if (result.code === 200) {
        setQrCode(result.data.qrCodeImage);
        setSessionId(result.data.sessionId);
        setCurrentStep(1);
        setLoginProgress(25);
        setStatus('waiting');
        setStatusMessage('请使用哔哩哔哩APP扫描二维码');
        startPolling(result.data.sessionId);
      } else {
        setStatus('error');
        setStatusMessage(result.message || '生成二维码失败');
        message.error(result.message || '生成二维码失败');
      }
    } catch (error) {
      setStatus('error');
      setStatusMessage('网络错误，请重试');
      message.error('网络错误，请检查网络连接');
      console.error('生成二维码失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const startPolling = (sessionId: string) => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
    
    pollingRef.current = setInterval(async () => {
      try {
        const result = await request(`/api/bilibili/login-status/${sessionId}`, {
          method: 'GET',
        });
        
        if (result.code === 200) {
          const { status: loginStatus, message: loginMessage } = result.data;
          
          setStatus(loginStatus);
          setStatusMessage(loginMessage);
          
          if (loginStatus === 'success') {
            setCurrentStep(3);
            setLoginProgress(100);
            
            // 记录登录历史
            await recordLoginHistory({
              accountId: result.data.userInfo?.mid || '',
              nickname: result.data.userInfo?.uname || '未知用户',
              avatar: result.data.userInfo?.face || '',
              loginMethod: 'qrcode',
              status: 'success'
            });
            
            clearInterval(pollingRef.current!);
            setPollInterval(null);
            
            // 刷新统计
            loadLoginStats();
            
            message.success('登录成功！');
            onLoginSuccess();
          } else if (loginStatus === 'expired' || loginStatus === 'error') {
            // 记录失败历史
            await recordLoginHistory({
              accountId: '',
              nickname: '未知用户',
              avatar: '',
              loginMethod: 'qrcode',
              status: loginStatus === 'expired' ? 'expired' : 'failed'
            });
            
            clearInterval(pollingRef.current!);
            setPollInterval(null);
          } else if (loginStatus === 'scanned') {
            setCurrentStep(2);
            setLoginProgress(75);
          }
        }
      } catch (error) {
        console.error('轮询登录状态失败:', error);
      }
    }, 2000);

    setPollInterval(pollingRef.current);
  };
  
  // 记录登录历史
  const recordLoginHistory = async (loginData: Partial<LoginHistory>) => {
    try {
      await request('/api/bilibili/record-login', {
        method: 'POST',
        data: {
          ...loginData,
          loginTime: new Date().toISOString(),
          deviceInfo: {
            ...deviceInfo,
            ip: 'auto-detect',
            location: 'auto-detect'
          }
        }
      });
    } catch (error) {
      console.error('记录登录历史失败:', error);
    }
  };

  const resetQRCode = () => {
    if (pollInterval) {
      clearInterval(pollInterval);
      setPollInterval(null);
    }
    setQrCode('');
    setSessionId('');
    setStatus('idle');
    setStatusMessage('');
  };

  // 获取登录方法标签
  const getMethodTag = (method: string) => {
    const methodMap = {
      qrcode: { color: 'blue', icon: <QrcodeOutlined />, text: '二维码' },
      password: { color: 'green', icon: <SafetyCertificateOutlined />, text: '密码' },
      sms: { color: 'orange', icon: <MobileOutlined />, text: '短信' }
    };
    const config = methodMap[method as keyof typeof methodMap] || methodMap.qrcode;
    return <Tag color={config.color} icon={config.icon}>{config.text}</Tag>;
  };
  
  // 获取状态标签
  const getStatusTag = (status: string) => {
    const statusMap = {
      success: { color: 'success', icon: <CheckCircleOutlined />, text: '成功' },
      failed: { color: 'error', icon: <CloseCircleOutlined />, text: '失败' },
      expired: { color: 'warning', icon: <ExclamationCircleOutlined />, text: '过期' }
    };
    const config = statusMap[status as keyof typeof statusMap] || statusMap.failed;
    return <Tag color={config.color} icon={config.icon}>{config.text}</Tag>;
  };
  
  // 过滤登录历史
  const getFilteredHistory = () => {
    return loginHistory.filter(item => {
      const methodMatch = historyFilter.method === 'all' || item.loginMethod === historyFilter.method;
      const statusMatch = historyFilter.status === 'all' || item.status === historyFilter.status;
      
      let dateMatch = true;
      if (historyFilter.dateRange.length === 2) {
        const itemDate = dayjs(item.loginTime);
        const startDate = historyFilter.dateRange[0];
        const endDate = historyFilter.dateRange[1];
        dateMatch = itemDate.isAfter(startDate.startOf('day')) && itemDate.isBefore(endDate.endOf('day'));
      }
      
      return methodMatch && statusMatch && dateMatch;
    });
  };

  const getStatusColor = () => {
    switch (status) {
      case 'waiting': return 'processing';
      case 'scanned': return 'warning';
      case 'success': return 'success';
      case 'error': case 'expired': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'success': return <CheckCircleOutlined />;
      case 'waiting': case 'scanned': return <Spin size="small" />;
      default: return null;
    }
  };

  const filteredHistory = getFilteredHistory();
  
  return (
    <div className="bilibili-login">
      {/* 统计面板 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="总登录次数"
              value={loginStats.totalLogins}
              prefix={<HistoryOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="成功登录"
              value={loginStats.successfulLogins}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="失败次数"
              value={loginStats.failedLogins}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="账号数量"
              value={loginStats.uniqueAccounts}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>
      
      {/* 已登录账号展示 */}
      {accounts.length > 0 && (
        <Card title="已登录的B站账号" style={{ marginBottom: 24 }}>
          <Row gutter={[16, 16]}>
            {accounts.map((account) => (
              <Col xs={24} sm={12} md={8} lg={6} key={account.id}>
                <Card size="small" hoverable>
                  <Space direction="vertical" align="center" style={{ width: '100%' }}>
                    <Avatar src={account.avatar} size={48}>
                      {account.nickname?.[0]}
                    </Avatar>
                    <Text strong>{account.nickname}</Text>
                    <Tag color={account.is_active ? 'green' : 'default'}>
                      {account.is_active ? '当前使用' : '未激活'}
                    </Tag>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        </Card>
      )}
      
      {/* 主登录区域 */}
      <Row gutter={24}>
        <Col xs={24} lg={14}>
          <Card title="扫码登录" style={{ height: '100%' }}>
            {/* 登录步骤 */}
            <Steps current={currentStep} style={{ marginBottom: 24 }}>
              <Step title="生成二维码" icon={<QrcodeOutlined />} />
              <Step title="扫描二维码" icon={<MobileOutlined />} />
              <Step title="确认登录" icon={<SecurityScanOutlined />} />
              <Step title="登录成功" icon={<CheckCircleOutlined />} />
            </Steps>
            
            {/* 进度条 */}
            <Progress 
              percent={loginProgress} 
              status={status === 'expired' ? 'exception' : 'active'}
              style={{ marginBottom: 24 }}
            />
            
            <div style={{ textAlign: 'center' }}>
              {loading && !qrCode && (
                <div style={{ padding: '40px 0' }}>
                  <Spin size="large" />
                  <p style={{ marginTop: 16, color: '#666' }}>正在生成二维码...</p>
                </div>
              )}
              
              {qrCode && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ 
                    display: 'inline-block',
                    padding: 16,
                    background: '#fff',
                    border: '1px solid #d9d9d9',
                    borderRadius: 8,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                  }}>
                    <img 
                      src={qrCode} 
                      alt="登录二维码" 
                      style={{ width: 200, height: 200, display: 'block' }}
                    />
                  </div>
                  
                  <div style={{ marginTop: 16 }}>
                    <Text style={{ 
                      fontSize: 16, 
                      color: getStatusColor(),
                      fontWeight: 500
                    }}>
                      {statusMessage}
                    </Text>
                    
                    {status === 'waiting' && (
                      <div style={{ marginTop: 8 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          <WifiOutlined /> 网络状态: {deviceInfo.onlineStatus ? '在线' : '离线'}
                        </Text>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {status === 'error' && (
                <Alert
                  message="登录失败"
                  description={statusMessage}
                  type="error"
                  showIcon
                  style={{ marginBottom: 24, textAlign: 'left' }}
                />
              )}
              
              {status === 'success' && (
                <Alert
                  message="登录成功"
                  description="正在跳转到账号管理页面..."
                  type="success"
                  showIcon
                  style={{ marginBottom: 24, textAlign: 'left' }}
                />
              )}
              
              <Space size="large">
                <Button 
                  type="primary" 
                  size="large"
                  icon={<QrcodeOutlined />}
                  onClick={generateQRCode}
                  loading={loading}
                  disabled={status === 'success'}
                >
                  {qrCode ? '重新生成' : '生成二维码'}
                </Button>
                
                <Button 
                  icon={<HistoryOutlined />}
                  onClick={() => setHistoryVisible(true)}
                >
                  登录历史
                </Button>
              </Space>
            </div>
          </Card>
        </Col>
        
        <Col xs={24} lg={10}>
          {/* 设备信息 */}
          <Card title="设备信息" style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <div>
                <Text type="secondary">平台: </Text>
                <Text>{deviceInfo.platform}</Text>
              </div>
              <div>
                <Text type="secondary">分辨率: </Text>
                <Text>{deviceInfo.screen}</Text>
              </div>
              <div>
                <Text type="secondary">时区: </Text>
                <Text>{deviceInfo.timezone}</Text>
              </div>
              <div>
                <Text type="secondary">语言: </Text>
                <Text>{deviceInfo.language}</Text>
              </div>
            </Space>
          </Card>
          
          {/* 安全设置 */}
          <Card title="安全设置">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>
                  <SafetyCertificateOutlined style={{ marginRight: 8 }} />
                  安全检查
                </span>
                <Switch 
                  checked={securityCheck} 
                  onChange={setSecurityCheck}
                  size="small"
                />
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>
                  <ClockCircleOutlined style={{ marginRight: 8 }} />
                  自动刷新
                </span>
                <Switch 
                  checked={autoRefresh} 
                  onChange={setAutoRefresh}
                  size="small"
                />
              </div>
              
              {autoRefresh && (
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>刷新间隔: </Text>
                  <Select 
                    value={refreshInterval} 
                    onChange={setRefreshInterval}
                    size="small"
                    style={{ width: 100 }}
                  >
                    <Option value={120}>2分钟</Option>
                    <Option value={180}>3分钟</Option>
                    <Option value={300}>5分钟</Option>
                  </Select>
                </div>
              )}
            </Space>
          </Card>
        </Col>
      </Row>
      
      {/* 使用说明 */}
      <Card title="使用说明" style={{ marginTop: 24 }}>
        <Timeline>
          <Timeline.Item color="blue" dot={<QrcodeOutlined />}>
            <Text strong>生成二维码</Text>
            <br />
            <Text type="secondary">点击"生成二维码"按钮，系统将为您生成专属登录二维码</Text>
          </Timeline.Item>
          <Timeline.Item color="orange" dot={<MobileOutlined />}>
            <Text strong>扫描二维码</Text>
            <br />
            <Text type="secondary">使用哔哩哔哩手机APP扫描屏幕上的二维码</Text>
          </Timeline.Item>
          <Timeline.Item color="purple" dot={<SecurityScanOutlined />}>
            <Text strong>确认登录</Text>
            <br />
            <Text type="secondary">在手机APP上点击"确认登录"按钮</Text>
          </Timeline.Item>
          <Timeline.Item color="green" dot={<CheckCircleOutlined />}>
            <Text strong>登录成功</Text>
            <br />
            <Text type="secondary">登录成功后，系统将自动跳转到账号管理页面</Text>
          </Timeline.Item>
        </Timeline>
      </Card>
      
      {/* 登录历史模态框 */}
      <Modal
        title="登录历史"
        open={historyVisible}
        onCancel={() => setHistoryVisible(false)}
        width={800}
        footer={null}
      >
        {/* 过滤器 */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Select
              placeholder="登录方式"
              value={historyFilter.method}
              onChange={(value) => setHistoryFilter(prev => ({ ...prev, method: value }))}
              style={{ width: '100%' }}
            >
              <Option value="all">全部方式</Option>
              <Option value="qrcode">二维码</Option>
              <Option value="password">密码</Option>
              <Option value="sms">短信</Option>
            </Select>
          </Col>
          <Col span={6}>
            <Select
              placeholder="登录状态"
              value={historyFilter.status}
              onChange={(value) => setHistoryFilter(prev => ({ ...prev, status: value }))}
              style={{ width: '100%' }}
            >
              <Option value="all">全部状态</Option>
              <Option value="success">成功</Option>
              <Option value="failed">失败</Option>
              <Option value="expired">过期</Option>
            </Select>
          </Col>
          <Col span={8}>
            <RangePicker
              value={historyFilter.dateRange}
              onChange={(dates) => setHistoryFilter(prev => ({ ...prev, dateRange: dates || [] }))}
              style={{ width: '100%' }}
            />
          </Col>
          <Col span={4}>
            <Button onClick={loadLoginHistory} loading={historyLoading}>
              刷新
            </Button>
          </Col>
        </Row>
        
        {/* 历史列表 */}
        {filteredHistory.length === 0 ? (
          <Empty description="暂无登录历史" />
        ) : (
          <List
            dataSource={filteredHistory}
            renderItem={(item) => (
              <List.Item>
                <List.Item.Meta
                  avatar={<Avatar src={item.avatar} icon={<UserOutlined />} />}
                  title={
                    <Space>
                      <Text strong>{item.nickname}</Text>
                      {getMethodTag(item.loginMethod)}
                      {getStatusTag(item.status)}
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={4}>
                      <Text type="secondary">
                        <ClockCircleOutlined /> {dayjs(item.loginTime).format('YYYY-MM-DD HH:mm:ss')}
                      </Text>
                      <Text type="secondary">
                        <EnvironmentOutlined /> {item.deviceInfo.location || '未知位置'} | {item.deviceInfo.ip}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {item.deviceInfo.device}
                      </Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Modal>
    </div>
  );
};

export default BilibiliLogin;