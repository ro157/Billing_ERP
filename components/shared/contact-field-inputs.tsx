'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { sanitizeGstinInput, sanitizeMobileInput } from '@/lib/field-validation'

interface ContactFieldInputsProps {
  mobile: string
  gstin: string
  onMobileChange: (value: string) => void
  onGstinChange: (value: string) => void
  mobileLabel?: string
  mobileError?: string
  gstinError?: string
  disabled?: boolean
  inputClass?: string
}

export function ContactFieldInputs({
  mobile,
  gstin,
  onMobileChange,
  onGstinChange,
  mobileLabel = 'Mobile',
  mobileError,
  gstinError,
  disabled = false,
  inputClass = 'h-9',
}: ContactFieldInputsProps) {
  const fieldClass = cn(inputClass, disabled && 'bg-muted/60 cursor-not-allowed')

  return (
    <>
      <div className="space-y-2">
        <Label>{mobileLabel}</Label>
        <Input
          type="tel"
          inputMode="numeric"
          maxLength={10}
          value={mobile}
          onChange={(e) => onMobileChange(sanitizeMobileInput(e.target.value))}
          className={fieldClass}
          disabled={disabled}
        />
        {mobileError && <p className="text-destructive text-xs">{mobileError}</p>}
      </div>
      <div className="space-y-2">
        <Label>GSTIN</Label>
        <Input
          value={gstin}
          maxLength={15}
          onChange={(e) => onGstinChange(sanitizeGstinInput(e.target.value))}
          className={cn(fieldClass, 'uppercase font-mono text-sm')}
          disabled={disabled}
        />
        {gstinError && <p className="text-destructive text-xs">{gstinError}</p>}
      </div>
    </>
  )
}
