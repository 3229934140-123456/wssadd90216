import { useState } from 'react'
import { 
  Button, Table, Modal, Form, Input, message, Space, Tag, 
  Row, Col, Card, Timeline, Empty, DatePicker, Select,
  Descriptions, Divider, Typography, List, Alert, Statistic,
  Collapse
} from 'antd'
import { 
  SearchOutlined, HistoryOutlined, FileSearchOutlined,
  EyeOutlined, RollbackOutlined, ExportOutlined,
  ClockCircleOutlined, UserOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useAppStore } from '@/store/appStore'
import { exportMultipleSheets } from '@/utils/excel'
import type { InfluencerSettlement, SettlementVersion } from '@/types'

const { Title, Text } = Typography
const { RangePicker } = DatePicker
const { TextArea } = Input
const { Panel } = Collapse

export default function Archive() {
  const [searchType, setSearchType] = useState<'order' | 'settlement' | 'version'>('settlement')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState<string>('')
  const [detailVisible, setDetailVisible] = useState(false)
  const [currentItem, setCurrentItem] = useState<any>(null)
  const [versionCompareVisible, setVersionCompareVisible] = useState(false)
  const [compareVersions, setCompareVersions] = useState<string[]>([])
  const [comparePeriod, setComparePeriod] = useState<string>('')

  const { 
    settlements, 
    versions, 
    orders, 
    exceptions,
    influencers,
    importedFiles
  } = useAppStore()

  const periods = Array.from(new Set([
    ...settlements.map(s => s.period),
    ...versions.map(v => v.period)
  ])).sort((a, b) => b.localeCompare(a))

  const getPeriodSettlements = (period: string) => {
    return settlements.filter(s => s.period === period)
  }

  const getPeriodVersions = (period: string) => {
    return versions.filter(v => v.period === period).sort((a, b) => b.version - a.version)
  }

  const searchOrders = () => {
    let result = [...orders]
    
    if (searchKeyword) {
      const keyword = searchKeyword.toLowerCase()
      result = result.filter(o => 
        o.orderNo.toLowerCase().includes(keyword) ||
        o.phone.includes(keyword) ||
        o.projectName.toLowerCase().includes(keyword) ||
        (o.customerName && o.customerName.toLowerCase().includes(keyword)) ||
        (o.influencerName && o.influencerName.toLowerCase().includes(keyword))
      )
    }
    
    if (dateRange) {
      result = result.filter(o => {
        const orderDate = dayjs(o.date)
        return orderDate.isAfter(dateRange[0]) && orderDate.isBefore(dateRange[1].endOf('day'))
      })
    }
    
    return result
  }

  const searchSettlements = () => {
    let result = [...settlements]
    
    if (searchKeyword) {
      const keyword = searchKeyword.toLowerCase()
      result = result.filter(s =>
        s.influencerName.toLowerCase().includes(keyword) ||
        s.period.includes(keyword)
      )
    }
    
    if (selectedPeriod) {
      result = result.filter(s => s.period === selectedPeriod)
    }
    
    return result
  }

  const openOrderDetail = (order: any) => {
    setCurrentItem(order)
    setDetailVisible(true)
  }

  const openSettlementDetail = (settlement: InfluencerSettlement) => {
    setCurrentItem(settlement)
    setDetailVisible(true)
  }

  const openVersionDetail = (version: SettlementVersion) => {
    const versionSettlements = settlements.filter(s => 
      version.settlementIds.includes(s.id)
    )
    setCurrentItem({ ...version, settlements: versionSettlements })
    setDetailVisible(true)
  }

  const handleExportHistory = () => {
    const allSettlements = [...settlements].sort((a, b) => 
      b.period.localeCompare(a.period) || b.version - a.version
    )
    
    const data = [
      { '历史结算记录': '' },
      { '导出时间': new Date().toLocaleString() },
      { '': '' },
      { '结算周期': '结算周期', '版本': '版本', '达人姓名': '达人姓名', '顾客数': '顾客数', '有效顾客': '有效顾客', '成交总额': '成交总额', '应付金额': '应付金额', '状态': '状态', '生成时间': '生成时间' },
      ...allSettlements.map(s => ({
        '结算周期': s.period,
        '版本': `V${s.version}`,
        '达人姓名': s.influencerName,
        '顾客数': s.customerCount,
        '有效顾客': s.validCustomerCount,
        '成交总额': s.totalAmount.toFixed(2),
        '应付金额': s.finalAmount.toFixed(2),
        '状态': s.status === 'draft' ? '草稿' : s.status === 'confirmed' ? '已确认' : '已付款',
        '生成时间': new Date(s.createdAt).toLocaleString()
      }))
    ]
    
    exportMultipleSheets([{ name: '历史记录', data }], `结算历史记录_${dayjs().format('YYYYMMDD')}.xlsx`)
    message.success('导出成功')
  }

  const handleVersionCompare = () => {
    setCompareVersions([])
    setComparePeriod('')
    setVersionCompareVisible(true)
  }

  const doVersionCompare = () => {
    if (!comparePeriod) {
      message.warning('请先选择结算周期')
      return
    }
    if (compareVersions.length !== 2) {
      message.warning('请选择两个版本进行对比')
      return
    }
    
    const [v1Id, v2Id] = compareVersions
    const v1 = versions.find(v => v.id === v1Id)
    const v2 = versions.find(v => v.id === v2Id)
    
    if (!v1 || !v2) return
    if (v1.period !== v2.period) {
      message.warning('只能对比同一结算周期的版本')
      return
    }
    
    const v1Settlements = settlements.filter(s => v1.settlementIds.includes(s.id))
    const v2Settlements = settlements.filter(s => v2.settlementIds.includes(s.id))
    
    const compareData: any[] = []
    const allInfluencers = new Set([
      ...v1Settlements.map(s => s.influencerName),
      ...v2Settlements.map(s => s.influencerName)
    ])
    
    allInfluencers.forEach(name => {
      const s1 = v1Settlements.find(s => s.influencerName === name)
      const s2 = v2Settlements.find(s => s.influencerName === name)
      
      const v1OrderNos = new Set(s1?.items.map(i => i.orderNo) || [])
      const v2OrderNos = new Set(s2?.items.map(i => i.orderNo) || [])
      const addedOrders = s2?.items.filter(i => !v1OrderNos.has(i.orderNo)) || []
      const removedOrders = s1?.items.filter(i => !v2OrderNos.has(i.orderNo)) || []
      const commonOrderNos = [...v1OrderNos].filter(n => v2OrderNos.has(n))
      const changedOrders: any[] = []
      commonOrderNos.forEach(no => {
        const o1 = s1?.items.find(i => i.orderNo === no)
        const o2 = s2?.items.find(i => i.orderNo === no)
        if (o1 && o2 && (Math.abs(o1.amount - o2.amount) > 0.01 || Math.abs(o1.commission - o2.commission) > 0.01 || o1.commissionRate !== o2.commissionRate)) {
          changedOrders.push({ orderNo: no, v1: o1, v2: o2 })
        }
      })
      
      compareData.push({
        name,
        v1Amount: s1?.finalAmount || 0,
        v2Amount: s2?.finalAmount || 0,
        diff: (s2?.finalAmount || 0) - (s1?.finalAmount || 0),
        v1Orders: s1?.items.length || 0,
        v2Orders: s2?.items.length || 0,
        ordersDiff: (s2?.items.length || 0) - (s1?.items.length || 0),
        v1Commission: s1?.totalCommission || 0,
        v2Commission: s2?.totalCommission || 0,
        commissionDiff: (s2?.totalCommission || 0) - (s1?.totalCommission || 0),
        addedOrders,
        removedOrders,
        changedOrders
      })
    })
    
    setCurrentItem({
      v1,
      v2,
      compareData,
      v1Total: v1Settlements.reduce((sum, s) => sum + s.finalAmount, 0),
      v2Total: v2Settlements.reduce((sum, s) => sum + s.finalAmount, 0)
    })
    setVersionCompareVisible(false)
    setDetailVisible(true)
  }

  const orderColumns = [
    {
      title: '订单号',
      dataIndex: 'orderNo',
      key: 'orderNo',
      width: 150,
      render: (text: string, record: any) => (
        <a onClick={() => openOrderDetail(record)}>{text}</a>
      )
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
      width: 120
    },
    {
      title: '顾客姓名',
      dataIndex: 'customerName',
      key: 'customerName',
      width: 100
    },
    {
      title: '项目名称',
      dataIndex: 'projectName',
      key: 'projectName'
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 100,
      render: (val: number, record: any) => 
        record.isRefund ? 
          <span className="amount-negative">-¥{(record.refundAmount || 0).toFixed(2)}</span> :
          <span className="amount-positive">¥{val.toFixed(2)}</span>
    },
    {
      title: '消费时间',
      dataIndex: 'date',
      key: 'date',
      width: 160
    },
    {
      title: '达人',
      dataIndex: 'influencerName',
      key: 'influencerName',
      width: 100,
      render: (val?: string) => val || <span className="text-muted">-</span>
    },
    {
      title: '结算周期',
      key: 'period',
      width: 100,
      render: (_: any, record: any) => {
        const settlement = settlements.find(s => 
          s.items.some((item: any) => item.orderId === record.id)
        )
        return settlement ? (
          <Tag color="blue">{settlement.period} V{settlement.version}</Tag>
        ) : <span className="text-muted">未结算</span>
      }
    }
  ]

  const settlementColumns = [
    {
      title: '结算周期',
      dataIndex: 'period',
      key: 'period',
      width: 120,
      render: (val: string) => <Tag color="blue">{val}</Tag>
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 80,
      render: (v: number) => `V${v}`
    },
    {
      title: '达人姓名',
      dataIndex: 'influencerName',
      key: 'influencerName',
      width: 120,
      render: (text: string, record: any) => (
        <a onClick={() => openSettlementDetail(record)} className="font-bold">{text}</a>
      )
    },
    {
      title: '顾客数',
      dataIndex: 'customerCount',
      key: 'customerCount',
      width: 80
    },
    {
      title: '有效顾客',
      dataIndex: 'validCustomerCount',
      key: 'validCustomerCount',
      width: 90
    },
    {
      title: '成交总额',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 110,
      render: (val: number) => <span className="amount-positive">¥{val.toFixed(2)}</span>
    },
    {
      title: '应付金额',
      dataIndex: 'finalAmount',
      key: 'finalAmount',
      width: 120,
      render: (val: number) => <span className="text-primary font-bold">¥{val.toFixed(2)}</span>
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const config: Record<string, { color: string; text: string }> = {
          draft: { color: 'default', text: '草稿' },
          confirmed: { color: 'processing', text: '已确认' },
          paid: { color: 'success', text: '已付款' }
        }
        return <Tag color={config[status].color}>{config[status].text}</Tag>
      }
    },
    {
      title: '生成时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (time: string) => new Date(time).toLocaleString()
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: InfluencerSettlement) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => openSettlementDetail(record)}>
          查看
        </Button>
      )
    }
  ]

  return (
    <div>
      <div className="card">
        <div className="flex-between mb-16">
          <div className="card-title" style={{ marginBottom: 0 }}>归档查询</div>
          <Space>
            <Button icon={<ExportOutlined />} onClick={handleExportHistory}>
              导出历史
            </Button>
            <Button icon={<HistoryOutlined />} onClick={handleVersionCompare}>
              版本对比
            </Button>
          </Space>
        </div>

        <div className="mb-16">
          <Space>
            <Select
              value={searchType}
              onChange={setSearchType}
              style={{ width: 150 }}
              options={[
                { value: 'settlement', label: '结算单查询' },
                { value: 'order', label: '订单查询' },
                { value: 'version', label: '版本记录' }
              ]}
            />
            {searchType === 'settlement' && (
              <Select
                placeholder="选择结算周期"
                value={selectedPeriod || undefined}
                onChange={setSelectedPeriod}
                style={{ width: 150 }}
                allowClear
                options={periods.map(p => ({ value: p, label: p }))}
              />
            )}
            {searchType === 'order' && (
              <RangePicker
                value={dateRange}
                onChange={(dates) => setDateRange(dates as any)}
                placeholder={['开始日期', '结束日期']}
              />
            )}
            <Input
              placeholder={searchType === 'order' ? '输入订单号/手机号/项目名称' : '输入达人姓名/结算周期'}
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              style={{ width: 300 }}
              prefix={<SearchOutlined />}
              allowClear
            />
            <Button type="primary" icon={<SearchOutlined />}>
              查询
            </Button>
          </Space>
        </div>

        {searchType === 'version' && (
          <div>
            {periods.length === 0 ? (
              <Empty description="暂无版本记录" />
            ) : (
              <div className="grid-3">
                {periods.map(period => {
                  const periodVersions = getPeriodVersions(period)
                  const periodSettlements = getPeriodSettlements(period)
                  const totalAmount = periodSettlements.reduce((sum, s) => sum + s.finalAmount, 0)
                  
                  return (
                    <Card 
                      key={period} 
                      size="small"
                      title={
                        <Space>
                          <ClockCircleOutlined />
                          <span className="font-bold">{period}</span>
                        </Space>
                      }
                      extra={
                        <Tag color="blue">{periodVersions.length} 个版本</Tag>
                      }
                    >
                      <Descriptions column={2} size="small">
                        <Descriptions.Item label="达人数">
                          {periodSettlements.length} 人
                        </Descriptions.Item>
                        <Descriptions.Item label="总佣金">
                          <span className="text-primary font-bold">¥{totalAmount.toFixed(2)}</span>
                        </Descriptions.Item>
                      </Descriptions>
                      <Divider style={{ margin: '12px 0' }} />
                      <Timeline>
                        {periodVersions.map(v => (
                          <Timeline.Item 
                            key={v.id}
                            color="blue"
                          >
                            <div onClick={() => openVersionDetail(v)} style={{ cursor: 'pointer' }}>
                              <Space>
                                <span className="font-bold">V{v.version}</span>
                                <span className="text-muted text-small">
                                  {new Date(v.createdAt).toLocaleString()}
                                </span>
                              </Space>
                              {v.note && <div className="text-small">{v.note}</div>}
                            </div>
                          </Timeline.Item>
                        ))}
                      </Timeline>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {searchType === 'settlement' && (
          <Table
            columns={settlementColumns}
            dataSource={searchSettlements()}
            rowKey="id"
            scroll={{ x: 1300 }}
            pagination={{ pageSize: 20, showSizeChanger: true }}
            locale={{ emptyText: <Empty description="暂无结算记录" /> }}
          />
        )}

        {searchType === 'order' && (
          <Table
            columns={orderColumns}
            dataSource={searchOrders()}
            rowKey="id"
            scroll={{ x: 1300 }}
            pagination={{ pageSize: 20, showSizeChanger: true }}
            locale={{ emptyText: <Empty description="暂无订单记录" /> }}
          />
        )}
      </div>

      <div className="card">
        <div className="card-title">数据统计概览</div>
        <Row gutter={16}>
          <Col span={6}>
            <Card>
              <Statistic 
                title="已导入文件" 
                value={importedFiles.length} 
                suffix="个"
                valueStyle={{ color: '#1677ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic 
                title="累计订单数" 
                value={orders.filter(o => !o.isRefund).length} 
                suffix="单"
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic 
                title="累计结算单" 
                value={settlements.length} 
                suffix="份"
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic 
                title="累计佣金" 
                value={settlements.reduce((sum, s) => sum + s.finalAmount, 0)} 
                precision={2}
                prefix="¥"
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
        </Row>
      </div>

      <Modal
        title="详情查看"
        open={detailVisible}
        width={900}
        onCancel={() => setDetailVisible(false)}
        footer={null}
      >
        {currentItem && currentItem.orderNo && (
          <div>
            <Title level={5} style={{ marginBottom: 16 }}>订单详情</Title>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="订单号">{currentItem.orderNo}</Descriptions.Item>
              <Descriptions.Item label="手机号">{currentItem.phone}</Descriptions.Item>
              <Descriptions.Item label="顾客姓名">{currentItem.customerName || '-'}</Descriptions.Item>
              <Descriptions.Item label="项目名称">{currentItem.projectName}</Descriptions.Item>
              <Descriptions.Item label="成交金额">
                <span className="amount-positive">¥{currentItem.amount.toFixed(2)}</span>
              </Descriptions.Item>
              <Descriptions.Item label="消费时间">{currentItem.date}</Descriptions.Item>
              <Descriptions.Item label="归属达人">
                {currentItem.influencerName || <span className="text-muted">未匹配</span>}
              </Descriptions.Item>
              <Descriptions.Item label="数据来源">
                {currentItem.source === 'cashier' ? '收银流水' : 
                 currentItem.source === 'groupbuy' ? '团购核销' : '退款明细'}
              </Descriptions.Item>
            </Descriptions>
            
            {currentItem.isRefund && (
              <Alert
                message="退款记录"
                description={`退款金额：¥${(currentItem.refundAmount || 0).toFixed(2)}，退款时间：${currentItem.refundDate}`}
                type="warning"
                showIcon
                style={{ marginTop: 16 }}
              />
            )}

            {currentItem.influencerName && (
              <div className="mt-16">
                <Divider orientation="left">关联结算单</Divider>
                {settlements
                  .filter(s => s.items.some((item: any) => item.orderId === currentItem.id))
                  .map(s => (
                    <Tag key={s.id} color="blue" style={{ marginBottom: 8 }}>
                      {s.period} V{s.version} - {s.influencerName} ¥{s.finalAmount.toFixed(2)}
                    </Tag>
                  ))}
              </div>
            )}

            <div className="mt-16">
              <Divider orientation="left">异常记录</Divider>
              {exceptions.filter(e => e.orderIds.includes(currentItem.id)).length === 0 ? (
                <Text type="secondary">无异常记录</Text>
              ) : (
                <List
                  size="small"
                  dataSource={exceptions.filter(e => e.orderIds.includes(currentItem.id))}
                  renderItem={(e) => (
                    <List.Item>
                      <Tag color={e.type === 'duplicate_customer' ? 'orange' : 
                               e.type === 'split_payment' ? 'blue' : 
                               e.type === 'cross_month' ? 'red' : 
                               e.type === 'cooperation_period' ? 'gold' : 'purple'}>
                        {e.type === 'duplicate_customer' ? '重复顾客' :
                         e.type === 'split_payment' ? '拆单付款' :
                         e.type === 'cross_month' ? '跨月补款' : 
                         e.type === 'cooperation_period' ? '合作周期异常' : '无法匹配'}
                      </Tag>
                      <span style={{ marginLeft: 8 }}>{e.description}</span>
                      <Tag 
                        color={e.status === 'pending' ? 'processing' : 
                               e.status === 'resolved' ? 'success' : 'default'}
                        style={{ marginLeft: 'auto' }}
                      >
                        {e.status === 'pending' ? '待处理' : 
                         e.status === 'resolved' ? '已处理' : '已忽略'}
                      </Tag>
                    </List.Item>
                  )}
                />
              )}
            </div>
          </div>
        )}

        {currentItem && currentItem.influencerName && currentItem.items && (
          <div>
            <Title level={5} style={{ marginBottom: 16 }}>
              {currentItem.influencerName} - 结算单详情
            </Title>
            <Descriptions bordered column={3} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="结算周期">{currentItem.period}</Descriptions.Item>
              <Descriptions.Item label="版本">V{currentItem.version}</Descriptions.Item>
              <Descriptions.Item label="状态">
                {currentItem.status === 'draft' ? '草稿' : 
                 currentItem.status === 'confirmed' ? '已确认' : '已付款'}
              </Descriptions.Item>
              <Descriptions.Item label="顾客数">{currentItem.customerCount} 人</Descriptions.Item>
              <Descriptions.Item label="有效顾客">{currentItem.validCustomerCount} 人</Descriptions.Item>
              <Descriptions.Item label="订单数">{currentItem.items.length} 单</Descriptions.Item>
              <Descriptions.Item label="成交总额">
                <span className="amount-positive">¥{currentItem.totalAmount.toFixed(2)}</span>
              </Descriptions.Item>
              <Descriptions.Item label="应付金额">
                <span className="text-primary font-bold">¥{currentItem.finalAmount.toFixed(2)}</span>
              </Descriptions.Item>
              <Descriptions.Item label="生成时间">
                {new Date(currentItem.createdAt).toLocaleString()}
              </Descriptions.Item>
            </Descriptions>

            <Table
              columns={[
                { title: '订单号', dataIndex: 'orderNo', key: 'orderNo' },
                { title: '项目名称', dataIndex: 'projectName', key: 'projectName' },
                { title: '项目类别', dataIndex: 'categoryName', key: 'categoryName', 
                  render: (v: string) => <Tag color="blue">{v}</Tag> },
                { title: '消费金额', dataIndex: 'amount', key: 'amount', 
                  render: (v: number) => `¥${v.toFixed(2)}` },
                { title: '提成比例', dataIndex: 'commissionRate', key: 'commissionRate',
                  render: (v: number) => `${(v * 100).toFixed(1)}%` },
                { title: '提成金额', dataIndex: 'commission', key: 'commission',
                  render: (v: number) => <span className="text-primary">¥{v.toFixed(2)}</span> },
                { title: '消费日期', dataIndex: 'date', key: 'date' }
              ]}
              dataSource={currentItem.items}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              size="small"
            />
          </div>
        )}

        {currentItem && currentItem.compareData && (
          <div>
            <Title level={5} style={{ marginBottom: 16 }}>版本对比</Title>
            <Alert
              message={`对比 ${currentItem.v1.period} 版本 V${currentItem.v1.version} 与 V${currentItem.v2.version}`}
              description={
                <div>
                  V{currentItem.v1.version} 总佣金：¥{currentItem.v1Total.toFixed(2)}
                  <span style={{ margin: '0 16px' }}>→</span>
                  V{currentItem.v2.version} 总佣金：¥{currentItem.v2Total.toFixed(2)}
                  <span className={currentItem.v2Total - currentItem.v1Total >= 0 ? 'text-success' : 'text-danger'} style={{ marginLeft: 16 }}>
                    差额：{currentItem.v2Total - currentItem.v1Total >= 0 ? '+' : ''}
                    ¥{(currentItem.v2Total - currentItem.v1Total).toFixed(2)}
                  </span>
                </div>
              }
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Table
              columns={[
                { title: '达人姓名', dataIndex: 'name', key: 'name', width: 120 },
                { title: `V${currentItem.v1.version}应付`, key: 'v1', width: 120,
                  render: (_: any, r: any) => `¥${r.v1Amount.toFixed(2)}` },
                { title: `V${currentItem.v2.version}应付`, key: 'v2', width: 120,
                  render: (_: any, r: any) => `¥${r.v2Amount.toFixed(2)}` },
                { title: '金额差异', key: 'diff', width: 120,
                  render: (_: any, r: any) => (
                    <span className={r.diff >= 0 ? 'text-success' : 'text-danger'}>
                      {r.diff >= 0 ? '+' : ''}¥{r.diff.toFixed(2)}
                    </span>
                  )},
                { title: `V${currentItem.v1.version}提成`, key: 'c1', width: 120,
                  render: (_: any, r: any) => `¥${r.v1Commission.toFixed(2)}` },
                { title: `V${currentItem.v2.version}提成`, key: 'c2', width: 120,
                  render: (_: any, r: any) => `¥${r.v2Commission.toFixed(2)}` },
                { title: '提成差异', key: 'cdiff', width: 120,
                  render: (_: any, r: any) => (
                    <span className={r.commissionDiff >= 0 ? 'text-success' : 'text-danger'}>
                      {r.commissionDiff >= 0 ? '+' : ''}¥{r.commissionDiff.toFixed(2)}
                    </span>
                  )},
                { title: `V${currentItem.v1.version}订单`, key: 'o1', width: 100,
                  render: (_: any, r: any) => `${r.v1Orders} 单` },
                { title: `V${currentItem.v2.version}订单`, key: 'o2', width: 100,
                  render: (_: any, r: any) => `${r.v2Orders} 单` },
                { title: '订单差异', key: 'odiff', width: 100,
                  render: (_: any, r: any) => (
                    <span className={r.ordersDiff >= 0 ? 'text-success' : 'text-danger'}>
                      {r.ordersDiff >= 0 ? '+' : ''}{r.ordersDiff} 单
                    </span>
                  )}
              ]}
              dataSource={currentItem.compareData}
              rowKey="name"
              pagination={false}
              size="small"
              expandable={{
                expandedRowRender: (record: any) => (
                  <div style={{ padding: '8px 16px', background: '#fafafa', borderRadius: 4 }}>
                    {record.addedOrders.length === 0 && record.removedOrders.length === 0 && record.changedOrders.length === 0 && (
                      <Text type="secondary">无订单变化</Text>
                    )}
                    {record.addedOrders.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <Tag color="green" style={{ marginBottom: 8 }}>
                          新增订单 {record.addedOrders.length} 单
                        </Tag>
                        <Table
                          size="small"
                          pagination={false}
                          columns={[
                            { title: '订单号', dataIndex: 'orderNo', key: 'orderNo' },
                            { title: '项目名称', dataIndex: 'projectName', key: 'projectName' },
                            { title: '成交金额', dataIndex: 'amount', key: 'amount',
                              render: (v: number) => `¥${v.toFixed(2)}` },
                            { title: '提成比例', dataIndex: 'commissionRate', key: 'commissionRate',
                              render: (v: number) => `${(v * 100).toFixed(1)}%` },
                            { title: '提成金额', dataIndex: 'commission', key: 'commission',
                              render: (v: number) => <span className="text-primary">¥{v.toFixed(2)}</span> },
                            { title: '消费日期', dataIndex: 'date', key: 'date' }
                          ]}
                          dataSource={record.addedOrders}
                          rowKey="id"
                        />
                      </div>
                    )}
                    {record.removedOrders.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <Tag color="red" style={{ marginBottom: 8 }}>
                          移除订单 {record.removedOrders.length} 单
                        </Tag>
                        <Table
                          size="small"
                          pagination={false}
                          columns={[
                            { title: '订单号', dataIndex: 'orderNo', key: 'orderNo' },
                            { title: '项目名称', dataIndex: 'projectName', key: 'projectName' },
                            { title: '成交金额', dataIndex: 'amount', key: 'amount',
                              render: (v: number) => `¥${v.toFixed(2)}` },
                            { title: '提成比例', dataIndex: 'commissionRate', key: 'commissionRate',
                              render: (v: number) => `${(v * 100).toFixed(1)}%` },
                            { title: '提成金额', dataIndex: 'commission', key: 'commission',
                              render: (v: number) => <span className="text-primary">¥{v.toFixed(2)}</span> },
                            { title: '消费日期', dataIndex: 'date', key: 'date' }
                          ]}
                          dataSource={record.removedOrders}
                          rowKey="id"
                        />
                      </div>
                    )}
                    {record.changedOrders.length > 0 && (
                      <div>
                        <Tag color="orange" style={{ marginBottom: 8 }}>
                          金额/提成变化 {record.changedOrders.length} 单
                        </Tag>
                        <Table
                          size="small"
                          pagination={false}
                          columns={[
                            { title: '订单号', key: 'orderNo',
                              render: (_: any, r: any) => r.orderNo },
                            { title: `V${currentItem.v1.version}金额`, key: 'v1amt',
                              render: (_: any, r: any) => `¥${r.v1.amount.toFixed(2)}` },
                            { title: `V${currentItem.v2.version}金额`, key: 'v2amt',
                              render: (_: any, r: any) => `¥${r.v2.amount.toFixed(2)}` },
                            { title: `V${currentItem.v1.version}提成`, key: 'v1com',
                              render: (_: any, r: any) => `${(r.v1.commissionRate * 100).toFixed(1)}% / ¥${r.v1.commission.toFixed(2)}` },
                            { title: `V${currentItem.v2.version}提成`, key: 'v2com',
                              render: (_: any, r: any) => `${(r.v2.commissionRate * 100).toFixed(1)}% / ¥${r.v2.commission.toFixed(2)}` }
                          ]}
                          dataSource={record.changedOrders}
                          rowKey="orderNo"
                        />
                      </div>
                    )}
                  </div>
                )
              }}
            />
          </div>
        )}

        {currentItem && currentItem.settlements && (
          <div>
            <Title level={5} style={{ marginBottom: 16 }}>
              {currentItem.period} V{currentItem.version} - 版本详情
            </Title>
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="创建时间">
                {new Date(currentItem.createdAt).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="创建人">
                <UserOutlined /> {currentItem.createdBy}
              </Descriptions.Item>
              <Descriptions.Item label="包含结算单" span={2}>
                {currentItem.settlementIds.length} 份
              </Descriptions.Item>
              <Descriptions.Item label="达人数量">
                {currentItem.settlements.length} 人
              </Descriptions.Item>
              <Descriptions.Item label="合计佣金">
                <span className="text-primary font-bold">
                  ¥{currentItem.settlements.reduce((sum: number, s: any) => sum + s.finalAmount, 0).toFixed(2)}
                </span>
              </Descriptions.Item>
              {currentItem.note && (
                <Descriptions.Item label="备注" span={2}>
                  {currentItem.note}
                </Descriptions.Item>
              )}
            </Descriptions>

            <Title level={5} style={{ marginBottom: 12 }}>达人结算单（点击展开查看订单明细）</Title>
            <Collapse 
              defaultActiveKey={[]} 
              ghost
              style={{ background: '#fff' }}
            >
              {currentItem.settlements.map((s: InfluencerSettlement) => (
                <Panel 
                  key={s.id}
                  header={
                    <Space>
                      <span className="font-bold">{s.influencerName}</span>
                      <Tag color="blue">{s.items.length} 单</Tag>
                      <Tag color="green">¥{s.totalAmount.toFixed(2)}</Tag>
                      <Tag color="red">¥{s.finalAmount.toFixed(2)}</Tag>
                      <Tag color={s.status === 'draft' ? 'default' : s.status === 'confirmed' ? 'processing' : 'success'}>
                        {s.status === 'draft' ? '草稿' : s.status === 'confirmed' ? '已确认' : '已付款'}
                      </Tag>
                    </Space>
                  }
                >
                  <Descriptions bordered column={3} size="small" style={{ marginBottom: 12 }}>
                    <Descriptions.Item label="顾客数">{s.customerCount} 人</Descriptions.Item>
                    <Descriptions.Item label="有效顾客">{s.validCustomerCount} 人</Descriptions.Item>
                    <Descriptions.Item label="订单数">{s.items.length} 单</Descriptions.Item>
                    <Descriptions.Item label="成交总额">
                      <span className="amount-positive">¥{s.totalAmount.toFixed(2)}</span>
                    </Descriptions.Item>
                    <Descriptions.Item label="提成总额">
                      <span className="text-primary">¥{s.totalCommission.toFixed(2)}</span>
                    </Descriptions.Item>
                    <Descriptions.Item label="应付佣金">
                      <span className="text-primary font-bold">¥{s.finalAmount.toFixed(2)}</span>
                    </Descriptions.Item>
                    <Descriptions.Item label="固定探店费">¥{s.fixedFee.toFixed(2)}</Descriptions.Item>
                    <Descriptions.Item label="有效客资奖励">¥{s.validCustomerReward.toFixed(2)}</Descriptions.Item>
                    <Descriptions.Item label="封顶金额">¥{s.maxAmount.toFixed(2)}</Descriptions.Item>
                  </Descriptions>
                  <Table
                    columns={[
                      { title: '订单号', dataIndex: 'orderNo', key: 'orderNo' },
                      { title: '顾客姓名', dataIndex: 'customerName', key: 'customerName', render: (v: string) => v || '-' },
                      { title: '项目名称', dataIndex: 'projectName', key: 'projectName' },
                      { title: '项目类别', dataIndex: 'categoryName', key: 'categoryName',
                        render: (v: string) => <Tag color="blue">{v}</Tag> },
                      { title: '成交金额', dataIndex: 'amount', key: 'amount',
                        render: (v: number) => `¥${v.toFixed(2)}` },
                      { title: '提成比例', dataIndex: 'commissionRate', key: 'commissionRate',
                        render: (v: number) => `${(v * 100).toFixed(1)}%` },
                      { title: '提成金额', dataIndex: 'commission', key: 'commission',
                        render: (v: number) => <span className="text-primary">¥{v.toFixed(2)}</span> },
                      { title: '消费日期', dataIndex: 'date', key: 'date' }
                    ]}
                    dataSource={s.items}
                    rowKey="id"
                    pagination={{ pageSize: 5, size: 'small' }}
                    size="small"
                  />
                </Panel>
              ))}
            </Collapse>
          </div>
        )}
      </Modal>

      <Modal
        title="选择版本进行对比"
        open={versionCompareVisible}
        onOk={doVersionCompare}
        onCancel={() => setVersionCompareVisible(false)}
        okText="开始对比"
        cancelText="取消"
      >
        <div className="mb-16">
          <Text type="secondary">请先选择结算周期，再选择该周期内的两个版本进行对比</Text>
        </div>
        <Form layout="vertical">
          <Form.Item label="结算周期" required>
            <Select
              placeholder="请选择结算周期"
              value={comparePeriod || undefined}
              onChange={(val) => {
                setComparePeriod(val)
                setCompareVersions([])
              }}
              style={{ width: '100%' }}
              options={periods.map(p => ({ value: p, label: p }))}
            />
          </Form.Item>
          <Form.Item label="对比版本（选择两个）" required>
            <Select
              mode="multiple"
              disabled={!comparePeriod}
              placeholder={comparePeriod ? '请选择两个版本' : '请先选择结算周期'}
              value={compareVersions}
              onChange={(vals) => setCompareVersions(vals.slice(0, 2))}
              style={{ width: '100%' }}
              maxTagCount={2}
              options={versions
                .filter(v => v.period === comparePeriod)
                .sort((a, b) => b.version - a.version)
                .map(v => ({
                  value: v.id,
                  label: `V${v.version} (${new Date(v.createdAt).toLocaleDateString()})`
                }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
