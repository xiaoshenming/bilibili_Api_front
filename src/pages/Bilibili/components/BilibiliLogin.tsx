import React, { useState, useEffect } from 'react';
import { Card, Button, Spin, Alert, Row, Col, Typography, Space, Avatar, Tag } from 'antd';
import { QrcodeOutlined, ReloadOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useModel, request } from '@umijs/max';

const { Title, Text } = Typography;

interface BilibiliAccount {
  id: string;
  dedeuserid: string;
  nickname: string;
  avatar: string;
  is_active: boolean;
  created_at: string;
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

  useEffect(() => {
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [pollInterval]);

  const generateQRCode = async () => {
    if (!initialState?.currentUser) {
      setStatus('error');
      setStatusMessage('请先登录系统');
      return;
    }

    setLoading(true);
    setStatus('waiting');
    setStatusMessage('正在生成二维码...');

    try {
      const result = await request('/api/bilibili/generate-qrcode', {
        method: 'POST',
      });
      
      if (result.code === 200) {
        setQrCode(result.data.qrCodeImage);
        setSessionId(result.data.sessionId);
        setStatus('waiting');
        setStatusMessage('请使用哔哩哔哩APP扫描二维码');
        startPolling(result.data.sessionId);
      } else {
        setStatus('error');
        setStatusMessage(result.message || '生成二维码失败');
      }
    } catch (error) {
      setStatus('error');
      setStatusMessage('网络错误，请重试');
      console.error('生成二维码失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const startPolling = (sessionId: string) => {
    const interval = setInterval(async () => {
      try {
        const result = await request(`/api/bilibili/login-status/${sessionId}`, {
          method: 'GET',
        });
        
        if (result.code === 200) {
          const { status: loginStatus, message: loginMessage } = result.data;
          
          setStatus(loginStatus);
          setStatusMessage(loginMessage);
          
          if (loginStatus === 'success') {
            clearInterval(interval);
            setPollInterval(null);
            onLoginSuccess();
          } else if (loginStatus === 'expired' || loginStatus === 'error') {
            clearInterval(interval);
            setPollInterval(null);
          }
        }
      } catch (error) {
        console.error('轮询登录状态失败:', error);
      }
    }, 2000);

    setPollInterval(interval);
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
    <div>
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

      {/* 扫码登录区域 */}
      <Row gutter={24}>
        <Col xs={24} lg={12}>
          <Card title="扫码登录新账号" extra={
            <Button 
              icon={<ReloadOutlined />} 
              onClick={resetQRCode}
              disabled={loading}
            >
              重新生成
            </Button>
          }>
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              {!qrCode ? (
                <div>
                  <QrcodeOutlined style={{ fontSize: 64, color: '#1890ff', marginBottom: 16 }} />
                  <div>
                    <Button 
                      type="primary" 
                      size="large" 
                      onClick={generateQRCode}
                      loading={loading}
                      icon={<QrcodeOutlined />}
                    >
                      生成登录二维码
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <img 
                    src={qrCode} 
                    alt="B站登录二维码" 
                    style={{ 
                      width: 200, 
                      height: 200, 
                      border: '1px solid #d9d9d9',
                      borderRadius: 8
                    }} 
                  />
                  <div style={{ marginTop: 16 }}>
                    <Tag color={getStatusColor()} icon={getStatusIcon()}>
                      {statusMessage}
                    </Tag>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </Col>
        
        <Col xs={24} lg={12}>
          <Card title="使用说明">
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Alert
                message="登录步骤"
                description={
                  <ol style={{ paddingLeft: 20, margin: 0 }}>
                    <li>点击"生成登录二维码"按钮</li>
                    <li>使用哔哩哔哩手机APP扫描二维码</li>
                    <li>在手机上确认登录</li>
                    <li>登录成功后即可使用视频解析功能</li>
                  </ol>
                }
                type="info"
                showIcon
              />
              
              <Alert
                message="注意事项"
                description={
                  <ul style={{ paddingLeft: 20, margin: 0 }}>
                    <li>二维码有效期为10分钟</li>
                    <li>登录后的账号信息会安全保存</li>
                    <li>可以同时登录多个B站账号</li>
                    <li>登录信息仅用于视频解析，不会泄露</li>
                  </ul>
                }
                type="warning"
                showIcon
              />
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default BilibiliLogin;