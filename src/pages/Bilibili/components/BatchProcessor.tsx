import React, { useState } from 'react';
import {
  Card,
  Button,
  Space,
  Typography,
  Input,
  Select,
  Progress,
  List,
  message,
  Modal,
  Tag,
  Alert,
  Divider,
  Row,
  Col,
  Statistic,
  notification
} from 'antd';
import {
  CloudDownloadOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  DeleteOutlined,
  ClearOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { batchProcessVideos } from '@/services/ant-design-pro/api';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

interface BatchProcessorProps {
  onProcessComplete?: (results: API.BatchProcessResult) => void;
}

interface BatchTask {
  id: string;
  url: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: API.VideoRecord;
  error?: string;
}

const BatchProcessor: React.FC<BatchProcessorProps> = ({ onProcessComplete }) => {
  const [urls, setUrls] = useState('');
  const [processing, setProcessing] = useState(false);
  const [tasks, setTasks] = useState<BatchTask[]>([]);
  const [selectedQuality, setSelectedQuality] = useState<number>(80);
  const [downloadMode, setDownloadMode] = useState<string>('auto');
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [results, setResults] = useState<API.BatchProcessResult | null>(null);

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

  const startBatchProcess = async () => {
    if (!urls.trim()) {
      message.warning('请输入视频链接');
      return;
    }

    const urlList = urls.split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0);

    if (urlList.length === 0) {
      message.warning('请输入有效的视频链接');
      return;
    }

    if (urlList.length > 50) {
      message.warning('批量处理最多支持50个视频');
      return;
    }

    setProcessing(true);
    setResults(null);

    // 初始化任务列表
    const initialTasks: BatchTask[] = urlList.map((url, index) => ({
      id: `task_${Date.now()}_${index}`,
      url,
      status: 'pending'
    }));
    setTasks(initialTasks);

    try {
      const result = await batchProcessVideos({
        urls: urlList,
        quality: selectedQuality,
        downloadMode
      });

      if (result.code === 200 || result.code === 201) {
        setResults(result.data);
        
        // 更新任务状态
        const updatedTasks = initialTasks.map(task => {
          // 从URL中提取BVID进行匹配
          const extractBVID = (url: string) => {
            if (url.startsWith('BV')) {
              return url;
            }
            const bvidMatch = url.match(/BV[a-zA-Z0-9]+/);
            return bvidMatch ? bvidMatch[0] : url;
          };
          
          const taskBVID = extractBVID(task.url);
          const successResult = result.data.success.find(s => 
            s.url === taskBVID || s.result?.bvid === taskBVID
          );
          const failedResult = result.data.failed.find(f => 
            extractBVID(f.url) === taskBVID
          );
          
          if (successResult) {
            return {
              ...task,
              status: 'completed' as const,
              result: successResult.result
            };
          } else if (failedResult) {
            return {
              ...task,
              status: 'failed' as const,
              error: failedResult.error
            };
          } else {
            return {
              ...task,
              status: 'completed' as const,
              result: undefined
            };
          }
        });
        
        setTasks(updatedTasks);
        
        notification.success({
          message: '批量处理完成',
          description: `成功处理 ${result.data.success.length} 个视频，失败 ${result.data.failed.length} 个`
        });
        
        onProcessComplete?.(result.data);
      } else {
        message.error(result.message || '批量处理失败');
        setTasks(prev => prev.map(task => ({
          ...task,
          status: 'failed',
          error: result.message || '处理失败'
        })));
      }
    } catch (error) {
      message.error('网络错误，请重试');
      setTasks(prev => prev.map(task => ({
        ...task,
        status: 'failed',
        error: '网络错误'
      })));
    } finally {
      setProcessing(false);
    }
  };

  const clearTasks = () => {
    setTasks([]);
    setResults(null);
    setUrls('');
  };

  const getStatusIcon = (status: BatchTask['status']) => {
    switch (status) {
      case 'pending':
        return <LoadingOutlined style={{ color: '#1890ff' }} />;
      case 'processing':
        return <LoadingOutlined style={{ color: '#1890ff' }} />;
      case 'completed':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'failed':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: BatchTask['status']) => {
    switch (status) {
      case 'pending':
        return 'default';
      case 'processing':
        return 'processing';
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const failedCount = tasks.filter(t => t.status === 'failed').length;
  const totalCount = tasks.length;
  const progressPercent = totalCount > 0 ? ((completedCount + failedCount) / totalCount) * 100 : 0;

  return (
    <div>
      <Card>
        <div style={{ marginBottom: 16 }}>
          <Title level={4} style={{ margin: 0 }}>
            <CloudDownloadOutlined style={{ marginRight: 8 }} />
            批量视频处理
          </Title>
          <Text type="secondary">
            一次性处理多个B站视频，支持批量下载和入库
          </Text>
        </div>

        {/* 设置区域 */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Space>
              <Text strong>视频质量:</Text>
              <Select
                style={{ width: 200 }}
                value={selectedQuality}
                onChange={setSelectedQuality}
              >
                {qualityOptions.map(option => (
                  <Option key={option.value} value={option.value}>
                    {option.label}
                  </Option>
                ))}
              </Select>
            </Space>
          </Col>
          <Col span={8}>
            <Space>
              <Text strong>下载模式:</Text>
              <Select
                style={{ width: 150 }}
                value={downloadMode}
                onChange={setDownloadMode}
              >
                {downloadModeOptions.map(option => (
                  <Option key={option.value} value={option.value}>
                    {option.label}
                  </Option>
                ))}
              </Select>
            </Space>
          </Col>
        </Row>

        {/* 输入区域 */}
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>视频链接 (每行一个):</Text>
          <TextArea
            rows={8}
            placeholder={`请输入B站视频链接，每行一个，例如：
https://www.bilibili.com/video/BV1xx411c7mD
https://www.bilibili.com/video/BV1yy411c7mE
BV1zz411c7mF`}
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            disabled={processing}
          />
          <div style={{ marginTop: 8, color: '#666' }}>
            <Text type="secondary">
              支持完整链接或BV号，最多50个视频
            </Text>
          </div>
        </div>

        {/* 操作按钮 */}
        <Space style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            icon={<CloudDownloadOutlined />}
            loading={processing}
            onClick={startBatchProcess}
            disabled={!urls.trim()}
          >
            开始批量处理
          </Button>
          <Button
            icon={<ClearOutlined />}
            onClick={clearTasks}
            disabled={processing}
          >
            清空任务
          </Button>
        </Space>

        {/* 进度显示 */}
        {tasks.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <Progress
              percent={Math.round(progressPercent)}
              status={processing ? 'active' : 'normal'}
              strokeColor={{
                '0%': '#108ee9',
                '100%': '#87d068',
              }}
            />
            <Row gutter={16} style={{ marginTop: 16 }}>
              <Col span={6}>
                <Statistic
                  title="总数"
                  value={totalCount}
                  prefix={<PlayCircleOutlined />}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="成功"
                  value={completedCount}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#3f8600' }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="失败"
                  value={failedCount}
                  prefix={<CloseCircleOutlined />}
                  valueStyle={{ color: '#cf1322' }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="进度"
                  value={progressPercent}
                  precision={1}
                  suffix="%"
                />
              </Col>
            </Row>
          </div>
        )}

        {/* 任务列表 */}
        {tasks.length > 0 && (
          <div>
            <Divider orientation="left">处理任务</Divider>
            <List
              size="small"
              dataSource={tasks}
              renderItem={(task) => (
                <List.Item
                  actions={[
                    <Tag color={getStatusColor(task.status)}>
                      {getStatusIcon(task.status)}
                      <span style={{ marginLeft: 4 }}>
                        {task.status === 'pending' && '等待中'}
                        {task.status === 'processing' && '处理中'}
                        {task.status === 'completed' && '已完成'}
                        {task.status === 'failed' && '失败'}
                      </span>
                    </Tag>
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <div>
                        <Text strong>
                          {task.result?.title || task.url}
                        </Text>
                        {task.result && (
                          <Tag color="blue" style={{ marginLeft: 8 }}>
                            {task.result.bvid}
                          </Tag>
                        )}
                      </div>
                    }
                    description={
                      <div>
                        <Text type="secondary">{task.url}</Text>
                        {task.error && (
                          <div style={{ color: '#ff4d4f', marginTop: 4 }}>
                            错误: {task.error}
                          </div>
                        )}
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </div>
        )}

        {/* 结果汇总 */}
        {results && (
          <div style={{ marginTop: 16 }}>
            <Divider orientation="left">处理结果</Divider>
            <Alert
              message="批量处理完成"
              description={
                <div>
                  <p>成功处理 <Text strong style={{ color: '#52c41a' }}>{results.success.length}</Text> 个视频</p>
                  <p>处理失败 <Text strong style={{ color: '#ff4d4f' }}>{results.failed.length}</Text> 个视频</p>
                  {results.failed.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <Text strong>失败原因:</Text>
                      <ul style={{ marginTop: 4, marginBottom: 0 }}>
                        {results.failed.map((item, index) => (
                          <li key={index}>
                            <Text code>{item.url}</Text>: {item.error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              }
              type={results.failed.length === 0 ? 'success' : 'warning'}
              showIcon
            />
          </div>
        )}
      </Card>
    </div>
  );
};

export default BatchProcessor;