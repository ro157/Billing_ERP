import { NextResponse } from 'next/server'

export function apiErrorResponse(err: unknown, context: string) {
  const error = err as { code?: string; message?: string; sqlMessage?: string }
  console.error(context, error?.code, error?.message ?? error?.sqlMessage ?? err)

  const message =
    error?.code === 'ER_CON_COUNT_ERROR'
      ? 'Database is busy. Please wait a moment and try again.'
      : process.env.NODE_ENV === 'development' && (error?.sqlMessage || error?.message)
        ? String(error.sqlMessage || error.message)
        : 'Internal server error'

  return NextResponse.json({ error: message }, { status: 500 })
}
