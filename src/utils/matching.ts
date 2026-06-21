import dayjs from 'dayjs'
import type { OrderRecord, Influencer, ProjectCategory, ExceptionType, ExceptionRecord, SettlementItem, InfluencerSettlement } from '@/types'
import { v4 as uuidv4 } from 'uuid'

const phoneKeywords = ['手机', '电话', '联系电话', '手机号', '联系手机', 'customer_phone', 'phone']
const orderNoKeywords = ['订单号', '订单编号', '单据号', 'order_no', 'orderId', 'order_id']
const projectKeywords = ['项目', '项目名称', '商品', '商品名称', 'project', 'item', 'product']
const amountKeywords = ['金额', '成交金额', '实付金额', '支付金额', '消费金额', 'amount', 'price', 'total']
const dateKeywords = ['日期', '时间', '下单时间', '成交时间', 'date', 'time', 'order_time']
const nameKeywords = ['姓名', '顾客姓名', '客户姓名', 'name', 'customer']
const influencerKeywords = ['达人', '达人姓名', '博主', 'KOL', 'influencer', 'creator']

export function autoDetectFields(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {}
  
  const lowerHeaders = headers.map(h => h.toLowerCase())
  
  mapping.phone = findMatch(headers, lowerHeaders, phoneKeywords)
  mapping.orderNo = findMatch(headers, lowerHeaders, orderNoKeywords)
  mapping.projectName = findMatch(headers, lowerHeaders, projectKeywords)
  mapping.amount = findMatch(headers, lowerHeaders, amountKeywords)
  mapping.date = findMatch(headers, lowerHeaders, dateKeywords)
  mapping.customerName = findMatch(headers, lowerHeaders, nameKeywords)
  mapping.influencerName = findMatch(headers, lowerHeaders, influencerKeywords)
  
  return mapping
}

function findMatch(headers: string[], lowerHeaders: string[], keywords: string[]): string {
  for (const keyword of keywords) {
    const lowerKeyword = keyword.toLowerCase()
    const index = lowerHeaders.findIndex(h => h.includes(lowerKeyword) || lowerKeyword.includes(h))
    if (index !== -1) {
      return headers[index]
    }
  }
  return ''
}

export function normalizePhone(phone: string): string {
  if (!phone) return ''
  return String(phone).replace(/\D/g, '').slice(-11)
}

export function normalizeAmount(amount: any): number {
  if (amount === null || amount === undefined || amount === '') return 0
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(/[^\d.-]/g, ''))
  return isNaN(num) ? 0 : Math.round(num * 100) / 100
}

export function normalizeDate(date: any): string {
  if (!date) return ''
  const d = dayjs(date)
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm:ss') : String(date)
}

export function matchProjectCategory(projectName: string, categories: ProjectCategory[]): ProjectCategory | null {
  if (!projectName || categories.length === 0) return null
  
  const lowerName = projectName.toLowerCase()
  
  for (const category of categories) {
    for (const keyword of category.keywords) {
      if (lowerName.includes(keyword.toLowerCase())) {
        return category
      }
    }
  }
  
  return null
}

export function isInCooperationPeriod(orderDate: string, influencer: Influencer): boolean {
  if (!orderDate || !influencer.cooperationStart || !influencer.cooperationEnd) return false
  
  const orderTime = dayjs(orderDate).startOf('day')
  const startTime = dayjs(influencer.cooperationStart).startOf('day')
  const endTime = dayjs(influencer.cooperationEnd).endOf('day')
  
  return (orderTime.isSame(startTime) || orderTime.isAfter(startTime)) && 
         (orderTime.isSame(endTime) || orderTime.isBefore(endTime))
}

export function detectExceptions(orders: OrderRecord[], influencers: Influencer[]): ExceptionRecord[] {
  const exceptions: ExceptionRecord[] = []
  const phoneMap = new Map<string, OrderRecord[]>()
  const orderNoMap = new Map<string, OrderRecord[]>()
  
  orders.forEach(order => {
    if (order.phone) {
      const existing = phoneMap.get(order.phone) || []
      phoneMap.set(order.phone, [...existing, order])
    }
    if (order.orderNo) {
      const existing = orderNoMap.get(order.orderNo) || []
      orderNoMap.set(order.orderNo, [...existing, order])
    }
  })
  
  for (const [phone, customerOrders] of phoneMap.entries()) {
    if (customerOrders.length > 1) {
      const influencerMap = new Map<string, OrderRecord[]>()
      customerOrders.forEach(o => {
        const key = o.influencerId || 'unknown'
        const existing = influencerMap.get(key) || []
        influencerMap.set(key, [...existing, o])
      })
      
      if (influencerMap.size > 1) {
        exceptions.push({
          id: uuidv4(),
          type: 'duplicate_customer',
          description: `手机号 ${phone} 的顾客在多个达人店铺消费，涉及 ${influencerMap.size} 位达人`,
          orderIds: customerOrders.map(o => o.id),
          orders: customerOrders,
          status: 'pending',
          createdAt: new Date().toISOString()
        })
      }
    }
  }
  
  for (const [orderNo, paymentOrders] of orderNoMap.entries()) {
    if (paymentOrders.length > 1) {
      exceptions.push({
        id: uuidv4(),
        type: 'split_payment',
        description: `订单 ${orderNo} 存在 ${paymentOrders.length} 条付款记录，可能为拆单付款`,
        orderIds: paymentOrders.map(o => o.id),
        orders: paymentOrders,
        status: 'pending',
        createdAt: new Date().toISOString()
      })
    }
  }
  
  orders.forEach(order => {
    if (order.influencerId && !order.isRefund) {
      const influencer = influencers.find(i => i.id === order.influencerId)
      if (influencer && !isInCooperationPeriod(order.date, influencer)) {
        exceptions.push({
          id: uuidv4(),
          type: 'cooperation_period',
          description: `订单 ${order.orderNo} 消费时间 ${dayjs(order.date).format('YYYY-MM-DD')} 不在达人 ${influencer.name} 合作周期（${influencer.cooperationStart} ~ ${influencer.cooperationEnd}）内`,
          orderIds: [order.id],
          orders: [order],
          status: 'pending',
          createdAt: new Date().toISOString()
        })
      }
    }
  })
  
  orders.forEach(order => {
    if (!order.influencerId && !order.isRefund) {
      exceptions.push({
        id: uuidv4(),
        type: 'mismatch',
        description: `订单 ${order.orderNo} 无法匹配到达人，请检查数据`,
        orderIds: [order.id],
        orders: [order],
        status: 'pending',
        createdAt: new Date().toISOString()
      })
    }
  })
  
  return exceptions
}

export function calculateSettlement(
  influencer: Influencer,
  orders: OrderRecord[],
  categories: ProjectCategory[],
  exceptions: ExceptionRecord[]
): InfluencerSettlement {
  const excludedOrderIds = new Set<string>()
  exceptions.forEach(e => {
    if (e.status === 'pending') {
      e.orderIds.forEach(id => excludedOrderIds.add(id))
    }
    if (e.status === 'resolved' && e.resolution === 'exclude') {
      e.orderIds.forEach(id => excludedOrderIds.add(id))
    }
    if (e.status === 'resolved' && e.resolution === 'reassign' && e.assignedInfluencerId !== influencer.id) {
      e.orderIds.forEach(id => excludedOrderIds.add(id))
    }
  })
  
  const influencerOrders = orders.filter(o => 
    o.influencerId === influencer.id && 
    !o.isRefund && 
    !excludedOrderIds.has(o.id)
  )
  
  const refundOrders = orders.filter(o => 
    o.influencerId === influencer.id && 
    o.isRefund
  )
  
  const items: SettlementItem[] = []
  let totalAmount = 0
  let totalCommission = 0
  
  const customerPhones = new Set<string>()
  const validCustomerPhones = new Set<string>()
  
  influencerOrders.forEach(order => {
    const category = matchProjectCategory(order.projectName, categories)
    const commissionRate = category ? category.commissionRate : influencer.commissionRate
    const commission = Math.round(order.amount * commissionRate * 100) / 100
    
    let refundDeduction = 0
    const relatedRefund = refundOrders.find(r => r.orderNo === order.orderNo)
    if (relatedRefund) {
      refundDeduction = relatedRefund.refundAmount || 0
    }
    
    items.push({
      id: uuidv4(),
      orderId: order.id,
      orderNo: order.orderNo,
      phone: order.phone,
      customerName: order.customerName,
      projectName: order.projectName,
      categoryName: category?.name || '其他',
      amount: order.amount,
      date: order.date,
      commissionRate,
      commission: Math.max(0, commission - refundDeduction * commissionRate),
      isRefund: false,
      refundDeduction
    })
    
    totalAmount += order.amount - (refundDeduction || 0)
    totalCommission += Math.max(0, commission - refundDeduction * commissionRate)
    
    if (order.phone) {
      customerPhones.add(order.phone)
      if (order.amount >= 100) {
        validCustomerPhones.add(order.phone)
      }
    }
  })
  
  const validCustomerReward = influencer.validCustomerReward * validCustomerPhones.size
  const subtotal = influencer.fixedFee + validCustomerReward + totalCommission
  const finalAmount = Math.min(subtotal, influencer.maxAmount)
  
  return {
    id: uuidv4(),
    influencerId: influencer.id,
    influencerName: influencer.name,
    version: 1,
    period: dayjs().format('YYYY-MM'),
    fixedFee: influencer.fixedFee,
    validCustomerReward,
    customerCount: customerPhones.size,
    validCustomerCount: validCustomerPhones.size,
    totalAmount: Math.round(totalAmount * 100) / 100,
    totalCommission: Math.round(totalCommission * 100) / 100,
    maxAmount: influencer.maxAmount,
    finalAmount: Math.round(finalAmount * 100) / 100,
    items,
    createdAt: new Date().toISOString(),
    status: 'draft'
  }
}

export function matchInfluencerByPhone(phone: string, influencers: Influencer[]): Influencer | null {
  const normalized = normalizePhone(phone)
  return influencers.find(i => normalizePhone(i.phone) === normalized) || null
}

export function matchInfluencerByName(name: string, influencers: Influencer[]): Influencer | null {
  if (!name) return null
  return influencers.find(i => i.name.includes(name) || name.includes(i.name)) || null
}
