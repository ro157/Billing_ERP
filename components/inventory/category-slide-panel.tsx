'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Plus, Search, Tag, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface CategorySlidePanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: { id: string; name: string }[]
  newCatName: string
  onNewCatNameChange: (name: string) => void
  catSaving: boolean
  onAddCategory: () => void
  onDeleteCategory: (id: string, name: string) => void
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  const trimmed = query.trim()
  if (!trimmed) return <>{text}</>

  const lowerText = text.toLowerCase()
  const lowerQuery = trimmed.toLowerCase()
  const index = lowerText.indexOf(lowerQuery)
  if (index === -1) return <>{text}</>

  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded bg-primary/15 px-0.5 font-medium text-foreground">
        {text.slice(index, index + trimmed.length)}
      </mark>
      {text.slice(index + trimmed.length)}
    </>
  )
}

export function CategorySlidePanel({
  open,
  onOpenChange,
  categories,
  newCatName,
  onNewCatNameChange,
  catSaving,
  onAddCategory,
  onDeleteCategory,
}: CategorySlidePanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) {
      setSearchQuery('')
      setSearchOpen(false)
    }
  }, [open])

  useEffect(() => {
    if (searchOpen) {
      const t = window.setTimeout(() => searchInputRef.current?.focus(), 50)
      return () => window.clearTimeout(t)
    }
  }, [searchOpen])

  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return categories
    return categories.filter((c) => c.name.toLowerCase().includes(q))
  }, [categories, searchQuery])

  const closeSearch = () => {
    setSearchQuery('')
    setSearchOpen(false)
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-y-0 right-0 z-50 flex h-full w-full flex-col bg-background shadow-2xl',
            'sm:max-w-md',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
            'duration-300 ease-out'
          )}
        >
          <div className="shrink-0 border-b bg-muted/30 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/15">
                  <Tag className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 pt-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <DialogPrimitive.Title className="text-lg font-semibold leading-tight">
                      Manage Categories
                    </DialogPrimitive.Title>
                    <Badge variant="secondary" className="h-5 px-2 text-[11px] font-medium">
                      {categories.length}
                    </Badge>
                  </div>
                  <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                    Organize products with custom categories
                  </DialogPrimitive.Description>
                </div>
              </div>
              <DialogPrimitive.Close className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <X className="h-5 w-5" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-5 py-4">
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <Input
                className="h-9 flex-1 min-w-0"
                placeholder="New category name..."
                value={newCatName}
                onChange={(e) => onNewCatNameChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    onAddCategory()
                  }
                }}
              />
              <Button
                className="h-9 shrink-0 w-full sm:w-auto"
                onClick={onAddCategory}
                disabled={catSaving || !newCatName.trim()}
              >
                <Plus className="h-4 w-4 sm:mr-1.5" />
                {catSaving ? 'Adding...' : 'Add'}
              </Button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-2">
              <div className="shrink-0">
                {searchOpen ? (
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      ref={searchInputRef}
                      className="h-9 bg-background pl-9 pr-9"
                      placeholder="Search categories..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') closeSearch()
                      }}
                    />
                    <button
                      type="button"
                      onClick={closeSearch}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label="Close search"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      All categories
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground"
                      onClick={() => setSearchOpen(true)}
                      title="Search categories"
                      aria-label="Search categories"
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border bg-card shadow-sm">
                {categories.length === 0 ? (
                  <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <Tag className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">No categories yet</p>
                    <p className="mt-1 max-w-[220px] text-xs text-muted-foreground">
                      Add your first category above to group inventory products.
                    </p>
                  </div>
                ) : filteredCategories.length === 0 ? (
                  <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <Search className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">No matches found</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Try a different search term
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y">
                    {filteredCategories.map((c) => (
                      <li
                        key={c.id}
                        className="group flex items-center justify-between gap-2 px-3 py-2.5 transition-colors hover:bg-muted/40"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm">
                          <HighlightMatch text={c.name} query={searchQuery} />
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-muted-foreground opacity-70 transition-opacity hover:text-destructive group-hover:opacity-100"
                          onClick={() => onDeleteCategory(c.id, c.name)}
                          title={`Delete ${c.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t bg-muted/20 px-5 py-3">
            <Button variant="outline" className="h-9 w-full" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
