'use client'

import { useToast } from '@/hooks/use-toast'
import {
  ConsoleMessage,
  formatConsoleMessageText,
} from '@/components/shared/console-message'

export function Toaster() {
  const { toasts } = useToast()

  if (toasts.length === 0) return null

  return (
    <div className="pointer-events-none fixed top-4 left-1/2 z-[100] flex w-full max-w-md -translate-x-1/2 flex-col gap-2 px-4">
      {toasts.map(({ id, title, description, variant }) => (
        <ConsoleMessage
          key={id}
          type={variant === 'destructive' ? 'error' : 'success'}
          text={formatConsoleMessageText(title, description)}
          className="pointer-events-auto shadow-sm"
        />
      ))}
    </div>
  )
}
