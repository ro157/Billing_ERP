'use client'

import Link from 'next/link'
import { Plus, Search, LayoutGrid, Table2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface ListPageToolbarProps {
  searchPlaceholder: string
  search: string
  onSearchChange: (value: string) => void
  addLabel: string
  addHref?: string
  onAddClick?: () => void
  viewMode?: 'table' | 'card'
  onViewModeChange?: (mode: 'table' | 'card') => void
  showViewToggle?: boolean
}

function ToolbarSearch({
  placeholder,
  value,
  onChange,
  className,
}: {
  placeholder: string
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  return (
    <div className={`relative min-w-0 ${className ?? ''}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      <Input
        placeholder={placeholder}
        className="pl-9 h-9 w-full bg-background"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

export function ListPageToolbar({
  searchPlaceholder,
  search,
  onSearchChange,
  addLabel,
  addHref,
  onAddClick,
  viewMode = 'table',
  onViewModeChange,
  showViewToggle = true,
}: ListPageToolbarProps) {
  const addContent = (
    <>
      <Plus className="w-4 h-4 shrink-0 mr-1.5" />
      <span className="text-sm truncate">{addLabel}</span>
    </>
  )

  const viewToggle = showViewToggle && onViewModeChange ? (
    <div className="flex items-center gap-1 rounded-md border bg-background p-1 shrink-0">
      <Button
        type="button"
        variant={viewMode === 'table' ? 'secondary' : 'outline'}
        size="icon"
        className="h-8 w-8"
        title="Table view"
        onClick={() => onViewModeChange('table')}
      >
        <Table2 className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={viewMode === 'card' ? 'secondary' : 'outline'}
        size="icon"
        className="h-8 w-8"
        title="Card view"
        onClick={() => onViewModeChange('card')}
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
    </div>
  ) : null

  return (
    <>
      <div className="grid grid-cols-2 gap-2 md:hidden">
        <ToolbarSearch
          placeholder={searchPlaceholder}
          value={search}
          onChange={onSearchChange}
        />
        {addHref ? (
          <Button asChild className="h-9 w-full min-w-0">
            <Link href={addHref}>{addContent}</Link>
          </Button>
        ) : (
          <Button type="button" className="h-9 w-full min-w-0" onClick={onAddClick}>
            {addContent}
          </Button>
        )}
      </div>

      <div className="hidden md:flex md:flex-col md:gap-2">
        <div className="flex justify-end">
          {addHref ? (
            <Button asChild className="h-9 w-fit">
              <Link href={addHref}>
                <Plus className="w-4 h-4 shrink-0 mr-1.5" />
                <span className="text-sm">{addLabel}</span>
              </Link>
            </Button>
          ) : (
            <Button type="button" className="h-9 w-fit" onClick={onAddClick}>
              <Plus className="w-4 h-4 shrink-0 mr-1.5" />
              <span className="text-sm">{addLabel}</span>
            </Button>
          )}
        </div>
        <div className="flex flex-row items-center gap-2">
          <ToolbarSearch
            placeholder={searchPlaceholder}
            value={search}
            onChange={onSearchChange}
            className="flex-1"
          />
          {viewToggle}
        </div>
      </div>
    </>
  )
}
