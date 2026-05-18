'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { productSchema, ProductInput } from '@/lib/validations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Plus, Search, Edit, Trash2, AlertTriangle, Package, Tag, X } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface Product {
  id: string
  name: string
  sku: string | null
  hsn_code: string | null
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
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [saving, setSaving] = useState(false)
  const [catDialogOpen, setCatDialogOpen] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [catSaving, setCatSaving] = useState(false)

  const form = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '', sku: '', hsnCode: '', sellingPrice: 0, purchasePrice: 0,
      openingStock: 0, gstRate: 18, gstType: 'CGST_SGST' as const, lowStockAlert: 0, discount: null,
      isActive: true, categoryId: '', unitId: '',
    },
  })

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ search, page: String(page), limit: '20' })
      if (categoryFilter) params.set('categoryId', categoryFilter)
      const res = await fetch(`/api/products?${params}`)
      const data = await res.json()
      setProducts(data.products)
      setTotal(data.total)
    } finally {
      setLoading(false)
    }
  }, [search, page, categoryFilter])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  useEffect(() => {
    Promise.all([
      fetch('/api/categories').then(r => r.json()),
      fetch('/api/brands').then(r => r.json()),
      fetch('/api/units').then(r => r.json()),
    ]).then(([cats, brds, unts]) => {
      setCategories(cats)
      setBrands(brds)
      setUnits(unts)
    })
  }, [])

  const openNew = () => {
    setEditing(null)
    form.reset({ name: '', sku: '', hsnCode: '', sellingPrice: 0, purchasePrice: 0, openingStock: 0, gstRate: 18, gstType: 'CGST_SGST' as const, lowStockAlert: 0, discount: null, isActive: true, categoryId: '', unitId: '' })
    setDialogOpen(true)
  }

  const openEdit = (product: Product) => {
    setEditing(product)
    form.reset({
      name: product.name,
      sku: product.sku || '',
      hsnCode: product.hsn_code || '',
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
        toast({ title: 'Error', description: err.error || JSON.stringify(err), variant: 'destructive' })
        return
      }
      toast({ title: editing ? 'Product updated' : 'Product created' })
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

  const addCategory = async () => {
    if (!newCatName.trim()) return
    setCatSaving(true)
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCatName.trim() }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast({ title: 'Error', description: err.error || 'Failed to add category', variant: 'destructive' })
        return
      }
      const cat = await res.json()
      setCategories(prev => [...prev, { id: cat.id, name: cat.name }])
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-muted-foreground">{total} product(s)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCatDialogOpen(true)}><Tag className="w-4 h-4 mr-2" />Categories</Button>
          <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Add Product</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                className="pl-9"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              />
            </div>
            <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v === 'all' ? '' : v); setPage(1) }}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {categoryFilter && (
              <Button variant="ghost" size="icon" onClick={() => { setCategoryFilter(''); setPage(1) }}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU / HSN</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Sale Price</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">GST %</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : products.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No products found</TableCell></TableRow>
            ) : (
              products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.unit_short_name}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm">{p.sku || '-'}</p>
                      <p className="text-xs text-muted-foreground">{p.hsn_code || '-'}</p>
                    </div>
                  </TableCell>
                  <TableCell>{p.category_name || '-'}</TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(p.selling_price))}</TableCell>
                  <TableCell className="text-right">
                    <span className={p.current_stock <= p.low_stock_alert ? 'text-orange-600 font-medium flex items-center justify-end gap-1' : ''}>
                      {p.current_stock <= p.low_stock_alert && <AlertTriangle className="w-3 h-3" />}
                      {p.current_stock}
                    </span>
                  </TableCell>
                  <TableCell className="text-right"><Badge variant="secondary">{p.gst_rate}%</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Edit className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(p.id)}><Trash2 className="w-4 h-4" /></Button>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[min(90vh,calc(100dvh-2rem))] max-w-2xl !flex !flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="shrink-0 space-y-1.5 px-6 pb-2 pt-6 pr-14 text-left">
            <DialogTitle>{editing ? 'Edit Product' : 'Add Product'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-2">
              <div className="grid grid-cols-2 gap-4 pb-2">
              <div className="col-span-2 space-y-2">
                <Label>Product Name *</Label>
                <Input {...form.register('name')} />
                {form.formState.errors.name && <p className="text-destructive text-xs">{form.formState.errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input {...form.register('sku')} />
              </div>
              <div className="space-y-2">
                <Label>HSN Code</Label>
                <Input {...form.register('hsnCode')} />
              </div>
              <div className="space-y-2">
                <Label>Selling Price (₹) *</Label>
                <Input type="number" step="0.01" className="no-spinner" {...form.register('sellingPrice', { valueAsNumber: true })} />
              </div>
              <div className="space-y-2">
                <Label>Purchase Price (₹) *</Label>
                <Input type="number" step="0.01" className="no-spinner" {...form.register('purchasePrice', { valueAsNumber: true })} />
              </div>
              <div className="space-y-2">
                <Label>GST Rate (%) *</Label>
                <Select onValueChange={(v) => form.setValue('gstRate', Number(v))} defaultValue="18">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GST_RATES.map(r => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {!editing && (
                <div className="space-y-2">
                  <Label>Opening Stock</Label>
                  <Input type="number" className="no-spinner" {...form.register('openingStock', { valueAsNumber: true })} />
                </div>
              )}
              <div className="space-y-2">
                <Label>Category</Label>
                <Select onValueChange={(v) => form.setValue('categoryId', v)}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select onValueChange={(v) => form.setValue('unitId', v)}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {units.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Low stock alert quantity</Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  className="no-spinner"
                  {...form.register('lowStockAlert', { valueAsNumber: true })}
                />
                {form.formState.errors.lowStockAlert && (
                  <p className="text-destructive text-xs">{form.formState.errors.lowStockAlert.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Discount (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  placeholder="Optional"
                  className="no-spinner"
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
              </div>
            </div>
            <DialogFooter className="shrink-0 gap-2 border-t bg-background px-6 py-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Manage Categories Dialog */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Categories</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4">
            {/* Add new category */}
            <div className="flex gap-2">
              <Input
                placeholder="New category name..."
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCategory() } }}
              />
              <Button onClick={addCategory} disabled={catSaving || !newCatName.trim()}>
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </div>
            {/* Categories list */}
            <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No categories yet</p>
              ) : (
                categories.map(c => (
                  <div key={c.id} className="flex items-center justify-between px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Tag className="w-3 h-3 text-muted-foreground" />
                      <span className="text-sm">{c.name}</span>
                    </div>
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => deleteCategory(c.id, c.name)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
