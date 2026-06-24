'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  customerToBuyer,
  emptyParty,
  partiesMatch,
  type PartyCustomer,
  type PartyFields,
} from '@/lib/party-fields'
import {
  firstPartyValidationError,
  type PartyFieldErrors,
  validatePartyContactFields,
} from '@/lib/field-validation'

export function useDocumentPartyFields(customers: PartyCustomer[]) {
  const [buyerFields, setBuyerFields] = useState<PartyFields>(emptyParty)
  const [consigneeFields, setConsigneeFields] = useState<PartyFields>(emptyParty)
  const [buyerContactErrors, setBuyerContactErrors] = useState<PartyFieldErrors>({})
  const [consigneeContactErrors, setConsigneeContactErrors] = useState<PartyFieldErrors>({})
  const [sameAsBuyer, setSameAsBuyer] = useState(false)
  const [customerListOpen, setCustomerListOpen] = useState(false)
  const customerSearchRef = useRef<HTMLDivElement | null>(null)

  const filteredCustomers = useMemo(() => {
    const q = buyerFields.name.trim().toLowerCase()
    if (!q) return customers
    return customers.filter((c) => c.name.toLowerCase().includes(q))
  }, [customers, buyerFields.name])

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (customerSearchRef.current && !customerSearchRef.current.contains(e.target as Node)) {
        setCustomerListOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const applyCustomer = useCallback(
    (c: PartyCustomer, setCustomerId: (id: string) => void) => {
      setCustomerId(c.id)
      const buyer = customerToBuyer(c)
      setBuyerFields(buyer)
      if (sameAsBuyer) setConsigneeFields(buyer)
      setCustomerListOpen(false)
    },
    [sameAsBuyer]
  )

  const updateBuyerField = useCallback(<K extends keyof PartyFields>(key: K, value: PartyFields[K]) => {
    setBuyerFields((prev) => ({ ...prev, [key]: value }))
    if (key === 'mobile' || key === 'gstin') {
      setBuyerContactErrors((prev) => ({ ...prev, [key]: undefined }))
    }
  }, [])

  const updateConsigneeField = useCallback(<K extends keyof PartyFields>(key: K, value: PartyFields[K]) => {
    setConsigneeFields((prev) => ({ ...prev, [key]: value }))
    if (key === 'mobile' || key === 'gstin') {
      setConsigneeContactErrors((prev) => ({ ...prev, [key]: undefined }))
    }
  }, [])

  const handleSameAsBuyerChange = useCallback(
    (checked: boolean) => {
      setSameAsBuyer(checked)
      if (checked) setConsigneeFields(buyerFields)
    },
    [buyerFields]
  )

  const validateParties = useCallback(
    (customerId: string): string | null => {
      if (!customerId) return 'Please select a customer from the list'

      const buyerErrors = validatePartyContactFields(buyerFields)
      const consigneeErrors = validatePartyContactFields(consigneeFields)
      setBuyerContactErrors(buyerErrors)
      setConsigneeContactErrors(consigneeErrors)

      return firstPartyValidationError([
        { fields: buyerFields, label: 'Buyer' },
        { fields: consigneeFields, label: 'Consignee' },
      ])
    },
    [buyerFields, consigneeFields]
  )

  const getPartyDetails = useCallback(
    () => ({
      buyer: buyerFields,
      consignee: consigneeFields,
    }),
    [buyerFields, consigneeFields]
  )

  const loadParties = useCallback((buyer: PartyFields, consignee: PartyFields) => {
    setBuyerFields(buyer)
    setConsigneeFields(consignee)
    setSameAsBuyer(partiesMatch(buyer, consignee))
    setBuyerContactErrors({})
    setConsigneeContactErrors({})
  }, [])

  return {
    buyerFields,
    consigneeFields,
    buyerContactErrors,
    consigneeContactErrors,
    sameAsBuyer,
    customerListOpen,
    setCustomerListOpen,
    customerSearchRef,
    filteredCustomers,
    applyCustomer,
    updateBuyerField,
    updateConsigneeField,
    handleSameAsBuyerChange,
    validateParties,
    getPartyDetails,
    loadParties,
  }
}
