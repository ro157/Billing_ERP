import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { WelcomePage } from '@/components/landing/welcome-page'

export default async function RootPage() {
  const session = await getServerSession(authOptions)

  if (session?.user?.isSuperAdmin) {
    redirect('/superadmin')
  }

  if (session) {
    redirect('/dashboard')
  }

  return <WelcomePage />
}
