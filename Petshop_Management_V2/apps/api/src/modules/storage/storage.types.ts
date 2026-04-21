import type { Readable } from 'stream'
import type { StorageProviderKind, StoredAsset } from '@prisma/client'

export type StorageUploadCategory = 'image' | 'document' | 'backup'
export type StorageVisibility = 'private' | 'public'

export interface UploadStorageFileInput {
  originalName: string
  mimeType: string
  size: number
  buffer: Buffer
}

export interface UploadStoredAssetInput {
  file: UploadStorageFileInput
  category: StorageUploadCategory
  uploadedById?: string | null
  visibility?: StorageVisibility
}

export interface DeleteStoredAssetInput {
  url: string
}

export interface StoredAssetContent {
  asset: StoredAsset
  stream: Readable
}

export interface GoogleDriveConnectionCheck {
  clientEmail: string | null
  sharedDriveId: string | null
  rootFolderId: string | null
  storageProvider: StorageProviderKind
}
