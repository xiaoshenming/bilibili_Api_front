import React, { useState, useEffect } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { Card, Tabs, message } from 'antd';
import { 
  VideoCameraOutlined, 
  QrcodeOutlined, 
  DatabaseOutlined,
  CloudDownloadOutlined,
  FolderOpenOutlined,
  AppstoreOutlined
} from '@ant-design/icons';
import { useModel, request } from '@umijs/max';
import BilibiliLogin from './components/BilibiliLogin';
import VideoParser from './components/VideoParser';
import AccountManager from './components/AccountManager';
import AvailableVideos from './components/AvailableVideos';
import BatchProcessor from './components/BatchProcessor';
import VideoManager from './components/videomanager';

const { TabPane } = Tabs;

const BilibiliPage: React.FC = () => {
  const { initialState } = useModel('@@initialState');
  const [activeTab, setActiveTab] = useState('login');
  const [bilibiliAccounts, setBilibiliAccounts] = useState([]);
  const [refreshAccounts, setRefreshAccounts] = useState(0);

  // 检查用户是否已登录
  useEffect(() => {
    if (!initialState?.currentUser) {
      message.warning('请先登录系统');
      return;
    }
    // 如果有B站账号，默认显示视频解析页面
    fetchBilibiliAccounts();
  }, [initialState, refreshAccounts]);

  const fetchBilibiliAccounts = async () => {
    try {
      const result = await request('/api/bilibili/accounts', {
        method: 'GET',
      });
      if (result.code === 200) {
        setBilibiliAccounts(result.data || []);
        // 如果有账号且当前在登录页面，自动切换到解析页面
        if (result.data?.length > 0 && activeTab === 'login') {
          setActiveTab('parser');
        }
      }
    } catch (error) {
      console.error('获取B站账号失败:', error);
    }
  };

  const handleLoginSuccess = () => {
    setRefreshAccounts(prev => prev + 1);
    setActiveTab('parser');
    message.success('B站账号登录成功！');
  };

  const tabItems = [
    {
      key: 'login',
      label: (
        <span>
          <QrcodeOutlined />
          扫码登录
        </span>
      ),
      children: (
        <BilibiliLogin 
          onLoginSuccess={handleLoginSuccess}
          accounts={bilibiliAccounts}
        />
      ),
    },
    {
      key: 'parser',
      label: (
        <span>
          <VideoCameraOutlined />
          视频解析
        </span>
      ),
      children: (
        <VideoParser 
          accounts={bilibiliAccounts}
        />
      ),
    },
    {
      key: 'available',
      label: (
        <span>
          <DatabaseOutlined />
          可下载视频库
        </span>
      ),
      children: (
        <AvailableVideos 
          onRequestPermission={(video) => {
            message.success(`已申请 ${video.title} 的下载权限`);
            // 可以在这里添加其他逻辑，比如刷新用户视频列表
          }}
        />
      ),
    },
    {
      key: 'batch',
      label: (
        <span>
          <CloudDownloadOutlined />
          批量处理
        </span>
      ),
      children: (
        <BatchProcessor 
          onProcessComplete={(results) => {
            message.success(`批量处理完成：成功 ${results.success.length} 个，失败 ${results.failed.length} 个`);
            // 处理完成后可以刷新视频列表
          }}
        />
      ),
    },
    {
      key: 'manager',
      label: (
        <span>
          <FolderOpenOutlined />
          我的视频
        </span>
      ),
      children: (
        <VideoManager 
          accounts={bilibiliAccounts}
        />
      ),
    },
    {
      key: 'accounts',
      label: (
        <span>
          <AppstoreOutlined />
          账号管理
        </span>
      ),
      children: (
        <AccountManager 
          accounts={bilibiliAccounts}
          onAccountChange={() => setRefreshAccounts(prev => prev + 1)}
        />
      ),
    },
  ];

  return (
    <PageContainer
      title="哔哩哔哩视频解析"
      subTitle="登录您的B站账号，解析并下载视频"
      content="支持解析B站视频的详细信息和下载链接，需要先登录B站账号"
    >
      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          size="large"
        />
      </Card>
    </PageContainer>
  );
};

export default BilibiliPage;