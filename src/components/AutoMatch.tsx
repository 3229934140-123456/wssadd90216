import { useState } from 'react'
import { Button, Table, Progress, message, Space, Tag, Statistic, Row, Col, Modal, Alert, Card } from 'antd'
import { PlayCircleOutlined, CheckCircleOutlined, WarningOutlined, ReloadOutlined } from '@ant-design/icons'
import { v4 as uuidv4 } from 'uuid'
import { useAppStore } from '@/store/appStore'
import { 
  normalizePhone, 
  normalizeAmount, 
  normalizeDate, 
  matchProjectCategory, 
  matchInfluencerByPhone,
  matchInfluencerByName,
  isInCooperationPeriod,
  detectExceptions
} from '@/utils/matching'
import type { FileType, OrderRecord } from '@/types'

export default function AutoMatch() {
  const [matching, setMatching] = useState(false)
  const [progress, setProgress] = useState(0)
  const [matchComplete, setMatchComplete] = useState(false)
  const [matchStats, setMatchStats] = useState({
    totalOrders: 0,
    matchedOrders: 0,
    unmatchedOrders: 0,
    matchedInfluencers: 0,
    exceptionCount: 0
  })

  const { 
    importedFiles, 
    fieldMappings, 
    influencers, 
    projectCategories,
    orders,
    setOrders,
    setExceptions
  } = useAppStore()

  const checkPrerequisites = () => {
    const requiredTypes: FileType[] = ['cashier', 'groupbuy']
    const missingTypes: string[] = []
    const typeLabels: Record<FileType, string> = {
      cooperation: '达人合作表',
      cashier: '收银流水',
      groupbuy: '团购核销表',
      refund: '退款明细'
    }
    
    requiredTypes.forEach(type => {
      if (!importedFiles.some(f => f.type === type)) {
        missingTypes.push(typeLabels[type])
      }
      const mapping = fieldMappings[type]
      if (!mapping) {
        if (!missingTypes.includes(typeLabels[type])) {
          missingTypes.push(`${typeLabels[type]}字段映射`)
        }
      } else {
        const requiredFields = [
          { key: 'phone', label: '手机号' },
          { key: 'orderNo', label: '订单号' },
          { key: 'projectName', label: '项目名称' },
          { key: 'amount', label: '成交金额' }
        ]
        const missingFields = requiredFields.filter(f => !mapping[f.key as keyof typeof mapping])
        if (missingFields.length > 0) {
          missingTypes.push(`${typeLabels[type]}缺少字段：${missingFields.map(f => f.label).join('、')}`)
        }
      }
    })

    if (influencers.length === 0) {
      missingTypes.push('达人佣金规则')
    }
    if (projectCategories.length === 0) {
      missingTypes.push('项目类别配置')
    }

    return missingTypes
  }

  const processFileToOrders = async (file: typeof importedFiles[0]): Promise<OrderRecord[]> => {
    const mapping = fieldMappings[file.type]
    if (!mapping) return []

    const processedOrders: OrderRecord[] = []

    for (const row of file.data) {
      const phone = normalizePhone(row[mapping.phone])
      const amount = normalizeAmount(row[mapping.amount])
      const date = normalizeDate(mapping.date ? row[mapping.date] : row[mapping.orderNo])
      
      if (!phone || !row[mapping.orderNo] || !row[mapping.projectName]) {
        continue
      }

      let influencer = null
      if (mapping.influencerName && row[mapping.influencerName]) {
        influencer = matchInfluencerByName(row[mapping.influencerName], influencers)
      }
      if (!influencer) {
        influencer = matchInfluencerByPhone(phone, influencers)
      }

      const category = matchProjectCategory(row[mapping.projectName], projectCategories)
      
      let isRefund = false
      let refundAmount = 0
      if (file.type === 'refund') {
        isRefund = true
        refundAmount = amount
      }

      const order: OrderRecord = {
        id: uuidv4(),
        source: file.type,
        orderNo: String(row[mapping.orderNo]),
        phone,
        customerName: mapping.customerName ? row[mapping.customerName] : undefined,
        projectName: row[mapping.projectName],
        amount: isRefund ? 0 : amount,
        date,
        categoryId: category?.id,
        influencerId: influencer?.id,
        influencerName: influencer?.name,
        isRefund,
        refundAmount: isRefund ? refundAmount : undefined,
        refundDate: isRefund ? date : undefined,
        rawData: row
      }

      if (influencer && !isInCooperationPeriod(date, influencer)) {
      }

      processedOrders.push(order)
    }

    return processedOrders
  }

  const startMatching = async () => {
    const missing = checkPrerequisites()
    if (missing.length > 0) {
      Modal.warning({
        title: '缺少必要配置',
        content: (
          <div>
            <p>请先完成以下配置：</p>
            <ul>
              {missing.map((item, idx) => <li key={idx}>{item}</li>)}
            </ul>
          </div>
        )
      })
      return
    }

    setMatching(true)
    setProgress(0)
    setMatchComplete(false)

    try {
      const allOrders: OrderRecord[] = []
      const filesToProcess = importedFiles.filter(f => 
        ['cashier', 'groupbuy', 'refund'].includes(f.type) && fieldMappings[f.type]
      )

      for (let i = 0; i < filesToProcess.length; i++) {
        const file = filesToProcess[i]
        const orders = await processFileToOrders(file)
        allOrders.push(...orders)
        setProgress(Math.round(((i + 1) / filesToProcess.length) * 80))
        await new Promise(resolve => setTimeout(resolve, 200))
      }

      setOrders(allOrders)
      setProgress(90)

      const exceptions = detectExceptions(allOrders, influencers)
      setExceptions(exceptions)
      setProgress(100)

      const matchedOrders = allOrders.filter(o => o.influencerId && !o.isRefund)
      const matchedInfluencerIds = new Set(matchedOrders.map(o => o.influencerId))

      setMatchStats({
        totalOrders: allOrders.filter(o => !o.isRefund).length,
        matchedOrders: matchedOrders.length,
        unmatchedOrders: allOrders.filter(o => !o.influencerId && !o.isRefund).length,
        matchedInfluencers: matchedInfluencerIds.size,
        exceptionCount: exceptions.length
      })

      setMatchComplete(true)
      message.success(`匹配完成，共处理 ${allOrders.length} 条订单`)
    } catch (error) {
      message.error(`匹配失败：${error}`)
    } finally {
      setMatching(false)
    }
  }

  const matchedInfluencers = () => {
    const influencerStats = new Map<string, { count: number, amount: number }>()
    orders.forEach(order => {
      if (order.influencerId && !order.isRefund) {
        const existing = influencerStats.get(order.influencerId) || { count: 0, amount: 0 }
        influencerStats.set(order.influencerId, {
          count: existing.count + 1,
          amount: existing.amount + order.amount
        })
      }
    })
    return influencers.map(inf => ({
      ...inf,
      orderCount: influencerStats.get(inf.id)?.count || 0,
      orderAmount: influencerStats.get(inf.id)?.amount || 0
    })).filter(i => i.orderCount > 0)
  }

  const orderColumns = [
    {
      title: '订单号',
      dataIndex: 'orderNo',
      key: 'orderNo',
      width: 150,
      ellipsis: true
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
      key: 'projectName',
      width: 200,
      ellipsis: true
    },
    {
      title: '项目类别',
      key: 'category',
      width: 100,
      render: (_: any, record: OrderRecord) => {
        const category = projectCategories.find(c => c.id === record.categoryId)
        return category ? <Tag color="blue">{category.name}</Tag> : <Tag color="default">未分类</Tag>
      }
    },
    {
      title: '成交金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 100,
      render: (val: number) => <span className="amount-positive">¥{val.toFixed(2)}</span>
    },
    {
      title: '消费时间',
      dataIndex: 'date',
      key: 'date',
      width: 160
    },
    {
      title: '匹配达人',
      key: 'influencer',
      width: 120,
      render: (_: any, record: OrderRecord) => {
        if (record.isRefund) return <Tag color="red">退款单</Tag>
        if (record.influencerName) {
          return <Tag color="green">{record.influencerName}</Tag>
        }
        return <Tag color="warning">未匹配</Tag>
      }
    },
    {
      title: '合作周期',
      key: 'period',
      width: 100,
      render: (_: any, record: OrderRecord) => {
        if (!record.influencerId) return null
        const influencer = influencers.find(i => i.id === record.influencerId)
        if (!influencer) return null
        const inPeriod = isInCooperationPeriod(record.date, influencer)
        return inPeriod ? 
          <Tag color="success">有效期内</Tag> : 
          <Tag color="warning">超期</Tag>
      }
    },
    {
      title: '数据来源',
      dataIndex: 'source',
      key: 'source',
      width: 100,
      render: (val: FileType) => {
        const labels: Record<FileType, string> = {
          cooperation: '达人合作表',
          cashier: '收银流水',
          groupbuy: '团购核销表',
          refund: '退款明细'
        }
        return labels[val]
      }
    }
  ]

  const influencerColumns = [
    {
      title: '达人姓名',
      dataIndex: 'name',
      key: 'name',
      width: 120,
      render: (text: string) => <span className="font-bold">{text}</span>
    },
    {
      title: '合作周期',
      key: 'period',
      width: 200,
      render: (_: any, record: any) => (
        <span>{record.cooperationStart} ~ {record.cooperationEnd}</span>
      )
    },
    {
      title: '匹配订单数',
      dataIndex: 'orderCount',
      key: 'orderCount',
      width: 120,
      render: (val: number) => <span className="text-primary font-bold">{val} 单</span>
    },
    {
      title: '成交总额',
      dataIndex: 'orderAmount',
      key: 'orderAmount',
      width: 120,
      render: (val: number) => <span className="amount-positive">¥{val.toFixed(2)}</span>
    },
    {
      title: '提点比例',
      dataIndex: 'commissionRate',
      key: 'commissionRate',
      width: 100,
      render: (val: number) => `${(val * 100).toFixed(1)}%`
    }
  ]

  return (
    <div>
      {!matchComplete && (
        <div className="card">
          <div className="card-title">自动匹配准备</div>
          
          {checkPrerequisites().length > 0 && (
            <Alert
              message="有未完成的配置项"
              description={
                <div>
                  请先完成以下配置：
                  <ul style={{ marginTop: 8 }}>
                    {checkPrerequisites().map((item, idx) => (
                      <li key={idx} className="text-warning">{item}</li>
                    ))}
                  </ul>
                </div>
              }
              type="warning"
              showIcon
              style={{ marginBottom: 24 }}
            />
          )}

          <div className="grid-4 mb-24">
            {importedFiles.filter(f => ['cashier', 'groupbuy', 'refund'].includes(f.type)).map(file => {
              const mapping = fieldMappings[file.type]
              return (
                <div key={file.id} className="stat-card">
                  <div className="flex-between">
                    <div>
                      <div className="stat-value">{file.data.length}</div>
                      <div className="stat-label">
                        {file.type === 'cashier' ? '收银流水' : 
                         file.type === 'groupbuy' ? '团购核销' : '退款明细'} 条数
                      </div>
                    </div>
                    {mapping ? 
                      <CheckCircleOutlined style={{ fontSize: 24, color: '#52c41a' }} /> :
                      <WarningOutlined style={{ fontSize: 24, color: '#faad14' }} />
                    }
                  </div>
                </div>
              )
            })}
          </div>

          <div className="grid-4 mb-24">
            <div className="stat-card">
              <div className="stat-value text-primary">{influencers.length}</div>
              <div className="stat-label">已配置达人</div>
            </div>
            <div className="stat-card">
              <div className="stat-value text-success">{projectCategories.length}</div>
              <div className="stat-label">项目类别</div>
            </div>
          </div>

          {matching ? (
            <div style={{ padding: '48px 0', textAlign: 'center' }}>
              <Progress 
                type="circle" 
                percent={progress} 
                size={120}
                status="active"
              />
              <div className="mt-16 text-muted">正在匹配数据...</div>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <Button 
                type="primary" 
                size="large"
                icon={<PlayCircleOutlined />}
                onClick={startMatching}
                disabled={checkPrerequisites().length > 0}
                style={{ width: 200, height: 48, fontSize: 16 }}
              >
                开始自动匹配
              </Button>
            </div>
          )}
        </div>
      )}

      {matchComplete && (
        <>
          <Row gutter={16} className="mb-24">
            <Col span={6}>
              <Card>
                <Statistic 
                  title="有效订单总数" 
                  value={matchStats.totalOrders} 
                  suffix="单"
                  valueStyle={{ color: '#1677ff' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic 
                  title="已匹配订单" 
                  value={matchStats.matchedOrders} 
                  suffix="单"
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic 
                  title="待处理异常" 
                  value={matchStats.exceptionCount} 
                  suffix="条"
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic 
                  title="覆盖达人" 
                  value={matchStats.matchedInfluencers} 
                  suffix="人"
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
          </Row>

          <div className="card">
            <div className="flex-between mb-16">
              <div className="card-title" style={{ marginBottom: 0 }}>达人匹配统计</div>
              <Button icon={<ReloadOutlined />} onClick={startMatching}>
                重新匹配
              </Button>
            </div>
            <Table
              columns={influencerColumns}
              dataSource={matchedInfluencers()}
              rowKey="id"
              pagination={false}
              summary={(pageData) => {
                let totalCount = 0
                let totalAmount = 0
                pageData.forEach((data: any) => {
                  totalCount += data.orderCount
                  totalAmount += data.orderAmount
                })
                return (
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={2}>
                      <span className="font-bold">合计</span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2}>
                      <span className="text-primary font-bold">{totalCount} 单</span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={3}>
                      <span className="amount-positive">¥{totalAmount.toFixed(2)}</span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={4}></Table.Summary.Cell>
                  </Table.Summary.Row>
                )
              }}
            />
          </div>

          <div className="card">
            <div className="card-title">订单明细</div>
            <Table
              columns={orderColumns}
              dataSource={orders.filter(o => !o.isRefund)}
              rowKey="id"
              scroll={{ x: 1300, y: 400 }}
              pagination={{ pageSize: 50, showSizeChanger: true }}
            />
          </div>
        </>
      )}
    </div>
  )
}
