import React, { useState, useEffect, useRef } from 'react';
import { 
  Card, Button, message, Spin, Alert, Typography, Space, Steps, Tag ,Image, 
  Timeline, Row, Col, Progress, Switch, Select, Avatar
} from 'antd';
import { 
  QrcodeOutlined, CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined,
  SecurityScanOutlined, MobileOutlined, HistoryOutlined, SafetyCertificateOutlined,
  ClockCircleOutlined, WifiOutlined
} from '@ant-design/icons';
import { useModel, request } from '@umijs/max';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Step } = Steps;
const { Option } = Select;

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

interface QRCodeInfo {
  qrcode_key: string;
  url: string;
  refresh_token?: string;
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
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [refreshInterval, setRefreshInterval] = useState<number>(180); // 3分钟
  const [securityCheck, setSecurityCheck] = useState<boolean>(false);
  
  // 设备和安全相关
  const [deviceInfo, setDeviceInfo] = useState<any>({});
  
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
  
  // 组件卸载时清理所有定时器
  useEffect(() => {
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      if (refreshRef.current) {
        clearTimeout(refreshRef.current);
        refreshRef.current = null;
      }
    };
  }, []);


  
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
    // 清理之前的轮询
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (pollInterval) {
      clearInterval(pollInterval);
      setPollInterval(null);
    }
    
    console.log('开始轮询登录状态，sessionId:', sessionId);
    
    const polling = setInterval(async () => {
      try {
        console.log('轮询检查登录状态...');
        const result = await request(`/api/bilibili/login-status/${sessionId}`, {
          method: 'GET',
        });
        
        console.log('登录状态检查结果:', result);
        
        if (result.code === 200) {
          const { status: loginStatus, message: loginMessage } = result.data;
          
          setStatus(loginStatus);
          setStatusMessage(loginMessage);
          
          if (loginStatus === 'success') {
            setCurrentStep(3);
            setLoginProgress(100);
            
            // 登录成功，可以在这里添加其他处理逻辑
            console.log('用户登录成功:', result.data.userInfo);
            
            // 停止轮询
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }
            if (pollInterval) {
              clearInterval(pollInterval);
              setPollInterval(null);
            }
            
            console.log('登录成功，停止轮询');
            
            // 延迟重置状态
            setTimeout(() => {
              setQrCode('');
              setSessionId('');
              setStatus('idle');
              setStatusMessage('');
              setCurrentStep(0);
              setLoginProgress(0);
            }, 2000);
            
            message.success('登录成功！');
            onLoginSuccess();
          } else if (loginStatus === 'expired' || loginStatus === 'error') {
            // 登录失败或过期
            console.log('登录失败或过期:', loginStatus, loginMessage);
            
            // 停止轮询
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }
            if (pollInterval) {
              clearInterval(pollInterval);
              setPollInterval(null);
            }
            
            console.log('登录失败或过期，停止轮询');
          } else if (loginStatus === 'scanned') {
            setCurrentStep(2);
            setLoginProgress(75);
            console.log('二维码已扫描，等待确认');
          } else if (loginStatus === 'waiting') {
            console.log('等待扫描二维码');
          }
        } else {
          console.error('获取登录状态失败:', result.message);
        }
      } catch (error) {
        console.error('轮询登录状态失败:', error);
      }
    }, 2000);

    pollingRef.current = polling;
    setPollInterval(polling);
    
    console.log('轮询已启动，间隔2秒');
  };
  


  const resetQRCode = () => {
    console.log('重置二维码，清理所有状态和定时器');
    
    // 清理所有定时器
    if (pollInterval) {
      clearInterval(pollInterval);
      setPollInterval(null);
    }
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (refreshRef.current) {
      clearTimeout(refreshRef.current);
      refreshRef.current = null;
    }
    
    // 重置状态
    setQrCode('');
    setSessionId('');
    setStatus('idle');
    setStatusMessage('');
    setCurrentStep(0);
    setLoginProgress(0);
    setLoading(false);
    
    console.log('二维码重置完成');
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

  return (
    <div className="bilibili-login">
      
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
      

    </div>
  );
};

export default BilibiliLogin;