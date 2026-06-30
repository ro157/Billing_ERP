type PricedItem = {
  rate?: number | null
}

export function resolveStoredIncludePricing(
  stored: unknown,
  items: PricedItem[],
  subtotal?: number | null
): boolean {
  if (Boolean(stored)) return true
  if (Number(subtotal) > 0) return true
  return items.some((item) => Number(item.rate) > 0)
}

export function normalizePurchaseDocumentItem<
  T extends { rate?: number; discount?: number; gstRate?: number; roundOff?: number },
>(item: T, includePricing: boolean): T {
  if (includePricing) return item
  return { ...item, rate: 0, discount: 0, gstRate: 0, roundOff: 0 }
}
