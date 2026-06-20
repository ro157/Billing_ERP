'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { registerSchema, RegisterInput } from '@/lib/validations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CardContent, CardFooter } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AuthCard } from '@/components/auth/auth-card'
import { ConsoleMessage, CONSOLE_MESSAGE_DURATION_MS } from '@/components/shared/console-message'
import { useConsoleMessage } from '@/hooks/use-console-message'
import { sanitizeGstinInput, sanitizeMobileInput } from '@/lib/field-validation'
import { INDIAN_STATES } from '@/lib/utils'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-destructive text-sm">{message}</p>
}

export default function RegisterPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { message, showSuccess, showError, clearMessage } = useConsoleMessage()

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      organizationName: '',
      phone: '',
      address: '',
      gstin: '',
      state: '',
      pincode: '',
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  })

  const onSubmit = async (data: RegisterInput) => {
    setLoading(true)
    clearMessage()
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await res.json()

      if (!res.ok) {
        const errMsg = Array.isArray(result.error)
          ? result.error.map((e: { message?: string }) => e.message).filter(Boolean).join(', ')
          : result.error || 'Registration failed'
        showError(errMsg)
        return
      }

      showSuccess(
        'Registration submitted! Your organisation is pending Super Admin approval. You can sign in once approved.'
      )
      setTimeout(() => router.replace('/login?pending=1'), CONSOLE_MESSAGE_DURATION_MS)
    } finally {
      setLoading(false)
    }
  }

  const clearOnChange = () => clearMessage()

  return (
    <AuthCard title="Register Organisation" className="max-w-2xl">
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <CardContent className="space-y-6 px-4 sm:px-6">
          {message && <ConsoleMessage type={message.type} text={message.text} />}

          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">
              Organisation Details
            </h3>

            <div className="space-y-2">
              <Label htmlFor="organizationName">
                Organisation Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="organizationName"
                placeholder="Your company name"
                {...form.register('organizationName', { onChange: clearOnChange })}
              />
              <FieldError message={form.formState.errors.organizationName?.message} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">
                  Phone <span className="text-destructive">*</span>
                </Label>
                <Controller
                  name="phone"
                  control={form.control}
                  render={({ field }) => (
                    <Input
                      id="phone"
                      inputMode="numeric"
                      placeholder="10-digit mobile"
                      maxLength={10}
                      value={field.value}
                      onChange={(e) => {
                        clearOnChange()
                        field.onChange(sanitizeMobileInput(e.target.value))
                      }}
                    />
                  )}
                />
                <FieldError message={form.formState.errors.phone?.message} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gstin">GSTIN (Optional)</Label>
                <Controller
                  name="gstin"
                  control={form.control}
                  render={({ field }) => (
                    <Input
                      id="gstin"
                      placeholder="15-character GSTIN"
                      maxLength={15}
                      value={field.value || ''}
                      onChange={(e) => {
                        clearOnChange()
                        field.onChange(sanitizeGstinInput(e.target.value))
                      }}
                    />
                  )}
                />
                <FieldError message={form.formState.errors.gstin?.message} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">
                Address <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="address"
                rows={3}
                placeholder="Street, area, landmark"
                className="resize-none min-h-[80px]"
                {...form.register('address', { onChange: clearOnChange })}
              />
              <FieldError message={form.formState.errors.address?.message} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  State <span className="text-destructive">*</span>
                </Label>
                <Controller
                  name="state"
                  control={form.control}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(v) => {
                        clearOnChange()
                        field.onChange(v)
                        if (form.getValues('gstin')) {
                          form.trigger('gstin')
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {INDIAN_STATES.map((s) => (
                          <SelectItem key={s.code} value={s.name}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError message={form.formState.errors.state?.message} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pincode">
                  Pincode <span className="text-destructive">*</span>
                </Label>
                <Controller
                  name="pincode"
                  control={form.control}
                  render={({ field }) => (
                    <Input
                      id="pincode"
                      inputMode="numeric"
                      placeholder="6-digit pincode"
                      maxLength={6}
                      value={field.value}
                      onChange={(e) => {
                        clearOnChange()
                        field.onChange(e.target.value.replace(/\D/g, '').slice(0, 6))
                      }}
                    />
                  )}
                />
                <FieldError message={form.formState.errors.pincode?.message} />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">
              Account Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Your Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="Full name"
                  {...form.register('name', { onChange: clearOnChange })}
                />
                <FieldError message={form.formState.errors.name?.message} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">
                  Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  {...form.register('email', { onChange: clearOnChange })}
                />
                <FieldError message={form.formState.errors.email?.message} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password">
                  Password <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min. 8 characters"
                    className="pr-10"
                    {...form.register('password', { onChange: clearOnChange })}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <FieldError message={form.formState.errors.password?.message} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">
                  Confirm Password <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Re-enter password"
                  {...form.register('confirmPassword', { onChange: clearOnChange })}
                />
                <FieldError message={form.formState.errors.confirmPassword?.message} />
              </div>
            </div>
          </section>
        </CardContent>

        <CardFooter className="flex flex-col gap-3 px-4 sm:px-6 pb-6">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Registering...
              </>
            ) : (
              'Register Organisation'
            )}
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </AuthCard>
  )
}
