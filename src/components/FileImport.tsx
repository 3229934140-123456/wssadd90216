import { useState, useRef } from 'react'
import { Button, Table, Modal, Form, Select, message, Space, Divider } from 'antd'
import { UploadOutlined, DeleteOutlined, EyeOutlined, CheckOutlined } from '@ant-design/icons'
import { v4 as uuidv4 } from 'uuid'
import { useAppStore } from '@/store/appStore'
import { readExcelFile } from '@/utils/excel'
import { autoDetectFields } from '@/utils/matching'
import type { FileType, ImportedFile, FieldMapping } from '@/types'

const fileTypeLabels: Record<FileType, string> = {
  cooperation: '达人合作表',
  cashier: '收银流水',
  groupbuy: '团购核销表',
  refund: '退款明细'
}

const fileTypeColors: Record<FileType, string> = {
  cooperation: '#1677ff',
  cashier: '#52c41a',
  groupbuy: '#faad14',
  refund: '#ff4d4f'
}

export default function FileImport() {
  const [dragging, setDragging] = useState(false)
  const [currentType, setCurrentType] = useState<FileType | null>(null)
  const [previewVisible, setPreviewVisible] = useState(false)
  const [previewData, setPreviewData] = useState<ImportedFile | null>(null)
  const [mappingVisible, setMappingVisible] = useState(false)
  const [mappingData, setMappingData] = useState<ImportedFile | null>(null)
  const [form] = Form.useForm()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { importedFiles, addImportedFile, removeImportedFile, fieldMappings, setFieldMapping } = useAppStore()

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    
    const files = Array.from(e.dataTransfer.files)
    await processFiles(files)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    await processFiles(files)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const processFiles = async (files: File[]) => {
    const excelFiles = files.filter(f => f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))
    
    if (excelFiles.length === 0) {
      message.error('请上传 Excel 文件（.xlsx 或 .xls）')
      return
    }

    for (const file of excelFiles) {
      try {
        const arrayBuffer = await file.arrayBuffer()
        const result = readExcelFile(arrayBuffer)
        
        const detectedType = detectFileType(file.name)
        const importedFile: ImportedFile = {
          id: uuidv4(),
          type: detectedType,
          name: file.name,
          path: file.name,
          sheetName: result.sheetName,
          headers: result.headers,
          data: result.data,
          importedAt: new Date().toISOString()
        }

        addImportedFile(importedFile)
        message.success(`已导入 ${file.name}`)

        if (!fieldMappings[detectedType]) {
          const autoMapping = autoDetectFields(result.headers)
          openMappingModal(importedFile, autoMapping)
        }
      } catch (error) {
        message.error(`导入 ${file.name} 失败：${error}`)
      }
    }
  }

  const detectFileType = (fileName: string): FileType => {
    const lower = fileName.toLowerCase()
    if (lower.includes('合作') || lower.includes('达人') || lower.includes('kol')) return 'cooperation'
    if (lower.includes('收银') || lower.includes('流水') || lower.includes('cashier')) return 'cashier'
    if (lower.includes('团购') || lower.includes('核销') || lower.includes('group')) return 'groupbuy'
    if (lower.includes('退款') || lower.includes('refund')) return 'refund'
    return 'cashier'
  }

  const openMappingModal = (file: ImportedFile, autoMapping?: Record<string, string>) => {
    setMappingData(file)
    setCurrentType(file.type)
    form.setFieldsValue({
      phone: autoMapping?.phone || '',
      orderNo: autoMapping?.orderNo || '',
      projectName: autoMapping?.projectName || '',
      amount: autoMapping?.amount || '',
      date: autoMapping?.date || '',
      customerName: autoMapping?.customerName || '',
      influencerName: autoMapping?.influencerName || ''
    })
    setMappingVisible(true)
  }

  const handleMappingSubmit = async () => {
    if (!mappingData || !currentType) return
    
    try {
      const values = await form.validateFields()
      const mapping: FieldMapping = {
        fileType: currentType,
        phone: values.phone,
        orderNo: values.orderNo,
        projectName: values.projectName,
        amount: values.amount,
        date: values.date,
        customerName: values.customerName,
        influencerName: values.influencerName
      }

      setFieldMapping(currentType, mapping)
      setMappingVisible(false)
      message.success('字段映射已保存')
    } catch (error) {
      message.warning('请填写所有必填字段')
    }
  }

  const handlePreview = (file: ImportedFile) => {
    setPreviewData(file)
    setPreviewVisible(true)
  }

  const handleRemove = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后已导入的数据将被清除，是否继续？',
      onOk: () => {
        removeImportedFile(id)
        message.success('已删除')
      }
    })
  }

  const handleChangeType = (file: ImportedFile, newType: FileType) => {
    const updated = { ...file, type: newType }
    useAppStore.setState(state => ({
      importedFiles: state.importedFiles.map(f => f.id === file.id ? updated : f)
    }))
    message.success('类型已更新')
  }

  const columns = [
    {
      title: '文件名',
      dataIndex: 'name',
      key: 'name',
      width: 250,
      render: (text: string) => <span className="font-bold">{text}</span>
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: FileType, record: ImportedFile) => (
        <Select
          value={type}
          style={{ width: '100%' }}
          onChange={(val) => handleChangeType(record, val)}
          options={[
            { value: 'cooperation', label: '达人合作表' },
            { value: 'cashier', label: '收银流水' },
            { value: 'groupbuy', label: '团购核销表' },
            { value: 'refund', label: '退款明细' }
          ]}
        />
      )
    },
    {
      title: '工作表',
      dataIndex: 'sheetName',
      key: 'sheetName',
      width: 150
    },
    {
      title: '数据行数',
      dataIndex: 'data',
      key: 'rows',
      width: 100,
      render: (data: any[]) => `${data.length} 行`
    },
    {
      title: '字段数',
      dataIndex: 'headers',
      key: 'headers',
      width: 100,
      render: (headers: string[]) => `${headers.length} 列`
    },
    {
      title: '字段映射',
      key: 'mapping',
      width: 100,
      render: (_: any, record: ImportedFile) => (
        fieldMappings[record.type] ? (
          <span className="text-success"><CheckOutlined /> 已配置</span>
        ) : (
          <span className="text-warning">未配置</span>
        )
      )
    },
    {
      title: '导入时间',
      dataIndex: 'importedAt',
      key: 'importedAt',
      width: 180,
      render: (time: string) => new Date(time).toLocaleString()
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: any, record: ImportedFile) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => handlePreview(record)}>
            预览
          </Button>
          <Button size="small" onClick={() => openMappingModal(record)}>
            字段映射
          </Button>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleRemove(record.id)}>
            删除
          </Button>
        </Space>
      )
    }
  ]

  const previewColumns = mappingData?.headers.map(h => ({
    title: h,
    dataIndex: h,
    key: h,
    ellipsis: true
  })) || []

  return (
    <div>
      <div className="card">
        <div className="card-title">导入数据文件</div>
        <div
          className={`upload-zone ${dragging ? 'dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
          <div className="upload-icon">📊</div>
          <div className="upload-text">拖拽 Excel 文件到此处，或点击选择文件</div>
          <div className="upload-hint">支持 .xlsx、.xls 格式，可同时上传多个文件</div>
          <Divider />
          <div style={{ textAlign: 'left' }}>
            <div className="text-muted mb-16">需要导入的文件类型：</div>
            <div className="grid-4">
              {Object.entries(fileTypeLabels).map(([key, label]) => (
                <div key={key} style={{ padding: '12px', background: '#fafafa', borderRadius: '6px' }}>
                  <div style={{ width: '8px', height: '8px', background: fileTypeColors[key as FileType], borderRadius: '50%', display: 'inline-block', marginRight: '8px' }}></div>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex-between mb-16">
          <div className="card-title" style={{ marginBottom: 0 }}>已导入文件</div>
          <Button icon={<UploadOutlined />} onClick={() => fileInputRef.current?.click()}>
            继续导入
          </Button>
        </div>
        <Table
          columns={columns}
          dataSource={importedFiles}
          rowKey="id"
          pagination={false}
          locale={{ emptyText: '暂无导入文件，请拖拽或点击上方区域导入' }}
        />
      </div>

      <Modal
        title="字段映射配置"
        open={mappingVisible}
        width={600}
        onOk={handleMappingSubmit}
        onCancel={() => setMappingVisible(false)}
        okText="确认"
        cancelText="取消"
      >
        {mappingData && (
          <div>
            <div className="text-muted mb-16">
              文件：<span className="font-bold">{mappingData.name}</span>（{fileTypeLabels[mappingData.type]}）
            </div>
            <Form form={form} layout="vertical">
              <div className="form-section">
                <div className="form-section-title">必填字段</div>
                <div className="grid-2">
                  <Form.Item
                    name="phone"
                    label="手机号"
                    rules={[{ required: true, message: '请选择手机号列' }]}
                  >
                    <Select placeholder="请选择手机号对应的列">
                      {mappingData.headers.map(h => (
                        <Select.Option key={h} value={h}>{h}</Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                  <Form.Item
                    name="orderNo"
                    label="订单号"
                    rules={[{ required: true, message: '请选择订单号列' }]}
                  >
                    <Select placeholder="请选择订单号对应的列">
                      {mappingData.headers.map(h => (
                        <Select.Option key={h} value={h}>{h}</Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                  <Form.Item
                    name="projectName"
                    label="项目名称"
                    rules={[{ required: true, message: '请选择项目名称列' }]}
                  >
                    <Select placeholder="请选择项目名称对应的列">
                      {mappingData.headers.map(h => (
                        <Select.Option key={h} value={h}>{h}</Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                  <Form.Item
                    name="amount"
                    label="成交金额"
                    rules={[{ required: true, message: '请选择成交金额列' }]}
                  >
                    <Select placeholder="请选择成交金额对应的列">
                      {mappingData.headers.map(h => (
                        <Select.Option key={h} value={h}>{h}</Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </div>
              </div>
              <div className="form-section">
                <div className="form-section-title">可选字段</div>
                <div className="grid-2">
                  <Form.Item name="date" label="订单时间">
                    <Select placeholder="请选择订单时间列" allowClear>
                      {mappingData.headers.map(h => (
                        <Select.Option key={h} value={h}>{h}</Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                  <Form.Item name="customerName" label="顾客姓名">
                    <Select placeholder="请选择顾客姓名列" allowClear>
                      {mappingData.headers.map(h => (
                        <Select.Option key={h} value={h}>{h}</Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                  <Form.Item name="influencerName" label="达人姓名">
                    <Select placeholder="请选择达人姓名列" allowClear>
                      {mappingData.headers.map(h => (
                        <Select.Option key={h} value={h}>{h}</Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </div>
              </div>
            </Form>
          </div>
        )}
      </Modal>

      <Modal
        title="数据预览"
        open={previewVisible}
        width={1000}
        onCancel={() => setPreviewVisible(false)}
        footer={null}
      >
        {previewData && (
          <Table
            columns={previewColumns}
            dataSource={previewData.data.slice(0, 50)}
            rowKey={(_, index) => String(index)}
            scroll={{ x: true, y: 400 }}
            size="small"
            pagination={{ pageSize: 20 }}
          />
        )}
      </Modal>
    </div>
  )
}
