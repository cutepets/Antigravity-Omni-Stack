'use client'

import { useParams } from 'next/navigation'
import { SupplierList } from '../_components/supplier-list'

export default function SupplierCodePage() {
  const params = useParams()
  const supplierCode = Array.isArray(params.supplierCode)
    ? params.supplierCode[0]
    : params.supplierCode

  return <SupplierList initialSupplierCode={supplierCode as string | undefined} />
}
