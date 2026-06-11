export async function parseJsonResponse<T = Record<string, unknown>>(res: Response): Promise<T> {
  const text = await res.text()

  if (!text.trim()) {
    if (!res.ok) {
      throw new Error(`Request failed (${res.status})`)
    }
    return {} as T
  }

  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`Invalid server response (${res.status})`)
  }
}
