import { Card, CardHeader, CardTitle } from '@/components/ui/card'

export const AUTH_CARD_CLASS = 'border-2 border-blue-600 shadow-md'

interface AuthCardProps {
  title: string
  children: React.ReactNode
}

export function AuthCard({ title, children }: AuthCardProps) {
  return (
    <div className="w-full max-w-md px-4">
      <Card className={AUTH_CARD_CLASS}>
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl font-semibold">{title}</CardTitle>
        </CardHeader>
        {children}
        <div className="border-t px-6 py-4 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Viros GST Billing. All rights reserved.
        </div>
      </Card>
    </div>
  )
}
