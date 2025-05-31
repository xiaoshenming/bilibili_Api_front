import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Table, 
  Button, 
  Space, 
  Typography, 
  Tag, 
  Image, 
  Modal, 
  Progress, 
  message, 
  Popconfirm,
  Input,
  Select,
  DatePicker,
  Row,
  Col,
  Statistic,
  Tooltip,
  Descriptions
} from 'antd';
import { 
  PlayCircleOutlined, 
  DownloadOutlined, 
  DeleteOutlined, 
  EyeOutlined,
  SearchOutlined,
  ReloadOutlined,
  FolderOpenOutlined,
  CloudDownloadOutlined,
  VideoCameraOutlined,
  LikeOutlined,
  ShareAltOutlined,
  HeartOutlined
} from '@ant-design/icons';
import { request } from '@umijs/max';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
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
}

interface VideoManagerProps {
  accounts: any[];
}

const VideoManager: React.FC<VideoManagerProps> = ({ accounts }) => {
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoRecord | null>(null);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [statistics, setStatistics] = useState({
    total: 0,
    completed: 0,
    downloading: 0,
    failed: 0,
    totalSize: 0
  });

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    setLoading(true);
    try {
      const result = await request('/api/video/user-list', {
        method: 'GET',
      });
      
      if (result.code === 200) {
        setVideos(result.data);
        calculateStatistics(result.data);
      } else {
        message.error(result.message || '获取视频列表失败');
      }
    } catch (error) {
      message.error('网络错误，请重试');
      console.error('获取视频列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStatistics = (videoList: VideoRecord[]) => {
    const stats = {
      total: videoList.length,
      completed: videoList.filter(v => v.download_status === 'completed').length,
      downloading: videoList.filter(v => v.download_status === 'downloading').length,
      failed: videoList.filter(v => v.download_status === 'failed').length,
      totalSize: videoList.reduce((sum, v) => sum + (v.file_size || 0), 0)
    };
    setStatistics(stats);
  };

  const deleteVideo = async (videoId: string, deleteFile: boolean = false) => {
    try {
      const result = await request(`/api/video/${videoId}?deleteFile=${deleteFile}`, {
        method: 'DELETE',
      });
      
      if (result.code === 200) {
        message.success('视频删除成功');
        fetchVideos();
      } else {
        message.error(result.message || '删除失败');
      }
    } catch (error) {
      message.error('网络错误，请重试');
      console.error('删除视频失败:', error);
    }
  };

  const batchDelete = async (deleteFile: boolean = false) => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要删除的视频');
      return;
    }

    try {
      const promises = selectedRowKeys.map(id => 
        request(`/api/video/${id}?deleteFile=${deleteFile}`, {
          method: 'DELETE',
        })
      );
      
      await Promise.all(promises);
      message.success(`成功删除 ${selectedRowKeys.length} 个视频`);
      setSelectedRowKeys([]);
      fetchVideos();
    } catch (error) {
      message.error('批量删除失败');
      console.error('批量删除失败:', error);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
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

  const formatNumber = (num: number) => {
    if (num >= 10000) {
      return `${(num / 10000).toFixed(1)}万`;
    }
    return num.toString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'downloading': return 'processing';
      case 'failed': return 'error';
      case 'pending': return 'warning';
      default: return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return '已完成';
      case 'downloading': return '下载中';
      case 'failed': return '失败';
      case 'pending': return '等待中';
      default: return '未知';
    }
  };

  const filteredVideos = videos.filter(video => {
    const matchesSearch = !searchText || 
      video.title.toLowerCase().includes(searchText.toLowerCase()) ||
      video.author.toLowerCase().includes(searchText.toLowerCase()) ||
      video.bvid.toLowerCase().includes(searchText.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || video.download_status === statusFilter;
    
    const matchesDate = !dateRange || (
      dayjs(video.created_at).isAfter(dateRange[0]) && 
      dayjs(video.created_at).isBefore(dateRange[1])
    );
    
    return matchesSearch && matchesStatus && matchesDate;
  });

  const columns: ColumnsType<VideoRecord> = [
    {
      title: '视频信息',
      key: 'video_info',
      width: 300,
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Image
            src={record.thumbnail_url}
            alt={record.title}
            width={80}
            height={60}
            style={{ borderRadius: 4, marginRight: 12 }}
            placeholder={<div style={{ width: 80, height: 60, backgroundColor: '#f5f5f5', borderRadius: 4 }} />}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Tooltip title={record.title}>
              <Text strong style={{ display: 'block', marginBottom: 4 }} ellipsis>
                {record.title}
              </Text>
            </Tooltip>
            <Space size={4}>
              <Tag color="blue">{record.bvid}</Tag>
              <Tag color="green">{formatDuration(record.duration)}</Tag>
              <Tag color="orange">{record.quality_desc}</Tag>
            </Space>
          </div>
        </div>
      ),
    },
    {
      title: 'UP主',
      dataIndex: 'author',
      key: 'author',
      width: 120,
      render: (author, record) => (
        <Space>
          <Image
            src={record.author_face}
            alt={author}
            width={24}
            height={24}
            style={{ borderRadius: '50%' }}
            placeholder={<div style={{ width: 24, height: 24, backgroundColor: '#f5f5f5', borderRadius: '50%' }} />}
          />
          <Text>{author}</Text>
        </Space>
      ),
    },
    {
      title: '数据统计',
      key: 'stats',
      width: 150,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Space size={8}>
            <EyeOutlined style={{ color: '#1890ff' }} />
            <Text style={{ fontSize: 12 }}>{formatNumber(record.view_count)}</Text>
            <LikeOutlined style={{ color: '#f5222d' }} />
            <Text style={{ fontSize: 12 }}>{formatNumber(record.like_count)}</Text>
          </Space>
          <Space size={8}>
            <HeartOutlined style={{ color: '#fa8c16' }} />
            <Text style={{ fontSize: 12 }}>{formatNumber(record.favorite_count)}</Text>
            <ShareAltOutlined style={{ color: '#52c41a' }} />
            <Text style={{ fontSize: 12 }}>{formatNumber(record.share_count)}</Text>
          </Space>
        </Space>
      ),
    },
    {
      title: '下载状态',
      key: 'download_status',
      width: 120,
      render: (_, record) => (
        <Space direction="vertical" size={4}>
          <Tag color={getStatusColor(record.download_status)}>
            {getStatusText(record.download_status)}
          </Tag>
          {record.download_status === 'downloading' && (
            <Progress 
              percent={record.download_progress} 
              size="small" 
              status="active"
            />
          )}
        </Space>
      ),
    },
    {
      title: '视频时长',
      dataIndex: 'duration',
      key: 'duration',
      width: 100,
      render: (duration) => <Text>{formatDuration(duration)}</Text>,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (date) => (
        <Text style={{ fontSize: 12 }}>
          {dayjs(date).format('YYYY-MM-DD HH:mm')}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => {
                setSelectedVideo(record);
                setDetailModalVisible(true);
              }}
            />
          </Tooltip>
          {record.download_status === 'completed' && (
            <Tooltip title="打开文件夹">
              <Button
                type="text"
                icon={<FolderOpenOutlined />}
                onClick={() => {
                  // 这里可以调用系统API打开文件夹
                  message.info('文件路径: ' + record.file_path);
                }}
              />
            </Tooltip>
          )}
          <Popconfirm
            title="删除确认"
            description="是否同时删除本地文件？"
            onConfirm={() => deleteVideo(record.id, true)}
            onCancel={() => deleteVideo(record.id, false)}
            okText="删除文件"
            cancelText="仅删除记录"
          >
            <Tooltip title="删除">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys);
    },
  };

  return (
    <div>
      {/* 统计信息 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
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
              prefix={<CloudDownloadOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="下载中"
              value={statistics.downloading}
              prefix={<DownloadOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总大小"
              value={formatFileSize(statistics.totalSize)}
              prefix={<FolderOpenOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 筛选和搜索 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col flex="auto">
            <Search
              placeholder="搜索视频标题、UP主或BV号"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: '100%' }}
              allowClear
            />
          </Col>
          <Col>
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 120 }}
            >
              <Option value="all">全部状态</Option>
              <Option value="completed">已完成</Option>
              <Option value="downloading">下载中</Option>
              <Option value="failed">失败</Option>
              <Option value="pending">等待中</Option>
            </Select>
          </Col>
          <Col>
            <RangePicker
              value={dateRange}
              onChange={setDateRange}
              placeholder={['开始日期', '结束日期']}
            />
          </Col>
          <Col>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchVideos}
              loading={loading}
            >
              刷新
            </Button>
          </Col>
        </Row>
      </Card>

      {/* 批量操作 */}
      {selectedRowKeys.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <Space>
            <Text>已选择 {selectedRowKeys.length} 项</Text>
            <Popconfirm
              title="批量删除确认"
              description="是否同时删除本地文件？"
              onConfirm={() => batchDelete(true)}
              onCancel={() => batchDelete(false)}
              okText="删除文件"
              cancelText="仅删除记录"
            >
              <Button danger icon={<DeleteOutlined />}>
                批量删除
              </Button>
            </Popconfirm>
            <Button onClick={() => setSelectedRowKeys([])}>
              取消选择
            </Button>
          </Space>
        </Card>
      )}

      {/* 视频列表 */}
      <Card>
        <Table
          columns={columns}
          dataSource={filteredVideos}
          rowKey="id"
          loading={loading}
          rowSelection={rowSelection}
          pagination={{
            total: filteredVideos.length,
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* 视频详情模态框 */}
      <Modal
        title="视频详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedVideo && (
          <div>
            <Row gutter={24}>
              <Col span={8}>
                <Image
                  src={selectedVideo.thumbnail_url}
                  alt={selectedVideo.title}
                  style={{ width: '100%', borderRadius: 8 }}
                />
              </Col>
              <Col span={16}>
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <div>
                    <Title level={4} style={{ margin: 0 }}>
                      {selectedVideo.title}
                    </Title>
                    <Space style={{ marginTop: 8 }}>
                      <Tag color="blue">{selectedVideo.bvid}</Tag>
                      <Tag color="green">{formatDuration(selectedVideo.duration)}</Tag>
                      <Tag color="orange">{selectedVideo.quality_desc}</Tag>
                      <Tag color={getStatusColor(selectedVideo.download_status)}>
                        {getStatusText(selectedVideo.download_status)}
                      </Tag>
                    </Space>
                  </div>

                  <Descriptions column={2} size="small">
                    <Descriptions.Item label="UP主">{selectedVideo.author}</Descriptions.Item>
                    <Descriptions.Item label="发布时间">
                      {dayjs(selectedVideo.publish_time).format('YYYY-MM-DD')}
                    </Descriptions.Item>
                    <Descriptions.Item label="播放量">
                      {formatNumber(selectedVideo.view_count)}
                    </Descriptions.Item>
                    <Descriptions.Item label="点赞数">
                      {formatNumber(selectedVideo.like_count)}
                    </Descriptions.Item>
                    <Descriptions.Item label="收藏数">
                      {formatNumber(selectedVideo.favorite_count)}
                    </Descriptions.Item>
                    <Descriptions.Item label="分享数">
                      {formatNumber(selectedVideo.share_count)}
                    </Descriptions.Item>
                    <Descriptions.Item label="文件大小">
                      {formatFileSize(selectedVideo.file_size)}
                    </Descriptions.Item>
                    <Descriptions.Item label="下载时间">
                      {dayjs(selectedVideo.created_at).format('YYYY-MM-DD HH:mm')}
                    </Descriptions.Item>
                  </Descriptions>

                  {selectedVideo.description && (
                    <div>
                      <Text strong>视频简介：</Text>
                      <div style={{ 
                        marginTop: 8, 
                        padding: 12, 
                        backgroundColor: '#f5f5f5', 
                        borderRadius: 6,
                        maxHeight: 150,
                        overflow: 'auto'
                      }}>
                        <Text>{selectedVideo.description}</Text>
                      </div>
                    </div>
                  )}

                  {selectedVideo.download_status === 'completed' && (
                    <div>
                      <Text strong>文件路径：</Text>
                      <div style={{ 
                        marginTop: 8, 
                        padding: 8, 
                        backgroundColor: '#f0f0f0', 
                        borderRadius: 4,
                        fontFamily: 'monospace',
                        fontSize: 12
                      }}>
                        {selectedVideo.file_path}
                      </div>
                    </div>
                  )}
                </Space>
              </Col>
            </Row>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default VideoManager;