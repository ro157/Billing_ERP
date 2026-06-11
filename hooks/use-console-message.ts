'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CONSOLE_MESSAGE_DURATION_MS,
  type ConsoleMessageType,
} from '@/components/shared/console-message'

export interface ConsoleMessageState {
  type: ConsoleMessageType
  text: string
}

export function useConsoleMessage(durationMs = CONSOLE_MESSAGE_DURATION_MS) {
  const [message, setMessage] = useState<ConsoleMessageState | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearMessage = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setMessage(null)
  }, [])

  const showMessage = useCallback(
    (type: ConsoleMessageType, text: string) => {
      clearMessage()
      setMessage({ type, text })
      timerRef.current = setTimeout(() => {
        setMessage(null)
        timerRef.current = null
      }, durationMs)
    },
    [clearMessage, durationMs]
  )

  const showSuccess = useCallback(
    (text: string) => showMessage('success', text),
    [showMessage]
  )

  const showError = useCallback(
    (text: string) => showMessage('error', text),
    [showMessage]
  )

  useEffect(() => () => clearMessage(), [clearMessage])

  return { message, showMessage, showSuccess, showError, clearMessage }
}
