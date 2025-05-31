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
  ClockCircleOutlined
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
  const [parseModalVisible, setParseModalVisible] = useState(false);
  const [downloadModalVisible, setDownloadModalVisible] = useState(false);
  const [downloadUrls, setDownloadUrls] = useState<{videoUrl: string, audioUrl: string} | null>(null);
  
  // 批量解析相关状态
  const [batchUrls, setBatchUrls] = useState<string>('');
  const [batchParseItems, setBatchParseItems] = useState<BatchParseItem[]>([]);
  const [batchParsing, setBatchParsing] = useState(false);
  
  // 下载相关状态
  const [parseTasks, setParseTasks] = useState<DownloadTask[]>([]);
  const [selectedQuality, setSelectedQuality] = useState<number>(80);
  const [downloadMode, setDownloadMode] = useState<string>('auto');
  const [autoDownload, setAutoDownload] = useState(false);
  
  // 设置相关状态
  const [settingsVisible, setSettingsVisible] = useState(false);
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
  
  // 下载模式选项
  const downloadModeOptions = [
    { value: 'auto', label: '自动选择' },
    { value: 'video_audio', label: '视频+音频分离' },
    { value: 'video_only', label: '仅视频' },
    { value: 'audio_only', label: '仅音频' }
  ];
  
  useEffect(() => {
    // 定期检查解析任务状态
    const interval = setInterval(() => {
      if (parseTasks.some(task => task.status === 'downloading')) {
        checkDownloadProgress();
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [parseTasks]);

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
      const result = await request('/api/video/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          url: inputUrl.trim(),
          quality: selectedQuality
        }
      });
      
      if (result.code === 200) {
        setVideoInfo(result.data);
        message.success('视频解析成功！');
        
        // 如果开启自动下载，直接开始下载
        if (autoDownload) {
          startDownload(result.data);
        }
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
          headers: {
            'Content-Type': 'application/json',
          },
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
          
          // 如果开启自动下载，直接开始下载
          if (autoDownload) {
            startDownload(result.data);
          }
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
  
  // 开始下载视频
  const startDownload = async (video: VideoInfo) => {
    const taskId = `download_${Date.now()}`;
    const newTask: DownloadTask = {
      id: taskId,
      bvid: video.bvid,
      title: video.title,
      status: 'pending',
      progress: 0
    };
    
    setParseTasks(prev => [...prev, newTask]);
    
    try {
      const result = await request('/api/video/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          url: `https://www.bilibili.com/video/${video.bvid}`,
          quality: selectedQuality,
          downloadMode: downloadMode
        }
      });
      
      if (result.code === 200 || result.code === 201) {
        setParseTasks(prev => 
          prev.map(task => task.id === taskId ? { 
            ...task, 
            status: 'completed' 
          } : task)
        );
        
        message.success(`视频处理成功: ${video.title}`);
        notification.success({
          message: '视频处理完成',
          description: `${video.title} 已成功下载并入库`
        });
      } else {
        setParseTasks(prev => 
          prev.map(task => task.id === taskId ? { 
            ...task, 
            status: 'failed',
            error: result.message || '处理失败'
          } : task)
        );
        message.error(result.message || '视频处理失败');
      }
    } catch (error) {
      setParseTasks(prev => 
        prev.map(task => task.id === taskId ? { 
          ...task, 
          status: 'failed',
          error: '网络错误'
        } : task)
      );
      message.error('网络错误，请重试');
    }
  };
  
  // 检查解析进度
  const checkDownloadProgress = async () => {
    const downloadingTasks = parseTasks.filter(task => task.status === 'downloading');
    
    for (const task of downloadingTasks) {
      try {
        // 这里应该调用后端API获取解析进度
        // 暂时模拟进度更新
        const progress = Math.min(task.progress + Math.random() * 10, 100);
        
        setParseTasks(prev => 
          prev.map(t => t.id === task.id ? { 
            ...t, 
            progress,
            status: progress >= 100 ? 'completed' : 'downloading'
          } : t)
        );
        
        if (progress >= 100) {
          notification.success({
            message: '解析完成',
            description: task.title
          });
        }
      } catch (error) {
        console.error('检查解析进度失败:', error);
      }
    }
  };
  
  // 取消解析任务
  const cancelDownload = (taskId: string) => {
    setParseTasks(prev => prev.filter(task => task.id !== taskId));
    message.info('已取消解析任务');
  };
  
  // 清空批量解析结果
  const clearBatchResults = () => {
    setBatchParseItems([]);
    setBatchUrls('');
  };
  
  // 批量下载选中的视频
  const batchDownloadSelected = () => {
    const selectedItems = batchParseItems.filter(item => 
      item.status === 'completed' && item.videoInfo
    );
    
    if (selectedItems.length === 0) {
      message.warning('没有可下载的视频');
      return;
    }
    
    selectedItems.forEach(item => {
      if (item.videoInfo) {
        startDownload(item.videoInfo);
      }
    });
    
    message.success(`已添加 ${selectedItems.length} 个下载任务`);
  };

  const getDownloadUrls = async () => {
    if (!videoInfo) return;

    setLoading(true);
    try {
      const result = await request(
        `/api/bilibili/download?bvid=${videoInfo.bvid}&cid=${videoInfo.cid}&quality=80`,
        {
          method: 'GET',
        }
      );
      
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
    if (seconds === undefined || seconds === null || isNaN(seconds)) {
      return '00:00';
    }
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatNumber = (num: number) => {
    if (num === undefined || num === null || isNaN(num)) {
      return '0';
    }
    if (num >= 10000) {
      return `${(num / 10000).toFixed(1)}万`;
    }
    return num.toString();
  };

  const formatDate = (timestamp: number) => {
    if (timestamp === undefined || timestamp === null || isNaN(timestamp)) {
      return '未知时间';
    }
    // pubdate是以秒为单位的时间戳，需要转换为毫秒
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
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
          <Card 
            title={
              <Space>
                <span>单视频解析</span>
                <Tag color="blue">单线程模式</Tag>
              </Space>
            } 
            style={{ marginBottom: 24 }}
          >
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
                支持格式：完整链接、BV号。单线程模式，逐个解析视频，适合精确处理单个视频。
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
                    icon={<DownloadOutlined />}
                    onClick={getDownloadUrls}
                    loading={loading}
                  >
                    获取下载链接
                  </Button>
                  <Button 
                    icon={<CloudDownloadOutlined />}
                    onClick={() => startDownload(videoInfo)}
                  >
                    直接下载
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
                  onClick={batchDownloadSelected}
                  icon={<DownloadOutlined />}
                  disabled={batchParseItems.filter(item => item.status === 'completed').length === 0}
                >
                  批量下载
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
                            <Button 
                              size="small"
                              onClick={() => startDownload(item.videoInfo!)}
                              icon={<DownloadOutlined />}
                            >
                              下载
                            </Button>
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
        
        <TabPane tab="解析管理" key="downloads">
          <Card title="解析任务管理" style={{ marginBottom: 24 }}>
            {parseTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#666' }}>
                <CloudDownloadOutlined style={{ fontSize: 48, marginBottom: 8 }} />
                <div>暂无下载任务</div>
              </div>
            ) : (
              <List
                dataSource={parseTasks}
                renderItem={(task) => (
                  <List.Item>
                    <div style={{ width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ flex: 1 }}>
                          <Title level={5} style={{ margin: 0 }}>{task.title}</Title>
                          <Text style={{ fontSize: 12, color: '#666' }}>BV号: {task.bvid}</Text>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {task.status === 'pending' && <Tag color="default">等待中</Tag>}
                          {task.status === 'downloading' && <Tag color="processing">下载中</Tag>}
                          {task.status === 'completed' && <Tag color="success">已完成</Tag>}
                          {task.status === 'failed' && <Tag color="error">失败</Tag>}
                          
                          {task.status === 'downloading' && (
                            <Button 
                              size="small" 
                              danger 
                              onClick={() => cancelDownload(task.id)}
                              icon={<DeleteOutlined />}
                            >
                              取消
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      {task.status === 'downloading' && (
                        <Progress 
                          percent={Math.round(task.progress)} 
                          size="small" 
                          status="active"
                        />
                      )}
                      
                      {task.status === 'failed' && task.error && (
                        <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 4 }}>
                          错误: {task.error}
                        </div>
                      )}
                    </div>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </TabPane>
      </Tabs>
      
      {/* 设置按钮 */}
      <div style={{ position: 'fixed', bottom: 24, right: 24 }}>
        <Button 
          type="primary" 
          shape="circle" 
          size="large"
          icon={<SettingOutlined />}
          onClick={() => setSettingsVisible(true)}
        />
      </div>
      
      {/* 设置模态框 */}
      <Modal
        title="下载设置"
        open={settingsVisible}
        onCancel={() => setSettingsVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setSettingsVisible(false)}>
            取消
          </Button>,
          <Button key="save" type="primary" onClick={() => setSettingsVisible(false)}>
            保存设置
          </Button>
        ]}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>默认视频质量</Text>
            <Select
              value={selectedQuality}
              onChange={setSelectedQuality}
              style={{ width: '100%' }}
              options={qualityOptions}
            />
          </div>
          
          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>下载模式</Text>
            <Select
              value={downloadMode}
              onChange={setDownloadMode}
              style={{ width: '100%' }}
              options={downloadModeOptions}
            />
          </div>
          
          <div>
            <Checkbox
              checked={autoDownload}
              onChange={(e) => setAutoDownload(e.target.checked)}
            >
              解析完成后自动开始下载
            </Checkbox>
          </div>
        </Space>
      </Modal>

      {/* 解析管理模态框 */}
      <Modal
        title="解析任务管理"
        open={parseModalVisible}
        onCancel={() => setParseModalVisible(false)}
        width={900}
        footer={[
          <Button key="clear" onClick={() => setParseTasks([])}>
            清空列表
          </Button>,
          <Button 
            key="manage" 
            type="primary"
            onClick={() => {
              setParseModalVisible(false);
              window.open('/parse-manager', '_blank');
            }}
          >
            打开解析管理中心
          </Button>,
          <Button key="close" onClick={() => setParseModalVisible(false)}>
            关闭
          </Button>
        ]}
      >
        <List
          dataSource={parseTasks}
          renderItem={(task) => (
            <List.Item
              actions={[
                task.status === 'completed' ? (
                  <Space>
                    <Button 
                      type="link" 
                      icon={<EyeOutlined />}
                      onClick={() => window.open('/video-player', '_blank')}
                    >
                      观看
                    </Button>
                    <Button type="link" icon={<CheckCircleOutlined />} style={{ color: '#52c41a' }}>
                      已完成
                    </Button>
                  </Space>
                ) : task.status === 'parsing' ? (
                  <Space>
                    <Button type="link" icon={<LoadingOutlined />} style={{ color: '#1890ff' }}>
                      解析中
                    </Button>
                    <Button type="link" icon={<DeleteOutlined />} danger>
                      取消
                    </Button>
                  </Space>
                ) : (
                  <Space>
                    <Button type="link" icon={<ClockCircleOutlined />} style={{ color: '#faad14' }}>
                      等待中
                    </Button>
                    <Button type="link" icon={<DeleteOutlined />} danger>
                      取消
                    </Button>
                  </Space>
                )
              ]}
            >
              <List.Item.Meta
                avatar={
                  <img
                    src={task.thumbnail}
                    alt={task.title}
                    style={{ width: 60, height: 40, objectFit: 'cover', borderRadius: 4 }}
                  />
                }
                title={task.title}
                description={
                  <div>
                    <div style={{ marginBottom: 4 }}>BVID: {task.bvid}</div>
                    <div style={{ marginBottom: 8 }}>画质: {getQualityText(task.quality)}</div>
                    <Progress
                      percent={Math.round(task.progress)}
                      status={
                        task.status === 'completed' ? 'success' : 
                        task.status === 'parsing' ? 'active' : 'normal'
                      }
                      size="small"
                      format={(percent) => {
                        if (task.status === 'completed') return '解析完成';
                        if (task.status === 'parsing') return `解析中 ${percent}%`;
                        return '等待解析';
                      }}
                    />
                  </div>
                }
              />
            </List.Item>
          )}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无解析任务"
              >
                <Button type="primary" onClick={() => setParseModalVisible(false)}>
                  去解析视频
                </Button>
              </Empty>
            )
          }}
        />
      </Modal>

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