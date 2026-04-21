import { BadRequestException, Injectable } from '@nestjs/common'
import { DatabaseService } from '../../database/database.service.js'
import { google } from 'googleapis'
import { decryptSecret } from '../../common/utils/secret-box.util.js'
import type { GoogleDriveConnectionCheck, StorageUploadCategory, UploadStorageFileInput } from './storage.types.js'

type GoogleDriveRuntimeConfig = {
  clientEmail: string
  privateKey: string
  sharedDriveId: string | null
  rootFolderId: string | null
  imageFolderId: string | null
  documentFolderId: string | null
  backupFolderId: string | null
}

@Injectable()
export class GoogleDriveStorageProvider {
  constructor(private readonly db: DatabaseService) {}

  private normalizePrivateKey(value: string) {
    return value.replace(/\\n/g, '\n')
  }

  private async loadRuntimeConfig(): Promise<GoogleDriveRuntimeConfig> {
    const config = await this.db.systemConfig.findFirst({
      select: {
        googleDriveServiceAccountEnc: true,
        googleDriveSharedDriveId: true,
        googleDriveRootFolderId: true,
        googleDriveImageFolderId: true,
        googleDriveDocumentFolderId: true,
        googleDriveBackupFolderId: true,
        googleDriveClientEmail: true,
      },
    })

    const serviceAccountJson =
      decryptSecret(config?.googleDriveServiceAccountEnc) ??
      process.env['GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON'] ??
      ''

    if (!serviceAccountJson) {
      throw new BadRequestException('Google Drive service account chưa được cấu hình')
    }

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(serviceAccountJson)
    } catch {
      throw new BadRequestException('Google Drive service account JSON không hợp lệ')
    }

    const clientEmail = String(parsed['client_email'] ?? config?.googleDriveClientEmail ?? '').trim()
    const privateKey = String(parsed['private_key'] ?? '').trim()

    if (!clientEmail || !privateKey) {
      throw new BadRequestException('Google Drive service account thiếu client_email hoặc private_key')
    }

    return {
      clientEmail,
      privateKey: this.normalizePrivateKey(privateKey),
      sharedDriveId: config?.googleDriveSharedDriveId ?? null,
      rootFolderId: config?.googleDriveRootFolderId ?? null,
      imageFolderId: config?.googleDriveImageFolderId ?? null,
      documentFolderId: config?.googleDriveDocumentFolderId ?? null,
      backupFolderId: config?.googleDriveBackupFolderId ?? null,
    }
  }

  private async createDriveClient() {
    const config = await this.loadRuntimeConfig()
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: config.clientEmail,
        private_key: config.privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/drive'],
    })

    return {
      drive: google.drive({ version: 'v3', auth }),
      config,
    }
  }

  private resolveFolderId(config: GoogleDriveRuntimeConfig, category: StorageUploadCategory) {
    if (category === 'image') return config.imageFolderId ?? config.rootFolderId
    if (category === 'backup') return config.backupFolderId ?? config.rootFolderId
    return config.documentFolderId ?? config.rootFolderId
  }

  async uploadFile(input: {
    file: UploadStorageFileInput
    category: StorageUploadCategory
  }) {
    const { drive, config } = await this.createDriveClient()
    const folderId = this.resolveFolderId(config, input.category)
    if (!folderId) {
      throw new BadRequestException('Google Drive folder cho danh mục này chưa được cấu hình')
    }

    const created = await drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name: input.file.originalName,
        parents: [folderId],
      },
      media: {
        mimeType: input.file.mimeType,
        body: Buffer.from(input.file.buffer),
      },
      fields: 'id,name,mimeType,size',
    })

    const fileId = created.data.id
    if (!fileId) {
      throw new BadRequestException('Google Drive không trả về fileId sau khi upload')
    }

    return {
      fileId,
      name: created.data.name ?? input.file.originalName,
      mimeType: created.data.mimeType ?? input.file.mimeType,
      size: Number(created.data.size ?? input.file.size),
    }
  }

  async deleteFile(fileId: string | null | undefined) {
    if (!fileId) {
      return
    }

    const { drive } = await this.createDriveClient()
    try {
      await drive.files.delete({
        fileId,
        supportsAllDrives: true,
      })
    } catch (error: any) {
      if (error?.code !== 404) {
        throw error
      }
    }
  }

  async downloadFile(fileId: string) {
    const { drive } = await this.createDriveClient()
    const response = await drive.files.get(
      {
        fileId,
        alt: 'media',
        supportsAllDrives: true,
      },
      {
        responseType: 'stream',
      },
    )

    return response.data
  }

  async testConnection(): Promise<GoogleDriveConnectionCheck> {
    const { drive, config } = await this.createDriveClient()

    if (config.sharedDriveId) {
      await drive.drives.get({
        driveId: config.sharedDriveId,
        fields: 'id,name',
      })
    } else if (config.rootFolderId) {
      await drive.files.get({
        fileId: config.rootFolderId,
        fields: 'id,name,mimeType',
        supportsAllDrives: true,
      })
    }

    return {
      clientEmail: config.clientEmail,
      sharedDriveId: config.sharedDriveId,
      rootFolderId: config.rootFolderId,
      storageProvider: 'GOOGLE_DRIVE',
    }
  }
}
