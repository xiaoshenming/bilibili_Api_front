import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Input, 
  Button, 
  Row, 
  Col, 
  Typography, 
  Space, 
  Alert, 
  Spin, 
  Image, 
  Tag, 
  Descriptions, 
  message, 
  Modal,
  Select,
  Progress,
  List,
  Checkbox,
  Divider,
  Tabs,
  Upload,
  notification,
  Empty
} from 'antd';

const { TextArea } = Input;
const { TabPane } = Tabs;
import { 
  SearchOutlined, 
  DownloadOutlined, 
  PlayCircleOutlined, 
  EyeOutlined, 
  LikeOutlined, 
  ShareAltOutlined,
  PlusOutlined,
  DeleteOutlined,
  CloudDownloadOutlined,
  FileTextOutlined,
  SettingOutlined,
  BulbOutlined,
  StopOutlined,
  ClearOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  ClockCircleOutlined,
  UserOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { request } from '@umijs/max';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

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

interface BatchParseItem {
  id: string;
  url: string;
  status: 'pending' | 'parsing' | 'completed' | 'failed';
  videoInfo?: VideoInfo;
  error?: string;
  progress?: number;
}

interface DownloadTask {
  id: string;
  bvid: string;
  title: string;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  progress: number;
  speed?: string;
  eta?: string;
  error?: string;
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
  const [playModalVisible, setPlayModalVisible] = useState(false);
  
  // 批量解析相关状态
  const [batchUrls, setBatchUrls] = useState<string>('');
  const [batchParseItems, setBatchParseItems] = useState<BatchParseItem[]>([]);
  const [batchParsing, setBatchParsing] = useState(false);
  
  // 解析相关状态
  const [selectedQuality, setSelectedQuality] = useState<number>(80);
  const [activeTab, setActiveTab] = useState('single');

  const activeAccount = accounts.find(acc => acc.is_active);
  
  // 质量选项
  const qualityOptions = [
    { value: 120, label: '4K 超清 (120)' },
    { value: 116, label: '1080P60 高清 (116)' },
    { value: 112, label: '1080P+ 高清 (112)' },
    { value: 80, label: '1080P 高清 (80)' },
    { value: 74, label: '720P60 高清 (74)' },
    { value: 64, label: '720P 高清 (64)' },
    { value: 32, label: '480P 清晰 (32)' },
    { value: 16, label: '360P 流畅 (16)' }
  ];
  


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
      // 使用后端提供的解析接口
      const result = await request('/api/video/parse', {
        method: 'POST',
        data: {
          url: inputUrl,
          quality: selectedQuality
        }
      });
      
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
  
  // 批量解析视频
  const batchParseVideos = async () => {
    if (!batchUrls.trim()) {
      message.warning('请输入视频链接');
      return;
    }
    
    if (!activeAccount) {
      message.warning('请先登录B站账号');
      return;
    }
    
    const urls = batchUrls.split('\n').filter(url => url.trim());
    if (urls.length === 0) {
      message.warning('请输入有效的视频链接');
      return;
    }
    
    if (urls.length > 20) {
      message.warning('批量解析最多支持20个视频');
      return;
    }
    
    setBatchParsing(true);
    const items: BatchParseItem[] = urls.map((url, index) => ({
      id: `batch_${Date.now()}_${index}`,
      url: url.trim(),
      status: 'pending'
    }));
    
    setBatchParseItems(items);
    
    // 逐个解析视频
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // 更新状态为解析中
      setBatchParseItems(prev => 
        prev.map(p => p.id === item.id ? { ...p, status: 'parsing' } : p)
      );
      
      try {
        const result = await request('/api/video/parse', {
          method: 'POST',
          data: {
            url: item.url,
            quality: selectedQuality
          }
        });
        
        if (result.code === 200) {
          setBatchParseItems(prev => 
            prev.map(p => p.id === item.id ? { 
              ...p, 
              status: 'completed', 
              videoInfo: result.data 
            } : p)
          );
        } else {
          setBatchParseItems(prev => 
            prev.map(p => p.id === item.id ? { 
              ...p, 
              status: 'failed', 
              error: result.message || '解析失败' 
            } : p)
          );
        }
      } catch (error) {
        setBatchParseItems(prev => 
          prev.map(p => p.id === item.id ? { 
            ...p, 
            status: 'failed', 
            error: '网络错误' 
          } : p)
        );
      }
      
      // 添加延迟避免请求过快
      if (i < items.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    setBatchParsing(false);
    notification.success({
      message: '批量解析完成',
      description: `成功解析 ${items.filter(item => item.status === 'completed').length} 个视频`
    });
  };
  
  // 处理视频（解析并保存到数据库）
  const processVideo = async (video: VideoInfo) => {
    try {
      const result = await request('/api/video/process', {
        method: 'POST',
        data: {
          url: video.bvid,
          quality: selectedQuality
        }
      });
      
      if (result.code === 201) {
        message.success(`视频已保存到数据库: ${video.title}`);
      } else {
        message.error(result.message || '保存失败');
      }
    } catch (error) {
      message.error('网络错误，请重试');
    }
  };
  
  // 清空批量解析结果
  const clearBatchResults = () => {
    setBatchParseItems([]);
    setBatchUrls('');
  };
  
  // 批量保存选中的视频
  const batchProcessSelected = () => {
    const selectedItems = batchParseItems.filter(item => 
      item.status === 'completed' && item.videoInfo
    );
    
    if (selectedItems.length === 0) {
      message.warning('没有可保存的视频');
      return;
    }
    
    selectedItems.forEach(item => {
      if (item.videoInfo) {
        processVideo(item.videoInfo);
      }
    });
    
    message.success(`已保存 ${selectedItems.length} 个视频到数据库`);
  };

  const getDownloadUrls = async () => {
    if (!videoInfo) return;

    // 直接使用解析时获取的下载链接
    if (videoInfo.videoUrl && videoInfo.audioUrl) {
      setDownloadUrls({
        videoUrl: videoInfo.videoUrl,
        audioUrl: videoInfo.audioUrl
      });
      setDownloadModalVisible(true);
    } else {
      message.error('视频下载链接不可用，请重新解析');
    }
  };

  // 在线播放视频
  const playVideo = () => {
    if (!videoInfo) {
      message.warning('请先解析视频');
      return;
    }
    setPlayModalVisible(true);
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

      <Tabs activeKey={activeTab} onChange={setActiveTab} style={{ marginBottom: 24 }}>
        <TabPane tab="单个解析" key="single">
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
                <Space>
                  <Button 
                    type="primary" 
                    icon={<PlayCircleOutlined />}
                    onClick={playVideo}
                  >
                    在线播放
                  </Button>
                  <Button 
                    icon={<DownloadOutlined />}
                    onClick={getDownloadUrls}
                  >
                    获取下载链接
                  </Button>
                  <Button 
                    icon={<CloudDownloadOutlined />}
                    onClick={() => processVideo(videoInfo)}
                  >
                    保存到数据库
                  </Button>
                </Space>
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
        </TabPane>
        
        <TabPane tab="批量解析" key="batch">
          <Card title="批量视频解析" style={{ marginBottom: 24 }}>
            <div style={{ marginBottom: 16 }}>
              <TextArea
                placeholder="请输入B站视频链接，每行一个\n支持BV号、av号或完整链接\n最多支持20个视频"
                value={batchUrls}
                onChange={(e) => setBatchUrls(e.target.value)}
                rows={6}
                style={{ marginBottom: 8 }}
              />
              <Space>
                <Button 
                  type="primary" 
                  onClick={batchParseVideos}
                  loading={batchParsing}
                  icon={<PlayCircleOutlined />}
                >
                  开始批量解析
                </Button>
                <Button onClick={clearBatchResults} icon={<DeleteOutlined />}>
                  清空结果
                </Button>
                <Button 
                  onClick={batchProcessSelected}
                  icon={<CloudDownloadOutlined />}
                  disabled={batchParseItems.filter(item => item.status === 'completed').length === 0}
                >
                  批量保存
                </Button>
              </Space>
            </div>
            
            {batchParseItems.length > 0 && (
              <Card title="解析结果" style={{ marginTop: 16 }}>
                <List
                  dataSource={batchParseItems}
                  renderItem={(item) => (
                    <List.Item>
                      <div style={{ width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <Text ellipsis style={{ flex: 1, marginRight: 8, fontSize: 12, color: '#666' }}>{item.url}</Text>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {item.status === 'pending' && <Tag color="default">等待中</Tag>}
                            {item.status === 'parsing' && <Tag color="processing">解析中</Tag>}
                            {item.status === 'completed' && <Tag color="success">完成</Tag>}
                            {item.status === 'failed' && <Tag color="error">失败</Tag>}
                          </div>
                        </div>
                        
                        {item.status === 'completed' && item.videoInfo && (
                          <div style={{ display: 'flex', gap: 12, padding: 12, backgroundColor: '#f5f5f5', borderRadius: 6 }}>
                            <Image
                              src={item.videoInfo.pic} 
                              alt={item.videoInfo.title}
                              width={80}
                              height={48}
                              style={{ borderRadius: 4, objectFit: 'cover' }}
                            />
                            <div style={{ flex: 1 }}>
                              <Title level={5} style={{ margin: 0, marginBottom: 4, fontSize: 14 }}>{item.videoInfo.title}</Title>
                              <Text style={{ fontSize: 12, color: '#666' }}>UP主: {item.videoInfo.name}</Text>
                            </div>
                            <Space>
                              <Button 
                                size="small"
                                type="primary"
                                onClick={() => {
                                  setVideoInfo(item.videoInfo!);
                                  playVideo();
                                }}
                                icon={<PlayCircleOutlined />}
                              >
                                播放
                              </Button>
                              <Button 
                                size="small"
                                onClick={() => processVideo(item.videoInfo!)}
                                icon={<CloudDownloadOutlined />}
                              >
                                保存
                              </Button>
                            </Space>
                          </div>
                        )}
                        
                        {item.status === 'failed' && (
                          <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 4 }}>
                            错误: {item.error}
                          </div>
                        )}
                      </div>
                    </List.Item>
                  )}
                />
              </Card>
            )}
          </Card>
        </TabPane>
        

      </Tabs>
      



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

      {/* 播放器模态框 */}
      <Modal
        title="视频播放"
        open={playModalVisible}
        onCancel={() => setPlayModalVisible(false)}
        footer={null}
        width={900}
        centered
      >
        {videoInfo && (
          <div>
            <video
              controls
              style={{ width: '100%', maxHeight: '500px' }}
              poster={videoInfo.pic}
            >
              <source src={videoInfo.durl?.[0]?.url || videoInfo.dash?.video?.[0]?.baseUrl} type="video/mp4" />
              您的浏览器不支持视频播放。
            </video>
            
            <div style={{ marginTop: 16 }}>
              <Title level={4}>{videoInfo.title}</Title>
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Text><UserOutlined /> UP主: {videoInfo.name}</Text>
                <Text><ClockCircleOutlined /> 时长: {formatDuration(videoInfo.duration)}</Text>
                <Text><EyeOutlined /> 播放量: {formatNumber(videoInfo.view)}</Text>
                <Text><CalendarOutlined /> 发布时间: {formatDate(videoInfo.pubdate)}</Text>
              </Space>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default VideoParser;