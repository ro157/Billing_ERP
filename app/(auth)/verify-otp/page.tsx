'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CardContent, CardFooter } from '@/components/ui/card'
import { AuthCard } from '@/components/auth/auth-card'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import Link from 'next/link'
import { OTP_EXPIRY_SECONDS } from '@/lib/auth-otp'

export default function VerifyOTPPage() {
  return (
    <Suspense fallback={null}>
      <VerifyOTPForm />
    </Suspense>
  )
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function VerifyOTPForm() {
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [verified, setVerified] = useState(false)
  const [verifiedOtp, setVerifiedOtp] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(OTP_EXPIRY_SECONDS)
  const [canResend, setCanResend] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''
  const { toast } = useToast()

  const resetTimer = useCallback(() => {
    setSecondsLeft(OTP_EXPIRY_SECONDS)
    setCanResend(false)
  }, [])

  useEffect(() => {
    if (!email) {
      router.push('/forgot-password')
    }
  }, [email, router])

  useEffect(() => {
    if (verified || canResend) return
    if (secondsLeft <= 0) {
      setCanResend(true)
      return
    }
    const timer = window.setTimeout(() => {
      setSecondsLeft((prev) => prev - 1)
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [secondsLeft, verified, canResend])

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (verified || canResend) return

    setLoading(true)
    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      })

      const data = await response.json()

      if (response.ok) {
        setVerified(true)
        setVerifiedOtp(otp)
        toast({
          title: 'OTP Verified',
          description: 'Set your new password below.',
        })
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Something went wrong',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Network error. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleResendOTP = async () => {
    if (!canResend || loading) return

    setLoading(true)
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (response.ok) {
        setOtp('')
        resetTimer()
        toast({
          title: 'OTP Resent',
          description: 'A new OTP has been sent to your email.',
        })
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Something went wrong',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Network error. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!verified) return

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Error',
        description: 'Passwords do not match',
        variant: 'destructive',
      })
      return
    }

    if (newPassword.length < 6) {
      toast({
        title: 'Error',
        description: 'Password must be at least 6 characters long',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: verifiedOtp, newPassword }),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Password reset successfully. Redirecting to login...',
        })
        setTimeout(() => {
          router.push('/login')
        }, 2000)
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Something went wrong',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Network error. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  if (!email) {
    return null
  }

  return (
    <AuthCard title={verified ? 'Reset Password' : 'Verify OTP'}>
      <form onSubmit={verified ? handleResetPassword : handleVerifyOtp}>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            {verified
              ? `OTP verified for ${email}. Enter your new password.`
              : `Enter the 5-digit OTP sent to ${email}`}
          </p>

          {!verified && (
            <div className="space-y-2">
              <Label htmlFor="otp">OTP</Label>
              <Input
                id="otp"
                type="text"
                inputMode="numeric"
                placeholder="Enter 5-digit OTP"
                className="text-center text-2xl tracking-widest"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 5))}
                maxLength={5}
                required
                disabled={canResend}
              />
            </div>
          )}

          {verified && (
            <>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          {verified ? (
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reset Password
            </Button>
          ) : (
            <>
              <Button
                type="submit"
                className="w-full"
                disabled={loading || otp.length !== 5 || canResend}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify OTP
              </Button>
              {canResend ? (
                <p className="text-center text-sm font-bold text-red-600">
                  OTP expired. Resend to get a new code.
                </p>
              ) : (
                <p className="text-center text-sm text-red-600">
                  OTP expires in{' '}
                  <span className="font-bold text-base tabular-nums">{formatTimer(secondsLeft)}</span>
                </p>
              )}
              <Button
                type="button"
                variant="link"
                onClick={handleResendOTP}
                disabled={loading || !canResend}
                className="text-sm text-primary disabled:opacity-50"
              >
                Resend OTP
              </Button>
            </>
          )}
          <Link href="/forgot-password" className="text-sm text-primary hover:underline">
            Back to Forgot Password
          </Link>
        </CardFooter>
      </form>
    </AuthCard>
  )
}
