'use client'

import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { NavigationProgress } from '@/components/layout/navigation-progress'
import { OrgThemeProvider } from '@/components/layout/org-theme-provider'
import { useAppStore } from '@/store/app-store'
import { cn } from '@/lib/utils'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { sidebarOpen, mobileSidebarOpen, setMobileSidebarOpen } = useAppStore()

  return (
    <OrgThemeProvider>
      <div className="flex min-h-screen bg-slate-50 dark:bg-background">
      <NavigationProgress />
      <Sidebar open={sidebarOpen} />
      {mobileSidebarOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
        />
      )}
      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col transition-all duration-300',
          'ml-0 w-full',
          sidebarOpen ? 'md:ml-64' : 'md:ml-16'
        )}
      >
        <Header />
        <main className="flex-1 min-w-0 overflow-x-hidden p-3 sm:p-4 md:p-6">{children}</main>
      </div>
      </div>
    </OrgThemeProvider>
  )
}
