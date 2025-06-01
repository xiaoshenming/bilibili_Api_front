import React, { useState, useEffect, useRef } from 'react';
import {
  PageContainer,
  ProTable,
  ProColumns
} from '@ant-design/pro-components';
import {
  Card,
  Row,
  Col,
  Typography,
  Space,
  Button,
  Tag,
  Image,
  Modal,
  message,
  Tooltip,
  Descriptions,
  Progress,
  Input,
  Select,
  DatePicker,
  Statistic,
  Popconfirm,
  notification,
  Spin,
  Empty,
  Avatar,
  List,
  Divider
} from 'antd';
import {
  PlayCircleOutlined,
  DownloadOutlined,
  EyeOutlined,
  LikeOutlined,
  ShareAltOutlined,
  HeartOutlined,
  VideoCameraOutlined,
  CloudDownloadOutlined,
  DeleteOutlined,
  ReloadOutlined,
  FullscreenOutlined,
  SettingOutlined,
  InfoCircleOutlined,
  UserOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import { request, useModel } from '@umijs/max';
import dayjs from 'dayjs';
import { getSafeImageUrl } from '@/utils/imageProxy';
import './index.less';

const { Title, Text, Paragraph } = Typography;
const { Search } = Input;
const { Option } = Select;
const { RangePicker } = DatePicker;

interface VideoRecord {
  id: string;
  bvid: string;
  aid: string;
  title: string;
  description: string;
  duration: number;
  view_count: number;
  like_count: number;
  coin_count: number;
  share_count: number;
  reply_count: number;
  favorite_count: number;
  author: string;
  author_mid: string;
  author_face: string;
  publish_time: string;
  file_path: string;
  file_size: number;
  thumbnail_url: string;
  quality: number;
  quality_desc: string;
  download_status: 'pending' | 'downloading' | 'completed' | 'failed';
  download_progress: number;
  created_at: string;
  updated_at: string;
  bilibili_nickname: string;
  play_url?: string;
}

interface DownloadTask {
  id: string;
  fileName: string;
  progress: number;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  downloadUrl?: string;
  error?: string;
}

const VideoPlayer: React.FC = () => {
  const { initialState } = useModel('@@initialState');
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoRecord | null>(null);
  const [playerModalVisible, setPlayerModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [downloadTasks, setDownloadTasks] = useState<DownloadTask[]>([]);
  const [downloadModalVisible, setDownloadModalVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [qualityFilter, setQualityFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [statistics, setStatistics] = useState({
    total: 0,
    completed: 0,
    totalSize: 0,
    totalDuration: 0
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const downloadIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!initialState?.currentUser) {
      message.warning('请先登录系统');
      return;
    }
    fetchVideos();
  }, [initialState]);

  useEffect(() => {
    return () => {
      if (downloadIntervalRef.current) {
        clearInterval(downloadIntervalRef.current);
      }
    };
  }, []);

  const fetchVideos = async () => {
    setLoading(true);
    try {
      const result = await request('/api/video/user-list', {
        method: 'GET',
      });
      if (result.code === 200) {
        const videoList = result.data || [];
        setVideos(videoList);
        
        // 计算统计信息
        const stats = {
          total: videoList.length,
          completed: videoList.filter((v: VideoRecord) => v.download_status === 'completed').length,
          totalSize: videoList.reduce((sum: number, v: VideoRecord) => sum + (v.file_size || 0), 0),
          totalDuration: videoList.reduce((sum: number, v: VideoRecord) => sum + (parseInt(v.duration) || 0), 0)
        };
        setStatistics(stats);
      }
    } catch (error) {
      console.error('获取视频列表失败:', error);
      message.error('获取视频列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handlePlayVideo = async (video: VideoRecord) => {
    try {
      // 先生成安全下载链接
      const result = await request('/api/video/generate-download-link', {
        method: 'POST',
        data: {
          fileName: `${video.bvid}.mp4`
        }
      });
      
      if (result.code === 200) {
        // 使用返回的安全下载URL作为播放地址
        const videoWithPlayUrl = { ...video, play_url: result.data.downloadUrl };
        setSelectedVideo(videoWithPlayUrl);
        setPlayerModalVisible(true);
      } else {
        message.error(result.message || '生成播放链接失败');
      }
    } catch (error) {
      console.error('生成播放链接失败:', error);
      message.error('生成播放链接失败，请检查网络连接');
    }
  };

  const handleDownloadVideo = async (video: VideoRecord) => {
    try {
      const result = await request('/api/video/generate-download-link', {
        method: 'POST',
        data: {
          fileName: `${video.bvid}.mp4`
        }
      });
      
      if (result.code === 200) {
        const downloadTask: DownloadTask = {
          id: video.id,
          fileName: `${video.title}.mp4`,
          progress: 0,
          status: 'pending',
          downloadUrl: result.data.downloadUrl
        };
        
        setDownloadTasks(prev => [...prev, downloadTask]);
        setDownloadModalVisible(true);
        
        // 开始下载
        startDownload(downloadTask);
        
        message.success('开始下载视频');
      }
    } catch (error) {
      console.error('生成下载链接失败:', error);
      message.error('生成下载链接失败');
    }
  };

  const startDownload = (task: DownloadTask) => {
    // 创建下载链接
    const link = document.createElement('a');
    link.href = task.downloadUrl!;
    link.download = task.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // 更新任务状态
    setDownloadTasks(prev => 
      prev.map(t => 
        t.id === task.id 
          ? { ...t, status: 'completed', progress: 100 }
          : t
      )
    );
  };

  const handleDeleteVideo = async (video: VideoRecord) => {
    try {
      const result = await request(`/api/video/${video.id}`, {
        method: 'DELETE',
        params: {
          deleteFile: true
        }
      });
      
      if (result.code === 200) {
        message.success('视频删除成功');
        fetchVideos();
      }
    } catch (error) {
      console.error('删除视频失败:', error);
      message.error('删除视频失败');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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

  const getStatusTag = (status: string) => {
    const statusMap = {
      'completed': { color: 'success', text: '已完成' },
      'downloading': { color: 'processing', text: '下载中' },
      'pending': { color: 'warning', text: '等待中' },
      'failed': { color: 'error', text: '失败' }
    };
    const config = statusMap[status as keyof typeof statusMap] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const getQualityTag = (quality: number) => {
    const qualityMap: { [key: number]: { color: string; text: string } } = {
      120: { color: 'purple', text: '4K超清' },
      116: { color: 'blue', text: '1080P60' },
      112: { color: 'blue', text: '1080P+' },
      80: { color: 'green', text: '1080P' },
      74: { color: 'orange', text: '720P60' },
      64: { color: 'orange', text: '720P' },
      32: { color: 'default', text: '480P' },
      16: { color: 'default', text: '360P' }
    };
    const config = qualityMap[quality] || { color: 'default', text: `${quality}P` };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const filteredVideos = videos.filter(video => {
    const matchesSearch = !searchText || 
      video.title.toLowerCase().includes(searchText.toLowerCase()) ||
      video.name.toLowerCase().includes(searchText.toLowerCase()) ||
      video.bvid.toLowerCase().includes(searchText.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || video.download_status === statusFilter;
    const matchesQuality = qualityFilter === 'all' || video.quality.toString() === qualityFilter;
    
    const matchesDate = !dateRange || !video.pubdate || (
      dayjs(video.pubdate * 1000).isAfter(dateRange[0]) &&
      dayjs(video.pubdate * 1000).isBefore(dateRange[1])
    );
    
    return matchesSearch && matchesStatus && matchesQuality && matchesDate;
  });

  const columns: ProColumns<VideoRecord>[] = [
    {
      title: '视频信息',
      dataIndex: 'title',
      key: 'title',
      width: 400,
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Image
            src={getSafeImageUrl(record.pic)}
            alt={record.title}
            width={80}
            height={60}
            style={{ borderRadius: 4, marginRight: 12, objectFit: 'cover' }}
            fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMIAAADDCAYAAADQvc6UAAABRWlDQ1BJQ0MgUHJvZmlsZQAAKJFjYGASSSwoyGFhYGDIzSspCnJ3UoiIjFJgf8LAwSDCIMogwMCcmFxc4BgQ4ANUwgCjUcG3awyMIPqyLsis7PPOq3QdDFcvjV3jOD1boQVTPQrgSkktTgbSf4A4LbmgqISBgTEFyFYuLykAsTuAbJEioKOA7DkgdjqEvQHEToKwj4DVhAQ5A9k3gGyB5IxEoBmML4BsnSQk8XQkNtReEOBxcfXxUQg1Mjc0dyHgXNJBSWpFCYh2zi+oLMpMzyhRcASGUqqCZ16yno6CkYGRAQMDKMwhqj/fAIcloxgHQqxAjIHBEugw5sUIsSQpBobtQPdLciLEVJYzMPBHMDBsayhILEqEO4DxG0txmrERhM29nYGBddr//5/DGRjYNRkY/l7////39v///y4Dmn+LgeHANwDrkl1AuO+pmgAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAwqADAAQAAAABAAAAwwAAAAD9b/HnAAAHlklEQVR4Ae3dP3Ik1RnG4W+FgYxN"
            onError={(e) => {
              console.log('图片加载失败:', record.pic);
              console.log('代理URL:', getSafeImageUrl(record.pic));
            }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 'bold', marginBottom: 4, fontSize: 14 }}>
              {record.title}
            </div>
            <div style={{ color: '#666', fontSize: 12 }}>
              <Space size={16}>
                <span><UserOutlined /> {record.name}</span>
                <span><VideoCameraOutlined /> {record.bvid}</span>
                <span><ClockCircleOutlined /> {formatDuration(record.duration)}</span>
              </Space>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: '统计信息',
      key: 'stats',
      width: 200,
      render: (_, record) => (
        <Space direction="vertical" size={4}>
          <div><EyeOutlined /> 播放: {record.view?.toLocaleString() || 0}</div>
          <div><LikeOutlined /> 点赞: {record.like?.toLocaleString() || 0}</div>
          <div><HeartOutlined /> 收藏: {record.favorite?.toLocaleString() || 0}</div>
        </Space>
      ),
    },
    {
      title: '画质',
      dataIndex: 'quality',
      key: 'quality',
      width: 100,
      render: (quality) => getQualityTag(quality),
    },
    {
      title: '视频时长',
      dataIndex: 'duration',
      key: 'duration',
      width: 120,
      render: (duration) => duration ? formatDuration(duration) : '-',
    },
    {
      title: '状态',
      dataIndex: 'download_status',
      key: 'download_status',
      width: 100,
      render: (status) => getStatusTag(status),
    },
    {
      title: '发布时间',
      dataIndex: 'pubdate',
      key: 'pubdate',
      width: 150,
      render: (date) => date ? dayjs(date * 1000).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          <Tooltip title="在线播放">
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              size="small"
              onClick={() => handlePlayVideo(record)}
              disabled={!record.bvid}
            />
          </Tooltip>
          <Tooltip title="下载到本地">
            <Button
              icon={<DownloadOutlined />}
              size="small"
              onClick={() => handleDownloadVideo(record)}
              disabled={!record.bvid}
            />
          </Tooltip>
          <Tooltip title="查看详情">
            <Button
              icon={<InfoCircleOutlined />}
              size="small"
              onClick={() => {
                setSelectedVideo(record);
                setDetailModalVisible(true);
              }}
            />
          </Tooltip>
          <Popconfirm
            title="确定要删除这个视频吗？"
            description="删除后将无法恢复，包括服务器上的文件"
            onConfirm={() => handleDeleteVideo(record)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除视频">
              <Button
                danger
                icon={<DeleteOutlined />}
                size="small"
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <PageContainer
      title="视频播放中心"
      subTitle="在线观看和管理已解析的视频"
      extra={[
        <Button
          key="refresh"
          icon={<ReloadOutlined />}
          onClick={fetchVideos}
          loading={loading}
        >
          刷新
        </Button>,
        <Button
          key="download-manager"
          icon={<CloudDownloadOutlined />}
          onClick={() => setDownloadModalVisible(true)}
        >
          下载管理 ({downloadTasks.length})
        </Button>
      ]}
    >
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总视频数"
              value={statistics.total}
              prefix={<VideoCameraOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已完成"
              value={statistics.completed}
              prefix={<PlayCircleOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总大小"
              value={formatFileSize(statistics.totalSize)}
              prefix={<CloudDownloadOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总时长"
              value={formatDuration(statistics.totalDuration)}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 筛选工具栏 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col span={8}>
            <Search
              placeholder="搜索视频标题、作者或BVID"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col span={4}>
            <Select
              placeholder="状态筛选"
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: '100%' }}
            >
              <Option value="all">全部状态</Option>
              <Option value="completed">已完成</Option>
              <Option value="downloading">下载中</Option>
              <Option value="pending">等待中</Option>
              <Option value="failed">失败</Option>
            </Select>
          </Col>
          <Col span={4}>
            <Select
              placeholder="画质筛选"
              value={qualityFilter}
              onChange={setQualityFilter}
              style={{ width: '100%' }}
            >
              <Option value="all">全部画质</Option>
              <Option value="120">4K超清</Option>
              <Option value="80">1080P</Option>
              <Option value="64">720P</Option>
              <Option value="32">480P</Option>
            </Select>
          </Col>
          <Col span={8}>
            <RangePicker
              value={dateRange}
              onChange={setDateRange}
              style={{ width: '100%' }}
              placeholder={['开始日期', '结束日期']}
            />
          </Col>
        </Row>
      </Card>

      {/* 视频列表 */}
      <ProTable<VideoRecord>
        columns={columns}
        dataSource={filteredVideos}
        rowKey="id"
        loading={loading}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条/总共 ${total} 条`,
        }}
        search={false}
        toolBarRender={false}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无视频数据"
            >
              <Button type="primary" href="/bilibili">
                去解析视频
              </Button>
            </Empty>
          ),
        }}
      />

      {/* 视频播放模态框 */}
      <Modal
        title={selectedVideo?.title}
        open={playerModalVisible}
        onCancel={() => setPlayerModalVisible(false)}
        width={1000}
        footer={[
          <Button key="download" icon={<DownloadOutlined />} onClick={() => selectedVideo && handleDownloadVideo(selectedVideo)}>
            下载到本地
          </Button>,
          <Button key="close" onClick={() => setPlayerModalVisible(false)}>
            关闭
          </Button>
        ]}
      >
        {selectedVideo && (
          <div>
            <video
              ref={videoRef}
              controls
              width="100%"
              height="500"
              poster={selectedVideo.pic}
              style={{ borderRadius: 8 }}
            >
              <source src={selectedVideo.play_url} type="video/mp4" />
              您的浏览器不支持视频播放。
            </video>
            <div style={{ marginTop: 16 }}>
              <Descriptions column={2} size="small">
                <Descriptions.Item label="作者">{selectedVideo.name}</Descriptions.Item>
                <Descriptions.Item label="时长">{formatDuration(selectedVideo.duration)}</Descriptions.Item>
                <Descriptions.Item label="播放量">{selectedVideo.view?.toLocaleString()}</Descriptions.Item>
                <Descriptions.Item label="点赞数">{selectedVideo.like?.toLocaleString()}</Descriptions.Item>
                <Descriptions.Item label="发布时间">{selectedVideo.pubdate ? dayjs(selectedVideo.pubdate * 1000).format('YYYY-MM-DD') : '-'}</Descriptions.Item>
                <Descriptions.Item label="画质">{getQualityTag(selectedVideo.quality)}</Descriptions.Item>
              </Descriptions>
              {selectedVideo.description && (
                <div style={{ marginTop: 12 }}>
                  <Text strong>视频简介：</Text>
                  <Paragraph ellipsis={{ rows: 3, expandable: true }}>
                    {selectedVideo.description}
                  </Paragraph>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* 视频详情模态框 */}
      <Modal
        title="视频详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        width={800}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>
        ]}
      >
        {selectedVideo && (
          <div>
            <Row gutter={16}>
              <Col span={8}>
                <Image
                  src={getSafeImageUrl(selectedVideo.pic)}
                  alt={selectedVideo.title}
                  width="100%"
                  style={{ borderRadius: 8 }}
                  onError={(e) => {
                    console.log('图片加载失败:', selectedVideo.pic);
                    console.log('代理URL:', getSafeImageUrl(selectedVideo.pic));
                  }}
                />
              </Col>
              <Col span={16}>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="标题">{selectedVideo.title}</Descriptions.Item>
                  <Descriptions.Item label="BVID">{selectedVideo.bvid}</Descriptions.Item>
                  <Descriptions.Item label="AID">{selectedVideo.aid}</Descriptions.Item>
                  <Descriptions.Item label="作者">
                    <Space>
                      <Avatar src={selectedVideo.face} size="small" />
                      {selectedVideo.name}
                    </Space>
                  </Descriptions.Item>
                  <Descriptions.Item label="时长">{formatDuration(selectedVideo.duration)}</Descriptions.Item>
                  <Descriptions.Item label="画质">{getQualityTag(selectedVideo.quality)}</Descriptions.Item>
                  <Descriptions.Item label="文件大小">{formatFileSize(selectedVideo.file_size)}</Descriptions.Item>
                  <Descriptions.Item label="状态">{getStatusTag(selectedVideo.download_status)}</Descriptions.Item>
                </Descriptions>
              </Col>
            </Row>
            
            <Divider />
            
            <Row gutter={16}>
              <Col span={12}>
                <Title level={5}>播放数据</Title>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div><EyeOutlined /> 播放量: {selectedVideo.view?.toLocaleString()}</div>
                  <div><LikeOutlined /> 点赞数: {selectedVideo.like?.toLocaleString()}</div>
                  <div><HeartOutlined /> 收藏数: {selectedVideo.favorite?.toLocaleString()}</div>
                  <div><ShareAltOutlined /> 分享数: {selectedVideo.share?.toLocaleString()}</div>
                </Space>
              </Col>
              <Col span={12}>
                <Title level={5}>时间信息</Title>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div><CalendarOutlined /> 发布时间: {selectedVideo.pubdate ? dayjs(selectedVideo.pubdate * 1000).format('YYYY-MM-DD HH:mm') : '-'}</div>
                  <div><CalendarOutlined /> 解析时间: {selectedVideo.created_at ? dayjs(selectedVideo.created_at).format('YYYY-MM-DD HH:mm') : '-'}</div>
                  <div><CalendarOutlined /> 更新时间: {selectedVideo.updated_at ? dayjs(selectedVideo.updated_at).format('YYYY-MM-DD HH:mm') : '-'}</div>
                </Space>
              </Col>
            </Row>
            
            {selectedVideo.description && (
              <>
                <Divider />
                <Title level={5}>视频简介</Title>
                <Paragraph>
                  {selectedVideo.description}
                </Paragraph>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* 下载管理模态框 */}
      <Modal
        title="下载管理"
        open={downloadModalVisible}
        onCancel={() => setDownloadModalVisible(false)}
        width={600}
        footer={[
          <Button key="clear" onClick={() => setDownloadTasks([])}>
            清空列表
          </Button>,
          <Button key="close" onClick={() => setDownloadModalVisible(false)}>
            关闭
          </Button>
        ]}
      >
        <List
          dataSource={downloadTasks}
          renderItem={(task) => (
            <List.Item>
              <List.Item.Meta
                title={task.fileName}
                description={
                  <div>
                    <Progress percent={task.progress} size="small" />
                    <div style={{ marginTop: 4 }}>
                      {getStatusTag(task.status)}
                      {task.error && <Text type="danger" style={{ marginLeft: 8 }}>{task.error}</Text>}
                    </div>
                  </div>
                }
              />
            </List.Item>
          )}
          locale={{ emptyText: '暂无下载任务' }}
        />
      </Modal>
    </PageContainer>
  );
};

export default VideoPlayer;