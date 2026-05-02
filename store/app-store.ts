import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AppState {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    }),
    {
      name: 'app-store',
    }
  )
)

// Invoice builder store
interface InvoiceItem {
  productId: string
  productName: string
  description: string
  quantity: number
  rate: number
  discount: number
  gstRate: number
  amount: number
  cgstAmount: number
  sgstAmount: number
  igstAmount: number
  gstAmount: number
}

interface InvoiceBuilderState {
  items: InvoiceItem[]
  gstType: 'CGST_SGST' | 'IGST' | 'EXEMPT'
  addItem: (item: InvoiceItem) => void
  updateItem: (index: number, item: Partial<InvoiceItem>) => void
  removeItem: (index: number) => void
  clearItems: () => void
  setGstType: (type: 'CGST_SGST' | 'IGST' | 'EXEMPT') => void
  getSubtotal: () => number
  getTaxAmount: () => number
  getTotal: () => number
}

export const useInvoiceBuilder = create<InvoiceBuilderState>()((set, get) => ({
  items: [],
  gstType: 'CGST_SGST',
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  updateItem: (index, item) =>
    set((state) => ({
      items: state.items.map((i, idx) => (idx === index ? { ...i, ...item } : i)),
    })),
  removeItem: (index) =>
    set((state) => ({ items: state.items.filter((_, idx) => idx !== index) })),
  clearItems: () => set({ items: [] }),
  setGstType: (type) => set({ gstType: type }),
  getSubtotal: () => get().items.reduce((sum, item) => sum + item.amount, 0),
  getTaxAmount: () => get().items.reduce((sum, item) => sum + item.gstAmount, 0),
  getTotal: () => get().items.reduce((sum, item) => sum + item.amount + item.gstAmount, 0),
}))
