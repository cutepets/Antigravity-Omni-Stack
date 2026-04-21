import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { StorageProviderKind, type StoredAsset } from '@prisma/client'
import { randomUUID } from 'crypto'
import { createReadStream } from 'fs'
import { mkdir, unlink, writeFile } from 'fs/promises'
import { extname, resolve } from 'path'
import { DatabaseService } from '../../database/database.service.js'
import { GoogleDriveStorageProvider } from './google-drive-storage.provider.js'
import type {
  DeleteStoredAssetInput,
  GoogleDriveConnectionCheck,
  StoredAssetContent,
  UploadStoredAssetInput,
} from './storage.types.js'

@Injectable()
export class StorageService {
  constructor(
    private readonly db: DatabaseService,
    private readonly googleDriveStorageProvider: GoogleDriveStorageProvider,
  ) {}

  private async getSystemConfig() {
    return this.db.systemConfig.findFirst({
      select: {
        storageProvider: true,
        googleDriveEnabled: true,
      },
    })
  }

  private getPublicApiUrl() {
    const configured =
      process.env['PUBLIC_API_URL'] ??
      process.env['API_PUBLIC_URL'] ??
      process.env['NEXT_PUBLIC_API_URL']

    if (configured) {
      return configured.replace(/\/+$/, '')
    }

    return `http://localhost:${process.env['API_PORT'] ?? '3001'}`
  }

  private buildAssetUrl(assetId: string) {
    return `${this.getPublicApiUrl()}/api/storage/assets/${assetId}/content`
  }

  private resolveLocalAbsolutePath(storageKey: string) {
    return resolve(process.cwd(), 'uploads', storageKey)
  }

  private async storeLocally(input: UploadStoredAssetInput) {
    const extension = extname(input.file.originalName).toLowerCase()
    const fileName = `${randomUUID()}${extension}`
    const storageKey = `storage/${input.category}/${fileName}`
    const absolutePath = this.resolveLocalAbsolutePath(storageKey)

    await mkdir(resolve(process.cwd(), 'uploads', 'storage', input.category), { recursive: true })
    await writeFile(absolutePath, input.file.buffer)

    return {
      provider: StorageProviderKind.LOCAL,
      storageKey,
      googleFileId: null,
      previewUrl: null,
    }
  }

  private async storeInGoogleDrive(input: UploadStoredAssetInput) {
    const uploaded = await this.googleDriveStorageProvider.uploadFile({
      file: input.file,
      category: input.category,
    })

    return {
      provider: StorageProviderKind.GOOGLE_DRIVE,
      storageKey: uploaded.name,
      googleFileId: uploaded.fileId,
      previewUrl: null,
    }
  }

  async uploadAsset(input: UploadStoredAssetInput) {
    const config = await this.getSystemConfig()
    const useGoogleDrive =
      config?.storageProvider === StorageProviderKind.GOOGLE_DRIVE &&
      config?.googleDriveEnabled === true

    const stored = useGoogleDrive
      ? await this.storeInGoogleDrive(input)
      : await this.storeLocally(input)

    const assetId = randomUUID()
    const asset = await this.db.storedAsset.create({
      data: {
        id: assetId,
        provider: stored.provider,
        category: input.category,
        originalName: input.file.originalName,
        mimeType: input.file.mimeType,
        size: input.file.size,
        extension: extname(input.file.originalName).toLowerCase() || null,
        storageKey: stored.storageKey,
        googleFileId: stored.googleFileId,
        previewUrl: stored.previewUrl,
        uploadedById: input.uploadedById ?? null,
        url: this.buildAssetUrl(assetId),
      },
    })

    return asset
  }

  async deleteAssetByUrl(input: DeleteStoredAssetInput) {
    const normalizedUrl = String(input.url ?? '').trim()
    if (!normalizedUrl) {
      throw new BadRequestException('Duong dan file khong hop le')
    }

    const asset = await this.db.storedAsset.findFirst({
      where: {
        url: normalizedUrl,
        deletedAt: null,
      },
    })

    if (!asset) {
      return null
    }

    if (asset.provider === StorageProviderKind.GOOGLE_DRIVE) {
      await this.googleDriveStorageProvider.deleteFile(asset.googleFileId)
    } else if (asset.storageKey) {
      try {
        await unlink(this.resolveLocalAbsolutePath(asset.storageKey))
      } catch (error: any) {
        if (error?.code !== 'ENOENT') {
          throw new BadRequestException('Khong the xoa file da upload')
        }
      }
    }

    await this.db.storedAsset.update({
      where: { id: asset.id },
      data: {
        deletedAt: new Date(),
      },
    })

    return asset
  }

  async getAssetContent(assetId: string): Promise<StoredAssetContent> {
    const asset = await this.db.storedAsset.findUnique({
      where: { id: assetId },
    })

    if (!asset || asset.deletedAt) {
      throw new NotFoundException('Khong tim thay tep')
    }

    if (asset.provider === StorageProviderKind.GOOGLE_DRIVE) {
      if (!asset.googleFileId) {
        throw new NotFoundException('Khong tim thay tep tren Google Drive')
      }

      const stream = await this.googleDriveStorageProvider.downloadFile(asset.googleFileId)
      return { asset, stream }
    }

    if (!asset.storageKey) {
      throw new NotFoundException('Khong tim thay tep luu tru cuc bo')
    }

    return {
      asset,
      stream: createReadStream(this.resolveLocalAbsolutePath(asset.storageKey)),
    }
  }

  async testGoogleDriveConnection(): Promise<GoogleDriveConnectionCheck> {
    return this.googleDriveStorageProvider.testConnection()
  }

  async resolveStoredAsset(url: string) {
    return this.db.storedAsset.findFirst({
      where: {
        url,
        deletedAt: null,
      },
    })
  }

  isStoredAssetUrl(url: string | null | undefined) {
    const normalizedUrl = String(url ?? '').trim()
    return normalizedUrl.startsWith(`${this.getPublicApiUrl()}/api/storage/assets/`)
  }
}
