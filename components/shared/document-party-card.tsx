'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ContactFieldInputs } from '@/components/shared/contact-field-inputs'
import { cn } from '@/lib/utils'
import type { PartyCustomer, PartyFields } from '@/lib/party-fields'
import type { PartyFieldErrors } from '@/lib/field-validation'

interface PartySectionProps {
  title: string
  fields: PartyFields
  onChange: <K extends keyof PartyFields>(key: K, value: PartyFields[K]) => void
  contactLabel: string
  mobileLabel: string
  showCustomerSearch?: boolean
  customerListOpen?: boolean
  onCustomerNameChange?: (value: string) => void
  onCustomerFocus?: () => void
  filteredCustomers?: PartyCustomer[]
  onSelectCustomer?: (c: PartyCustomer) => void
  customerSearchRef?: React.RefObject<HTMLDivElement>
  customerError?: string
  contactErrors?: PartyFieldErrors
}

function PartySection({
  title,
  fields,
  onChange,
  contactLabel,
  mobileLabel,
  showCustomerSearch,
  customerListOpen,
  onCustomerNameChange,
  onCustomerFocus,
  filteredCustomers,
  onSelectCustomer,
  customerSearchRef,
  customerError,
  contactErrors,
}: PartySectionProps) {
  const inputClass = 'h-9'

  return (
    <div className="space-y-4">
      {title ? (
        <h3 className="text-sm font-semibold text-slate-700 border-b pb-2">{title}</h3>
      ) : null}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          className="sm:col-span-2 lg:col-span-3 space-y-2 relative"
          ref={showCustomerSearch ? customerSearchRef : undefined}
        >
          <Label>Customer Name *</Label>
          {showCustomerSearch ? (
            <>
              <Input
                value={fields.name}
                onChange={(e) => onCustomerNameChange?.(e.target.value)}
                onFocus={onCustomerFocus}
                placeholder="Enter customer name"
                autoComplete="off"
                className={inputClass}
              />
              {customerListOpen && filteredCustomers && filteredCustomers.length > 0 && (
                <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover py-1 text-sm shadow-md">
                  {filteredCustomers.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left hover:bg-accent"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => onSelectCustomer?.(c)}
                      >
                        <span className="font-medium">{c.name}</span>
                        {c.gstin && (
                          <span className="ml-2 text-xs text-muted-foreground font-mono">{c.gstin}</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {customerError && <p className="text-destructive text-xs">{customerError}</p>}
            </>
          ) : (
            <Input
              value={fields.name}
              onChange={(e) => onChange('name', e.target.value)}
              className={inputClass}
            />
          )}
        </div>
        <div className="space-y-2">
          <Label>{contactLabel}</Label>
          <Input
            value={fields.contactPerson}
            onChange={(e) => onChange('contactPerson', e.target.value)}
            className={inputClass}
          />
        </div>
        <ContactFieldInputs
          mobile={fields.mobile}
          gstin={fields.gstin}
          onMobileChange={(value) => onChange('mobile', value)}
          onGstinChange={(value) => onChange('gstin', value)}
          mobileLabel={mobileLabel}
          mobileError={contactErrors?.mobile}
          gstinError={contactErrors?.gstin}
          inputClass={inputClass}
        />
        <div className="space-y-2">
          <Label>PAN</Label>
          <Input
            value={fields.pan}
            onChange={(e) => onChange('pan', e.target.value.toUpperCase())}
            className={cn(inputClass, 'uppercase font-mono text-sm')}
            maxLength={10}
          />
        </div>
        <div className="space-y-2">
          <Label>City</Label>
          <Input
            value={fields.city}
            onChange={(e) => onChange('city', e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="space-y-2 sm:col-span-2 lg:col-span-1">
          <Label>Address</Label>
          <Textarea
            rows={2}
            value={fields.address}
            onChange={(e) => onChange('address', e.target.value)}
            className="min-h-[2.25rem] lg:min-h-[4rem] resize-none"
          />
        </div>
      </div>
    </div>
  )
}

export interface DocumentPartyCardProps {
  buyerFields: PartyFields
  consigneeFields: PartyFields
  buyerContactErrors: PartyFieldErrors
  consigneeContactErrors: PartyFieldErrors
  sameAsBuyer: boolean
  customerListOpen: boolean
  customerSearchRef: React.RefObject<HTMLDivElement>
  filteredCustomers: PartyCustomer[]
  customerError?: string
  onBuyerFieldChange: <K extends keyof PartyFields>(key: K, value: PartyFields[K]) => void
  onConsigneeFieldChange: <K extends keyof PartyFields>(key: K, value: PartyFields[K]) => void
  onSameAsBuyerChange: (checked: boolean) => void
  onCustomerNameChange: (value: string) => void
  onCustomerFocus: () => void
  onSelectCustomer: (c: PartyCustomer) => void
}

export function DocumentPartyCard({
  buyerFields,
  consigneeFields,
  buyerContactErrors,
  consigneeContactErrors,
  sameAsBuyer,
  customerListOpen,
  customerSearchRef,
  filteredCustomers,
  customerError,
  onBuyerFieldChange,
  onConsigneeFieldChange,
  onSameAsBuyerChange,
  onCustomerNameChange,
  onCustomerFocus,
  onSelectCustomer,
}: DocumentPartyCardProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3 px-4 sm:px-6">
        <CardTitle className="text-base">Customer Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 sm:space-y-6 px-4 sm:px-6">
        <PartySection
          title="Billed to (Buyer)"
          fields={buyerFields}
          onChange={onBuyerFieldChange}
          contactLabel="B. Person"
          mobileLabel="Mob"
          showCustomerSearch
          customerListOpen={customerListOpen}
          onCustomerNameChange={onCustomerNameChange}
          onCustomerFocus={onCustomerFocus}
          filteredCustomers={filteredCustomers}
          onSelectCustomer={onSelectCustomer}
          customerSearchRef={customerSearchRef}
          customerError={customerError}
          contactErrors={buyerContactErrors}
        />

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 border-b pb-2">
            <h3 className="text-sm font-semibold text-slate-700">Shipped to (Consignee)</h3>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={sameAsBuyer}
                onChange={(e) => onSameAsBuyerChange(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 accent-blue-600"
              />
              <span className="text-muted-foreground">Same as buyer</span>
            </label>
          </div>
          <PartySection
            title=""
            fields={consigneeFields}
            onChange={onConsigneeFieldChange}
            contactLabel="S. Person"
            mobileLabel="Mobile"
            contactErrors={consigneeContactErrors}
          />
        </div>
      </CardContent>
    </Card>
  )
}
