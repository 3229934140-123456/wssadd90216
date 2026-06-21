import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  AppState,
  ImportedFile,
  FieldMapping,
  FileType,
  Influencer,
  ProjectCategory,
  OrderRecord,
  ExceptionRecord,
  InfluencerSettlement,
  SettlementVersion
} from '@/types'

interface AppStore extends AppState {
  addImportedFile: (file: ImportedFile) => void
  removeImportedFile: (id: string) => void
  clearImportedFiles: () => void
  
  setFieldMapping: (type: FileType, mapping: FieldMapping) => void
  clearFieldMapping: (type: FileType) => void
  
  addInfluencer: (influencer: Influencer) => void
  updateInfluencer: (id: string, data: Partial<Influencer>) => void
  removeInfluencer: (id: string) => void
  
  addProjectCategory: (category: ProjectCategory) => void
  updateProjectCategory: (id: string, data: Partial<ProjectCategory>) => void
  removeProjectCategory: (id: string) => void
  
  setOrders: (orders: OrderRecord[]) => void
  addOrder: (order: OrderRecord) => void
  updateOrder: (id: string, data: Partial<OrderRecord>) => void
  
  setExceptions: (exceptions: ExceptionRecord[]) => void
  updateException: (id: string, data: Partial<ExceptionRecord>) => void
  
  addSettlement: (settlement: InfluencerSettlement) => void
  setSettlements: (settlements: InfluencerSettlement[]) => void
  updateSettlement: (id: string, data: Partial<InfluencerSettlement>) => void
  
  addVersion: (version: SettlementVersion) => void
  setCurrentVersion: (version: number) => void
  setCurrentPeriod: (period: string) => void
  
  resetAll: () => void
}

const initialState: AppState = {
  importedFiles: [],
  fieldMappings: {
    cooperation: null,
    cashier: null,
    groupbuy: null,
    refund: null
  },
  influencers: [],
  projectCategories: [],
  orders: [],
  exceptions: [],
  settlements: [],
  versions: [],
  currentPeriod: '',
  currentVersion: 1
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      ...initialState,
      
      addImportedFile: (file) => set((state) => ({
        importedFiles: [...state.importedFiles, file]
      })),
      removeImportedFile: (id) => set((state) => ({
        importedFiles: state.importedFiles.filter(f => f.id !== id)
      })),
      clearImportedFiles: () => set({ importedFiles: [] }),
      
      setFieldMapping: (type, mapping) => set((state) => ({
        fieldMappings: { ...state.fieldMappings, [type]: mapping }
      })),
      clearFieldMapping: (type) => set((state) => ({
        fieldMappings: { ...state.fieldMappings, [type]: null }
      })),
      
      addInfluencer: (influencer) => set((state) => ({
        influencers: [...state.influencers, influencer]
      })),
      updateInfluencer: (id, data) => set((state) => ({
        influencers: state.influencers.map(i => 
          i.id === id ? { ...i, ...data } : i
        )
      })),
      removeInfluencer: (id) => set((state) => ({
        influencers: state.influencers.filter(i => i.id !== id)
      })),
      
      addProjectCategory: (category) => set((state) => ({
        projectCategories: [...state.projectCategories, category]
      })),
      updateProjectCategory: (id, data) => set((state) => ({
        projectCategories: state.projectCategories.map(c =>
          c.id === id ? { ...c, ...data } : c
        )
      })),
      removeProjectCategory: (id) => set((state) => ({
        projectCategories: state.projectCategories.filter(c => c.id !== id)
      })),
      
      setOrders: (orders) => set({ orders }),
      addOrder: (order) => set((state) => ({
        orders: [...state.orders, order]
      })),
      updateOrder: (id, data) => set((state) => ({
        orders: state.orders.map(o => o.id === id ? { ...o, ...data } : o)
      })),
      
      setExceptions: (exceptions) => set({ exceptions }),
      updateException: (id, data) => set((state) => ({
        exceptions: state.exceptions.map(e => e.id === id ? { ...e, ...data } : e)
      })),
      
      addSettlement: (settlement) => set((state) => ({
        settlements: [...state.settlements, settlement]
      })),
      setSettlements: (settlements) => set({ settlements }),
      updateSettlement: (id, data) => set((state) => ({
        settlements: state.settlements.map(s => s.id === id ? { ...s, ...data } : s)
      })),
      
      addVersion: (version) => set((state) => ({
        versions: [...state.versions, version]
      })),
      setCurrentVersion: (currentVersion) => set({ currentVersion }),
      setCurrentPeriod: (currentPeriod) => set({ currentPeriod }),
      
      resetAll: () => set(initialState)
    }),
    {
      name: 'commission-settlement-storage'
    }
  )
)
