'use client'

import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { FieldValues, Path, UseFormRegister } from 'react-hook-form'

type DocumentTermsFieldProps<T extends FieldValues> = {
  register: UseFormRegister<T>
  name?: Path<T>
}

export function DocumentTermsField<T extends FieldValues>({
  register,
  name = 'terms' as Path<T>,
}: DocumentTermsFieldProps<T>) {
  return (
    <div className="space-y-2">
      <Label>Terms & Conditions</Label>
      <Textarea
        rows={4}
        className="min-h-[11rem] resize-y"
        placeholder="Terms printed on this document..."
        {...register(name)}
      />
    </div>
  )
}
