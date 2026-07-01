'use client'

import { AuthCard } from '@/components/auth/auth-card'
import { RegisterForm } from '@/components/auth/register-form'

export default function RegisterPage() {
  return (
    <>
    <AuthCard title="Register Organisation" className="max-w-2xl">
      <RegisterForm />
    </AuthCard>
    </>
  )
}
