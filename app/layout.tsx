import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Toaster } from '@/components/ui/toaster'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Viros GST Billing - ERP Software',
  description: 'Complete GST ERP Software for Indian Businesses',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=window.location.pathname;var lightOnly=p==='/'||['/login','/register','/forgot-password','/reset-password','/verify-otp'].indexOf(p)!==-1;if(lightOnly){document.documentElement.classList.remove('dark');return;}var s=localStorage.getItem('app-store');if(s){var d=JSON.parse(s);if(d.state&&d.state.colorMode==='dark')document.documentElement.classList.add('dark')}}catch(e){}})();`,
          }}
        />
      </head>
      <body className={inter.className}>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}
