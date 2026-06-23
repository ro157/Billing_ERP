import { AuthLightMode } from '@/components/auth/auth-light-mode'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AuthLightMode />
      <div className="min-h-screen flex items-start sm:items-center justify-center bg-gradient-to-br from-blue-200 via-blue-300 to-indigo-400 py-6 sm:py-8">
        {children}
      </div>
    </>
  )
}
