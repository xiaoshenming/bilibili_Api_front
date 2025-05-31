import React, { useState } from 'react';
import { Card, Row, Col, Avatar, Button, Space, Typography, Tag, Popconfirm, message, Modal, Alert } from 'antd';
import { DeleteOutlined, CheckCircleOutlined, CloseCircleOutlined, UserOutlined } from '@ant-design/icons';
import { request } from '@umijs/max';

const { Title, Text } = Typography;

interface BilibiliAccount {
  id: string;
  dedeuserid: string;
  nickname: string;
  avatar: string;
  is_active: boolean;
  created_at: string;
}

interface AccountManagerProps {
  accounts: BilibiliAccount[];
  onAccountChange: () => void;
}

const AccountManager: React.FC<AccountManagerProps> = ({ accounts, onAccountChange }) => {
  const [loading, setLoading] = useState<string>('');

  const toggleAccountStatus = async (accountId: string, isActive: boolean) => {
    setLoading(accountId);
    
    try {
      const result = await request(`/api/bilibili/accounts/${accountId}/toggle`, {
        method: 'PUT',
        data: { isActive: !isActive },
      });
      
      if (result.code === 200) {
        message.success(isActive ? '账号已停用' : '账号已激活');
        onAccountChange();
      } else {
        message.error(result.message || '操作失败');
      }
    } catch (error) {
      message.error('网络错误，请重试');
      console.error('切换账号状态失败:', error);
    } finally {
      setLoading('');
    }
  };

  const deleteAccount = async (accountId: string) => {
    setLoading(accountId);
    
    try {
      const result = await request(`/api/bilibili/accounts/${accountId}`, {
        method: 'DELETE',
      });
      
      if (result.code === 200) {
        message.success('账号删除成功');
        onAccountChange();
      } else {
        message.error(result.message || '删除失败');
      }
    } catch (error) {
      message.error('网络错误，请重试');
      console.error('删除账号失败:', error);
    } finally {
      setLoading('');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN');
  };

  if (accounts.length === 0) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <UserOutlined style={{ fontSize: 64, color: '#ccc', marginBottom: 16 }} />
          <Title level={4} type="secondary">暂无B站账号</Title>
          <Text type="secondary">请先在扫码登录页面登录您的B站账号</Text>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <Alert
        message="账号管理说明"
        description="您可以管理已登录的B站账号，激活的账号将用于视频解析。同时只能有一个账号处于激活状态。"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />
      
      <Row gutter={[16, 16]}>
        {accounts.map((account) => (
          <Col xs={24} sm={12} lg={8} xl={6} key={account.id}>
            <Card
              hoverable
              style={{
                borderColor: account.is_active ? '#52c41a' : undefined,
                boxShadow: account.is_active ? '0 2px 8px rgba(82, 196, 26, 0.2)' : undefined,
              }}
              actions={[
                <Button
                  key="toggle"
                  type={account.is_active ? 'default' : 'primary'}
                  icon={account.is_active ? <CloseCircleOutlined /> : <CheckCircleOutlined />}
                  loading={loading === account.id}
                  onClick={() => toggleAccountStatus(account.id, account.is_active)}
                  size="small"
                >
                  {account.is_active ? '停用' : '激活'}
                </Button>,
                <Popconfirm
                  key="delete"
                  title="确认删除"
                  description="删除后将无法恢复，确定要删除这个账号吗？"
                  onConfirm={() => deleteAccount(account.id)}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    loading={loading === account.id}
                    size="small"
                  >
                    删除
                  </Button>
                </Popconfirm>,
              ]}
            >
              <Card.Meta
                avatar={
                  <Avatar 
                    src={account.avatar} 
                    size={48}
                    style={{
                      border: account.is_active ? '2px solid #52c41a' : '1px solid #d9d9d9'
                    }}
                  >
                    {account.nickname?.[0]}
                  </Avatar>
                }
                title={
                  <Space direction="vertical" size={4}>
                    <Text strong>{account.nickname}</Text>
                    <Tag color={account.is_active ? 'green' : 'default'} size="small">
                      {account.is_active ? '当前使用' : '未激活'}
                    </Tag>
                  </Space>
                }
                description={
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      UID: {account.dedeuserid}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      登录时间: {formatDate(account.created_at)}
                    </Text>
                  </Space>
                }
              />
            </Card>
          </Col>
        ))}
      </Row>
      
      <Card style={{ marginTop: 24 }} title="使用提示">
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            message="账号状态说明"
            description={
              <ul style={{ paddingLeft: 20, margin: 0 }}>
                <li><strong>激活状态：</strong>该账号将用于视频解析，同时只能有一个账号处于激活状态</li>
                <li><strong>停用状态：</strong>账号信息保留，但不会用于视频解析</li>
                <li><strong>删除操作：</strong>彻底删除账号信息，无法恢复</li>
              </ul>
            }
            type="info"
            showIcon
          />
          
          <Alert
            message="安全提醒"
            description="您的B站登录信息经过加密存储，仅用于视频解析功能，不会被用于其他用途。如有安全顾虑，可随时删除账号。"
            type="warning"
            showIcon
          />
        </Space>
      </Card>
    </div>
  );
};

export default AccountManager;