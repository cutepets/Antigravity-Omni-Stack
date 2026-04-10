import QRCode from 'qrcode'

type BuildVietQrPayloadParams = {
  bankBin: string
  accountNumber: string
  amount: number
  transferContent: string
}

const VIET_QR_GUID = 'A000000727'
const VIET_QR_SERVICE_CODE = 'QRIBFTTA'
const VIETNAM_CURRENCY_CODE = '704'
const VIETNAM_COUNTRY_CODE = 'VN'
const MAX_TRANSFER_CONTENT_LENGTH = 25

function encodeTlv(id: string, value: string) {
  const normalizedValue = String(value)
  return `${id}${String(normalizedValue.length).padStart(2, '0')}${normalizedValue}`
}

function crc16Ccitt(payload: string) {
  let crc = 0xffff

  for (let index = 0; index < payload.length; index += 1) {
    crc ^= payload.charCodeAt(index) << 8

    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0')
}

export function buildVietQrPayload(params: BuildVietQrPayloadParams) {
  const bankBin = String(params.bankBin ?? '').trim()
  const accountNumber = String(params.accountNumber ?? '').trim()
  const transferContent = String(params.transferContent ?? '').trim()
  const amount = Number(params.amount)

  if (!/^\d{6}$/.test(bankBin)) {
    throw new Error('VietQR requires a 6-digit bank BIN')
  }

  if (!/^\d{1,19}$/.test(accountNumber)) {
    throw new Error('VietQR requires an account number of up to 19 digits')
  }

  if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) {
    throw new Error('VietQR amount must be a positive integer amount in VND')
  }

  if (!transferContent || transferContent.length > MAX_TRANSFER_CONTENT_LENGTH) {
    throw new Error('VietQR transfer content must be between 1 and 25 characters')
  }

  const merchantAccountInfo = encodeTlv('00', VIET_QR_GUID)
    + encodeTlv(
      '01',
      encodeTlv('00', bankBin) + encodeTlv('01', accountNumber),
    )
    + encodeTlv('02', VIET_QR_SERVICE_CODE)

  const additionalData = encodeTlv('08', transferContent)

  const payloadWithoutCrc = [
    encodeTlv('00', '01'),
    encodeTlv('01', '12'),
    encodeTlv('38', merchantAccountInfo),
    encodeTlv('53', VIETNAM_CURRENCY_CODE),
    encodeTlv('54', String(amount)),
    encodeTlv('58', VIETNAM_COUNTRY_CODE),
    encodeTlv('62', additionalData),
    '6304',
  ].join('')

  return `${payloadWithoutCrc}${crc16Ccitt(payloadWithoutCrc)}`
}

export async function buildVietQrDataUrl(payload: string) {
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 320,
  })
}

