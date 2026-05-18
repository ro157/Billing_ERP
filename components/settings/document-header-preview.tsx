'use client'

import type { BusinessSettingsInput } from '@/lib/validations'

type DocumentHeaderPreviewProps = BusinessSettingsInput & {
  logoPreview: string | null
}

const HEADER_BG = '#c5d4e0'

function formatLocationLine(city?: string, state?: string, pincode?: string) {
  const parts: string[] = []
  if (city?.trim()) parts.push(city.trim())
  if (state?.trim()) parts.push(state.trim())
  const location = parts.join(', ')
  if (location && pincode?.trim()) return `${location} - ${pincode.trim()}`
  if (location) return location
  if (pincode?.trim()) return pincode.trim()
  return null
}

/** Split long company names across two lines (matches letterhead style). */
function splitCompanyName(name: string): string[] {
  const n = name.trim() || 'Your Company Name'

  const itSolutions = n.match(/^(.+?\s+IT)\s+(Solutions\s+.+)$/i)
  if (itSolutions) return [itSolutions[1], itSolutions[2]]

  const pvtLtd = n.match(/^(.+?)\s+(Private\s+Limited|Pvt\.?\s+Ltd\.?)$/i)
  if (pvtLtd && pvtLtd[1].split(/\s+/).length >= 2) return [pvtLtd[1], pvtLtd[2]]

  const words = n.split(/\s+/)
  if (words.length <= 5) return [n]

  const mid = Math.ceil(words.length / 2)
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')]
}

function ContactRow({ label, value, placeholder }: { label: string; value?: string; placeholder: string }) {
  const display = value?.trim() || placeholder
  const isPlaceholder = !value?.trim()

  return (
    <p className={`leading-snug ${isPlaceholder ? 'text-gray-600/70' : 'text-gray-900'}`}>
      <span className="font-bold">{label} :</span>{' '}
      <span className={isPlaceholder ? 'italic' : undefined}>{display}</span>
    </p>
  )
}

export function DocumentHeaderPreview({
  logoPreview,
  companyName,
  pan,
  phone,
  email,
  website,
  address,
  city,
  state,
  pincode,
}: DocumentHeaderPreviewProps) {
  const nameLines = splitCompanyName(companyName || '')
  const addressLines = address?.trim() ? address.trim().split(/\n/).map((l) => l.trim()).filter(Boolean) : []
  const locationLine = formatLocationLine(city, state, pincode)

  return (
    <div className="w-full overflow-x-auto rounded-md border border-slate-300/60 shadow-sm">
      <div
        className="flex min-w-[680px] items-start justify-between gap-8 px-6 py-5"
        style={{ backgroundColor: HEADER_BG }}
      >
        {/* Left: logo + company name & address */}
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <div className="flex h-[88px] w-[88px] shrink-0 items-center justify-center">
            {logoPreview ? (
              <img
                src={logoPreview}
                alt="Company logo"
                className="max-h-[88px] max-w-[88px] object-contain object-left"
              />
            ) : (
              <div
                className="flex h-[88px] w-[88px] items-center justify-center rounded border border-dashed border-slate-400/60 bg-white/30 text-[10px] text-slate-600"
                aria-hidden
              >
                Logo
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 pt-0.5">
            <div className="space-y-0">
              {nameLines.map((line, i) => (
                <p
                  key={i}
                  className="text-[15px] font-bold leading-tight tracking-tight text-gray-900 sm:text-[16px]"
                >
                  {line}
                </p>
              ))}
            </div>

            <div className="mt-2 space-y-0.5 text-[11px] leading-relaxed text-gray-800 sm:text-xs">
              {addressLines.length > 0 ? (
                addressLines.map((line, i) => <p key={i}>{line}</p>)
              ) : (
                <>
                  <p className="text-gray-600/75 italic">Street address, area, landmark</p>
                  <p className="text-gray-600/75 italic">Locality, city area</p>
                </>
              )}
              {locationLine ? (
                <p>{locationLine}</p>
              ) : (
                !addressLines.length && (
                  <p className="text-gray-600/75 italic">City, State - Pincode</p>
                )
              )}
            </div>
          </div>
        </div>

        {/* Right: contact details */}
        <div className="shrink-0 space-y-0.5 text-right text-[11px] sm:text-xs">
          <ContactRow label="Phone" value={phone} placeholder="Phone number" />
          <ContactRow label="Email" value={email} placeholder="email@company.com" />
          <ContactRow label="Website" value={website} placeholder="www.company.com" />
          <ContactRow label="PAN" value={pan} placeholder="AAAAA0000A" />
        </div>
      </div>
    </div>
  )
}
