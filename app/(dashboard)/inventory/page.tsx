'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { productSchema, ProductInput } from '@/lib/validations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { usePageCount } from '@/hooks/use-page-count'
import { Plus, Search, Edit, Trash2, Package, Tag, X, Eye, LayoutGrid, Table2 } from 'lucide-react'
import { formatCurrency, formatCategoryName, normalizeCategoryNameKey, sortByNameCaseSensitive } from '@/lib/utils'
import { parseJsonResponse } from '@/lib/fetch-json'
import { CategorySlidePanel } from '@/components/inventory/category-slide-panel'

function formatHsnSac(hsn: string | null, sac: string | null): string {
  if (hsn && sac) return `${hsn} / ${sac}`
  return hsn || sac || '-'
}

interface Product {
  id: string
  name: string
  sku: string | null
  hsn_code: string | null
  sac_code: string | null
  description: string | null
  selling_price: number
  purchase_price: number
  current_stock: number
  gst_rate: number
  gst_type: string
  is_active: number
  low_stock_alert: number
  category_id: string | null
  unit_id: string | null
  brand_id: string | null
  category_name: string | null
  unit_name: string | null
  unit_short_name: string | null
  brand_name: string | null
  discount: number | string | null
}

interface SelectOption { id: string; name: string }

const GST_RATES = [0, 5, 12, 18, 28]

export default function InventoryPage() {
  const { toast } = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<SelectOption[]>([])
  const [brands, setBrands] = useState<SelectOption[]>([])
  const [units, setUnits] = useState<SelectOption[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active')
  const [total, setTotal] = useState(0)
  usePageCount(`${total} product(s)`)
  const [page, setPage] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [viewing, setViewing] = useState<Product | null>(null)
  const [viewLoading, setViewLoading] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({})
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table')
  const [isMobile, setIsMobile] = useState(false)
  const [saving, setSaving] = useState(false)
  const [catDialogOpen, setCatDialogOpen] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [catSaving, setCatSaving] = useState(false)

  const form = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '', sku: '', hsnCode: '', sellingPrice: 0, purchasePrice: 0,
      description: '',
      openingStock: 0, gstRate: 18, gstType: 'CGST_SGST' as const, lowStockAlert: 0, discount: null,
      isActive: true, categoryId: '', unitId: '',
    },
  })

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ search, page: String(page), limit: '20' })
      if (categoryFilter) params.set('categoryId', categoryFilter)
      params.set('status', statusFilter)
      const res = await fetch(`/api/products?${params}`)
      const data = await parseJsonResponse<{ products?: Product[]; total?: number; error?: string }>(res)
      if (!res.ok) {
        toast({ title: data.error || 'Failed to load products', variant: 'destructive' })
        return
      }
      setProducts(data.products || [])
      setTotal(Number(data.total) || 0)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to load products'
      toast({ title: message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [search, page, categoryFilter, statusFilter])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const showTable = viewMode === 'table' && !isMobile
  const showCards = viewMode === 'card' || isMobile

  useEffect(() => {
    // clear selection when list changes (pagination/filter/search)
    setSelectedIds({})
  }, [search, page, categoryFilter, statusFilter])

  const selectedCount = useMemo(() => Object.values(selectedIds).filter(Boolean).length, [selectedIds])
  const allVisibleSelected = useMemo(() => {
    if (products.length === 0) return false
    return products.every((p) => selectedIds[p.id])
  }, [products, selectedIds])
  const someVisibleSelected = useMemo(() => {
    if (products.length === 0) return false
    return products.some((p) => selectedIds[p.id])
  }, [products, selectedIds])

  const toggleSelectAllVisible = (checked: boolean) => {
    const next: Record<string, boolean> = { ...selectedIds }
    for (const p of products) next[p.id] = checked
    setSelectedIds(next)
  }

  const toggleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => ({ ...prev, [id]: checked }))
  }

  useEffect(() => {
    async function fetchOptions(url: string): Promise<SelectOption[]> {
      const res = await fetch(url)
      if (!res.ok) return []
      const data = await res.json()
      return Array.isArray(data) ? data : []
    }

    Promise.all([
      fetchOptions('/api/categories'),
      fetchOptions('/api/brands'),
      fetchOptions('/api/units'),
    ]).then(([cats, brds, unts]) => {
      setCategories(sortByNameCaseSensitive(cats))
      setBrands(brds)
      setUnits(unts)
    })
  }, [])

  const openNew = () => {
    setEditing(null)
    form.reset({ name: '', sku: '', hsnCode: '', sellingPrice: 0, purchasePrice: 0, description: '', openingStock: 0, gstRate: 18, gstType: 'CGST_SGST' as const, lowStockAlert: 0, discount: null, isActive: true, categoryId: '', unitId: '' })
    setDialogOpen(true)
  }

  const openView = async (product: Product) => {
    setViewDialogOpen(true)
    setViewLoading(true)
    setViewing(product)
    try {
      const res = await fetch(`/api/products/${product.id}`)
      if (res.ok) setViewing(await res.json())
    } finally {
      setViewLoading(false)
    }
  }

  const openEditFromView = () => {
    if (!viewing) return
    setViewDialogOpen(false)
    openEdit(viewing)
  }

  const openEdit = (product: Product) => {
    setEditing(product)
    form.reset({
      name: product.name,
      sku: product.sku || '',
      hsnCode: product.hsn_code || '',
      description: product.description || '',
      sellingPrice: Number(product.selling_price),
      purchasePrice: Number(product.purchase_price),
      openingStock: product.current_stock,
      gstRate: Number(product.gst_rate),
      gstType: product.gst_type as 'CGST_SGST' | 'IGST' | 'EXEMPT',
      lowStockAlert: product.low_stock_alert,
      discount:
        product.discount === null || product.discount === undefined || product.discount === ''
          ? null
          : Number(product.discount),
      isActive: product.is_active === 1,
      categoryId: product.category_id || '',
      unitId: product.unit_id || '',
    })
    setDialogOpen(true)
  }

  const onSubmit = async (data: ProductInput) => {
    setSaving(true)
    try {
      const url = editing ? `/api/products/${editing.id}` : '/api/products'
      const method = editing ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!res.ok) {
        const err = await res.json()
        const message =
          typeof err.error === 'string'
            ? err.error
            : Array.isArray(err.error)
              ? err.error.map((e: { message?: string }) => e.message).filter(Boolean).join(', ') || 'Validation failed'
              : JSON.stringify(err.error ?? err)
        toast({ title: 'Error', description: message, variant: 'destructive' })
        return
      }
      toast({
        title: editing ? 'Product updated' : 'Product created',
        description: editing ? 'Product details saved successfully.' : undefined,
      })
      setDialogOpen(false)
      fetchProducts()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Something went wrong', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product?')) return
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast({ title: 'Product deleted' })
      fetchProducts()
    } else {
      const err = await res.json()
      toast({ title: 'Error', description: err.error || 'Cannot delete', variant: 'destructive' })
    }
  }

  const handleDeleteSelected = async () => {
    const ids = Object.entries(selectedIds).filter(([, v]) => v).map(([k]) => k)
    if (ids.length === 0) return
    if (!confirm(`Delete ${ids.length} selected product(s)?`)) return
    try {
      const results = await Promise.allSettled(ids.map((id) => fetch(`/api/products/${id}`, { method: 'DELETE' })))
      const okCount = results.filter((r) => r.status === 'fulfilled' && r.value.ok).length
      const failCount = ids.length - okCount
      if (okCount > 0) toast({ title: `Deleted ${okCount} product(s)` })
      if (failCount > 0) toast({ title: 'Some deletes failed', description: `${failCount} item(s) could not be deleted`, variant: 'destructive' })
      setSelectedIds({})
      fetchProducts()
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Bulk delete failed', variant: 'destructive' })
    }
  }

  const addCategory = async () => {
    const formattedName = formatCategoryName(newCatName)
    if (!formattedName) return

    const newKey = normalizeCategoryNameKey(formattedName)
    const existing = categories.find((c) => normalizeCategoryNameKey(c.name) === newKey)
    if (existing) {
      toast({
        title: 'Duplicate category',
        description: `"${existing.name}" already exists`,
        variant: 'destructive',
      })
      return
    }

    setCatSaving(true)
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formattedName }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast({ title: 'Error', description: err.error || 'Failed to add category', variant: 'destructive' })
        return
      }
      const cat = await res.json()
      setCategories((prev) => sortByNameCaseSensitive([...prev, { id: cat.id, name: cat.name }]))
      setNewCatName('')
      toast({ title: `Category "${cat.name}" added` })
    } finally {
      setCatSaving(false)
    }
  }

  const deleteCategory = async (id: string, name: string) => {
    if (!confirm(`Delete category "${name}"? Products using it will lose their category.`)) return
    const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setCategories(prev => prev.filter(c => c.id !== id))
      if (categoryFilter === id) setCategoryFilter('')
      toast({ title: `Category "${name}" deleted` })
    } else {
      const err = await res.json()
      toast({ title: 'Error', description: err.error || 'Cannot delete', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4 md:space-y-6 min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:flex-wrap sm:w-auto sm:items-center">
          {selectedCount > 0 && (
            <Button
              variant="destructive"
              onClick={handleDeleteSelected}
              size="icon"
              title={`Delete ${selectedCount} selected`}
              aria-label={`Delete ${selectedCount} selected`}
              className="col-span-2 sm:col-span-1 sm:w-9"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setCatDialogOpen(true)}
            title="Category"
            aria-label="Category"
            className="h-9 px-2.5 sm:px-3"
          >
            <Tag className="w-4 h-4 shrink-0 mr-1.5" />
            <span className="text-xs sm:text-sm truncate">Category</span>
          </Button>
          <Button
            onClick={openNew}
            title="Add Product"
            aria-label="Add Product"
            className="h-9 px-2.5 sm:px-3"
          >
            <Plus className="w-4 h-4 shrink-0 mr-1.5" />
            <span className="text-xs sm:text-sm truncate">Add Product</span>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-3 sm:p-4 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              className="pl-9 h-9"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 md:flex md:flex-row md:items-center md:gap-3">
            <Select value={categoryFilter || 'all'} onValueChange={(v) => { setCategoryFilter(v === 'all' ? '' : v); setPage(1) }}>
              <SelectTrigger className="w-full h-9 md:w-48">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as 'active' | 'inactive' | 'all'); setPage(1) }}>
              <SelectTrigger className="w-full h-9 md:w-36">
                <SelectValue placeholder="Active" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="all">All Status</SelectItem>
              </SelectContent>
            </Select>
            <div className="hidden md:flex items-center gap-2 md:ml-auto">
              <div className="flex items-center gap-1 rounded-md border bg-background p-1">
                <Button
                  variant={viewMode === 'table' ? 'secondary' : 'outline'}
                  size="icon"
                  className="h-8 w-8"
                  title="Table view"
                  onClick={() => setViewMode('table')}
                >
                  <Table2 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'card' ? 'secondary' : 'outline'}
                  size="icon"
                  className="h-8 w-8"
                  title="Card view"
                  onClick={() => setViewMode('card')}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </div>
              {categoryFilter && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setCategoryFilter(''); setPage(1) }}>
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {showTable && (
        <Card className="overflow-x-auto">
          <Table className="min-w-[800px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={allVisibleSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected
                  }}
                  onChange={(e) => toggleSelectAllVisible(e.target.checked)}
                  className="h-4 w-4"
                />
              </TableHead>
              <TableHead>Product</TableHead>
              <TableHead>HSN / SAC</TableHead>
              <TableHead className="text-right">Sale Price</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : products.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">No products found</TableCell></TableRow>
            ) : (
              products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      aria-label={`Select ${p.name}`}
                      checked={!!selectedIds[p.id]}
                      onChange={(e) => toggleSelectOne(p.id, e.target.checked)}
                      className="h-4 w-4"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="font-medium">{p.name}</p>
                        {p.unit_short_name && (
                          <p className="text-xs text-muted-foreground">{p.unit_short_name}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{formatHsnSac(p.hsn_code, p.sac_code)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(p.selling_price))}</TableCell>
                  <TableCell className="text-right">
                    <span
                      className={
                        Number(p.current_stock) <= Number(p.low_stock_alert ?? 0)
                          ? 'font-medium text-orange-600'
                          : ''
                      }
                    >
                      {Number(p.current_stock)}
                      {p.unit_short_name && (
                        <span className="text-xs text-muted-foreground ml-1">{p.unit_short_name}</span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>{p.category_name || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={p.is_active === 1 ? 'default' : 'secondary'}>
                      {p.is_active === 1 ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-0">
                      <Button variant="ghost" size="icon" title="View" className="h-7 w-7" onClick={() => openView(p)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Edit" className="h-7 w-7" onClick={() => openEdit(p)}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(p.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {total > 20 && (
          <div className="flex items-center justify-between p-4 border-t">
            <p className="text-sm text-muted-foreground">Page {page} of {Math.ceil(total / 20)}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
        </Card>
      )}

      {showCards && (
        <div className="space-y-3">
          {products.length > 0 && (
            <div className="flex items-center justify-between rounded-lg border bg-card px-3 py-2">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={allVisibleSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected
                  }}
                  onChange={(e) => toggleSelectAllVisible(e.target.checked)}
                  className="h-4 w-4"
                />
                Select all
              </label>
              {selectedCount > 0 && (
                <span className="text-xs text-muted-foreground">{selectedCount} selected</span>
              )}
            </div>
          )}

          {loading ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">Loading...</CardContent>
            </Card>
          ) : products.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">No products found</CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3 md:gap-3">
              {products.map((p) => (
                <Card key={p.id} className="overflow-hidden rounded-xl border shadow-sm">
                  <CardContent className="p-0">
                    <div className="p-3">
                      <div className="flex items-center justify-between gap-1">
                        <label className="flex items-center shrink-0">
                          <input
                            type="checkbox"
                            aria-label={`Select ${p.name}`}
                            checked={!!selectedIds[p.id]}
                            onChange={(e) => toggleSelectOne(p.id, e.target.checked)}
                            className="h-4 w-4"
                          />
                        </label>
                        <div className="flex items-center shrink-0">
                          <Button variant="ghost" size="icon" title="View" className="h-7 w-7" onClick={() => openView(p)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Edit" className="h-7 w-7" onClick={() => openEdit(p)}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Delete"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(p.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      <div className="mt-2 flex items-start gap-2">
                        <Package className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium text-sm leading-snug break-words">{p.name}</p>
                            <Badge variant={p.is_active === 1 ? 'default' : 'secondary'} className="shrink-0 text-[10px] px-1.5 py-0">
                              {p.is_active === 1 ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatHsnSac(p.hsn_code, p.sac_code)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 border-t pt-2 text-sm">
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground">Sale Price</span>
                          <span className="font-medium text-sm">{formatCurrency(Number(p.selling_price))}</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-xs text-muted-foreground">Stock</span>
                          <span
                            className={`font-medium text-sm ${
                              Number(p.current_stock) <= Number(p.low_stock_alert ?? 0)
                                ? 'text-orange-600'
                                : ''
                            }`}
                          >
                            {Number(p.current_stock)}
                            {p.unit_short_name ? ` ${p.unit_short_name}` : ''}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 border-t bg-muted/40 px-3 py-2.5 rounded-b-xl">
                      <Tag className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground shrink-0">Category</span>
                      <span className="ml-auto min-w-0 truncate text-right text-sm font-medium">
                        {p.category_name || '-'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {total > 20 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Page {page} of {Math.ceil(total / 20)}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="w-[calc(100vw-0.75rem)] max-w-lg max-h-[92dvh] overflow-hidden flex flex-col gap-0 p-0 rounded-xl sm:rounded-2xl !top-3 !translate-y-0 sm:!top-[50%] sm:!translate-y-[-50%]">
          <DialogHeader className="px-4 pt-4 pb-2 shrink-0">
            <DialogTitle className="text-base">Product Details</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-2">
          {viewLoading && !viewing ? (
            <p className="py-8 text-center text-muted-foreground">Loading...</p>
          ) : viewing ? (
            <div className="space-y-3 py-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div className="col-span-2">
                  <p className="text-muted-foreground">Product Name</p>
                  <p className="font-medium">{viewing.name}</p>
                </div>
                {viewing.description && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Description</p>
                    <p className="whitespace-pre-wrap">{viewing.description}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground">SKU</p>
                  <p>{viewing.sku || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">HSN / SAC</p>
                  <p>{formatHsnSac(viewing.hsn_code, viewing.sac_code)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Sale Price</p>
                  <p>{formatCurrency(Number(viewing.selling_price))}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Purchase Price</p>
                  <p>{formatCurrency(Number(viewing.purchase_price))}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Category</p>
                  <p>{viewing.category_name || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Unit</p>
                  <p>{viewing.unit_name || viewing.unit_short_name || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">GST Rate</p>
                  <p>{Number(viewing.gst_rate)}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Stock</p>
                  <p>{viewing.current_stock}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge variant={viewing.is_active === 1 ? 'default' : 'secondary'}>
                    {viewing.is_active === 1 ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                {viewing.discount != null && viewing.discount !== '' && (
                  <div>
                    <p className="text-muted-foreground">Discount</p>
                    <p>{Number(viewing.discount)}%</p>
                  </div>
                )}
              </div>
            </div>
          ) : null}
          </div>
          <DialogFooter className="shrink-0 flex-row gap-2 border-t px-3 py-2.5 sm:px-4 rounded-b-xl sm:rounded-b-2xl">
            <Button variant="outline" className="flex-1 h-9 sm:flex-none sm:w-auto" onClick={() => setViewDialogOpen(false)}>Close</Button>
            <Button className="flex-1 h-9 sm:flex-none sm:w-auto" onClick={openEditFromView} disabled={!viewing}>Edit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92dvh] w-[calc(100vw-0.75rem)] max-w-2xl !flex !flex-col gap-0 overflow-hidden p-0 rounded-xl sm:rounded-2xl sm:w-full sm:max-w-2xl !top-3 !translate-y-0 sm:!top-[50%] sm:!translate-y-[-50%]">
          <DialogHeader className="shrink-0 space-y-0 px-3 pb-2 pt-3 pr-11 text-left sm:px-6 sm:pt-5 sm:pr-14">
            <DialogTitle className="text-base sm:text-lg">{editing ? 'Edit Product' : 'Add Product'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-1 sm:px-6 sm:py-2">
              <div className="grid grid-cols-2 gap-2.5 sm:gap-4 pb-1">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs sm:text-sm">Product Name *</Label>
                <Input className="h-9" {...form.register('name')} />
                {form.formState.errors.name && <p className="text-destructive text-xs">{form.formState.errors.name.message}</p>}
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs sm:text-sm">Product Description</Label>
                <Textarea
                  rows={2}
                  placeholder="Optional"
                  className="min-h-[4.5rem] resize-none sm:min-h-[5rem]"
                  {...form.register('description')}
                />
                {form.formState.errors.description && (
                  <p className="text-destructive text-xs">{form.formState.errors.description.message as string}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs sm:text-sm">SKU</Label>
                <Input className="h-9" {...form.register('sku')} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs sm:text-sm">HSN Code</Label>
                <Input className="h-9" {...form.register('hsnCode')} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs sm:text-sm">Selling Price (₹) *</Label>
                <Input type="number" step="0.01" className="h-9 no-spinner" {...form.register('sellingPrice', { valueAsNumber: true })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs sm:text-sm">Purchase Price (₹) *</Label>
                <Input type="number" step="0.01" className="h-9 no-spinner" {...form.register('purchasePrice', { valueAsNumber: true })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs sm:text-sm">GST Rate (%) *</Label>
                <Select onValueChange={(v) => form.setValue('gstRate', Number(v))} defaultValue="18">
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GST_RATES.map(r => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {!editing && (
                <div className="space-y-1">
                  <Label className="text-xs sm:text-sm">Opening Stock</Label>
                  <Input type="number" className="h-9 no-spinner" {...form.register('openingStock', { valueAsNumber: true })} />
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs sm:text-sm">Category</Label>
                <Select onValueChange={(v) => form.setValue('categoryId', v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs sm:text-sm">Unit</Label>
                <Select onValueChange={(v) => form.setValue('unitId', v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {units.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs sm:text-sm">Low stock alert quantity</Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  className="h-9 no-spinner"
                  {...form.register('lowStockAlert', { valueAsNumber: true })}
                />
                {form.formState.errors.lowStockAlert && (
                  <p className="text-destructive text-xs">{form.formState.errors.lowStockAlert.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs sm:text-sm">Discount (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  placeholder="Optional"
                  className="h-9 no-spinner"
                  {...form.register('discount', {
                    setValueAs: (v) => {
                      if (v === '' || v === null || v === undefined) return null
                      const n = Number(v)
                      return Number.isFinite(n) ? n : null
                    },
                  })}
                />
                {form.formState.errors.discount && (
                  <p className="text-destructive text-xs">{form.formState.errors.discount.message as string}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs sm:text-sm">Status</Label>
                <Select
                  value={form.watch('isActive') ? 'active' : 'inactive'}
                  onValueChange={(v) => form.setValue('isActive', v === 'active')}
                >
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              </div>
            </div>
            <DialogFooter className="shrink-0 flex-row gap-2 border-t bg-background px-3 py-2.5 sm:px-6 sm:py-3 rounded-b-xl sm:rounded-b-2xl">
              <Button type="button" variant="outline" className="flex-1 h-9 sm:flex-none sm:w-auto" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" className="flex-1 h-9 sm:flex-none sm:w-auto" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Manage Categories — right slide panel */}
      <CategorySlidePanel
        open={catDialogOpen}
        onOpenChange={setCatDialogOpen}
        categories={categories}
        newCatName={newCatName}
        onNewCatNameChange={setNewCatName}
        catSaving={catSaving}
        onAddCategory={addCategory}
        onDeleteCategory={deleteCategory}
      />
    </div>
  )
}
