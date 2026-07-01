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
import { AuthLightMode } from '@/components/auth/auth-light-mode'
import { RegisterSlidePanel } from '@/components/landing/register-slide-panel'

const APP_NAME = 'Viros GST Billing'

const features = [
  {
    icon: FileText,
    title: 'GST Invoicing',
    description: 'Create tax-compliant invoices, quotations, and delivery challans in minutes.',
    accent: 'from-blue-500 to-blue-700',
    iconBg: 'bg-blue-600 shadow-blue-600/30',
    bar: 'from-blue-400 via-blue-500 to-blue-600',
    hoverBorder: 'hover:border-blue-200/80',
    hoverShadow: 'hover:shadow-blue-500/15',
  },
  {
    icon: Package,
    title: 'Inventory & Purchases',
    description: 'Track stock, manage vendors, and handle purchase orders from one dashboard.',
    accent: 'from-violet-500 to-violet-700',
    iconBg: 'bg-violet-600 shadow-violet-600/30',
    bar: 'from-violet-400 via-violet-500 to-violet-600',
    hoverBorder: 'hover:border-violet-200/80',
    hoverShadow: 'hover:shadow-violet-500/15',
  },
  {
    icon: BarChart3,
    title: 'Reports & Analytics',
    description: 'Get clear insights into sales, purchases, and GST summaries for smarter decisions.',
    accent: 'from-emerald-500 to-emerald-700',
    iconBg: 'bg-emerald-600 shadow-emerald-600/30',
    bar: 'from-emerald-400 via-emerald-500 to-emerald-600',
    hoverBorder: 'hover:border-emerald-200/80',
    hoverShadow: 'hover:shadow-emerald-500/15',
  },
  {
    icon: Users,
    title: 'Team & Roles',
    description: 'Assign permissions to staff so everyone sees only what they need.',
    accent: 'from-amber-500 to-amber-700',
    iconBg: 'bg-amber-500 shadow-amber-500/30',
    bar: 'from-amber-400 via-amber-500 to-amber-600',
    hoverBorder: 'hover:border-amber-200/80',
    hoverShadow: 'hover:shadow-amber-500/15',
  },
  {
    icon: ShieldCheck,
    title: 'Built for Compliance',
    description: 'Designed for Indian GST workflows — accurate, organised, and audit-ready.',
    accent: 'from-cyan-500 to-cyan-700',
    iconBg: 'bg-cyan-600 shadow-cyan-600/30',
    bar: 'from-cyan-400 via-cyan-500 to-cyan-600',
    hoverBorder: 'hover:border-cyan-200/80',
    hoverShadow: 'hover:shadow-cyan-500/15',
  },
]

export function WelcomePage() {
  const [registerOpen, setRegisterOpen] = useState(false)

  return (
    <>
      <AuthLightMode />
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

            <div className="mt-12 grid grid-cols-1 gap-5 sm:mt-16 sm:grid-cols-2 sm:gap-6 lg:mt-20 lg:grid-cols-3">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className={`group relative overflow-hidden rounded-2xl border border-white/70 bg-white/90 p-5 shadow-md shadow-slate-900/5 backdrop-blur-md transition-all duration-300 hover:-translate-y-1.5 hover:bg-white hover:shadow-xl sm:p-6 ${feature.hoverBorder} ${feature.hoverShadow}`}
                >
                  <div
                    className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${feature.bar} opacity-80 transition-opacity group-hover:opacity-100`}
                  />
                  <div
                    className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${feature.accent} opacity-[0.07] blur-2xl transition-opacity group-hover:opacity-[0.14]`}
                  />

                  <div className="relative flex items-start gap-4">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${feature.iconBg} text-white shadow-lg transition-transform duration-300 group-hover:scale-110`}
                    >
                      <feature.icon className="h-5 w-5" strokeWidth={2.25} />
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <h3 className="text-base font-semibold leading-snug text-slate-900 sm:text-lg">
                        {feature.title}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600">
                        {feature.description}
                      </p>
                    </div>
                  </div>
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
