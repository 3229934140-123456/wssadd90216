export type FileType = 'cooperation' | 'cashier' | 'groupbuy' | 'refund'

export interface ImportedFile {
  id: string
  type: FileType
  name: string
  path: string
  sheetName?: string
  headers: string[]
  data: any[]
  importedAt: string
}

export interface FieldMapping {
  fileType: FileType
  phone: string
  orderNo: string
  projectName: string
  amount: string
  date?: string
  influencerName?: string
  cooperationStart?: string
  cooperationEnd?: string
  customerName?: string
  refundAmount?: string
  refundDate?: string
}

export interface Influencer {
  id: string
  name: string
  phone: string
  fixedFee: number
  validCustomerReward: number
  commissionRate: number
  maxAmount: number
  cooperationStart: string
  cooperationEnd: string
  projectCategories: string[]
  createdAt: string
}

export interface ProjectCategory {
  id: string
  name: string
  keywords: string[]
  commissionRate: number
}

export interface OrderRecord {
  id: string
  source: FileType
  orderNo: string
  phone: string
  customerName?: string
  projectName: string
  amount: number
  date: string
  categoryId?: string
  influencerId?: string
  influencerName?: string
  isRefund: boolean
  refundAmount?: number
  refundDate?: string
  rawData: any
}

export type ExceptionType = 'duplicate_customer' | 'split_payment' | 'cross_month' | 'mismatch'

export interface ExceptionRecord {
  id: string
  type: ExceptionType
  description: string
  orderIds: string[]
  orders: OrderRecord[]
  status: 'pending' | 'resolved' | 'ignored'
  resolution?: 'merge' | 'exclude' | 'reassign'
  assignedInfluencerId?: string
  notes?: string
  createdAt: string
  resolvedAt?: string
  attachments?: Attachment[]
}

export interface Attachment {
  id: string
  name: string
  type: 'image' | 'file'
  data: string
  uploadedAt: string
}

export interface SettlementItem {
  id: string
  orderId: string
  orderNo: string
  phone: string
  customerName?: string
  projectName: string
  categoryName: string
  amount: number
  date: string
  commissionRate: number
  commission: number
  isRefund: boolean
  refundDeduction?: number
}

export interface InfluencerSettlement {
  id: string
  influencerId: string
  influencerName: string
  version: number
  period: string
  fixedFee: number
  validCustomerReward: number
  customerCount: number
  validCustomerCount: number
  totalAmount: number
  totalCommission: number
  maxAmount: number
  finalAmount: number
  items: SettlementItem[]
  createdAt: string
  status: 'draft' | 'confirmed' | 'paid'
  notes?: string
}

export interface StoreSummary {
  id: string
  period: string
  storeName: string
  totalOrders: number
  totalAmount: number
  totalCommission: number
  influencerCount: number
  settlements: {
    influencerId: string
    influencerName: string
    amount: number
  }[]
}

export interface PaymentRequest {
  id: string
  period: string
  settlementIds: string[]
  totalAmount: number
  createdAt: string
  status: 'pending' | 'approved' | 'paid'
}

export interface SettlementVersion {
  id: string
  period: string
  version: number
  createdAt: string
  createdBy: string
  note?: string
  settlementIds: string[]
}

export interface AppState {
  importedFiles: ImportedFile[]
  fieldMappings: Record<FileType, FieldMapping | null>
  influencers: Influencer[]
  projectCategories: ProjectCategory[]
  orders: OrderRecord[]
  exceptions: ExceptionRecord[]
  settlements: InfluencerSettlement[]
  versions: SettlementVersion[]
  currentPeriod: string
  currentVersion: number
}
