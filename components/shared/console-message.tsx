'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type ConsoleMessageType = 'error' | 'success'

export const CONSOLE_MESSAGE_DURATION_MS = 4000

interface ConsoleMessageProps {
  type: ConsoleMessageType
  text: string
  className?: string
}

export function ConsoleMessage({ type, text, className }: ConsoleMessageProps) {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-md border-2 px-3 py-2.5 text-sm font-medium',
        type === 'error'
          ? 'border-red-500 bg-red-50 text-red-600'
          : 'border-green-500 bg-green-50 text-green-600',
        className
      )}
    >
      {text}
    </div>
  )
}

export function formatConsoleMessageText(
  title?: ReactNode,
  description?: ReactNode
): string {
  const parts = [title, description]
    .filter((part) => part !== undefined && part !== null && String(part).trim() !== '')
    .map((part) => String(part))
  return parts.join(' — ')
}
