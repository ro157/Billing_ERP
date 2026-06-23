'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useRouter } from 'next/navigation'
import { Building2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RegisterForm } from '@/components/auth/register-form'

interface RegisterSlidePanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RegisterSlidePanel({ open, onOpenChange }: RegisterSlidePanelProps) {
  const router = useRouter()

  const handleSuccess = () => {
    onOpenChange(false)
    router.push('/login?pending=1')
  }

  const handleSignIn = () => {
    onOpenChange(false)
    router.push('/login')
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-y-0 right-0 z-50 flex h-full w-full flex-col bg-white shadow-2xl',
            'sm:max-w-xl lg:max-w-2xl',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
            'duration-300 ease-out'
          )}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-blue-200/60 bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-5 sm:px-6">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogPrimitive.Title className="text-xl font-semibold text-white">
                  Register Organisation
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="mt-1 text-sm text-blue-100">
                  Create your organisation account to get started
                </DialogPrimitive.Description>
              </div>
            </div>
            <DialogPrimitive.Close className="rounded-lg p-2 text-blue-100 transition-colors hover:bg-white/10 hover:text-white">
              <X className="h-5 w-5" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/50">
            <RegisterForm onSuccess={handleSuccess} onSignInClick={handleSignIn} />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
