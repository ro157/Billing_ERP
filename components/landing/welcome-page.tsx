'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  FileText,
  Package,
  BarChart3,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RegisterSlidePanel } from '@/components/landing/register-slide-panel'

const APP_NAME = 'Viros GST Billing'

const features = [
  {
    icon: FileText,
    title: 'GST Invoicing',
    description: 'Create tax-compliant invoices, quotations, and delivery challans in minutes.',
  },
  {
    icon: Package,
    title: 'Inventory & Purchases',
    description: 'Track stock, manage vendors, and handle purchase orders from one dashboard.',
  },
  {
    icon: BarChart3,
    title: 'Reports & Analytics',
    description: 'Get clear insights into sales, purchases, and GST summaries for smarter decisions.',
  },
  {
    icon: Users,
    title: 'Team & Roles',
    description: 'Assign permissions to staff so everyone sees only what they need.',
  },
  {
    icon: ShieldCheck,
    title: 'Built for Compliance',
    description: 'Designed for Indian GST workflows — accurate, organised, and audit-ready.',
  },
]

export function WelcomePage() {
  const [registerOpen, setRegisterOpen] = useState(false)

  return (
    <>
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-200 via-blue-300 to-indigo-400">
        <main className="flex-1">
          <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <div className="mx-auto max-w-3xl text-center">
              <p className="mb-4 text-sm font-medium uppercase tracking-wider text-blue-800">
                Complete GST ERP for Indian Businesses
              </p>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
                Transform Your Daily Billing Workflow
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-slate-700 sm:text-xl">
                Stop juggling spreadsheets and manual entries. {APP_NAME} brings
                invoicing, inventory, purchases, and GST reporting together — so you can bill
                faster, stay compliant, and focus on growing your business.
              </p>
              <div className="mx-auto mt-10 flex w-full max-w-md flex-row items-stretch justify-center gap-3 sm:max-w-lg">
                <Button
                  size="lg"
                  className="h-11 flex-1 px-3 text-sm sm:h-12 sm:px-4 sm:text-base"
                  onClick={() => setRegisterOpen(true)}
                >
                  Get Started Free
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="h-11 flex-1 bg-white/60 px-3 text-sm sm:h-12 sm:px-4 sm:text-base"
                >
                  <Link href="/login">Sign In</Link>
                </Button>
              </div>
            </div>

            <div className="mt-40 grid gap-6 sm:mt-52 sm:grid-cols-2 lg:mt-64 lg:grid-cols-3">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-xl border border-white/40 bg-white/70 p-6 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md"
                >
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-blue-600 text-white">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{feature.description}</p>
                </div>
              ))}
            </div>
          </section>
        </main>

        <footer className="border-t border-white/20 bg-white/40 py-6 text-center text-sm text-slate-600">
          &copy; {new Date().getFullYear()} {APP_NAME}. All rights reserved.
        </footer>
      </div>

      <RegisterSlidePanel open={registerOpen} onOpenChange={setRegisterOpen} />
    </>
  )
}
