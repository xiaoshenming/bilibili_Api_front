import React, { useState, useEffect } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { 
  Card, 
  message, 
  Alert, 
  Row, 
  Col, 
  Statistic, 
  Progress, 
  Tag, 
  Space, 
  Typography, 
  Button,
  Tooltip,
  Modal,
  Descriptions,
  Badge
} from 'antd';
import {
  CrownOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  WarningOutlined
} from '@ant-design/icons';
import AvailableVideos from '../Bilibili/components/AvailableVideos';
import { request } from '@umijs/max';

const { Title, Text } = Typography;

interface DailyLimitStatus {
  userRole: string;
  roleName: string;
  totalLimit: number | string;
  usedCount: number;
  remaining: number | string;
  canApply: boolean;
  resetTime: string;
}

const AvailableVideosPage: React.FC = () => {
  const [limitStatus, setLimitStatus] = useState<DailyLimitStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [helpModalVisible, setHelpModalVisible] = useState(false);

  // 获取每日限制状态
  const fetchDailyLimitStatus = async () => {
    try {
      const response = await request('/api/video/daily-limit-status', {
        method: 'GET',
      });
      
      if (response.code === 200) {
        setLimitStatus(response.data);
      } else {
        console.error('获取每日限制状态失败:', response.message);
      }
    } catch (error) {
      console.error('获取每日限制状态失败:', error);
    }
  };

  useEffect(() => {
    fetchDailyLimitStatus();
  }, []);

  // 权限等级配置
  const getRoleConfig = (role: string) => {
    const configs = {
      '1': { 
        name: '普通用户', 
        color: '#1890ff', 
        icon: '👤',
        description: '每日可申请1个视频下载权限'
      },
      '2': { 
        name: '高级用户', 
        color: '#52c41a', 
        icon: '⭐',
        description: '每日可申请10个视频下载权限'
      },
      '3': { 
        name: 'VIP用户', 
        color: '#faad14', 
        icon: '💎',
        description: '每日可申请100个视频下载权限'
      },
      '4': { 
        name: '管理员', 
        color: '#722ed1', 
        icon: '👑',
        description: '无限制申请视频下载权限'
      }
    };
    return configs[role as keyof typeof configs] || configs['1'];
  };

  // 获取进度条颜色
  const getProgressColor = () => {
    if (!limitStatus || limitStatus.totalLimit === '无限制') return '#52c41a';
    
    const usedPercent = (limitStatus.usedCount / (limitStatus.totalLimit as number)) * 100;
    if (usedPercent >= 90) return '#ff4d4f';
    if (usedPercent >= 70) return '#faad14';
    return '#52c41a';
  };

  // 获取剩余次数的状态
  const getRemainingStatus = () => {
    if (!limitStatus) return { type: 'info', text: '加载中...' };
    
    if (limitStatus.totalLimit === '无限制') {
      return { type: 'success', text: '无限制' };
    }
    
    const remaining = limitStatus.remaining as number;
    if (remaining <= 0) {
      return { type: 'error', text: '已达上限' };
    }
    if (remaining <= 2) {
      return { type: 'warning', text: `仅剩${remaining}次` };
    }
    return { type: 'success', text: `剩余${remaining}次` };
  };

  const roleConfig = limitStatus ? getRoleConfig(limitStatus.userRole) : null;
  const remainingStatus = getRemainingStatus();

  return (
    <PageContainer
      title={
        <Space>
          <span>可下载视频库</span>
          {roleConfig && (
            <Tag color={roleConfig.color} icon={<span>{roleConfig.icon}</span>}>
              {roleConfig.name}
            </Tag>
          )}
        </Space>
      }
      subTitle="浏览和申请下载权限"
      content="查看所有可下载的视频资源，根据您的权限等级申请下载权限"
      extra={[
        <Button 
          key="help"
          icon={<InfoCircleOutlined />}
          onClick={() => setHelpModalVisible(true)}
        >
          权限说明
        </Button>,
        <Button 
          key="refresh"
          icon={<ReloadOutlined />}
          onClick={fetchDailyLimitStatus}
          loading={loading}
        >
          刷新状态
        </Button>
      ]}
    >
      {/* 权限状态卡片 */}
      {limitStatus && (
        <Card style={{ marginBottom: 24 }}>
          <Row gutter={24}>
            <Col span={6}>
              <Statistic
                title="权限等级"
                value={limitStatus.roleName}
                prefix={roleConfig && <span style={{ fontSize: 16 }}>{roleConfig.icon}</span>}
                valueStyle={{ color: roleConfig?.color }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="每日限制"
                value={limitStatus.totalLimit}
                suffix={limitStatus.totalLimit !== '无限制' ? '个' : ''}
                valueStyle={{ 
                  color: limitStatus.totalLimit === '无限制' ? '#52c41a' : '#1890ff' 
                }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="已使用"
                value={limitStatus.usedCount}
                suffix={limitStatus.totalLimit !== '无限制' ? `/${limitStatus.totalLimit}` : ''}
                valueStyle={{ color: getProgressColor() }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="剩余次数"
                value={remainingStatus.text}
                valueStyle={{ 
                  color: remainingStatus.type === 'error' ? '#ff4d4f' : 
                         remainingStatus.type === 'warning' ? '#faad14' : '#52c41a'
                }}
              />
            </Col>
          </Row>
          
          {/* 进度条 */}
          {limitStatus.totalLimit !== '无限制' && (
            <div style={{ marginTop: 16 }}>
              <div style={{ marginBottom: 8 }}>
                <Text strong>今日使用进度</Text>
                <Text type="secondary" style={{ float: 'right' }}>
                  {limitStatus.resetTime}
                </Text>
              </div>
              <Progress
                percent={Math.round((limitStatus.usedCount / (limitStatus.totalLimit as number)) * 100)}
                strokeColor={getProgressColor()}
                showInfo={true}
                format={(percent) => `${limitStatus.usedCount}/${limitStatus.totalLimit}`}
              />
            </div>
          )}
          
          {/* 状态提醒 */}
          {!limitStatus.canApply && (
            <Alert
              style={{ marginTop: 16 }}
              message="今日申请次数已达上限"
              description={`您的${limitStatus.roleName}每日只能申请${limitStatus.totalLimit}个视频下载权限，${limitStatus.resetTime}重置。`}
              type="warning"
              icon={<WarningOutlined />}
              showIcon
            />
          )}
          
          {limitStatus.canApply && limitStatus.totalLimit !== '无限制' && limitStatus.remaining <= 2 && (
            <Alert
              style={{ marginTop: 16 }}
              message="申请次数即将用完"
              description={`您今日还可以申请${limitStatus.remaining}个视频下载权限，请合理安排使用。`}
              type="info"
              icon={<ExclamationCircleOutlined />}
              showIcon
            />
          )}
        </Card>
      )}
      
      {/* 视频列表 */}
      <Card>
        <AvailableVideos 
          onRequestPermission={(video) => {
            message.success(`已申请 ${video.title} 的下载权限`);
            // 刷新权限状态
            fetchDailyLimitStatus();
          }}
        />
      </Card>
      
      {/* 权限说明模态框 */}
      <Modal
        title={
          <Space>
            <CrownOutlined />
            <span>权限等级说明</span>
          </Space>
        }
        open={helpModalVisible}
        onCancel={() => setHelpModalVisible(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setHelpModalVisible(false)}>
            我知道了
          </Button>
        ]}
        width={700}
      >
        <div style={{ marginBottom: 24 }}>
          <Alert
            message="权限规则"
            description="每个用户根据权限等级享有不同的每日下载申请限制，自己上传或处理的视频不受此限制。"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
        </div>
        
        <Descriptions title="权限等级详情" bordered column={1}>
          <Descriptions.Item 
            label={
              <Space>
                <span>👤</span>
                <Badge status="processing" text="1级权限 - 普通用户" />
              </Space>
            }
          >
            <div>
              <div><Text strong>每日限制：</Text>1个视频</div>
              <div><Text type="secondary">适合偶尔下载视频的普通用户</Text></div>
            </div>
          </Descriptions.Item>
          
          <Descriptions.Item 
            label={
              <Space>
                <span>⭐</span>
                <Badge status="success" text="2级权限 - 高级用户" />
              </Space>
            }
          >
            <div>
              <div><Text strong>每日限制：</Text>10个视频</div>
              <div><Text type="secondary">适合经常使用下载功能的活跃用户</Text></div>
            </div>
          </Descriptions.Item>
          
          <Descriptions.Item 
            label={
              <Space>
                <span>💎</span>
                <Badge status="warning" text="3级权限 - VIP用户" />
              </Space>
            }
          >
            <div>
              <div><Text strong>每日限制：</Text>100个视频</div>
              <div><Text type="secondary">适合大量下载需求的VIP用户</Text></div>
            </div>
          </Descriptions.Item>
          
          <Descriptions.Item 
            label={
              <Space>
                <span>👑</span>
                <Badge status="error" text="4级权限 - 管理员" />
              </Space>
            }
          >
            <div>
              <div><Text strong>每日限制：</Text><Text type="success">无限制</Text></div>
              <div><Text type="secondary">管理员和超级管理员享有无限制权限</Text></div>
            </div>
          </Descriptions.Item>
        </Descriptions>
        
        <div style={{ marginTop: 24 }}>
          <Alert
            message="特殊规则"
            description={
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                <li>申请自己上传或处理的视频不计入每日限制</li>
                <li>每日00:00自动重置申请次数</li>
                <li>达到限制后需等待次日重置才能继续申请</li>
                <li>已获得权限的视频可随时下载，不受时间限制</li>
              </ul>
            }
            type="success"
            showIcon
          />
        </div>
      </Modal>
    </PageContainer>
  );
};

export default AvailableVideosPage;