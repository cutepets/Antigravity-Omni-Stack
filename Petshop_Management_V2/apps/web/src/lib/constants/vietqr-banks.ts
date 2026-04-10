import banksJson from './vietqr-banks.json'

type RawVietQrBank = {
  id: number
  name: string
  code: string
  bin: string
  shortName?: string | null
  logo?: string | null
  transferSupported?: number | boolean | null
  lookupSupported?: number | boolean | null
  isTransfer?: number | boolean | null
}

export type VietQrBank = {
  id: number
  name: string
  code: string
  bin: string
  shortName: string
  logo: string | null
  transferSupported: boolean
  lookupSupported: boolean
  isTransfer: boolean
}

const rawBanks = banksJson as RawVietQrBank[]

export const VIETQR_BANKS: VietQrBank[] = rawBanks
  .map((bank) => ({
    id: Number(bank.id) || 0,
    name: String(bank.name ?? '').trim(),
    code: String(bank.code ?? '').trim().toUpperCase(),
    bin: String(bank.bin ?? '').trim(),
    shortName: String(bank.shortName ?? bank.name ?? '').trim(),
    logo: bank.logo ? String(bank.logo) : null,
    transferSupported: Boolean(bank.transferSupported),
    lookupSupported: Boolean(bank.lookupSupported),
    isTransfer: Boolean(bank.isTransfer),
  }))
  .filter((bank) => bank.id > 0 && bank.name && /^\d{6}$/.test(bank.bin))
  .sort((left, right) => left.shortName.localeCompare(right.shortName, 'vi'))

export function findVietQrBank(value?: string | null) {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (!normalized) return null

  return (
    VIETQR_BANKS.find((bank) => bank.bin === normalized) ??
    VIETQR_BANKS.find((bank) => bank.code.toLowerCase() === normalized) ??
    VIETQR_BANKS.find((bank) => bank.shortName.toLowerCase() === normalized) ??
    VIETQR_BANKS.find((bank) => bank.name.toLowerCase() === normalized) ??
    null
  )
}
