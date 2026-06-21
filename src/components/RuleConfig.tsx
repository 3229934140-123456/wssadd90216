import { useState } from 'react'
import { Button, Table, Modal, Form, Input, InputNumber, DatePicker, Select, message, Space, Tag, Popconfirm, Drawer } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SettingOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { v4 as uuidv4 } from 'uuid'
import { useAppStore } from '@/store/appStore'
import type { Influencer, ProjectCategory } from '@/types'

export default function RuleConfig() {
  const [influencerVisible, setInfluencerVisible] = useState(false)
  const [categoryVisible, setCategoryVisible] = useState(false)
  const [editingInfluencer, setEditingInfluencer] = useState<Influencer | null>(null)
  const [editingCategory, setEditingCategory] = useState<ProjectCategory | null>(null)
  const [influencerForm] = Form.useForm()
  const [categoryForm] = Form.useForm()

  const {
    influencers,
    addInfluencer,
    updateInfluencer,
    removeInfluencer,
    projectCategories,
    addProjectCategory,
    updateProjectCategory,
    removeProjectCategory
  } = useAppStore()

  const openInfluencerModal = (influencer?: Influencer) => {
    setEditingInfluencer(influencer || null)
    influencerForm.setFieldsValue(influencer ? {
      ...influencer,
      cooperationStart: influencer.cooperationStart ? dayjs(influencer.cooperationStart) : null,
      cooperationEnd: influencer.cooperationEnd ? dayjs(influencer.cooperationEnd) : null,
      projectCategories: influencer.projectCategories || []
    } : {
      fixedFee: 0,
      validCustomerReward: 0,
      commissionRate: 0.1,
      maxAmount: 50000,
      projectCategories: []
    })
    setInfluencerVisible(true)
  }

  const handleInfluencerSubmit = () => {
    influencerForm.validateFields().then(values => {
      const data: Influencer = {
        id: editingInfluencer?.id || uuidv4(),
        name: values.name,
        phone: values.phone,
        fixedFee: values.fixedFee || 0,
        validCustomerReward: values.validCustomerReward || 0,
        commissionRate: values.commissionRate || 0,
        maxAmount: values.maxAmount || 0,
        cooperationStart: values.cooperationStart?.format('YYYY-MM-DD') || '',
        cooperationEnd: values.cooperationEnd?.format('YYYY-MM-DD') || '',
        projectCategories: values.projectCategories || [],
        createdAt: editingInfluencer?.createdAt || new Date().toISOString()
      }

      if (editingInfluencer) {
        updateInfluencer(editingInfluencer.id, data)
        message.success('达人信息已更新')
      } else {
        addInfluencer(data)
        message.success('达人已添加')
      }
      setInfluencerVisible(false)
      influencerForm.resetFields()
    })
  }

  const openCategoryModal = (category?: ProjectCategory) => {
    setEditingCategory(category || null)
    categoryForm.setFieldsValue(category || {
      name: '',
      keywords: [],
      commissionRate: 0.1
    })
    setCategoryVisible(true)
  }

  const handleCategorySubmit = () => {
    categoryForm.validateFields().then(values => {
      const data: ProjectCategory = {
        id: editingCategory?.id || uuidv4(),
        name: values.name,
        keywords: values.keywords || [],
        commissionRate: values.commissionRate || 0
      }

      if (editingCategory) {
        updateProjectCategory(editingCategory.id, data)
        message.success('项目类别已更新')
      } else {
        addProjectCategory(data)
        message.success('项目类别已添加')
      }
      setCategoryVisible(false)
      categoryForm.resetFields()
    })
  }

  const influencerColumns = [
    {
      title: '达人姓名',
      dataIndex: 'name',
      key: 'name',
      width: 120,
      render: (text: string) => <span className="font-bold">{text}</span>
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
      width: 130
    },
    {
      title: '合作周期',
      key: 'period',
      width: 220,
      render: (_: any, record: Influencer) => (
        <span>
          {record.cooperationStart || '-'} ~ {record.cooperationEnd || '-'}
        </span>
      )
    },
    {
      title: '固定探店费',
      dataIndex: 'fixedFee',
      key: 'fixedFee',
      width: 100,
      render: (val: number) => `¥${val.toFixed(2)}`
    },
    {
      title: '有效客资奖励',
      dataIndex: 'validCustomerReward',
      key: 'validCustomerReward',
      width: 120,
      render: (val: number) => `¥${val.toFixed(2)}/人`
    },
    {
      title: '成交提点',
      dataIndex: 'commissionRate',
      key: 'commissionRate',
      width: 100,
      render: (val: number) => `${(val * 100).toFixed(1)}%`
    },
    {
      title: '封顶金额',
      dataIndex: 'maxAmount',
      key: 'maxAmount',
      width: 100,
      render: (val: number) => `¥${val.toFixed(2)}`
    },
    {
      title: '可接项目',
      dataIndex: 'projectCategories',
      key: 'projectCategories',
      render: (categories: string[]) => (
        <div className="tags-container">
          {categories.map((cat, idx) => {
            const category = projectCategories.find(c => c.id === cat)
            return category ? <Tag key={idx} color="blue">{category.name}</Tag> : null
          })}
          {categories.length === 0 && <span className="text-muted">全部项目</span>}
        </div>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right' as const,
      render: (_: any, record: Influencer) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openInfluencerModal(record)}>
            编辑
          </Button>
          <Popconfirm title="确认删除该达人？" onConfirm={() => removeInfluencer(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  const categoryColumns = [
    {
      title: '项目类别',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      render: (text: string) => <span className="font-bold">{text}</span>
    },
    {
      title: '识别关键词',
      dataIndex: 'keywords',
      key: 'keywords',
      render: (keywords: string[]) => (
        <div className="tags-container">
          {keywords.map((kw, idx) => (
            <Tag key={idx} color="geekblue">{kw}</Tag>
          ))}
        </div>
      )
    },
    {
      title: '提成比例',
      dataIndex: 'commissionRate',
      key: 'commissionRate',
      width: 120,
      render: (val: number) => (
        <span className="text-primary font-bold">{(val * 100).toFixed(1)}%</span>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: ProjectCategory) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openCategoryModal(record)}>
            编辑
          </Button>
          <Popconfirm title="确认删除该类别？" onConfirm={() => removeProjectCategory(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div>
      <div className="card">
        <div className="flex-between mb-16">
          <div className="card-title" style={{ marginBottom: 0 }}>达人佣金规则配置</div>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openInfluencerModal()}>
            添加达人
          </Button>
        </div>
        <Table
          columns={influencerColumns}
          dataSource={influencers}
          rowKey="id"
          scroll={{ x: 1200 }}
          locale={{ emptyText: '暂无达人配置，请点击上方按钮添加' }}
        />
      </div>

      <div className="card">
        <div className="flex-between mb-16">
          <div className="card-title" style={{ marginBottom: 0 }}>项目类别提成配置</div>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openCategoryModal()}>
            添加项目类别
          </Button>
        </div>
        <div className="grid-3 mb-24">
          {projectCategories.map(cat => (
            <div key={cat.id} className="stat-card">
              <div className="flex-between">
                <div>
                  <div className="stat-value text-primary">{(cat.commissionRate * 100).toFixed(1)}%</div>
                  <div className="stat-label">{cat.name}</div>
                </div>
                <SettingOutlined 
                  style={{ fontSize: '24px', color: '#d9d9d9', cursor: 'pointer' }}
                  onClick={() => openCategoryModal(cat)}
                />
              </div>
              <div className="mt-16">
                {cat.keywords.map((kw, idx) => (
                  <Tag key={idx} color="geekblue">{kw}</Tag>
                ))}
              </div>
            </div>
          ))}
        </div>
        <Table
          columns={categoryColumns}
          dataSource={projectCategories}
          rowKey="id"
          locale={{ emptyText: '暂无项目类别配置，请点击上方按钮添加' }}
        />
      </div>

      <Modal
        title={editingInfluencer ? '编辑达人' : '添加达人'}
        open={influencerVisible}
        width={700}
        onOk={handleInfluencerSubmit}
        onCancel={() => setInfluencerVisible(false)}
        okText="确认"
        cancelText="取消"
      >
        <Form form={influencerForm} layout="vertical">
          <div className="form-section">
            <div className="form-section-title">基本信息</div>
            <div className="grid-2">
              <Form.Item
                name="name"
                label="达人姓名"
                rules={[{ required: true, message: '请输入达人姓名' }]}
              >
                <Input placeholder="请输入达人姓名" />
              </Form.Item>
              <Form.Item
                name="phone"
                label="联系电话"
                rules={[{ required: true, message: '请输入联系电话' }]}
              >
                <Input placeholder="请输入联系电话" />
              </Form.Item>
              <Form.Item
                name="cooperationStart"
                label="合作开始日期"
                rules={[{ required: true, message: '请选择合作开始日期' }]}
              >
                <DatePicker style={{ width: '100%' }} placeholder="选择开始日期" />
              </Form.Item>
              <Form.Item
                name="cooperationEnd"
                label="合作结束日期"
                rules={[{ required: true, message: '请选择合作结束日期' }]}
              >
                <DatePicker style={{ width: '100%' }} placeholder="选择结束日期" />
              </Form.Item>
            </div>
          </div>
          <div className="form-section">
            <div className="form-section-title">佣金规则</div>
            <div className="grid-2">
              <Form.Item
                name="fixedFee"
                label="固定探店费（元）"
                rules={[{ required: true, message: '请输入固定探店费' }]}
              >
                <InputNumber style={{ width: '100%' }} min={0} placeholder="请输入固定探店费" />
              </Form.Item>
              <Form.Item
                name="validCustomerReward"
                label="有效客资奖励（元/人）"
                rules={[{ required: true, message: '请输入有效客资奖励' }]}
              >
                <InputNumber style={{ width: '100%' }} min={0} placeholder="请输入每人奖励金额" />
              </Form.Item>
              <Form.Item
                name="commissionRate"
                label="成交提点比例"
                rules={[{ required: true, message: '请输入成交提点比例' }]}
              >
                <InputNumber 
                  style={{ width: '100%' }} 
                  min={0} 
                  max={1} 
                  step={0.01}
                  formatter={value => `${value ? (value * 100).toFixed(1) : 0}%`}
                  parser={value => (value ? parseFloat(value) / 100 : 0) as 0 | 1}
                  placeholder="请输入提点比例"
                />
              </Form.Item>
              <Form.Item
                name="maxAmount"
                label="单月封顶金额（元）"
                rules={[{ required: true, message: '请输入封顶金额' }]}
              >
                <InputNumber style={{ width: '100%' }} min={0} placeholder="请输入封顶金额" />
              </Form.Item>
            </div>
          </div>
          <div className="form-section">
            <div className="form-section-title">可接项目（不选则默认为全部项目）</div>
            <Form.Item name="projectCategories">
              <Select
                mode="multiple"
                placeholder="选择可接的项目类别"
                options={projectCategories.map(c => ({
                  value: c.id,
                  label: c.name
                }))}
              />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      <Drawer
        title={editingCategory ? '编辑项目类别' : '添加项目类别'}
        width={500}
        open={categoryVisible}
        onClose={() => setCategoryVisible(false)}
        extra={
          <Space>
            <Button onClick={() => setCategoryVisible(false)}>取消</Button>
            <Button type="primary" onClick={handleCategorySubmit}>确认</Button>
          </Space>
        }
      >
        <Form form={categoryForm} layout="vertical">
          <Form.Item
            name="name"
            label="项目类别名称"
            rules={[{ required: true, message: '请输入项目类别名称' }]}
          >
            <Input placeholder="例如：注射类、光电类、皮肤护理" />
          </Form.Item>
          <Form.Item
            name="commissionRate"
            label="提成比例"
            rules={[{ required: true, message: '请输入提成比例' }]}
          >
            <InputNumber 
              style={{ width: '100%' }} 
              min={0} 
              max={1} 
              step={0.01}
              formatter={value => `${value ? (value * 100).toFixed(1) : 0}%`}
              parser={value => (value ? parseFloat(value) / 100 : 0) as 0 | 1}
              placeholder="请输入提成比例"
            />
          </Form.Item>
          <Form.Item
            name="keywords"
            label="识别关键词"
            rules={[{ required: true, message: '请输入识别关键词' }]}
            extra="用于从订单项目名称中自动识别匹配该类别，多个关键词用回车分隔"
          >
            <Select
              mode="tags"
              style={{ width: '100%' }}
              placeholder="输入关键词后按回车"
              tokenSeparators={[',', '，', '\n']}
            />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  )
}
