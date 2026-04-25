import { BadRequestException } from '@nestjs/common'
import { relative, resolve, sep } from 'path'

export const PRIVATE_STORAGE_ROOT = process.env['PRIVATE_UPLOAD_DIR'] ?? 'storage/private'

export function sanitizeStorageSegment(value: string | undefined | null) {
  const normalized = String(value ?? 'unknown').trim()
  return normalized.replace(/[^a-zA-Z0-9_-]/g, '_') || 'unknown'
}

export function resolvePrivateStorageKey(storageKey: string, rootDir = PRIVATE_STORAGE_ROOT) {
  const normalizedKey = String(storageKey ?? '').replaceAll('\\', '/').trim()
  if (!normalizedKey || normalizedKey.startsWith('/') || normalizedKey.includes('../')) {
    throw new BadRequestException('Duong dan file khong hop le')
  }

  const absoluteRoot = resolve(process.cwd(), rootDir)
  const absolutePath = resolve(absoluteRoot, normalizedKey)
  const relativePath = relative(absoluteRoot, absolutePath)

  if (
    relativePath.startsWith('..') ||
    relativePath.includes(`..${sep}`) ||
    resolve(absolutePath) === absoluteRoot
  ) {
    throw new BadRequestException('Duong dan file khong hop le')
  }

  return {
    absolutePath,
    relativePath: relativePath.replaceAll('\\', '/'),
  }
}
