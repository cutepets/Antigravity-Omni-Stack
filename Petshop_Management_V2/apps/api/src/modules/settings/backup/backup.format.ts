import { BadRequestException } from '@nestjs/common'
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'
import { gunzipSync, gzipSync } from 'zlib'
import type { BackupArchivePayload } from './backup.types.js'
import { APP_BACKUP_FORMAT_VERSION } from './backup.types.js'

const MAGIC = Buffer.from('APPBAK')
const SALT_LENGTH = 16
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16
const HEADER_LENGTH = MAGIC.length + 1 + SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
const ALGORITHM = 'aes-256-gcm'

type BackupEnvelope = {
  formatVersion: number
  salt: Buffer
  iv: Buffer
  authTag: Buffer
  ciphertext: Buffer
}

function normalizePassword(password: string) {
  const normalized = String(password ?? '')
  if (normalized.length < 8) {
    throw new BadRequestException('Mat khau backup phai co it nhat 8 ky tu')
  }
  return normalized
}

function deriveKey(password: string, salt: Buffer) {
  return scryptSync(normalizePassword(password), salt, 32)
}

function readEnvelope(fileBuffer: Buffer): BackupEnvelope {
  if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length <= HEADER_LENGTH) {
    throw new BadRequestException('Tep backup khong hop le hoac bi hong')
  }

  const magic = fileBuffer.subarray(0, MAGIC.length)
  if (!magic.equals(MAGIC)) {
    throw new BadRequestException('Khong dung dinh dang file .appbak')
  }

  const formatVersion = fileBuffer.readUInt8(MAGIC.length)
  const saltOffset = MAGIC.length + 1
  const ivOffset = saltOffset + SALT_LENGTH
  const authTagOffset = ivOffset + IV_LENGTH
  const ciphertextOffset = authTagOffset + AUTH_TAG_LENGTH

  return {
    formatVersion,
    salt: fileBuffer.subarray(saltOffset, ivOffset),
    iv: fileBuffer.subarray(ivOffset, authTagOffset),
    authTag: fileBuffer.subarray(authTagOffset, ciphertextOffset),
    ciphertext: fileBuffer.subarray(ciphertextOffset),
  }
}

export function encodeBackupArchive(payload: BackupArchivePayload, password: string) {
  const serialized = Buffer.from(JSON.stringify(payload), 'utf8')
  const compressed = gzipSync(serialized)
  const salt = randomBytes(SALT_LENGTH)
  const iv = randomBytes(IV_LENGTH)
  const key = deriveKey(password, salt)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(compressed), cipher.final()])
  const authTag = cipher.getAuthTag()

  return Buffer.concat([
    MAGIC,
    Buffer.from([APP_BACKUP_FORMAT_VERSION]),
    salt,
    iv,
    authTag,
    encrypted,
  ])
}

export function decodeBackupArchive(fileBuffer: Buffer, password: string) {
  const envelope = readEnvelope(fileBuffer)
  if (envelope.formatVersion !== APP_BACKUP_FORMAT_VERSION) {
    throw new BadRequestException(
      `Version file backup khong duoc ho tro (${envelope.formatVersion})`,
    )
  }

  try {
    const key = deriveKey(password, envelope.salt)
    const decipher = createDecipheriv(ALGORITHM, key, envelope.iv)
    decipher.setAuthTag(envelope.authTag)

    const decrypted = Buffer.concat([
      decipher.update(envelope.ciphertext),
      decipher.final(),
    ])

    const inflated = gunzipSync(decrypted)
    return JSON.parse(inflated.toString('utf8')) as BackupArchivePayload
  } catch {
    throw new BadRequestException('Khong giai ma duoc file backup. Kiem tra lai mat khau')
  }
}

export function readBackupFormatVersion(fileBuffer: Buffer) {
  return readEnvelope(fileBuffer).formatVersion
}

