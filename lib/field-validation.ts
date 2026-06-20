import { INDIAN_STATES } from '@/lib/utils'

export const MOBILE_REGEX = /^[6-9]\d{9}$/
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/

export function sanitizeMobileInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, 10)
}

export function sanitizeGstinInput(value: string): string {
  return value.replace(/[^0-9A-Za-z]/g, '').toUpperCase().slice(0, 15)
}

export function validateMobile(
  value: string | null | undefined,
  options: { required?: boolean } = {}
): string | undefined {
  const trimmed = (value ?? '').trim()
  if (!trimmed) {
    return options.required ? 'Mobile number is required' : undefined
  }
  if (!MOBILE_REGEX.test(trimmed)) {
    return 'Invalid mobile number (10 digits, starts with 6-9)'
  }
  return undefined
}

export function validateGstin(
  value: string | null | undefined,
  options: { required?: boolean } = {}
): string | undefined {
  const trimmed = (value ?? '').trim().toUpperCase()
  if (!trimmed) {
    return options.required ? 'GSTIN is required' : undefined
  }
  if (!GSTIN_REGEX.test(trimmed)) {
    return 'Invalid GSTIN (15 characters)'
  }
  return undefined
}

export function getStateCodeByName(stateName: string): string | undefined {
  const found = INDIAN_STATES.find(
    (s) => s.name.toLowerCase() === stateName.trim().toLowerCase()
  )
  return found?.code
}

export function validateGstinWithState(
  gstin: string | null | undefined,
  stateName: string
): string | undefined {
  const gstinErr = validateGstin(gstin, { required: false })
  if (gstinErr) return gstinErr
  const trimmed = (gstin ?? '').trim().toUpperCase()
  if (!trimmed) return undefined
  const stateCode = getStateCodeByName(stateName)
  if (!stateCode) return 'Invalid state selected'
  if (trimmed.slice(0, 2) !== stateCode) {
    return 'GSTIN state code does not match selected state'
  }
  return undefined
}

export type PartyFieldErrors = { mobile?: string; gstin?: string }

export function validatePartyContactFields(
  fields: { mobile?: string; gstin?: string },
  options: { mobileRequired?: boolean; gstinRequired?: boolean } = {}
): PartyFieldErrors {
  const errors: PartyFieldErrors = {}
  const mobileErr = validateMobile(fields.mobile, { required: options.mobileRequired })
  const gstinErr = validateGstin(fields.gstin, { required: options.gstinRequired })
  if (mobileErr) errors.mobile = mobileErr
  if (gstinErr) errors.gstin = gstinErr
  return errors
}

export function firstPartyValidationError(
  parties: Array<{
    fields: { mobile?: string; gstin?: string }
    label: string
    mobileRequired?: boolean
    gstinRequired?: boolean
  }>
): string | null {
  for (const party of parties) {
    const errs = validatePartyContactFields(party.fields, {
      mobileRequired: party.mobileRequired,
      gstinRequired: party.gstinRequired,
    })
    const first = errs.mobile || errs.gstin
    if (first) return `${party.label}: ${first}`
  }
  return null
}
