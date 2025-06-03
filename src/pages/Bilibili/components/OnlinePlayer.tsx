import React, { useState, useRef, useEffect } from 'react';
import {
  Card,
  Button,
  Input,
  Space,
  message,
  Progress,
  Slider,
  Row,
  Col,
  Typography,
  Alert,
  Spin,
  Tooltip
} from 'antd';
import {
  PlayCircleOutlined,
  PauseOutlined,
  SoundOutlined,
  MutedOutlined,
  FullscreenOutlined,
  ReloadOutlined,
  LinkOutlined
} from '@ant-design/icons';

const { Text, Title } = Typography;

interface PlayerData {
  videoUrl: string;
  audioUrl: string;
  bvid: string;
  cid: string;
  quality: string;
}

interface OnlinePlayerProps {
  // 可以接收外部传入的播放数据
  initialData?: PlayerData;
}

const OnlinePlayer: React.FC<OnlinePlayerProps> = ({ initialData }) => {
  const [playerData, setPlayerData] = useState<PlayerData | null>(initialData || null);
  const [inputData, setInputData] = useState('');
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [buffered, setBuffered] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 解析输入的JSON数据
  const parseInputData = () => {
    try {
      setLoading(true);
      setError(null);
      
      const parsed = JSON.parse(inputData);
      
      if (parsed.code === 200 && parsed.data) {
        const data = parsed.data;
        
        // 清理URL中的反引号和多余空格
        const cleanVideoUrl = data.videoUrl?.replace(/`/g, '').trim();
        const cleanAudioUrl = data.audioUrl?.replace(/`/g, '').trim();
        
        if (!cleanVideoUrl || !cleanAudioUrl) {
          throw new Error('视频或音频URL缺失');
        }
        
        const playerData: PlayerData = {
          videoUrl: cleanVideoUrl,
          audioUrl: cleanAudioUrl,
          bvid: data.bvid || '',
          cid: data.cid || '',
          quality: data.quality || ''
        };
        
        setPlayerData(playerData);
        message.success('数据解析成功！');
      } else {
        throw new Error('数据格式不正确');
      }
    } catch (error) {
      console.error('解析数据失败:', error);
      setError(`解析失败: ${error instanceof Error ? error.message : '未知错误'}`);
      message.error('数据解析失败，请检查格式');
    } finally {
      setLoading(false);
    }
  };

  // 播放/暂停控制
  const togglePlay = async () => {
    if (!videoRef.current || !audioRef.current) return;

    try {
      if (isPlaying) {
        videoRef.current.pause();
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        // 同步播放位置
        const videoTime = videoRef.current.currentTime;
        audioRef.current.currentTime = videoTime;
        
        await Promise.all([
          videoRef.current.play(),
          audioRef.current.play()
        ]);
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('播放控制失败:', error);
      message.error('播放失败，请检查网络连接');
      setError('播放失败，可能是网络问题或URL已过期');
    }
  };

  // 时间更新处理
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    
    const current = videoRef.current.currentTime;
    setCurrentTime(current);
    
    // 同步音频时间（允许小幅度误差）
    if (audioRef.current && Math.abs(audioRef.current.currentTime - current) > 0.1) {
      audioRef.current.currentTime = current;
    }
    
    // 更新缓冲进度
    const bufferedEnd = videoRef.current.buffered.length > 0 
      ? videoRef.current.buffered.end(videoRef.current.buffered.length - 1)
      : 0;
    setBuffered((bufferedEnd / duration) * 100);
  };

  // 进度条拖拽
  const handleSeek = (value: number) => {
    if (!videoRef.current || !audioRef.current) return;
    
    const seekTime = (value / 100) * duration;
    videoRef.current.currentTime = seekTime;
    audioRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  // 音量控制
  const handleVolumeChange = (value: number) => {
    setVolume(value);
    if (audioRef.current) {
      audioRef.current.volume = value;
    }
  };

  // 静音切换
  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
    }
  };

  // 全屏切换
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  // 监听全屏状态变化
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // 格式化时间显示
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 重新加载
  const handleReload = () => {
    if (videoRef.current && audioRef.current) {
      videoRef.current.load();
      audioRef.current.load();
      setCurrentTime(0);
      setIsPlaying(false);
      setError(null);
      message.info('已重新加载');
    }
  };

  return (
    <div className="online-player">
      <Card title="在线预览播放器" style={{ marginBottom: 24 }}>
        <Alert
          message="使用说明"
          description="粘贴从视频解析接口获取的JSON数据，支持视频和音频同步播放。注意：播放链接有时效性，过期后需要重新获取。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input.TextArea
            value={inputData}
            onChange={(e) => setInputData(e.target.value)}
            placeholder='粘贴JSON数据，格式如：{"code": 200, "data": {"videoUrl": "...", "audioUrl": "...", "bvid": "...", "quality": "..."}}'
            rows={4}
          />
          
          <Space>
            <Button
              type="primary"
              onClick={parseInputData}
              loading={loading}
              disabled={!inputData.trim()}
              icon={<LinkOutlined />}
            >
              解析数据
            </Button>
            
            <Button
              onClick={() => {
                setInputData('');
                setPlayerData(null);
                setError(null);
              }}
            >
              清空
            </Button>
          </Space>
        </Space>
      </Card>

      {error && (
        <Alert
          message="播放错误"
          description={error}
          type="error"
          showIcon
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      {playerData && (
        <Card title="视频播放器" style={{ marginBottom: 24 }}>
          <div ref={containerRef} className={`player-container ${isFullscreen ? 'fullscreen' : ''}`}>
            {/* 视频信息 */}
            <div style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={6}><Text strong>BVID:</Text> {playerData.bvid}</Col>
                <Col span={6}><Text strong>CID:</Text> {playerData.cid}</Col>
                <Col span={6}><Text strong>质量:</Text> {playerData.quality}P</Col>
                <Col span={6}><Text strong>时长:</Text> {formatTime(duration)}</Col>
              </Row>
            </div>

            {/* 视频播放区域 */}
            <div style={{ position: 'relative', backgroundColor: '#000', marginBottom: 16 }}>
              <video
                ref={videoRef}
                style={{ width: '100%', height: 'auto', maxHeight: '60vh' }}
                onLoadedMetadata={() => {
                  if (videoRef.current) {
                    setDuration(videoRef.current.duration);
                  }
                }}
                onTimeUpdate={handleTimeUpdate}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onError={(e) => {
                  console.error('视频加载错误:', e);
                  setError('视频加载失败，可能是链接已过期');
                }}
                preload="metadata"
                crossOrigin="anonymous"
              >
                <source src={playerData.videoUrl} type="video/mp4" />
                您的浏览器不支持视频播放
              </video>
              
              {/* 音频元素（隐藏） */}
              <audio
                ref={audioRef}
                onError={(e) => {
                  console.error('音频加载错误:', e);
                  setError('音频加载失败，可能是链接已过期');
                }}
                preload="metadata"
                crossOrigin="anonymous"
              >
                <source src={playerData.audioUrl} type="audio/mp4" />
              </audio>
            </div>

            {/* 播放控制栏 */}
            <div style={{ padding: '16px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
              {/* 进度条 */}
              <div style={{ marginBottom: 16 }}>
                <Slider
                  value={duration > 0 ? (currentTime / duration) * 100 : 0}
                  onChange={handleSeek}
                  tooltip={{
                    formatter: (value) => formatTime((value! / 100) * duration)
                  }}
                  trackStyle={{ backgroundColor: '#1890ff' }}
                  railStyle={{ backgroundColor: '#d9d9d9' }}
                />
                
                {/* 缓冲进度显示 */}
                <div style={{ marginTop: 4, fontSize: '12px', color: '#666' }}>
                  缓冲: {buffered.toFixed(1)}% | 当前: {formatTime(currentTime)} / {formatTime(duration)}
                </div>
              </div>

              {/* 控制按钮 */}
              <Row justify="space-between" align="middle">
                <Col>
                  <Space>
                    <Button
                      type="primary"
                      shape="circle"
                      icon={isPlaying ? <PauseOutlined /> : <PlayCircleOutlined />}
                      onClick={togglePlay}
                      size="large"
                    />
                    
                    <Tooltip title="重新加载">
                      <Button
                        shape="circle"
                        icon={<ReloadOutlined />}
                        onClick={handleReload}
                      />
                    </Tooltip>
                  </Space>
                </Col>
                
                <Col flex={1} style={{ marginLeft: 16, marginRight: 16 }}>
                  <Row align="middle" gutter={8}>
                    <Col>
                      <Button
                        type="text"
                        icon={isMuted ? <MutedOutlined /> : <SoundOutlined />}
                        onClick={toggleMute}
                      />
                    </Col>
                    <Col flex={1}>
                      <Slider
                        min={0}
                        max={1}
                        step={0.1}
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        tooltip={{
                          formatter: (value) => `${Math.round(value! * 100)}%`
                        }}
                      />
                    </Col>
                  </Row>
                </Col>
                
                <Col>
                  <Tooltip title="全屏">
                    <Button
                      shape="circle"
                      icon={<FullscreenOutlined />}
                      onClick={toggleFullscreen}
                    />
                  </Tooltip>
                </Col>
              </Row>
            </div>
          </div>
        </Card>
      )}

      <style jsx>{`
        .player-container.fullscreen {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: #000;
          z-index: 9999;
          display: flex;
          flex-direction: column;
        }
        
        .player-container.fullscreen video {
          flex: 1;
          max-height: none;
        }
      `}</style>
    </div>
  );
};

export default OnlinePlayer;