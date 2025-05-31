import React from 'react';
import { PageContainer } from '@ant-design/pro-components';
import { Card, message } from 'antd';
import AvailableVideos from '../Bilibili/components/AvailableVideos';

const AvailableVideosPage: React.FC = () => {
  return (
    <PageContainer
      title="可下载视频库"
      subTitle="浏览和申请下载权限"
      content="查看所有可下载的视频资源，申请下载权限后即可下载"
    >
      <Card>
        <AvailableVideos 
          onRequestPermission={(video) => {
            message.success(`已申请 ${video.title} 的下载权限`);
            // 可以在这里添加其他逻辑，比如刷新用户视频列表
          }}
        />
      </Card>
    </PageContainer>
  );
};

export default AvailableVideosPage;