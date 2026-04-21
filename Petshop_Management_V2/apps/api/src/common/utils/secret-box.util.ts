import { BadRequestException } from '@nestjs/common'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

const ENCRYPTION_KEY_ENV = 'APP_SECRET_ENCRYPTION_KEY'
const GCM_ALGORITHM = 'aes-256-gcm'

function getEncryptionKey() {
  const rawKey = process.env[ENCRYPTION_KEY_ENV]
  if (!rawKey) {
    throw new BadRequestException(`Missing required environment variable: ${ENCRYPTION_KEY_ENV}`)
  }

  return createHash('sha256').update(rawKey).digest()
}

export function encryptSecret(secret: string) {
  const normalized = String(secret ?? '').trim()
  if (!normalized) {
    throw new BadRequestException('Secret cannot be empty')
  }

  const key = getEncryptionKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv(GCM_ALGORITHM, key, iv)

  const encrypted = Buffer.concat([cipher.update(normalized, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return `${iv.toString('base64url')}.${authTag.toString('base64url')}.${encrypted.toString('base64url')}`
}

export function decryptSecret(payload: string | null | undefined) {
  const normalized = String(payload ?? '').trim()
  if (!normalized) {
    return null
  }

  const [ivPart, tagPart, encryptedPart] = normalized.split('.')
  if (!ivPart || !tagPart || !encryptedPart) {
    throw new BadRequestException('Encrypted secret payload is invalid')
  }

  const key = getEncryptionKey()
  const decipher = createDecipheriv(
    GCM_ALGORITHM,
    key,
    Buffer.from(ivPart, 'base64url'),
  )
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'))

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, 'base64url')),
    decipher.final(),
  ])

  return decrypted.toString('utf8')
}
