import { AuthLightMode } from '@/components/auth/auth-light-mode'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AuthLightMode />
      <div className="min-h-[100dvh] min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-200 via-blue-300 to-indigo-400 px-4 py-6 sm:py-8">
        {children}
      </div>
    </>
  )
}
