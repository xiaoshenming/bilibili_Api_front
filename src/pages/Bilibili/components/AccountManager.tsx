import React, { useState, useEffect } from 'react';
import { 
  Card, 
  List, 
  Button, 
  message, 
  Avatar, 
  Tag, 
  Space, 
  Modal, 
  Descriptions, 
  Spin,
  Input,
  Select,
  DatePicker,
  Statistic,
  Row,
  Col,
  Progress,
  Tooltip,
  Badge,
  Popconfirm,
  notification,
  Typography,
  Divider,
  Empty,
  Alert
} from 'antd';
import { 
  UserOutlined, 
  DeleteOutlined, 
  ReloadOutlined, 
  ExclamationCircleOutlined,
  SearchOutlined,
  FilterOutlined,
  EyeOutlined,
  HeartOutlined,
  StarOutlined,
  SettingOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  CrownOutlined,
  TeamOutlined
} from '@ant-design/icons';
import { request } from '@umijs/max';
import dayjs from 'dayjs';
import { getSafeImageUrl } from '@/utils/imageProxy';

const { Search } = Input;
const { Option } = Select;
const { Text, Title } = Typography;

interface Account {
  uid: string;
  name: string;
  face: string;
  isLogin: boolean;
  cookies?: string;
  loginTime?: string;
  level?: number;
  vipStatus?: number;
  vipType?: number;
  follower?: number;
  following?: number;
  videoCount?: number;
  lastActiveTime?: string;
  accountStatus?: 'active' | 'inactive' | 'banned' | 'warning';
  coins?: number;
  experience?: number;
}

interface AccountStats {
  totalAccounts: number;
  activeAccounts: number;
  inactiveAccounts: number;
  bannedAccounts: number;
  totalCoins: number;
  totalFollowers: number;
}

interface FilterOptions {
  status: string;
  level: string;
  vipType: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

interface BilibiliAccount {
  id: string;
  dedeuserid: string;
  nickname: string;
  avatar: string;
  is_active: boolean;
  created_at: string;
  level?: number;
  vipStatus?: number;
  vipType?: number;
  follower?: number;
  following?: number;
  videoCount?: number;
  lastActiveTime?: string;
  accountStatus?: 'active' | 'inactive' | 'banned' | 'warning';
  coins?: number;
  experience?: number;
}

interface AccountManagerProps {
  accounts: BilibiliAccount[];
  onAccountChange: () => void;
}

const AccountManager: React.FC<AccountManagerProps> = ({ accounts, onAccountChange }) => {
  const [loading, setLoading] = useState<string>('');
  const [searchText, setSearchText] = useState('');
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    status: 'all',
    level: 'all',
    vipType: 'all',
    sortBy: 'loginTime',
    sortOrder: 'desc'
  });
  const [accountStats, setAccountStats] = useState<AccountStats>({
    totalAccounts: 0,
    activeAccounts: 0,
    inactiveAccounts: 0,
    bannedAccounts: 0,
    totalCoins: 0,
    totalFollowers: 0
  });
  const [refreshing, setRefreshing] = useState(false);
  const [batchOperationVisible, setBatchOperationVisible] = useState(false);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);

  // 计算账号统计信息
  const calculateStats = (accountList: BilibiliAccount[]) => {
    const stats: AccountStats = {
      totalAccounts: accountList.length,
      activeAccounts: accountList.filter(acc => acc.accountStatus === 'active').length,
      inactiveAccounts: accountList.filter(acc => acc.accountStatus === 'inactive').length,
      bannedAccounts: accountList.filter(acc => acc.accountStatus === 'banned').length,
      totalCoins: accountList.reduce((sum, acc) => sum + (acc.coins || 0), 0),
      totalFollowers: accountList.reduce((sum, acc) => sum + (acc.follower || 0), 0)
    };
    setAccountStats(stats);
  };

  // 过滤和搜索账号
  const getFilteredAccounts = () => {
    let filtered = accounts.filter(account => {
      // 搜索过滤
      if (searchText && !account.nickname.toLowerCase().includes(searchText.toLowerCase()) && 
          !account.dedeuserid.includes(searchText)) {
        return false;
      }
      
      // 状态过滤
      if (filterOptions.status !== 'all' && account.accountStatus !== filterOptions.status) {
        return false;
      }
      
      // 等级过滤
      if (filterOptions.level !== 'all') {
        const level = account.level || 0;
        if (filterOptions.level === 'low' && level >= 3) return false;
        if (filterOptions.level === 'medium' && (level < 3 || level >= 5)) return false;
        if (filterOptions.level === 'high' && level < 5) return false;
      }
      
      // VIP类型过滤
      if (filterOptions.vipType !== 'all') {
        const vipType = account.vipType || 0;
        if (filterOptions.vipType === 'none' && vipType > 0) return false;
        if (filterOptions.vipType === 'monthly' && vipType !== 1) return false;
        if (filterOptions.vipType === 'annual' && vipType !== 2) return false;
      }
      
      return true;
    });
    
    // 排序
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (filterOptions.sortBy) {
        case 'name':
          aValue = a.nickname;
          bValue = b.nickname;
          break;
        case 'level':
          aValue = a.level || 0;
          bValue = b.level || 0;
          break;
        case 'follower':
          aValue = a.follower || 0;
          bValue = b.follower || 0;
          break;
        case 'coins':
          aValue = a.coins || 0;
          bValue = b.coins || 0;
          break;
        case 'loginTime':
        default:
          aValue = new Date(a.created_at || 0).getTime();
          bValue = new Date(b.created_at || 0).getTime();
          break;
      }
      
      if (filterOptions.sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
    
    return filtered;
  };

  // 刷新所有账号信息
  const refreshAllAccounts = async () => {
    setRefreshing(true);
    try {
      const result = await request('/api/bilibili/accounts/refresh', {
        method: 'POST',
      });
      
      if (result.code === 200) {
        onAccountChange();
        calculateStats(result.data);
        notification.success({
          message: '刷新成功',
          description: '所有账号信息已更新'
        });
      } else {
        message.error(result.message || '刷新失败');
      }
    } catch (error) {
      message.error('刷新失败，请重试');
      console.error('刷新账号失败:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // 监听账号变化，计算统计信息
  useEffect(() => {
    calculateStats(accounts);
  }, [accounts]);

  // 获取账号状态标签
  const getStatusTag = (account: BilibiliAccount) => {
    if (!account.is_active) {
      return <Tag color="red" icon={<CloseCircleOutlined />}>已停用</Tag>;
    }
    
    const status = account.accountStatus || 'active';
    switch (status) {
      case 'active':
        return <Tag color="green" icon={<CheckCircleOutlined />}>正常</Tag>;
      case 'warning':
        return <Tag color="orange" icon={<WarningOutlined />}>警告</Tag>;
      case 'banned':
        return <Tag color="red" icon={<CloseCircleOutlined />}>封禁</Tag>;
      case 'inactive':
        return <Tag color="gray" icon={<InfoCircleOutlined />}>不活跃</Tag>;
      default:
        return <Tag color="default">未知</Tag>;
    }
  };

  // 获取VIP标签
  const getVipTag = (vipType?: number) => {
    if (!vipType || vipType === 0) return null;
    
    switch (vipType) {
      case 1:
        return <Tag color="gold" icon={<CrownOutlined />}>月度大会员</Tag>;
      case 2:
        return <Tag color="purple" icon={<CrownOutlined />}>年度大会员</Tag>;
      default:
        return <Tag color="blue" icon={<CrownOutlined />}>大会员</Tag>;
    }
  };

  // 获取等级颜色
  const getLevelColor = (level?: number) => {
    if (!level) return '#ccc';
    if (level >= 6) return '#ff6b6b';
    if (level >= 5) return '#ff9f43';
    if (level >= 4) return '#feca57';
    if (level >= 3) return '#48dbfb';
    if (level >= 2) return '#0abde3';
    return '#778ca3';
  };

  const filteredAccounts = getFilteredAccounts();

  // 批量操作账号
  const batchOperation = async (operation: string) => {
    if (selectedAccountIds.length === 0) {
      message.warning('请选择要操作的账号');
      return;
    }
    
    setLoading('batch');
    try {
      const result = await request('/api/bilibili/accounts/batch', {
        method: 'POST',
        data: {
          accountIds: selectedAccountIds,
          operation
        }
      });
      
      if (result.code === 200) {
        message.success(`批量${operation}成功`);
        onAccountChange();
        setSelectedAccountIds([]);
        setBatchOperationVisible(false);
      } else {
        message.error(result.message || `批量${operation}失败`);
      }
    } catch (error) {
      message.error('批量操作失败，请重试');
      console.error('批量操作失败:', error);
    } finally {
      setLoading('');
    }
  };

  const toggleAccountStatus = async (accountId: string, isActive: boolean) => {
    setLoading(accountId);
    
    try {
      const result = await request(`/api/bilibili/accounts/${accountId}/toggle`, {
        method: 'PUT',
        data: { isActive: !isActive },
      });
      
      if (result.code === 200) {
        message.success(isActive ? '账号已停用' : '账号已激活');
        onAccountChange();
      } else {
        message.error(result.message || '操作失败');
      }
    } catch (error) {
      message.error('网络错误，请重试');
      console.error('切换账号状态失败:', error);
    } finally {
      setLoading('');
    }
  };

  const deleteAccount = async (accountId: string) => {
    setLoading(accountId);
    
    try {
      const result = await request(`/api/bilibili/accounts/${accountId}`, {
        method: 'DELETE',
      });
      
      if (result.code === 200) {
        message.success('账号删除成功');
        onAccountChange();
      } else {
        message.error(result.message || '删除失败');
      }
    } catch (error) {
      message.error('网络错误，请重试');
      console.error('删除账号失败:', error);
    } finally {
      setLoading('');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN');
  };

  return (
    <div className="account-manager">
      {/* 统计面板 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="总账号数"
              value={accountStats.totalAccounts}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="活跃账号"
              value={accountStats.activeAccounts}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="总粉丝数"
              value={accountStats.totalFollowers}
              prefix={<HeartOutlined />}
              valueStyle={{ color: '#eb2f96' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="总硬币数"
              value={accountStats.totalCoins}
              prefix={<StarOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 搜索和过滤 */}
      <Card title="账号管理" style={{ marginBottom: 24 }}>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={8}>
            <Search
              placeholder="搜索账号名称或UID"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={4}>
            <Select
              placeholder="状态筛选"
              value={filterOptions.status}
              onChange={(value) => setFilterOptions(prev => ({ ...prev, status: value }))}
              style={{ width: '100%' }}
            >
              <Option value="all">全部状态</Option>
              <Option value="active">正常</Option>
              <Option value="inactive">不活跃</Option>
              <Option value="warning">警告</Option>
              <Option value="banned">封禁</Option>
            </Select>
          </Col>
          <Col xs={24} sm={4}>
            <Select
              placeholder="等级筛选"
              value={filterOptions.level}
              onChange={(value) => setFilterOptions(prev => ({ ...prev, level: value }))}
              style={{ width: '100%' }}
            >
              <Option value="all">全部等级</Option>
              <Option value="low">低等级(0-2)</Option>
              <Option value="medium">中等级(3-4)</Option>
              <Option value="high">高等级(5+)</Option>
            </Select>
          </Col>
          <Col xs={24} sm={4}>
            <Select
              placeholder="VIP筛选"
              value={filterOptions.vipType}
              onChange={(value) => setFilterOptions(prev => ({ ...prev, vipType: value }))}
              style={{ width: '100%' }}
            >
              <Option value="all">全部类型</Option>
              <Option value="none">非会员</Option>
              <Option value="monthly">月度会员</Option>
              <Option value="annual">年度会员</Option>
            </Select>
          </Col>
          <Col xs={24} sm={4}>
            <Space>
              <Tooltip title="刷新所有账号">
                <Button 
                  icon={<SyncOutlined />} 
                  onClick={refreshAllAccounts}
                  loading={refreshing}
                />
              </Tooltip>
              <Tooltip title="批量操作">
                <Button 
                  icon={<SettingOutlined />} 
                  onClick={() => setBatchOperationVisible(true)}
                  disabled={selectedAccountIds.length === 0}
                />
              </Tooltip>
            </Space>
          </Col>
        </Row>

        {/* 账号列表 */}
        {filteredAccounts.length === 0 ? (
          <Empty
            description="暂无符合条件的账号"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            {accounts.length === 0 && (
              <Button type="primary" href="#/bilibili/login">
                添加账号
              </Button>
            )}
          </Empty>
        ) : (
          <List
            dataSource={filteredAccounts}
            renderItem={(account) => (
              <List.Item>
                <Card style={{ width: '100%' }} bodyStyle={{ padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={selectedAccountIds.includes(account.dedeuserid)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedAccountIds(prev => [...prev, account.dedeuserid]);
                            } else {
                              setSelectedAccountIds(prev => prev.filter(id => id !== account.dedeuserid));
                            }
                          }}
                        />
                        <Badge 
                          count={account.level || 0} 
                          style={{ backgroundColor: getLevelColor(account.level) }}
                        >
                          <Avatar 
                            size={64} 
                            src={getSafeImageUrl(account.avatar)} 
                            icon={<UserOutlined />}
                          />
                        </Badge>
                      </div>
                      
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <Title level={5} style={{ margin: 0 }}>{account.nickname}</Title>
                          {getStatusTag(account)}
                          {getVipTag(account.vipType)}
                        </div>
                        
                        <Row gutter={16}>
                          <Col span={12}>
                            <Text type="secondary">UID: {account.dedeuserid}</Text>
                          </Col>
                          <Col span={12}>
                            <Text type="secondary">等级: Lv.{account.level || 0}</Text>
                          </Col>
                          <Col span={12}>
                            <Text type="secondary">
                              <EyeOutlined /> 粉丝: {(account.follower || 0).toLocaleString()}
                            </Text>
                          </Col>
                          <Col span={12}>
                            <Text type="secondary">
                              <StarOutlined /> 硬币: {account.coins || 0}
                            </Text>
                          </Col>
                        </Row>
                        
                        <div style={{ marginTop: 8 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            登录时间: {dayjs(account.created_at).format('YYYY-MM-DD HH:mm:ss')}
                          </Text>
                        </div>
                      </div>
                    </div>
                    
                    <Space>
                      <Tooltip title={account.is_active ? '停用账号' : '启用账号'}>
                        <Popconfirm
                          title={`确定要${account.is_active ? '停用' : '启用'}此账号吗？`}
                          onConfirm={() => toggleAccountStatus(account.dedeuserid, account.is_active)}
                          okText="确定"
                          cancelText="取消"
                        >
                          <Button 
                            type={account.is_active ? "default" : "primary"}
                            loading={loading === account.dedeuserid}
                            icon={account.is_active ? <CloseCircleOutlined /> : <CheckCircleOutlined />}
                          >
                            {account.is_active ? '停用' : '启用'}
                          </Button>
                        </Popconfirm>
                      </Tooltip>
                      
                      <Tooltip title="删除账号">
                        <Popconfirm
                          title="确定要删除此账号吗？此操作不可恢复！"
                          onConfirm={() => deleteAccount(account.dedeuserid)}
                          okText="确定"
                          cancelText="取消"
                          okType="danger"
                        >
                          <Button 
                            danger 
                            icon={<DeleteOutlined />}
                            loading={loading === `delete_${account.dedeuserid}`}
                          >
                            删除
                          </Button>
                        </Popconfirm>
                      </Tooltip>
                    </Space>
                  </div>
                </Card>
              </List.Item>
            )}
          />
        )}
      </Card>

      {/* 批量操作模态框 */}
      <Modal
        title="批量操作"
        open={batchOperationVisible}
        onCancel={() => setBatchOperationVisible(false)}
        footer={null}
      >
        <div style={{ textAlign: 'center' }}>
          <Text>已选择 {selectedAccountIds.length} 个账号</Text>
          <Divider />
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Button 
              type="primary" 
              block 
              onClick={() => batchOperation('activate')}
              loading={loading === 'batch'}
            >
              批量启用
            </Button>
            <Button 
              block 
              onClick={() => batchOperation('deactivate')}
              loading={loading === 'batch'}
            >
              批量停用
            </Button>
            <Button 
              danger 
              block 
              onClick={() => batchOperation('delete')}
              loading={loading === 'batch'}
            >
              批量删除
            </Button>
          </Space>
        </div>
      </Modal>
    </div>
  );
};

export default AccountManager;