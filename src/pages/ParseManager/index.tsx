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
  Modal,
  message,
  Tooltip,
  Progress,
  Input,
  Select,
  DatePicker,
  Statistic,
  Popconfirm,
  notification,
  Spin,
  Empty,
  List,
  Divider,
  Steps,
  Alert,
  Timeline,
  Badge
} from 'antd';
import {
  CloudDownloadOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  StopOutlined,
  DeleteOutlined,
  ReloadOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  LoadingOutlined,
  FileTextOutlined,
  SettingOutlined,
  InfoCircleOutlined,
  VideoCameraOutlined,
  DownloadOutlined,
  ClearOutlined,
  SyncOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { request, useModel } from '@umijs/max';
import dayjs from 'dayjs';
import './index.less';

const { Title, Text, Paragraph } = Typography;
const { Search } = Input;
const { Option } = Select;
const { RangePicker } = DatePicker;
const { Step } = Steps;

interface ParseTask {
  id: string;
  url: string;
  bvid?: string;
  title?: string;
  status: 'pending' | 'parsing' | 'downloading' | 'merging' | 'completed' | 'failed' | 'paused';
  progress: number;
  currentStep: number;
  steps: string[];
  videoInfo?: {
    title: string;
    author: string;
    duration: number;
    thumbnail: string;
    quality: number;
  };
  error?: string;
  startTime: string;
  endTime?: string;
  fileSize?: number;
  downloadSpeed?: string;
  eta?: string;
  userId: string;
  quality: number;
  downloadMode: string;
}

interface BatchParseTask {
  id: string;
  name: string;
  urls: string[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  progress: number;
  completedCount: number;
  failedCount: number;
  tasks: ParseTask[];
  startTime: string;
  endTime?: string;
}

const ParseManager: React.FC = () => {
  const { initialState } = useModel('@@initialState');
  const [tasks, setTasks] = useState<ParseTask[]>([]);
  const [batchTasks, setBatchTasks] = useState<BatchParseTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ParseTask | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [activeTab, setActiveTab] = useState('single');
  const [statistics, setStatistics] = useState({
    total: 0,
    running: 0,
    completed: 0,
    failed: 0,
    totalSize: 0
  });
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!initialState?.currentUser) {
      message.warning('请先登录系统');
      return;
    }
    fetchTasks();
    startPolling();
    
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [initialState]);

  const startPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
    
    pollingRef.current = setInterval(() => {
      fetchTasks();
    }, 2000); // 每2秒更新一次
  };

  const fetchTasks = async () => {
    try {
      // 这里应该调用实际的API获取解析任务列表
      // 暂时使用模拟数据
      const mockTasks: ParseTask[] = [
        {
          id: '1',
          url: 'https://www.bilibili.com/video/BV1xx411c7mu',
          bvid: 'BV1xx411c7mu',
          title: '【技术分享】React开发实战教程',
          status: 'downloading',
          progress: 65,
          currentStep: 2,
          steps: ['解析视频信息', '下载视频流', '下载音频流', '合并音视频', '完成'],
          videoInfo: {
            title: '【技术分享】React开发实战教程',
            author: '技术UP主',
            duration: 1800,
            thumbnail: 'https://i0.hdslb.com/bfs/archive/example.jpg',
            quality: 80
          },
          startTime: dayjs().subtract(5, 'minute').toISOString(),
          fileSize: 157286400,
          downloadSpeed: '2.5 MB/s',
          eta: '2分钟',
          userId: '1',
          quality: 80,
          downloadMode: 'auto'
        },
        {
          id: '2',
          url: 'https://www.bilibili.com/video/BV1yy4y1a7nE',
          bvid: 'BV1yy4y1a7nE',
          title: 'Vue3 + TypeScript 项目实战',
          status: 'completed',
          progress: 100,
          currentStep: 4,
          steps: ['解析视频信息', '下载视频流', '下载音频流', '合并音视频', '完成'],
          videoInfo: {
            title: 'Vue3 + TypeScript 项目实战',
            author: '前端大神',
            duration: 2400,
            thumbnail: 'https://i0.hdslb.com/bfs/archive/example2.jpg',
            quality: 80
          },
          startTime: dayjs().subtract(1, 'hour').toISOString(),
          endTime: dayjs().subtract(45, 'minute').toISOString(),
          fileSize: 234567890,
          userId: '1',
          quality: 80,
          downloadMode: 'auto'
        },
        {
          id: '3',
          url: 'https://www.bilibili.com/video/BV1zz4y1a7nF',
          bvid: 'BV1zz4y1a7nF',
          title: 'Node.js 后端开发指南',
          status: 'failed',
          progress: 30,
          currentStep: 1,
          steps: ['解析视频信息', '下载视频流', '下载音频流', '合并音视频', '完成'],
          error: '网络连接超时，请检查网络设置',
          startTime: dayjs().subtract(30, 'minute').toISOString(),
          userId: '1',
          quality: 80,
          downloadMode: 'auto'
        }
      ];
      
      setTasks(mockTasks);
      
      // 计算统计信息
      const stats = {
        total: mockTasks.length,
        running: mockTasks.filter(t => ['parsing', 'downloading', 'merging'].includes(t.status)).length,
        completed: mockTasks.filter(t => t.status === 'completed').length,
        failed: mockTasks.filter(t => t.status === 'failed').length,
        totalSize: mockTasks.reduce((sum, t) => sum + (t.fileSize || 0), 0)
      };
      setStatistics(stats);
    } catch (error) {
      console.error('获取解析任务失败:', error);
    }
  };

  const handlePauseTask = async (taskId: string) => {
    try {
      // 调用暂停API
      message.success('任务已暂停');
      fetchTasks();
    } catch (error) {
      message.error('暂停任务失败');
    }
  };

  const handleResumeTask = async (taskId: string) => {
    try {
      // 调用恢复API
      message.success('任务已恢复');
      fetchTasks();
    } catch (error) {
      message.error('恢复任务失败');
    }
  };

  const handleStopTask = async (taskId: string) => {
    try {
      // 调用停止API
      message.success('任务已停止');
      fetchTasks();
    } catch (error) {
      message.error('停止任务失败');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      // 调用删除API
      setTasks(prev => prev.filter(t => t.id !== taskId));
      message.success('任务已删除');
    } catch (error) {
      message.error('删除任务失败');
    }
  };

  const handleRetryTask = async (taskId: string) => {
    try {
      // 调用重试API
      message.success('任务已重新开始');
      fetchTasks();
    } catch (error) {
      message.error('重试任务失败');
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
      'pending': { color: 'default', text: '等待中', icon: <ClockCircleOutlined /> },
      'parsing': { color: 'processing', text: '解析中', icon: <LoadingOutlined spin /> },
      'downloading': { color: 'processing', text: '下载中', icon: <DownloadOutlined /> },
      'merging': { color: 'processing', text: '合并中', icon: <SyncOutlined spin /> },
      'completed': { color: 'success', text: '已完成', icon: <CheckCircleOutlined /> },
      'failed': { color: 'error', text: '失败', icon: <CloseCircleOutlined /> },
      'paused': { color: 'warning', text: '已暂停', icon: <PauseCircleOutlined /> }
    };
    const config = statusMap[status as keyof typeof statusMap] || { color: 'default', text: status, icon: null };
    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    );
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

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = !searchText || 
      task.title?.toLowerCase().includes(searchText.toLowerCase()) ||
      task.bvid?.toLowerCase().includes(searchText.toLowerCase()) ||
      task.url.toLowerCase().includes(searchText.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    
    const matchesDate = !dateRange || (
      dayjs(task.startTime).isAfter(dateRange[0]) &&
      dayjs(task.startTime).isBefore(dateRange[1])
    );
    
    return matchesSearch && matchesStatus && matchesDate;
  });

  const columns: ProColumns<ParseTask>[] = [
    {
      title: '任务信息',
      key: 'info',
      width: 350,
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {record.videoInfo?.thumbnail && (
            <img
              src={record.videoInfo.thumbnail}
              alt={record.title}
              style={{
                width: 60,
                height: 45,
                borderRadius: 4,
                marginRight: 12,
                objectFit: 'cover'
              }}
            />
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 'bold', marginBottom: 4, fontSize: 14 }}>
              {record.title || record.bvid || '解析中...'}
            </div>
            <div style={{ color: '#666', fontSize: 12 }}>
              <Space size={8}>
                <span>{record.bvid}</span>
                {record.videoInfo?.author && <span>• {record.videoInfo.author}</span>}
                {record.videoInfo?.duration && <span>• {formatDuration(record.videoInfo.duration)}</span>}
              </Space>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: '进度',
      key: 'progress',
      width: 200,
      render: (_, record) => (
        <div>
          <Progress
            percent={record.progress}
            size="small"
            status={record.status === 'failed' ? 'exception' : record.status === 'completed' ? 'success' : 'active'}
          />
          <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
            {record.steps[record.currentStep] || '准备中...'}
          </div>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => getStatusTag(status),
    },
    {
      title: '画质',
      dataIndex: 'quality',
      key: 'quality',
      width: 80,
      render: (quality) => getQualityTag(quality),
    },
    {
      title: '文件大小',
      key: 'fileSize',
      width: 100,
      render: (_, record) => record.fileSize ? formatFileSize(record.fileSize) : '-',
    },
    {
      title: '速度/剩余时间',
      key: 'speed',
      width: 120,
      render: (_, record) => (
        <div style={{ fontSize: 12 }}>
          {record.downloadSpeed && <div>{record.downloadSpeed}</div>}
          {record.eta && <div style={{ color: '#666' }}>剩余 {record.eta}</div>}
        </div>
      ),
    },
    {
      title: '开始时间',
      dataIndex: 'startTime',
      key: 'startTime',
      width: 150,
      render: (time) => dayjs(time).format('MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space size={4}>
          {record.status === 'downloading' || record.status === 'parsing' || record.status === 'merging' ? (
            <Tooltip title="暂停">
              <Button
                size="small"
                icon={<PauseCircleOutlined />}
                onClick={() => handlePauseTask(record.id)}
              />
            </Tooltip>
          ) : record.status === 'paused' ? (
            <Tooltip title="继续">
              <Button
                size="small"
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={() => handleResumeTask(record.id)}
              />
            </Tooltip>
          ) : null}
          
          {record.status === 'failed' && (
            <Tooltip title="重试">
              <Button
                size="small"
                type="primary"
                icon={<ReloadOutlined />}
                onClick={() => handleRetryTask(record.id)}
              />
            </Tooltip>
          )}
          
          {record.status === 'completed' && (
            <Tooltip title="查看视频">
              <Button
                size="small"
                type="primary"
                icon={<EyeOutlined />}
                onClick={() => window.open('/video-player', '_blank')}
              />
            </Tooltip>
          )}
          
          <Tooltip title="查看详情">
            <Button
              size="small"
              icon={<InfoCircleOutlined />}
              onClick={() => {
                setSelectedTask(record);
                setDetailModalVisible(true);
              }}
            />
          </Tooltip>
          
          {['completed', 'failed', 'paused'].includes(record.status) && (
            <Popconfirm
              title="确定要删除这个任务吗？"
              onConfirm={() => handleDeleteTask(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Tooltip title="删除">
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <PageContainer
      title="解析管理中心"
      subTitle="管理和监控视频解析任务"
      extra={[
        <Button
          key="refresh"
          icon={<ReloadOutlined />}
          onClick={fetchTasks}
          loading={loading}
        >
          刷新
        </Button>,
        <Button
          key="clear-completed"
          icon={<ClearOutlined />}
          onClick={() => {
            setTasks(prev => prev.filter(t => t.status !== 'completed'));
            message.success('已清理完成的任务');
          }}
        >
          清理已完成
        </Button>
      ]}
    >
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总任务数"
              value={statistics.total}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="运行中"
              value={statistics.running}
              prefix={<LoadingOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已完成"
              value={statistics.completed}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="失败数"
              value={statistics.failed}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 筛选工具栏 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col span={8}>
            <Search
              placeholder="搜索任务标题、BVID或URL"
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
              <Option value="pending">等待中</Option>
              <Option value="parsing">解析中</Option>
              <Option value="downloading">下载中</Option>
              <Option value="merging">合并中</Option>
              <Option value="completed">已完成</Option>
              <Option value="failed">失败</Option>
              <Option value="paused">已暂停</Option>
            </Select>
          </Col>
          <Col span={8}>
            <RangePicker
              value={dateRange}
              onChange={setDateRange}
              style={{ width: '100%' }}
              placeholder={['开始时间', '结束时间']}
            />
          </Col>
          <Col span={4}>
            <Button
              type="primary"
              icon={<VideoCameraOutlined />}
              onClick={() => window.open('/bilibili', '_blank')}
              block
            >
              新建解析
            </Button>
          </Col>
        </Row>
      </Card>

      {/* 任务列表 */}
      <ProTable<ParseTask>
        columns={columns}
        dataSource={filteredTasks}
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
              description="暂无解析任务"
            >
              <Button type="primary" href="/bilibili">
                去解析视频
              </Button>
            </Empty>
          ),
        }}
      />

      {/* 任务详情模态框 */}
      <Modal
        title="任务详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        width={800}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>
        ]}
      >
        {selectedTask && (
          <div>
            <Row gutter={16}>
              <Col span={12}>
                <Card title="基本信息" size="small">
                  <div style={{ marginBottom: 8 }}><strong>标题:</strong> {selectedTask.title || '解析中...'}</div>
                  <div style={{ marginBottom: 8 }}><strong>BVID:</strong> {selectedTask.bvid || '-'}</div>
                  <div style={{ marginBottom: 8 }}><strong>URL:</strong> {selectedTask.url}</div>
                  <div style={{ marginBottom: 8 }}><strong>画质:</strong> {getQualityTag(selectedTask.quality)}</div>
                  <div style={{ marginBottom: 8 }}><strong>下载模式:</strong> {selectedTask.downloadMode}</div>
                  <div style={{ marginBottom: 8 }}><strong>状态:</strong> {getStatusTag(selectedTask.status)}</div>
                </Card>
              </Col>
              <Col span={12}>
                <Card title="进度信息" size="small">
                  <Progress percent={selectedTask.progress} />
                  <div style={{ marginTop: 12 }}>
                    <Steps
                      current={selectedTask.currentStep}
                      size="small"
                      direction="vertical"
                      items={selectedTask.steps.map((step, index) => ({
                        title: step,
                        status: index < selectedTask.currentStep ? 'finish' : 
                               index === selectedTask.currentStep ? 
                               (selectedTask.status === 'failed' ? 'error' : 'process') : 'wait'
                      }))}
                    />
                  </div>
                </Card>
              </Col>
            </Row>
            
            <Divider />
            
            <Row gutter={16}>
              <Col span={12}>
                <Card title="时间信息" size="small">
                  <div style={{ marginBottom: 8 }}><strong>开始时间:</strong> {dayjs(selectedTask.startTime).format('YYYY-MM-DD HH:mm:ss')}</div>
                  {selectedTask.endTime && (
                    <div style={{ marginBottom: 8 }}><strong>结束时间:</strong> {dayjs(selectedTask.endTime).format('YYYY-MM-DD HH:mm:ss')}</div>
                  )}
                  {selectedTask.endTime && (
                    <div style={{ marginBottom: 8 }}><strong>耗时:</strong> {dayjs(selectedTask.endTime).diff(dayjs(selectedTask.startTime), 'minute')} 分钟</div>
                  )}
                  {selectedTask.eta && (
                    <div style={{ marginBottom: 8 }}><strong>预计剩余:</strong> {selectedTask.eta}</div>
                  )}
                </Card>
              </Col>
              <Col span={12}>
                <Card title="文件信息" size="small">
                  {selectedTask.fileSize && (
                    <div style={{ marginBottom: 8 }}><strong>文件大小:</strong> {formatFileSize(selectedTask.fileSize)}</div>
                  )}
                  {selectedTask.downloadSpeed && (
                    <div style={{ marginBottom: 8 }}><strong>下载速度:</strong> {selectedTask.downloadSpeed}</div>
                  )}
                  {selectedTask.videoInfo && (
                    <>
                      <div style={{ marginBottom: 8 }}><strong>作者:</strong> {selectedTask.videoInfo.author}</div>
                      <div style={{ marginBottom: 8 }}><strong>时长:</strong> {formatDuration(selectedTask.videoInfo.duration)}</div>
                    </>
                  )}
                </Card>
              </Col>
            </Row>
            
            {selectedTask.error && (
              <>
                <Divider />
                <Alert
                  message="错误信息"
                  description={selectedTask.error}
                  type="error"
                  showIcon
                />
              </>
            )}
          </div>
        )}
      </Modal>
    </PageContainer>
  );
};

export default ParseManager;