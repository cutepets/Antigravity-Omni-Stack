import type { Readable } from 'stream'
import type { StorageProviderKind, StoredAsset } from '@prisma/client'

export type StorageUploadCategory = 'image' | 'document' | 'backup'
export type StorageVisibility = 'private' | 'public'
export type StorageUploadScope =
  | 'products'
  | 'variants'
  | 'staff'
  | 'pets'
  | 'vaccines'
  | 'equipment'
  | 'services'
  | 'suppliers'
  | 'supplier-documents'
  | 'settings'
  | 'documents'
  | 'backups'

export interface UploadStorageFileInput {
  originalName: string
  mimeType: string
  size: number
  buffer: Buffer
}

export interface UploadStoredAssetInput {
  file: UploadStorageFileInput
  category: StorageUploadCategory
  scope?: StorageUploadScope | null
  uploadedById?: string | null
  visibility?: StorageVisibility
  providerOverride?: StorageProviderKind
  ownerType?: string | null
  ownerId?: string | null
  fieldName?: string | null
  displayName?: string | null
}

export interface DeleteStoredAssetInput {
  url: string
}

export interface BindStoredAssetReferenceInput {
  assetUrl: string
  entityType: string
  entityId: string
  fieldName: string
}

export interface UnbindStoredAssetReferenceInput {
  assetUrl: string
  entityType: string
  entityId: string
  fieldName: string
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

export interface ListStoredAssetsInput {
  status?: string | null
  category?: StorageUploadCategory | 'all' | null
  provider?: StorageProviderKind | 'all' | 'LEGACY' | null
  q?: string | null
  page?: number
  limit?: number
}
