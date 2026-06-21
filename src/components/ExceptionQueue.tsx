import { useState, useRef } from 'react'
import { 
  Button, Table, Modal, Form, Select, Input, message, Space, Tag, 
  Row, Col, Card, List, Upload, Image, Empty, Divider, Typography,
  Radio, Alert
} from 'antd'
import { 
  CheckOutlined, MergeOutlined, DeleteOutlined, 
  UserOutlined, PaperClipOutlined, CameraOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons'
import { useAppStore } from '@/store/appStore'
import type { ExceptionRecord, ExceptionType, Attachment } from '@/types'
import { v4 as uuidv4 } from 'uuid'

const { TextArea } = Input
const { Title, Text } = Typography

const exceptionTypeConfig: Record<ExceptionType, { label: string; color: string; icon: string }> = {
  duplicate_customer: { label: '重复顾客', color: 'orange', icon: '👥' },
  split_payment: { label: '拆单付款', color: 'blue', icon: '💳' },
  cross_month: { label: '跨月补款', color: 'red', icon: '📅' },
  mismatch: { label: '无法匹配', color: 'purple', icon: '❓' },
  cooperation_period: { label: '合作周期异常', color: 'gold', icon: '⏰' }
}

const exceptionBadgeClass: Record<ExceptionType, string> = {
  duplicate_customer: 'duplicate',
  split_payment: 'split',
  cross_month: 'cross',
  mismatch: 'mismatch',
  cooperation_period: 'cooperation'
}

export default function ExceptionQueue() {
  const [filterType, setFilterType] = useState<ExceptionType | 'all'>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'resolved' | 'ignored'>('all')
  const [detailVisible, setDetailVisible] = useState(false)
  const [currentException, setCurrentException] = useState<ExceptionRecord | null>(null)
  const [processVisible, setProcessVisible] = useState(false)
  const [processType, setProcessType] = useState<'merge' | 'exclude' | 'reassign'>('merge')
  const [notes, setNotes] = useState('')
  const [selectedInfluencer, setSelectedInfluencer] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { 
    exceptions, 
    updateException, 
    influencers,
    orders,
    updateOrder
  } = useAppStore()

  const filteredExceptions = exceptions.filter(e => {
    if (filterType !== 'all' && e.type !== filterType) return false
    if (filterStatus !== 'all' && e.status !== filterStatus) return false
    return true
  })

  const pendingCount = exceptions.filter(e => e.status === 'pending').length
  const resolvedCount = exceptions.filter(e => e.status === 'resolved').length
  const ignoredCount = exceptions.filter(e => e.status === 'ignored').length

  const openDetail = (exception: ExceptionRecord) => {
    setCurrentException(exception)
    setDetailVisible(true)
  }

  const openProcess = (exception: ExceptionRecord, type: 'merge' | 'exclude' | 'reassign') => {
    setCurrentException(exception)
    setProcessType(type)
    setSelectedInfluencer(type === 'reassign' && exception.orders[0]?.influencerId ? exception.orders[0].influencerId : '')
    setNotes(exception.notes || '')
    setProcessVisible(true)
  }

  const handleProcess = () => {
    if (!currentException) return

    if (processType === 'reassign' && !selectedInfluencer) {
      message.warning('请选择目标达人')
      return
    }

    const updateData: Partial<ExceptionRecord> = {
      status: 'resolved',
      resolution: processType,
      notes,
      resolvedAt: new Date().toISOString()
    }

    if (processType === 'reassign' && selectedInfluencer) {
      updateData.assignedInfluencerId = selectedInfluencer
      const influencer = influencers.find(i => i.id === selectedInfluencer)
      currentException.orderIds.forEach(orderId => {
        updateOrder(orderId, {
          influencerId: selectedInfluencer,
          influencerName: influencer?.name
        })
      })
    }

    if (processType === 'merge') {
      const primaryInfluencerId = currentException.orders[0]?.influencerId
      const primaryInfluencerName = currentException.orders[0]?.influencerName
      currentException.orderIds.forEach(orderId => {
        updateOrder(orderId, {
          influencerId: primaryInfluencerId,
          influencerName: primaryInfluencerName
        })
      })
    }

    updateException(currentException.id, updateData)
    message.success('处理完成')
    setProcessVisible(false)
    setCurrentException(null)
  }

  const handleIgnore = (exception: ExceptionRecord) => {
    Modal.confirm({
      title: '确认忽略此异常？',
      content: '忽略后该异常将不再显示在待处理列表中',
      onOk: () => {
        updateException(exception.id, {
          status: 'ignored',
          resolvedAt: new Date().toISOString()
        })
        message.success('已忽略')
      }
    })
  }

  const handleAddAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !currentException) return

    const reader = new FileReader()
    reader.onload = () => {
      const attachment: Attachment = {
        id: uuidv4(),
        name: file.name,
        type: file.type.startsWith('image/') ? 'image' : 'file',
        data: reader.result as string,
        uploadedAt: new Date().toISOString()
      }

      const newAttachments = [...(currentException.attachments || []), attachment]
      updateException(currentException.id, {
        attachments: newAttachments
      })
      setCurrentException({ ...currentException, attachments: newAttachments })
      message.success('附件已添加')
    }
    reader.readAsDataURL(file)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDeleteAttachment = (attachmentId: string) => {
    if (!currentException) return
    const newAttachments = (currentException.attachments || []).filter(a => a.id !== attachmentId)
    updateException(currentException.id, {
      attachments: newAttachments
    })
    setCurrentException({ ...currentException, attachments: newAttachments })
  }

  const handleAddNote = () => {
    if (!currentException || !notes.trim()) return
    updateException(currentException.id, { notes })
    message.success('备注已保存')
  }

  const orderColumns = [
    {
      title: '订单号',
      dataIndex: 'orderNo',
      key: 'orderNo'
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone'
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
      render: (val: number) => `¥${val.toFixed(2)}`
    },
    {
      title: '消费时间',
      dataIndex: 'date',
      key: 'date'
    },
    {
      title: '当前归属达人',
      dataIndex: 'influencerName',
      key: 'influencerName',
      render: (val?: string) => val || <span className="text-muted">未匹配</span>
    }
  ]

  const columns = [
    {
      title: '异常类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: ExceptionType) => (
        <span className={`exception-badge ${exceptionBadgeClass[type]}`}>
          {exceptionTypeConfig[type].icon} {exceptionTypeConfig[type].label}
        </span>
      )
    },
    {
      title: '异常描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: '涉及订单数',
      key: 'orderCount',
      width: 100,
      render: (_: any, record: ExceptionRecord) => (
        <Tag color="blue">{record.orderIds.length} 单</Tag>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const config: Record<string, { color: string; text: string }> = {
          pending: { color: 'processing', text: '待处理' },
          resolved: { color: 'success', text: '已处理' },
          ignored: { color: 'default', text: '已忽略' }
        }
        return <Tag color={config[status].color}>{config[status].text}</Tag>
      }
    },
    {
      title: '处理方式',
      dataIndex: 'resolution',
      key: 'resolution',
      width: 100,
      render: (resolution?: string) => {
        if (!resolution) return null
        const config: Record<string, { icon: string; text: string }> = {
          merge: { icon: '🔗', text: '合并' },
          exclude: { icon: '🚫', text: '剔除' },
          reassign: { icon: '👤', text: '改归属' }
        }
        return <span>{config[resolution]?.icon} {config[resolution]?.text}</span>
      }
    },
    {
      title: '发现时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (time: string) => new Date(time).toLocaleString()
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      fixed: 'right' as const,
      render: (_: any, record: ExceptionRecord) => (
        <Space>
          <Button size="small" onClick={() => openDetail(record)}>
            详情
          </Button>
          {record.status === 'pending' && (
            <>
              {record.type !== 'cooperation_period' && (
                <Button size="small" icon={<MergeOutlined />} onClick={() => openProcess(record, 'merge')}>
                  合并
                </Button>
              )}
              <Button size="small" icon={<DeleteOutlined />} onClick={() => openProcess(record, 'exclude')}>
                剔除
              </Button>
              {record.type === 'cooperation_period' || record.type === 'duplicate_customer' || record.type === 'mismatch' ? (
                <Button size="small" icon={<UserOutlined />} onClick={() => openProcess(record, 'reassign')}>
                  改归属
                </Button>
              ) : null}
              {record.type !== 'cooperation_period' && (
                <Button size="small" onClick={() => handleIgnore(record)}>
                  忽略
                </Button>
              )}
            </>
          )}
        </Space>
      )
    }
  ]

  return (
    <div>
      <Row gutter={16} className="mb-24">
        <Col span={6}>
          <Card onClick={() => { setFilterStatus('all'); setFilterType('all') }} style={{ cursor: 'pointer' }}>
            <div className="stat-value">{exceptions.length}</div>
            <div className="stat-label">异常总数</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card 
            onClick={() => setFilterStatus('pending')} 
            style={{ cursor: 'pointer', borderLeft: pendingCount > 0 ? '3px solid #faad14' : undefined }}
          >
            <div className="stat-value text-warning">{pendingCount}</div>
            <div className="stat-label">待处理</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card onClick={() => setFilterStatus('resolved')} style={{ cursor: 'pointer' }}>
            <div className="stat-value text-success">{resolvedCount}</div>
            <div className="stat-label">已处理</div>
          </Card>
        </Col>
        <Col span={6}>
          <Card onClick={() => setFilterStatus('ignored')} style={{ cursor: 'pointer' }}>
            <div className="stat-value text-muted">{ignoredCount}</div>
            <div className="stat-label">已忽略</div>
          </Card>
        </Col>
      </Row>

      <div className="card">
        <div className="flex-between mb-16">
          <div style={{ display: 'flex', gap: 16 }}>
            <Select
              value={filterType}
              onChange={setFilterType}
              style={{ width: 150 }}
              options={[
                { value: 'all', label: '全部类型' },
                { value: 'duplicate_customer', label: '重复顾客' },
                { value: 'split_payment', label: '拆单付款' },
                { value: 'cross_month', label: '跨月补款' },
                { value: 'mismatch', label: '无法匹配' },
                { value: 'cooperation_period', label: '合作周期异常' }
              ]}
            />
            <Select
              value={filterStatus}
              onChange={setFilterStatus}
              style={{ width: 150 }}
              options={[
                { value: 'all', label: '全部状态' },
                { value: 'pending', label: '待处理' },
                { value: 'resolved', label: '已处理' },
                { value: 'ignored', label: '已忽略' }
              ]}
            />
          </div>
        </div>
        <Table
          columns={columns}
          dataSource={filteredExceptions}
          rowKey="id"
          scroll={{ x: 1200 }}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          locale={{ emptyText: <Empty description="暂无异常记录" /> }}
        />
      </div>

      <Modal
        title="异常详情"
        open={detailVisible}
        width={900}
        onCancel={() => setDetailVisible(false)}
        footer={null}
      >
        {currentException && (
          <div>
            <div className="mb-16">
              <span className={`exception-badge ${exceptionBadgeClass[currentException.type]}`}>
                {exceptionTypeConfig[currentException.type].icon} {exceptionTypeConfig[currentException.type].label}
              </span>
              <Text type="secondary" style={{ marginLeft: 12 }}>
                发现于 {new Date(currentException.createdAt).toLocaleString()}
              </Text>
            </div>
            <Alert 
              message={currentException.description} 
              type="warning" 
              showIcon 
              style={{ marginBottom: 24 }}
            />
            
            <Title level={5} style={{ marginBottom: 16 }}>涉及订单</Title>
            <Table
              columns={orderColumns}
              dataSource={currentException.orders}
              rowKey="id"
              pagination={false}
              size="small"
            />

            {currentException.notes && (
              <div className="mt-24">
                <Title level={5} style={{ marginBottom: 16 }}>处理备注</Title>
                <div style={{ padding: 16, background: '#fafafa', borderRadius: 6 }}>
                  {currentException.notes}
                </div>
              </div>
            )}

            <div className="mt-24">
              <div className="flex-between mb-16">
                <Title level={5} style={{ margin: 0 }}>凭证附件</Title>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf,.doc,.docx"
                  style={{ display: 'none' }}
                  onChange={handleAddAttachment}
                />
                <Button 
                  icon={<CameraOutlined />} 
                  onClick={() => fileInputRef.current?.click()}
                >
                  添加截图/文件
                </Button>
              </div>
              {currentException.attachments && currentException.attachments.length > 0 ? (
                <div className="attachment-list">
                  {currentException.attachments.map(att => (
                    <div key={att.id} className="attachment-item">
                      {att.type === 'image' ? (
                        <Image 
                          src={att.data} 
                          alt={att.name}
                          preview={{ mask: '点击查看' }}
                        />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0' }}>
                          <PaperClipOutlined style={{ fontSize: 32, color: '#999' }} />
                        </div>
                      )}
                      <div 
                        className="attachment-delete"
                        onClick={() => handleDeleteAttachment(att.id)}
                      >
                        ×
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty description="暂无附件，可添加截图或文件作为争议凭证" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </div>

            <div className="mt-24">
              <Title level={5} style={{ marginBottom: 16 }}>添加说明</Title>
              <Form layout="vertical">
                <Form.Item>
                  <TextArea 
                    rows={3} 
                    placeholder="输入对此异常的说明或处理意见..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" onClick={handleAddNote}>保存说明</Button>
                </Form.Item>
              </Form>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title={
          processType === 'merge' ? '合并归属' :
          processType === 'exclude' ? '剔除订单' : 
          currentException?.type === 'cooperation_period' ? '重新分配合作达人' : '修改达人归属'
        }
        open={processVisible}
        onOk={handleProcess}
        onCancel={() => setProcessVisible(false)}
        okText="确认处理"
        cancelText="取消"
      >
        {currentException && (
          <div>
            {processType === 'merge' && (
              <div>
                <Alert
                  message="将所有关联订单合并到第一位达人"
                  description={
                    <div>
                      <p>第一位达人：<span className="font-bold">{currentException.orders[0]?.influencerName || '未知'}</span></p>
                      <p className="text-muted">所有 {currentException.orderIds.length} 条订单将统一归属于该达人计算佣金</p>
                    </div>
                  }
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
                <div>
                  <p>涉及订单归属情况：</p>
                  <List
                    size="small"
                    dataSource={currentException.orders}
                    renderItem={(order) => (
                      <List.Item>
                        <span>{order.orderNo}</span>
                        <span className="text-muted">
                          → {order.influencerName || '未匹配'}
                        </span>
                      </List.Item>
                    )}
                  />
                </div>
              </div>
            )}

            {processType === 'exclude' && (
              <Alert
                message={currentException.type === 'cooperation_period' ? '将这些合作期外订单从结算中剔除' : '将从结算中剔除这些订单'}
                description={
                  <div>
                    <p>共 <span className="font-bold text-danger">{currentException.orderIds.length}</span> 条订单</p>
                    <p className="text-muted">剔除后这些订单将不参与任何佣金计算</p>
                  </div>
                }
                type="warning"
                showIcon
              />
            )}

            {processType === 'reassign' && (
              <div>
                <Alert
                  message={currentException.type === 'cooperation_period' ? '请选择合作期内的达人' : '请选择新的达人归属'}
                  description={currentException.type === 'cooperation_period' ? '订单将重新归属于所选合作期内的达人计算佣金' : '所有关联订单将重新归属于所选达人'}
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
                <Form layout="vertical">
                  <Form.Item
                    label="目标达人"
                    required
                  >
                    <Select
                      value={selectedInfluencer}
                      onChange={setSelectedInfluencer}
                      placeholder={currentException.type === 'cooperation_period' ? '请选择合作期内的达人' : '请选择要归属的达人'}
                      options={influencers.map(i => ({
                        value: i.id,
                        label: `${i.name} (${i.phone})`
                      }))}
                    />
                  </Form.Item>
                </Form>
              </div>
            )}

            <Divider />
            <Form layout="vertical">
              <Form.Item label="处理备注（可选）">
                <TextArea 
                  rows={2} 
                  placeholder="输入处理说明..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  )
}
