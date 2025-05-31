import React, { useState } from 'react';
import { Card, Input, Button, Row, Col, Typography, Space, Alert, Spin, Image, Tag, Descriptions, message, Modal } from 'antd';
import { SearchOutlined, DownloadOutlined, PlayCircleOutlined, EyeOutlined, LikeOutlined, ShareAltOutlined } from '@ant-design/icons';
import { CopyToClipboard } from 'react-copy-to-clipboard';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface BilibiliAccount {
  id: string;
  dedeuserid: string;
  nickname: string;
  avatar: string;
  is_active: boolean;
  created_at: string;
}

interface VideoInfo {
  bvid: string;
  aid: string;
  cid: string;
  title: string;
  desc: string;
  tname: string;
  pic: string;
  duration: number;
  pubdate: number;
  name: string;
  face: string;
  view: number;
  danmaku: number;
  reply: number;
  favorite: number;
  coin: number;
  share: number;
  like: number;
  videoUrl?: string;
  audioUrl?: string;
}

interface VideoParserProps {
  accounts: BilibiliAccount[];
}

const VideoParser: React.FC<VideoParserProps> = ({ accounts }) => {
  const [inputUrl, setInputUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [downloadModalVisible, setDownloadModalVisible] = useState(false);
  const [downloadUrls, setDownloadUrls] = useState<{videoUrl: string, audioUrl: string} | null>(null);

  const activeAccount = accounts.find(acc => acc.is_active);

  const parseVideo = async () => {
    if (!inputUrl.trim()) {
      message.warning('请输入B站视频链接或BV号');
      return;
    }

    if (!activeAccount) {
      message.warning('请先登录B站账号');
      return;
    }

    setLoading(true);
    setVideoInfo(null);

    try {
      const response = await fetch(`/api/bilibili/parse-videos?input=${encodeURIComponent(inputUrl)}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      const result = await response.json();
      
      if (result.code === 200) {
        setVideoInfo(result.data);
        message.success('视频解析成功！');
      } else {
        message.error(result.message || '解析失败');
      }
    } catch (error) {
      message.error('网络错误，请重试');
      console.error('解析视频失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDownloadUrls = async () => {
    if (!videoInfo) return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/bilibili/download?bvid=${videoInfo.bvid}&cid=${videoInfo.cid}&quality=80`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      const result = await response.json();
      
      if (result.code === 200) {
        setDownloadUrls({
          videoUrl: result.data.videoUrl,
          audioUrl: result.data.audioUrl
        });
        setDownloadModalVisible(true);
      } else {
        message.error(result.message || '获取下载链接失败');
      }
    } catch (error) {
      message.error('网络错误，请重试');
      console.error('获取下载链接失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatNumber = (num: number) => {
    if (num >= 10000) {
      return `${(num / 10000).toFixed(1)}万`;
    }
    return num.toString();
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('zh-CN');
  };

  return (
    <div>
      {/* 当前使用账号 */}
      {activeAccount && (
        <Alert
          message={`当前使用账号: ${activeAccount.nickname}`}
          type="success"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      {!activeAccount && (
        <Alert
          message="请先在扫码登录页面登录B站账号"
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      {/* 输入区域 */}
      <Card title="视频解析" style={{ marginBottom: 24 }}>
        <Space.Compact style={{ width: '100%' }}>
          <Input
            placeholder="请输入B站视频链接或BV号，例如：https://www.bilibili.com/video/BV1xx411c7mD 或 BV1xx411c7mD"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            onPressEnter={parseVideo}
            size="large"
          />
          <Button 
            type="primary" 
            icon={<SearchOutlined />}
            onClick={parseVideo}
            loading={loading}
            disabled={!activeAccount}
            size="large"
          >
            解析
          </Button>
        </Space.Compact>
        
        <div style={{ marginTop: 16 }}>
          <Text type="secondary">
            支持格式：完整链接、BV号。解析后可获取视频详细信息和下载链接。
          </Text>
        </div>
      </Card>

      {/* 加载状态 */}
      {loading && (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>
              <Text>正在解析视频信息...</Text>
            </div>
          </div>
        </Card>
      )}

      {/* 视频信息展示 */}
      {videoInfo && (
        <Card 
          title="视频信息" 
          extra={
            <Button 
              type="primary" 
              icon={<DownloadOutlined />}
              onClick={getDownloadUrls}
              loading={loading}
            >
              获取下载链接
            </Button>
          }
        >
          <Row gutter={24}>
            <Col xs={24} md={8}>
              <Image
                src={videoInfo.pic}
                alt={videoInfo.title}
                style={{ width: '100%', borderRadius: 8 }}
                placeholder={
                  <div style={{ 
                    height: 200, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    backgroundColor: '#f5f5f5'
                  }}>
                    <PlayCircleOutlined style={{ fontSize: 48, color: '#ccc' }} />
                  </div>
                }
              />
            </Col>
            
            <Col xs={24} md={16}>
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <div>
                  <Title level={3} style={{ margin: 0 }}>
                    {videoInfo.title}
                  </Title>
                  <div style={{ marginTop: 8 }}>
                    <Tag color="blue">{videoInfo.tname}</Tag>
                    <Tag color="green">时长: {formatDuration(videoInfo.duration)}</Tag>
                    <Tag color="orange">发布: {formatDate(videoInfo.pubdate)}</Tag>
                  </div>
                </div>

                <Descriptions column={2} size="small">
                  <Descriptions.Item label="UP主">{videoInfo.name}</Descriptions.Item>
                  <Descriptions.Item label="BV号">{videoInfo.bvid}</Descriptions.Item>
                  <Descriptions.Item label={<><EyeOutlined /> 播放</>}>
                    {formatNumber(videoInfo.view)}
                  </Descriptions.Item>
                  <Descriptions.Item label={<><LikeOutlined /> 点赞</>}>
                    {formatNumber(videoInfo.like)}
                  </Descriptions.Item>
                  <Descriptions.Item label="弹幕">
                    {formatNumber(videoInfo.danmaku)}
                  </Descriptions.Item>
                  <Descriptions.Item label="收藏">
                    {formatNumber(videoInfo.favorite)}
                  </Descriptions.Item>
                  <Descriptions.Item label="投币">
                    {formatNumber(videoInfo.coin)}
                  </Descriptions.Item>
                  <Descriptions.Item label={<><ShareAltOutlined /> 分享</>}>
                    {formatNumber(videoInfo.share)}
                  </Descriptions.Item>
                </Descriptions>

                {videoInfo.desc && (
                  <div>
                    <Text strong>简介：</Text>
                    <Paragraph 
                      ellipsis={{ rows: 3, expandable: true, symbol: '展开' }}
                      style={{ marginTop: 8 }}
                    >
                      {videoInfo.desc}
                    </Paragraph>
                  </div>
                )}
              </Space>
            </Col>
          </Row>
        </Card>
      )}

      {/* 下载链接模态框 */}
      <Modal
        title="下载链接"
        open={downloadModalVisible}
        onCancel={() => setDownloadModalVisible(false)}
        footer={null}
        width={800}
      >
        {downloadUrls && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Alert
              message="下载说明"
              description="视频和音频是分离的，需要分别下载后使用工具合并。链接有时效性，请及时下载。"
              type="info"
              showIcon
            />
            
            <Card title="视频链接" size="small">
              <TextArea 
                value={downloadUrls.videoUrl}
                rows={3}
                readOnly
                style={{ marginBottom: 8 }}
              />
              <CopyToClipboard 
                text={downloadUrls.videoUrl}
                onCopy={() => message.success('视频链接已复制到剪贴板')}
              >
                <Button type="primary" block>
                  复制视频链接
                </Button>
              </CopyToClipboard>
            </Card>
            
            <Card title="音频链接" size="small">
              <TextArea 
                value={downloadUrls.audioUrl}
                rows={3}
                readOnly
                style={{ marginBottom: 8 }}
              />
              <CopyToClipboard 
                text={downloadUrls.audioUrl}
                onCopy={() => message.success('音频链接已复制到剪贴板')}
              >
                <Button type="primary" block>
                  复制音频链接
                </Button>
              </CopyToClipboard>
            </Card>
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default VideoParser;