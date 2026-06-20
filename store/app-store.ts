import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ColorMode = 'light' | 'dark'

interface AppState {
  sidebarOpen: boolean
  mobileSidebarOpen: boolean
  colorMode: ColorMode
  setSidebarOpen: (open: boolean) => void
  setMobileSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setColorMode: (mode: ColorMode) => void
  toggleColorMode: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      mobileSidebarOpen: false,
      colorMode: 'light',
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setColorMode: (mode) => set({ colorMode: mode }),
      toggleColorMode: () =>
        set((state) => ({ colorMode: state.colorMode === 'dark' ? 'light' : 'dark' })),
    }),
    {
      name: 'app-store',
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        colorMode: state.colorMode,
      }),
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
