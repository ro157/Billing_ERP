import { Loader2 } from 'lucide-react'

export function PageLoader({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground gap-2">
      <Loader2 className="h-6 w-6 animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  )
}

export function FormPageLoader({ title }: { title: string }) {
  return <PageLoader label={`Loading ${title}...`} />
}

export function DashboardPageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 rounded bg-muted" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-80 rounded-xl bg-muted" />
    </div>
  )
}
