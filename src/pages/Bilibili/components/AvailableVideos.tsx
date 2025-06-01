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
  message,
  Input,
  Select,
  DatePicker,
  Row,
  Col,
  Statistic,
  Tooltip,
  Descriptions,
  Badge,
  Spin,
  Empty,
  Pagination
} from 'antd';
import {
  PlayCircleOutlined,
  DownloadOutlined,
  EyeOutlined,
  SearchOutlined,
  ReloadOutlined,
  VideoCameraOutlined,
  LikeOutlined,
  ShareAltOutlined,
  HeartOutlined,
  ClockCircleOutlined,
  UserOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { getAvailableVideos, addDownloadPermission, getVideoPermission } from '@/services/ant-design-pro/api';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { getSafeImageUrl } from '../../../utils/imageProxy';

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;
const { RangePicker } = DatePicker;

interface AvailableVideosProps {
  onRequestPermission?: (video: API.VideoRecord) => void;
}

const AvailableVideos: React.FC<AvailableVideosProps> = ({ onRequestPermission }) => {
  const [videos, setVideos] = useState<API.VideoRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<API.VideoRecord | null>(null);
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
    hasMore: false
  });
  const [permissionStatus, setPermissionStatus] = useState<Record<string, API.VideoPermission>>({});
  const [requestingPermission, setRequestingPermission] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchVideos();
  }, [pagination.current, pagination.pageSize]);

  const fetchVideos = async () => {
    setLoading(true);
    try {
      const result = await getAvailableVideos({
        limit: pagination.pageSize,
        offset: (pagination.current - 1) * pagination.pageSize
      });
      
      if (result.code === 200) {
        setVideos(result.data.videos);
        setPagination(prev => ({
          ...prev,
          total: result.data.total,
          hasMore: result.data.hasMore
        }));
        
        // 批量检查权限状态
        checkPermissionsForVideos(result.data.videos);
      } else {
        message.error(result.message || '获取可下载视频列表失败');
      }
    } catch (error) {
      message.error('网络错误，请重试');
      console.error('获取可下载视频列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkPermissionsForVideos = async (videoList: API.VideoRecord[]) => {
    const permissionPromises = videoList.map(async (video) => {
      try {
        const result = await getVideoPermission(video.bvid);
        if (result.code === 200) {
          return { bvid: video.bvid, permission: result.data };
        }
      } catch (error) {
        console.error(`检查视频 ${video.bvid} 权限失败:`, error);
      }
      return { bvid: video.bvid, permission: { hasPermission: false } };
    });

    const results = await Promise.all(permissionPromises);
    const newPermissionStatus: Record<string, API.VideoPermission> = {};
    results.forEach(({ bvid, permission }) => {
      newPermissionStatus[bvid] = permission;
    });
    setPermissionStatus(newPermissionStatus);
  };

  const requestDownloadPermission = async (video: API.VideoRecord) => {
    setRequestingPermission(prev => ({ ...prev, [video.bvid]: true }));
    try {
      const result = await addDownloadPermission({ bvid: video.bvid });
      
      if (result.code === 200 || result.code === 201) {
        message.success('下载权限申请成功！');
        // 重新检查该视频的权限状态
        const permissionResult = await getVideoPermission(video.bvid);
        if (permissionResult.code === 200) {
          setPermissionStatus(prev => ({
            ...prev,
            [video.bvid]: permissionResult.data
          }));
        }
        onRequestPermission?.(video);
      } else {
        message.error(result.message || '申请下载权限失败');
      }
    } catch (error) {
      message.error('网络错误，请重试');
      console.error('申请下载权限失败:', error);
    } finally {
      setRequestingPermission(prev => ({ ...prev, [video.bvid]: false }));
    }
  };

  const formatDuration = (seconds: number): string => {
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

  const formatNumber = (num: number): string => {
    if (num === undefined || num === null || isNaN(num)) {
      return '0';
    }
    if (num >= 10000) {
      return `${(num / 10000).toFixed(1)}万`;
    }
    return num.toString();
  };

  const formatDate = (timestamp: number): string => {
    if (timestamp === undefined || timestamp === null || isNaN(timestamp)) {
      return '未知时间';
    }
    return dayjs(timestamp * 1000).format('YYYY-MM-DD HH:mm');
  };

  const getPermissionStatus = (video: API.VideoRecord) => {
    const permission = permissionStatus[video.bvid];
    if (!permission) {
      return { status: 'unknown', text: '检查中...', color: 'default' };
    }
    
    if (permission.hasPermission) {
      return { 
        status: 'granted', 
        text: permission.relationDesc || '已授权', 
        color: 'success' 
      };
    }
    
    return { status: 'denied', text: '未授权', color: 'default' };
  };

  const columns: ColumnsType<API.VideoRecord> = [
    {
      title: '视频信息',
      key: 'info',
      width: 400,
      render: (_, record) => (
        <div style={{ display: 'flex', gap: 12 }}>
          <Image
            width={120}
            height={68}
            src={getSafeImageUrl(record.pic)}
            alt={record.title}
            style={{ borderRadius: 4, objectFit: 'cover' }}
            fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMIAAADDCAYAAADQvc6UAAABRWlDQ1BJQ0MgUHJvZmlsZQAAKJFjYGASSSwoyGFhYGDIzSspCnJ3UoiIjFJgf8LAwSDCIMogwMCcmFxc4BgQ4ANUwgCjUcG3awyMIPqyLsis7PPOq3QdDFcvjV3jOD1boQVTPQrgSkktTgbSf4A4LbmgqISBgTEFyFYuLykAsTuAbJEioKOA7DkgdjqEvQHEToKwj4DVhAQ5A9k3gGyB5IxEoBmML4BsnSQk8XQkNtReEOBxcfXxUQg1Mjc0dyHgXNJBSWpFCYh2zi+oLMpMzyhRcASGUqqCZ16yno6CkYGRAQMDKMwhqj/fAIcloxgHQqxAjIHBEugw5sUIsSQpBobtQPdLciLEVJYzMPBHMDBsayhILEqEO4DxG0txmrERhM29nYGBddr//5/DGRjYNRkY/l7////39v///y4Dmn+LgeHANwDrkl1AuO+pmgAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAwqADAAQAAAABAAAAwwAAAAD9b/HnAAAHlklEQVR4Ae3dP3Ik1RnG4W+FgYxN"
            onError={(e) => {
              console.log('图片加载失败:', record.pic);
              console.log('代理URL:', getSafeImageUrl(record.pic));
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ marginBottom: 4 }}>
              <Text strong style={{ fontSize: 14, lineHeight: '20px' }}>
                {record.title}
              </Text>
            </div>
            <div style={{ marginBottom: 4 }}>
              <Space size={4}>
                <UserOutlined style={{ fontSize: 12, color: '#666' }} />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {record.owner_name}
                </Text>
              </Space>
            </div>
            <div>
              <Space size={12}>
                <Space size={4}>
                  <EyeOutlined style={{ fontSize: 12, color: '#666' }} />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {formatNumber(record.view_count)}
                  </Text>
                </Space>
                <Space size={4}>
                  <LikeOutlined style={{ fontSize: 12, color: '#666' }} />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {formatNumber(record.like_count)}
                  </Text>
                </Space>
                <Space size={4}>
                  <ClockCircleOutlined style={{ fontSize: 12, color: '#666' }} />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {formatDuration(record.duration)}
                  </Text>
                </Space>
              </Space>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: '分类',
      dataIndex: 'tname',
      key: 'tname',
      width: 100,
      render: (tname: string) => (
        <Tag color="blue">{tname}</Tag>
      ),
    },
    {
      title: '发布时间',
      dataIndex: 'pubdate',
      key: 'pubdate',
      width: 150,
      render: (pubdate: number) => (
        <Text type="secondary">
          {formatDate(pubdate)}
        </Text>
      ),
      sorter: (a, b) => a.pubdate - b.pubdate,
    },
    {
      title: '权限状态',
      key: 'permission',
      width: 120,
      render: (_, record) => {
        const { status, text, color } = getPermissionStatus(record);
        return (
          <Badge 
            status={status === 'granted' ? 'success' : status === 'denied' ? 'default' : 'processing'} 
            text={text}
          />
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => {
        const permission = permissionStatus[record.bvid];
        const isRequesting = requestingPermission[record.bvid];
        
        return (
          <Space size="middle">
            <Button
              type="link"
              icon={<EyeOutlined />}
              onClick={() => {
                setSelectedVideo(record);
                setDetailModalVisible(true);
              }}
            >
              详情
            </Button>
            
            {permission?.hasPermission ? (
              <Tooltip title="已有下载权限">
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  disabled
                >
                  已授权
                </Button>
              </Tooltip>
            ) : (
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                loading={isRequesting}
                onClick={() => requestDownloadPermission(record)}
              >
                申请下载
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  const filteredVideos = videos.filter(video => {
    const matchesSearch = !searchText || 
      video.title.toLowerCase().includes(searchText.toLowerCase()) ||
      video.owner_name.toLowerCase().includes(searchText.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || video.tname === categoryFilter;
    
    const matchesDate = !dateRange || (
      dayjs(video.pubdate * 1000).isAfter(dateRange[0]) &&
      dayjs(video.pubdate * 1000).isBefore(dateRange[1])
    );
    
    return matchesSearch && matchesCategory && matchesDate;
  });

  const categories = Array.from(new Set(videos.map(v => v.tname))).filter(Boolean);

  return (
    <div>
      <Card>
        <div style={{ marginBottom: 16 }}>
          <Title level={4} style={{ margin: 0 }}>
            <VideoCameraOutlined style={{ marginRight: 8 }} />
            可下载视频库
          </Title>
          <Text type="secondary">
            浏览所有可下载的视频，申请下载权限后即可下载到本地
          </Text>
        </div>
        
        {/* 搜索和筛选 */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Search
              placeholder="搜索视频标题或作者"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onSearch={fetchVideos}
              enterButton={<SearchOutlined />}
            />
          </Col>
          <Col span={4}>
            <Select
              style={{ width: '100%' }}
              placeholder="选择分类"
              value={categoryFilter}
              onChange={setCategoryFilter}
            >
              <Option value="all">全部分类</Option>
              {categories.map(category => (
                <Option key={category} value={category}>{category}</Option>
              ))}
            </Select>
          </Col>
          <Col span={6}>
            <RangePicker
              style={{ width: '100%' }}
              value={dateRange}
              onChange={setDateRange}
              placeholder={['开始日期', '结束日期']}
            />
          </Col>
          <Col span={6}>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={fetchVideos}
                loading={loading}
              >
                刷新
              </Button>
            </Space>
          </Col>
        </Row>
        
        {/* 统计信息 */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Statistic
              title="总视频数"
              value={pagination.total}
              prefix={<VideoCameraOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="已授权"
              value={Object.values(permissionStatus).filter(p => p.hasPermission).length}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="未授权"
              value={Object.values(permissionStatus).filter(p => !p.hasPermission).length}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="当前页"
              value={`${pagination.current}/${Math.ceil(pagination.total / pagination.pageSize)}`}
            />
          </Col>
        </Row>
        
        {/* 视频列表 */}
        <Table
          columns={columns}
          dataSource={filteredVideos}
          rowKey="bvid"
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            onChange: (page, pageSize) => {
              setPagination(prev => ({ ...prev, current: page, pageSize: pageSize || 20 }));
            },
          }}
          scroll={{ x: 1000 }}
        />
      </Card>
      
      {/* 视频详情模态框 */}
      <Modal
        title="视频详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
          selectedVideo && !permissionStatus[selectedVideo.bvid]?.hasPermission && (
            <Button
              key="request"
              type="primary"
              icon={<DownloadOutlined />}
              loading={requestingPermission[selectedVideo.bvid]}
              onClick={() => {
                if (selectedVideo) {
                  requestDownloadPermission(selectedVideo);
                }
              }}
            >
              申请下载权限
            </Button>
          ),
        ]}
        width={800}
      >
        {selectedVideo && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <Image
                width={400}
                height={225}
                src={selectedVideo.pic}
                alt={selectedVideo.title}
                style={{ borderRadius: 8 }}
              />
            </div>
            
            <Descriptions column={2} bordered>
              <Descriptions.Item label="标题" span={2}>
                {selectedVideo.title}
              </Descriptions.Item>
              <Descriptions.Item label="BVID">
                {selectedVideo.bvid}
              </Descriptions.Item>
              <Descriptions.Item label="AID">
                {selectedVideo.aid}
              </Descriptions.Item>
              <Descriptions.Item label="作者">
                <Space>
                  <Image
                    width={24}
                    height={24}
                    src={selectedVideo.owner_face}
                    style={{ borderRadius: '50%' }}
                  />
                  {selectedVideo.owner_name}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="分类">
                <Tag color="blue">{selectedVideo.tname}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="时长">
                {formatDuration(selectedVideo.duration)}
              </Descriptions.Item>
              <Descriptions.Item label="发布时间">
                {formatDate(selectedVideo.pubdate)}
              </Descriptions.Item>
              <Descriptions.Item label="播放量">
                <Space>
                  <EyeOutlined />
                  {formatNumber(selectedVideo.view_count)}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="点赞数">
                <Space>
                  <LikeOutlined />
                  {formatNumber(selectedVideo.like_count)}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="投币数">
                <Space>
                  <HeartOutlined />
                  {formatNumber(selectedVideo.coin_count)}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="分享数">
                <Space>
                  <ShareAltOutlined />
                  {formatNumber(selectedVideo.share_count)}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="权限状态" span={2}>
                {(() => {
                  const { status, text, color } = getPermissionStatus(selectedVideo);
                  return (
                    <Badge 
                      status={status === 'granted' ? 'success' : status === 'denied' ? 'default' : 'processing'} 
                      text={text}
                    />
                  );
                })()}
              </Descriptions.Item>
              <Descriptions.Item label="简介" span={2}>
                <div style={{ maxHeight: 100, overflow: 'auto' }}>
                  {selectedVideo.desc || '暂无简介'}
                </div>
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AvailableVideos;