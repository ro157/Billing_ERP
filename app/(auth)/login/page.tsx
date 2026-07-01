'use client'

import { useState, useEffect, Suspense } from 'react'
import { getSession, signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema, LoginInput } from '@/lib/validations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CardContent, CardFooter } from '@/components/ui/card'
import { AuthCard } from '@/components/auth/auth-card'
import { ConsoleMessage, CONSOLE_MESSAGE_DURATION_MS } from '@/components/shared/console-message'
import { useConsoleMessage } from '@/hooks/use-console-message'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import { ORG_APPROVAL_LOGIN_PENDING } from '@/lib/registration-messages'

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { message, showSuccess, showError, clearMessage } = useConsoleMessage()

  useEffect(() => {
    if (searchParams.get('pending') === '1') {
      showSuccess(ORG_APPROVAL_LOGIN_PENDING)
    }
  }, [searchParams, showSuccess])

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = async (data: LoginInput) => {
    setLoading(true)
    clearMessage()
    try {
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      })

      if (result?.error) {
        const msgRes = await fetch('/api/auth/login-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: data.email, password: data.password }),
        })
        const msgData = await msgRes.json().catch(() => ({}))
        showError(
          typeof msgData?.message === 'string'
            ? msgData.message
            : 'Invalid email or password. Please check your credentials and try again.'
        )
      } else {
        const session = await getSession()
        showSuccess('Login successful! Redirecting...')
        const destination = session?.user?.isSuperAdmin ? '/superadmin' : '/dashboard'
        setTimeout(() => router.replace(destination), CONSOLE_MESSAGE_DURATION_MS)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard title="Welcome">
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          {message && <ConsoleMessage type={message.type} text={message.text} />}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="text"
              placeholder="Enter your email"
              {...form.register('email', {
                onChange: () => clearMessage(),
              })}
            />
            {form.formState.errors.email && (
              <p className="text-destructive text-sm">{form.formState.errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                className="pr-10"
                {...form.register('password', {
                  onChange: () => clearMessage(),
                })}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {form.formState.errors.password && (
              <p className="text-destructive text-sm">{form.formState.errors.password.message}</p>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </Button>
          <Link href="/forgot-password" className="text-sm text-primary hover:underline">
            Forgot your password?
          </Link>
        </CardFooter>
      </form>
    </AuthCard>
  )
}
