import { BadRequestException } from '@nestjs/common'
import { randomUUID } from 'crypto'
import { mkdirSync } from 'fs'
import { unlink } from 'fs/promises'
import { diskStorage, memoryStorage } from 'multer'
import { extname, relative, resolve, sep } from 'path'
import type { Request } from 'express'

export const IMAGE_UPLOAD_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
])

export const IMAGE_UPLOAD_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'])

export const DOCUMENT_UPLOAD_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
])

export const DOCUMENT_UPLOAD_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
])

type UploadDestination = string | ((req: Request, file: Express.Multer.File) => string)

type DiskUploadOptions = {
  destination: UploadDestination
  allowedMimeTypes: Set<string>
  allowedExtensions: Set<string>
  maxFileSize: number
  errorMessage: string
}

type ValidateUploadedFileOptions = {
  allowedMimeTypes: Set<string>
  allowedExtensions: Set<string>
  maxFileSize: number
  errorMessage: string
}

type UploadedFilePathOptions = {
  publicPrefix: string
  rootDir: string
}

function ensureUploadDirectory(destination: string) {
  const absoluteDestination = resolve(process.cwd(), destination)
  mkdirSync(absoluteDestination, { recursive: true })
  return absoluteDestination
}

function resolveUploadDestination(
  destination: UploadDestination,
  req: Request,
  file: Express.Multer.File,
) {
  return typeof destination === 'function' ? destination(req, file) : destination
}

export function createDiskUploadOptions(options: DiskUploadOptions) {
  return {
    fileFilter: (req: Request, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
      const ext = extname(file.originalname).toLowerCase()
      const mime = (file.mimetype || '').toLowerCase()

      if (!options.allowedMimeTypes.has(mime) || !options.allowedExtensions.has(ext)) {
        cb(new BadRequestException(options.errorMessage), false)
        return
      }

      cb(null, true)
    },
    storage: diskStorage({
      destination: (req, file, cb) => {
        const destination = resolveUploadDestination(options.destination, req, file)
        cb(null, ensureUploadDirectory(destination))
      },
      filename: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase()
        cb(null, `${randomUUID()}${ext}`)
      },
    }),
    limits: { fileSize: options.maxFileSize },
  }
}

export function createMemoryUploadOptions(options: DiskUploadOptions) {
  return {
    fileFilter: (req: Request, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
      const ext = extname(file.originalname).toLowerCase()
      const mime = (file.mimetype || '').toLowerCase()

      if (!options.allowedMimeTypes.has(mime) || !options.allowedExtensions.has(ext)) {
        cb(new BadRequestException(options.errorMessage), false)
        return
      }

      cb(null, true)
    },
    storage: memoryStorage(),
    limits: { fileSize: options.maxFileSize },
  }
}

export function validateUploadedFile(
  file: Express.Multer.File | undefined | null,
  options: ValidateUploadedFileOptions,
) {
  if (!file) {
    throw new BadRequestException('File is required')
  }

  if (file.size > options.maxFileSize) {
    throw new BadRequestException(`File size must be less than ${Math.floor(options.maxFileSize / 1024 / 1024)}MB`)
  }

  const extension = extname(file.originalname).toLowerCase()
  const mimeType = (file.mimetype || '').toLowerCase()
  if (!options.allowedMimeTypes.has(mimeType) || !options.allowedExtensions.has(extension)) {
    throw new BadRequestException(options.errorMessage)
  }

  if (!file.filename) {
    throw new BadRequestException('Uploaded file is missing filename metadata')
  }
}

export function resolveUploadedFilePath(url: string, options: UploadedFilePathOptions) {
  const normalizedUrl = String(url ?? '').trim()
  if (!normalizedUrl.startsWith(options.publicPrefix)) {
    throw new BadRequestException('Duong dan file khong hop le')
  }

  const relativePath = normalizedUrl.slice(options.publicPrefix.length).replaceAll('\\', '/').trim()
  if (!relativePath) {
    throw new BadRequestException('Duong dan file khong hop le')
  }

  const absoluteRoot = resolve(process.cwd(), options.rootDir)
  const absolutePath = resolve(absoluteRoot, relativePath)
  const normalizedRelativePath = relative(absoluteRoot, absolutePath)

  if (
    normalizedRelativePath.startsWith('..') ||
    normalizedRelativePath.includes(`..${sep}`) ||
    resolve(absolutePath) === absoluteRoot
  ) {
    throw new BadRequestException('Duong dan file khong hop le')
  }

  return {
    absolutePath,
    relativePath: normalizedRelativePath.replaceAll('\\', '/'),
  }
}

export async function deleteUploadedFile(url: string, options: UploadedFilePathOptions) {
  const { absolutePath } = resolveUploadedFilePath(url, options)

  try {
    await unlink(absolutePath)
  } catch (error: any) {
    if (error?.code !== 'ENOENT') {
      throw new BadRequestException('Khong the xoa file da upload')
    }
  }
}
