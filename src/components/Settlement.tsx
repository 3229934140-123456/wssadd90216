import { useState } from 'react'
import { 
  Button, Table, Modal, Form, Input, message, Space, Tag, 
  Row, Col, Card, Statistic, Divider, Tabs, Empty, Alert,
  Descriptions, Popconfirm, Select
} from 'antd'
import { 
  FileOutlined, ExportOutlined, CheckCircleOutlined, 
  PrinterOutlined, HistoryOutlined, SendOutlined
} from '@ant-design/icons'
import { v4 as uuidv4 } from 'uuid'
import dayjs from 'dayjs'
import { useAppStore } from '@/store/appStore'
import { calculateSettlement } from '@/utils/matching'
import { exportMultipleSheets } from '@/utils/excel'
import type { InfluencerSettlement, SettlementItem } from '@/types'

const { TextArea } = Input
const { TabPane } = Tabs

export default function Settlement() {
  const [generating, setGenerating] = useState(false)
  const [detailVisible, setDetailVisible] = useState(false)
  const [currentSettlement, setCurrentSettlement] = useState<InfluencerSettlement | null>(null)
  const [confirmVisible, setConfirmVisible] = useState(false)
  const [paymentVisible, setPaymentVisible] = useState(false)
  const [period, setPeriod] = useState(dayjs().format('YYYY-MM'))

  const { 
    influencers, 
    orders, 
    exceptions, 
    projectCategories,
    settlements,
    setSettlements,
    addSettlement,
    updateSettlement,
    addVersion,
    currentVersion,
    setCurrentVersion,
    setCurrentPeriod
  } = useAppStore()

  const pendingExceptions = exceptions.filter(e => e.status === 'pending').length

  const generateSettlements = async () => {
    if (pendingExceptions > 0) {
      Modal.confirm({
        title: '有待处理的异常',
        content: `当前有 ${pendingExceptions} 条异常未处理，是否继续生成结算单？未处理的异常订单可能导致结算数据不准确。`,
        okText: '继续生成',
        cancelText: '返回处理',
        onOk: () => doGenerate()
      })
      return
    }
    doGenerate()
  }

  const doGenerate = async (versionNum?: number) => {
    setGenerating(true)
    try {
      const newSettlements: InfluencerSettlement[] = []
      const version = versionNum ?? currentVersion
      
      for (const influencer of influencers) {
        const settlement = calculateSettlement(
          influencer,
          orders,
          projectCategories,
          exceptions
        )
        settlement.version = version
        settlement.period = period
        if (settlement.items.length > 0) {
          newSettlements.push(settlement)
        }
      }

      const existingOtherVersions = settlements.filter(s => s.version !== version)
      setSettlements([...existingOtherVersions, ...newSettlements])
      setCurrentPeriod(period)
      if (versionNum) {
        setCurrentVersion(versionNum)
      }

      addVersion({
        id: uuidv4(),
        period,
        version,
        createdAt: new Date().toISOString(),
        createdBy: '财务专员',
        note: version > 1 ? `重新计算 V${version}` : '自动生成结算单',
        settlementIds: newSettlements.map(s => s.id),
        settlementsSnapshot: JSON.parse(JSON.stringify(newSettlements))
      })

      message.success(`成功生成 V${version} 版本 ${newSettlements.length} 位达人的结算单`)
    } catch (error) {
      message.error(`生成失败：${error}`)
    } finally {
      setGenerating(false)
    }
  }

  const openDetail = (settlement: InfluencerSettlement) => {
    setCurrentSettlement(settlement)
    setDetailVisible(true)
  }

  const handleConfirm = (settlement: InfluencerSettlement) => {
    setCurrentSettlement(settlement)
    setConfirmVisible(true)
  }

  const doConfirm = () => {
    if (!currentSettlement) return
    updateSettlement(currentSettlement.id, {
      status: 'confirmed'
    })
    message.success('结算单已确认')
    setConfirmVisible(false)
  }

  const handleMarkPaid = (settlement: InfluencerSettlement) => {
    updateSettlement(settlement.id, {
      status: 'paid'
    })
    message.success('已标记为已付款')
  }

  const handleExportAll = () => {
    if (currentVersionSettlements.length === 0) {
      message.warning('暂无结算数据可导出')
      return
    }

    const sheets: { name: string; data: any[] }[] = []

    currentVersionSettlements.forEach(s => {
      const influencerData = [
        { '达人结算单': '' },
        { '达人姓名': s.influencerName },
        { '结算周期': s.period },
        { '版本': `V${s.version}` },
        { '': '' },
        { '项目': '金额', '备注': '' },
        { '固定探店费': s.fixedFee.toFixed(2) },
        { '有效客资奖励': s.validCustomerReward.toFixed(2), '备注': `${s.validCustomerCount} 人 × ${(s.validCustomerReward / Math.max(s.validCustomerCount, 1)).toFixed(2)} 元/人` },
        { '成交提成': s.totalCommission.toFixed(2) },
        { '': '' },
        { '小计': (s.fixedFee + s.validCustomerReward + s.totalCommission).toFixed(2) },
        { '封顶金额': s.maxAmount.toFixed(2) },
        { '应付金额': s.finalAmount.toFixed(2) },
        { '': '' },
        { '顾客数': s.customerCount, '有效顾客数': s.validCustomerCount },
        { '成交总额': s.totalAmount.toFixed(2) },
        { '': '' },
        { '订单明细': '' },
        { '订单号': '订单号', '手机号': '手机号', '顾客姓名': '顾客姓名', '项目名称': '项目名称', '项目类别': '项目类别', '消费金额': '消费金额', '提成比例': '提成比例', '提成金额': '提成金额', '消费日期': '消费日期', '退款扣除': '退款扣除' },
        ...s.items.map(item => ({
          '订单号': item.orderNo,
          '手机号': item.phone,
          '顾客姓名': item.customerName || '',
          '项目名称': item.projectName,
          '项目类别': item.categoryName,
          '消费金额': item.amount.toFixed(2),
          '提成比例': `${(item.commissionRate * 100).toFixed(1)}%`,
          '提成金额': item.commission.toFixed(2),
          '消费日期': item.date,
          '退款扣除': item.refundDeduction ? item.refundDeduction.toFixed(2) : '0.00'
        }))
      ]
      sheets.push({ name: `${s.influencerName}-结算单`, data: influencerData })
    })

    const summaryData = [
      { '门店汇总表': '' },
      { '结算周期': period },
      { '版本': `V${currentVersion}` },
      { '': '' },
      { '达人姓名': '达人姓名', '顾客数': '顾客数', '有效顾客数': '有效顾客数', '成交总额': '成交总额', '固定探店费': '固定探店费', '客资奖励': '客资奖励', '成交提成': '成交提成', '应付金额': '应付金额', '状态': '状态' },
      ...currentVersionSettlements.map(s => ({
        '达人姓名': s.influencerName,
        '顾客数': s.customerCount,
        '有效顾客数': s.validCustomerCount,
        '成交总额': s.totalAmount.toFixed(2),
        '固定探店费': s.fixedFee.toFixed(2),
        '客资奖励': s.validCustomerReward.toFixed(2),
        '成交提成': s.totalCommission.toFixed(2),
        '应付金额': s.finalAmount.toFixed(2),
        '状态': s.status === 'draft' ? '草稿' : s.status === 'confirmed' ? '已确认' : '已付款'
      })),
      { '': '' },
      { '合计': '合计', 
        '顾客数': currentVersionSettlements.reduce((sum, s) => sum + s.customerCount, 0),
        '有效顾客数': currentVersionSettlements.reduce((sum, s) => sum + s.validCustomerCount, 0),
        '成交总额': currentVersionSettlements.reduce((sum, s) => sum + s.totalAmount, 0).toFixed(2),
        '固定探店费': currentVersionSettlements.reduce((sum, s) => sum + s.fixedFee, 0).toFixed(2),
        '客资奖励': currentVersionSettlements.reduce((sum, s) => sum + s.validCustomerReward, 0).toFixed(2),
        '成交提成': currentVersionSettlements.reduce((sum, s) => sum + s.totalCommission, 0).toFixed(2),
        '应付金额': currentVersionSettlements.reduce((sum, s) => sum + s.finalAmount, 0).toFixed(2)
      }
    ]
    sheets.push({ name: '门店汇总表', data: summaryData })

    const paymentData = [
      { '付款申请表': '' },
      { '结算周期': period },
      { '版本': `V${currentVersion}` },
      { '生成日期': new Date().toLocaleDateString() },
      { '': '' },
      { '序号': '序号', '收款人': '收款人', '联系电话': '联系电话', '应付金额': '应付金额', '备注': '备注' },
      ...currentVersionSettlements.map((s, idx) => {
        const influencer = influencers.find(i => i.id === s.influencerId)
        return {
          '序号': idx + 1,
          '收款人': s.influencerName,
          '联系电话': influencer?.phone || '',
          '应付金额': s.finalAmount.toFixed(2),
          '备注': ''
        }
      }),
      { '': '' },
      { '合计': '合计',
        '应付金额': currentVersionSettlements.reduce((sum, s) => sum + s.finalAmount, 0).toFixed(2)
      }
    ]
    sheets.push({ name: '付款申请表', data: paymentData })

    exportMultipleSheets(sheets, `达人佣金结算_${period}_V${currentVersion}.xlsx`)
    message.success('导出成功')
  }

  const handleExportSingle = (settlement: InfluencerSettlement) => {
    const influencer = influencers.find(i => i.id === settlement.influencerId)
    const data = [
      { '达人结算单': '' },
      { '达人姓名': settlement.influencerName },
      { '联系电话': influencer?.phone || '' },
      { '结算周期': settlement.period },
      { '版本': `V${settlement.version}` },
      { '生成日期': new Date(settlement.createdAt).toLocaleDateString() },
      { '': '' },
      { '费用明细': '' },
      { '项目': '项目', '金额（元）': '金额（元）', '备注': '备注' },
      { '固定探店费': settlement.fixedFee.toFixed(2), '备注': '' },
      { '有效客资奖励': settlement.validCustomerReward.toFixed(2), '备注': `${settlement.validCustomerCount} 人` },
      { '成交提成': settlement.totalCommission.toFixed(2), '备注': `${settlement.items.length} 笔订单` },
      { '': '' },
      { '小计': (settlement.fixedFee + settlement.validCustomerReward + settlement.totalCommission).toFixed(2) },
      { '封顶金额': settlement.maxAmount.toFixed(2) },
      { '应付金额': settlement.finalAmount.toFixed(2) },
      { '': '' },
      { '订单明细': '' },
      { '订单号': '订单号', '项目名称': '项目名称', '项目类别': '项目类别', '消费金额': '消费金额', '提成比例': '提成比例', '提成金额': '提成金额', '退款扣除': '退款扣除', '消费日期': '消费日期' },
      ...settlement.items.map(item => ({
        '订单号': item.orderNo,
        '项目名称': item.projectName,
        '项目类别': item.categoryName,
        '消费金额': item.amount.toFixed(2),
        '提成比例': `${(item.commissionRate * 100).toFixed(1)}%`,
        '提成金额': item.commission.toFixed(2),
        '退款扣除': item.refundDeduction ? item.refundDeduction.toFixed(2) : '0.00',
        '消费日期': item.date
      }))
    ]
    exportMultipleSheets([{ name: '结算单', data }], `${settlement.influencerName}_结算单_${period}.xlsx`)
  }

  const handleBatchConfirm = () => {
    const draftCount = currentVersionSettlements.filter(s => s.status === 'draft').length
    Modal.confirm({
      title: '批量确认结算单',
      content: `确认将 ${draftCount} 份草稿状态的结算单全部标记为已确认？`,
      onOk: () => {
        currentVersionSettlements.forEach(s => {
          if (s.status === 'draft') {
            updateSettlement(s.id, { status: 'confirmed' })
          }
        })
        message.success('批量确认成功')
      }
    })
  }

  const currentVersionSettlements = settlements.filter(
    s => s.version === currentVersion && s.period === period
  )

  const totalStats = {
    totalAmount: currentVersionSettlements.reduce((sum, s) => sum + s.totalAmount, 0),
    totalFinal: currentVersionSettlements.reduce((sum, s) => sum + s.finalAmount, 0),
    totalFixed: currentVersionSettlements.reduce((sum, s) => sum + s.fixedFee, 0),
    totalReward: currentVersionSettlements.reduce((sum, s) => sum + s.validCustomerReward, 0),
    totalCommission: currentVersionSettlements.reduce((sum, s) => sum + s.totalCommission, 0),
    totalCustomers: currentVersionSettlements.reduce((sum, s) => sum + s.customerCount, 0),
    totalValidCustomers: currentVersionSettlements.reduce((sum, s) => sum + s.validCustomerCount, 0),
    totalOrders: currentVersionSettlements.reduce((sum, s) => sum + s.items.length, 0)
  }

  const settlementColumns = [
    {
      title: '达人姓名',
      dataIndex: 'influencerName',
      key: 'influencerName',
      width: 120,
      render: (text: string) => <span className="font-bold">{text}</span>
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
      title: '固定探店费',
      dataIndex: 'fixedFee',
      key: 'fixedFee',
      width: 100,
      render: (val: number) => `¥${val.toFixed(2)}`
    },
    {
      title: '客资奖励',
      dataIndex: 'validCustomerReward',
      key: 'validCustomerReward',
      width: 100,
      render: (val: number) => `¥${val.toFixed(2)}`
    },
    {
      title: '成交提成',
      dataIndex: 'totalCommission',
      key: 'totalCommission',
      width: 100,
      render: (val: number) => `¥${val.toFixed(2)}`
    },
    {
      title: '封顶金额',
      dataIndex: 'maxAmount',
      key: 'maxAmount',
      width: 100,
      render: (val: number) => `¥${val.toFixed(2)}`
    },
    {
      title: '应付金额',
      dataIndex: 'finalAmount',
      key: 'finalAmount',
      width: 120,
      render: (val: number, record: InfluencerSettlement) => {
        const subtotal = record.fixedFee + record.validCustomerReward + record.totalCommission
        const exceeded = subtotal > record.maxAmount
        return (
          <span className={exceeded ? 'text-warning' : 'text-success'} style={{ fontWeight: 600 }}>
            ¥{val.toFixed(2)}
            {exceeded && <Tag color="warning" style={{ marginLeft: 4 }}>已封顶</Tag>}
          </span>
        )
      }
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
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 80,
      render: (v: number) => `V${v}`
    },
    {
      title: '操作',
      key: 'action',
      width: 260,
      fixed: 'right' as const,
      render: (_: any, record: InfluencerSettlement) => (
        <Space>
          <Button size="small" onClick={() => openDetail(record)}>
            详情
          </Button>
          <Button size="small" icon={<ExportOutlined />} onClick={() => handleExportSingle(record)}>
            导出
          </Button>
          {record.status === 'draft' && (
            <Button size="small" type="primary" onClick={() => handleConfirm(record)}>
              确认
            </Button>
          )}
          {record.status === 'confirmed' && (
            <Popconfirm title="确认标记为已付款？" onConfirm={() => handleMarkPaid(record)}>
              <Button size="small" icon={<CheckCircleOutlined />}>
                标记付款
              </Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ]

  const itemColumns = [
    {
      title: '订单号',
      dataIndex: 'orderNo',
      key: 'orderNo',
      width: 150
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
      title: '项目类别',
      dataIndex: 'categoryName',
      key: 'categoryName',
      width: 100,
      render: (val: string) => <Tag color="blue">{val}</Tag>
    },
    {
      title: '消费金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 100,
      render: (val: number) => <span className="amount-positive">¥{val.toFixed(2)}</span>
    },
    {
      title: '提成比例',
      dataIndex: 'commissionRate',
      key: 'commissionRate',
      width: 90,
      render: (val: number) => `${(val * 100).toFixed(1)}%`
    },
    {
      title: '提成金额',
      dataIndex: 'commission',
      key: 'commission',
      width: 100,
      render: (val: number) => <span className="text-primary">¥{val.toFixed(2)}</span>
    },
    {
      title: '退款扣除',
      dataIndex: 'refundDeduction',
      key: 'refundDeduction',
      width: 100,
      render: (val?: number) => val ? <span className="text-danger">-¥{val.toFixed(2)}</span> : '-'
    },
    {
      title: '消费日期',
      dataIndex: 'date',
      key: 'date',
      width: 160
    }
  ]

  return (
    <div>
      {settlements.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '64px 24px' }}>
          <FileOutlined style={{ fontSize: 64, color: '#d9d9d9', marginBottom: 16 }} />
          <div style={{ fontSize: 16, color: 'rgba(0,0,0,0.65)', marginBottom: 8 }}>
            暂无结算单
          </div>
          <div style={{ color: 'rgba(0,0,0,0.45)', marginBottom: 24 }}>
            请先完成文件导入、规则配置和自动匹配
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
            <Select
              value={period}
              onChange={setPeriod}
              style={{ width: 150 }}
              options={Array.from({ length: 12 }, (_, i) => {
                const d = dayjs().subtract(i, 'month')
                return { value: d.format('YYYY-MM'), label: d.format('YYYY年MM月') }
              })}
            />
            <Button 
              type="primary" 
              size="large"
              icon={<FileOutlined />}
              onClick={generateSettlements}
              loading={generating}
            >
              生成结算单
            </Button>
          </div>
        </div>
      ) : (
        <>
          <Row gutter={16} className="mb-24">
            <Col span={6}>
              <Card>
                <Statistic 
                  title="成交总额" 
                  value={totalStats.totalAmount} 
                  precision={2}
                  prefix="¥"
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic 
                  title="应付佣金合计" 
                  value={totalStats.totalFinal} 
                  precision={2}
                  prefix="¥"
                  valueStyle={{ color: '#1677ff' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic 
                  title="服务达人" 
                  value={currentVersionSettlements.length} 
                  suffix="人"
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic 
                  title="有效顾客" 
                  value={totalStats.totalValidCustomers} 
                  suffix="人"
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={16} className="mb-24">
            <Col span={8}>
              <Card size="small">
                <div className="text-muted text-small">固定探店费</div>
                <div className="text-large font-bold">¥{totalStats.totalFixed.toFixed(2)}</div>
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small">
                <div className="text-muted text-small">有效客资奖励</div>
                <div className="text-large font-bold">¥{totalStats.totalReward.toFixed(2)}</div>
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small">
                <div className="text-muted text-small">成交提成</div>
                <div className="text-large font-bold">¥{totalStats.totalCommission.toFixed(2)}</div>
              </Card>
            </Col>
          </Row>

          <div className="card">
            <div className="flex-between mb-16">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div className="card-title" style={{ marginBottom: 0 }}>达人结算单列表</div>
                <Tag color="blue">版本 V{currentVersion}</Tag>
                <Tag color="green">{period}</Tag>
              </div>
              <Space>
                <Select
                  value={period}
                  onChange={setPeriod}
                  style={{ width: 150 }}
                  options={Array.from({ length: 12 }, (_, i) => {
                    const d = dayjs().subtract(i, 'month')
                    return { value: d.format('YYYY-MM'), label: d.format('YYYY年MM月') }
                  })}
                />
                <Button 
                  icon={<HistoryOutlined />} 
                  onClick={() => {
                    const newVersion = currentVersion + 1
                    doGenerate(newVersion)
                  }}
                  loading={generating}
                >
                  重新计算
                </Button>
                <Button icon={<ExportOutlined />} onClick={handleExportAll}>
                  导出全部
                </Button>
                <Button 
                  icon={<PrinterOutlined />} 
                  onClick={() => message.info('打印功能开发中')}
                >
                  打印
                </Button>
                {currentVersionSettlements.some(s => s.status === 'draft') && (
                  <Button type="primary" onClick={handleBatchConfirm}>
                    批量确认
                  </Button>
                )}
              </Space>
            </div>
            <Table
              columns={settlementColumns}
              dataSource={currentVersionSettlements}
              rowKey="id"
              scroll={{ x: 1400 }}
              pagination={{ pageSize: 20, showSizeChanger: true }}
              summary={(pageData) => {
                let totalAmount = 0, totalFinal = 0, totalFixed = 0, totalReward = 0, totalCommission = 0
                pageData.forEach((s: InfluencerSettlement) => {
                  totalAmount += s.totalAmount
                  totalFinal += s.finalAmount
                  totalFixed += s.fixedFee
                  totalReward += s.validCustomerReward
                  totalCommission += s.totalCommission
                })
                return (
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0}>
                      <span className="font-bold">本页合计</span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1}></Table.Summary.Cell>
                    <Table.Summary.Cell index={2}></Table.Summary.Cell>
                    <Table.Summary.Cell index={3}>
                      <span className="amount-positive">¥{totalAmount.toFixed(2)}</span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={4}>¥{totalFixed.toFixed(2)}</Table.Summary.Cell>
                    <Table.Summary.Cell index={5}>¥{totalReward.toFixed(2)}</Table.Summary.Cell>
                    <Table.Summary.Cell index={6}>¥{totalCommission.toFixed(2)}</Table.Summary.Cell>
                    <Table.Summary.Cell index={7}></Table.Summary.Cell>
                    <Table.Summary.Cell index={8}>
                      <span className="text-primary font-bold">¥{totalFinal.toFixed(2)}</span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={9}></Table.Summary.Cell>
                    <Table.Summary.Cell index={10}></Table.Summary.Cell>
                    <Table.Summary.Cell index={11}></Table.Summary.Cell>
                  </Table.Summary.Row>
                )
              }}
            />
          </div>

          <div className="card">
            <div className="card-title">门店汇总表</div>
            <Descriptions bordered column={3} size="small">
              <Descriptions.Item label="结算周期">{period}</Descriptions.Item>
              <Descriptions.Item label="版本">V{currentVersion}</Descriptions.Item>
              <Descriptions.Item label="生成时间">{new Date().toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="达人数">{currentVersionSettlements.length} 人</Descriptions.Item>
              <Descriptions.Item label="总订单数">{totalStats.totalOrders} 单</Descriptions.Item>
              <Descriptions.Item label="总顾客数">{totalStats.totalCustomers} 人</Descriptions.Item>
              <Descriptions.Item label="成交总额">
                <span className="amount-positive font-bold">¥{totalStats.totalAmount.toFixed(2)}</span>
              </Descriptions.Item>
              <Descriptions.Item label="应付佣金">
                <span className="text-primary font-bold">¥{totalStats.totalFinal.toFixed(2)}</span>
              </Descriptions.Item>
              <Descriptions.Item label="人均佣金">
                ¥{(totalStats.totalFinal / Math.max(currentVersionSettlements.length, 1)).toFixed(2)}
              </Descriptions.Item>
            </Descriptions>
          </div>
        </>
      )}

      <Modal
        title="结算单详情"
        open={detailVisible}
        width={1100}
        onCancel={() => setDetailVisible(false)}
        footer={null}
      >
        {currentSettlement && (
          <div>
            <Descriptions bordered column={3} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="达人姓名" span={1}>
                <span className="font-bold">{currentSettlement.influencerName}</span>
              </Descriptions.Item>
              <Descriptions.Item label="结算周期">{currentSettlement.period}</Descriptions.Item>
              <Descriptions.Item label="版本">V{currentSettlement.version}</Descriptions.Item>
              <Descriptions.Item label="顾客数">{currentSettlement.customerCount} 人</Descriptions.Item>
              <Descriptions.Item label="有效顾客">{currentSettlement.validCustomerCount} 人</Descriptions.Item>
              <Descriptions.Item label="订单数">{currentSettlement.items.length} 单</Descriptions.Item>
            </Descriptions>

            <Card size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={6}>
                  <div className="text-muted text-small">固定探店费</div>
                  <div className="text-large">¥{currentSettlement.fixedFee.toFixed(2)}</div>
                </Col>
                <Col span={6}>
                  <div className="text-muted text-small">有效客资奖励</div>
                  <div className="text-large">¥{currentSettlement.validCustomerReward.toFixed(2)}</div>
                </Col>
                <Col span={6}>
                  <div className="text-muted text-small">成交提成</div>
                  <div className="text-large">¥{currentSettlement.totalCommission.toFixed(2)}</div>
                </Col>
                <Col span={6}>
                  <div className="text-muted text-small">应付金额</div>
                  <div className="text-large font-bold text-primary">¥{currentSettlement.finalAmount.toFixed(2)}</div>
                </Col>
              </Row>
            </Card>

            <div className="card-title">订单明细</div>
            <Table
              columns={itemColumns}
              dataSource={currentSettlement.items}
              rowKey="id"
              scroll={{ x: 1100, y: 400 }}
              pagination={{ pageSize: 50 }}
              size="small"
              summary={(pageData) => {
                let amount = 0, commission = 0, refund = 0
                pageData.forEach((item: SettlementItem) => {
                  amount += item.amount
                  commission += item.commission
                  refund += item.refundDeduction || 0
                })
                return (
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={5}>本页合计</Table.Summary.Cell>
                    <Table.Summary.Cell index={5}>¥{amount.toFixed(2)}</Table.Summary.Cell>
                    <Table.Summary.Cell index={6}></Table.Summary.Cell>
                    <Table.Summary.Cell index={7}>¥{commission.toFixed(2)}</Table.Summary.Cell>
                    <Table.Summary.Cell index={8} className="text-danger">-¥{refund.toFixed(2)}</Table.Summary.Cell>
                    <Table.Summary.Cell index={9}></Table.Summary.Cell>
                  </Table.Summary.Row>
                )
              }}
            />
          </div>
        )}
      </Modal>

      <Modal
        title="确认结算单"
        open={confirmVisible}
        onOk={doConfirm}
        onCancel={() => setConfirmVisible(false)}
        okText="确认"
        cancelText="取消"
      >
        {currentSettlement && (
          <div>
            <Alert
              message={`确认 ${currentSettlement.influencerName} 的结算单？`}
              description={
                <div>
                  <p>应付金额：<span className="font-bold text-primary">¥{currentSettlement.finalAmount.toFixed(2)}</span></p>
                  <p>包含订单：<span className="font-bold">{currentSettlement.items.length}</span> 单</p>
                  <p className="text-muted">确认后将进入付款流程，数据将锁定无法修改</p>
                </div>
              }
              type="info"
              showIcon
            />
          </div>
        )}
      </Modal>
    </div>
  )
}
