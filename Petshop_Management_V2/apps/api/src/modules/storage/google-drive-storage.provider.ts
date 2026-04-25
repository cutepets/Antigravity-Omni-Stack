import { BadRequestException, Injectable } from '@nestjs/common'
import { google } from 'googleapis'
import { Readable } from 'stream'
import { DatabaseService } from '../../database/database.service.js'
import { decryptSecret } from '../../common/utils/secret-box.util.js'
import type {
  GoogleDriveConnectionCheck,
  StorageUploadCategory,
  StorageUploadScope,
  UploadStorageFileInput,
} from './storage.types.js'

type GoogleDriveRuntimeConfig = {
  authMode: 'SERVICE_ACCOUNT' | 'OAUTH'
  clientEmail: string | null
  privateKey: string | null
  clientId: string | null
  clientSecret: string | null
  oauthRefreshToken: string | null
  sharedDriveId: string | null
  rootFolderId: string | null
  imageFolderId: string | null
  documentFolderId: string | null
  backupFolderId: string | null
}

@Injectable()
export class GoogleDriveStorageProvider {
  constructor(private readonly db: DatabaseService) { }

  private normalizePrivateKey(value: string) {
    return value.replace(/\\n/g, '\n')
  }

  private async loadRuntimeConfig(): Promise<GoogleDriveRuntimeConfig> {
    const config = await this.db.systemConfig.findFirst({
      select: {
        googleDriveServiceAccountEnc: true,
        googleDriveAuthMode: true,
        googleDriveOAuthRefreshTokenEnc: true,
        googleDriveOAuthEmail: true,
        googleAuthClientId: true,
        googleAuthClientSecretEnc: true,
        googleDriveSharedDriveId: true,
        googleDriveRootFolderId: true,
        googleDriveImageFolderId: true,
        googleDriveDocumentFolderId: true,
        googleDriveBackupFolderId: true,
        googleDriveClientEmail: true,
      },
    })

    const authMode = (config?.googleDriveAuthMode ?? 'SERVICE_ACCOUNT') as GoogleDriveRuntimeConfig['authMode']
    const serviceAccountJson =
      decryptSecret(config?.googleDriveServiceAccountEnc) ??
      process.env['GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON'] ??
      ''
    const oauthRefreshToken = decryptSecret(config?.googleDriveOAuthRefreshTokenEnc) ?? null
    const oauthClientId =
      config?.googleAuthClientId?.trim() ||
      process.env['GOOGLE_AUTH_CLIENT_ID'] ||
      ''
    const oauthClientSecret =
      decryptSecret(config?.googleAuthClientSecretEnc) ||
      process.env['GOOGLE_AUTH_CLIENT_SECRET'] ||
      ''

    if (authMode === 'OAUTH') {
      if (!oauthClientId || !oauthClientSecret) {
        throw new BadRequestException('Google OAuth client chua duoc cau hinh')
      }
      if (!oauthRefreshToken) {
        throw new BadRequestException('Google Drive OAuth chua ket noi. Vui long bam "Ket noi Google Drive" trong cai dat.')
      }

      return {
        authMode,
        clientEmail: config?.googleDriveOAuthEmail ?? config?.googleDriveClientEmail ?? null,
        privateKey: null,
        clientId: oauthClientId,
        clientSecret: oauthClientSecret,
        oauthRefreshToken,
        sharedDriveId: config?.googleDriveSharedDriveId ?? null,
        rootFolderId: config?.googleDriveRootFolderId ?? null,
        imageFolderId: config?.googleDriveImageFolderId ?? null,
        documentFolderId: config?.googleDriveDocumentFolderId ?? null,
        backupFolderId: config?.googleDriveBackupFolderId ?? null,
      }
    }

    if (!serviceAccountJson) {
      throw new BadRequestException('Google Drive service account chua duoc cau hinh')
    }

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(serviceAccountJson)
    } catch {
      throw new BadRequestException('Google Drive service account JSON khong hop le')
    }

    const clientEmail = String(parsed['client_email'] ?? config?.googleDriveClientEmail ?? '').trim()
    const privateKey = String(parsed['private_key'] ?? '').trim()

    if (!clientEmail || !privateKey) {
      throw new BadRequestException('Google Drive service account thieu client_email hoac private_key')
    }

    return {
      authMode: 'SERVICE_ACCOUNT',
      clientEmail,
      privateKey: this.normalizePrivateKey(privateKey),
      clientId: null,
      clientSecret: null,
      oauthRefreshToken: null,
      sharedDriveId: config?.googleDriveSharedDriveId ?? null,
      rootFolderId: config?.googleDriveRootFolderId ?? null,
      imageFolderId: config?.googleDriveImageFolderId ?? null,
      documentFolderId: config?.googleDriveDocumentFolderId ?? null,
      backupFolderId: config?.googleDriveBackupFolderId ?? null,
    }
  }

  private async createDriveClient() {
    const config = await this.loadRuntimeConfig()
    if (config.authMode === 'OAUTH') {
      const auth = new google.auth.OAuth2(config.clientId ?? undefined, config.clientSecret ?? undefined)
      auth.setCredentials({ refresh_token: config.oauthRefreshToken ?? undefined })

      return {
        drive: google.drive({ version: 'v3', auth }),
        config,
      }
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: config.clientEmail ?? '',
        private_key: config.privateKey ?? '',
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
    scope?: StorageUploadScope | null
  }) {
    const { drive, config } = await this.createDriveClient()
    const baseFolderId = this.resolveFolderId(config, input.category)
    if (!baseFolderId) {
      throw new BadRequestException('Google Drive folder cho danh muc nay chua duoc cau hinh')
    }

    const folderId =
      input.category === 'image' && input.scope
        ? await this.findOrCreateChildFolder(drive, baseFolderId, input.scope, config.sharedDriveId)
        : baseFolderId

    return this.createDriveFile(drive, folderId, input.file)
  }

  private async createDriveFile(
    drive: ReturnType<typeof google.drive>,
    folderId: string,
    file: UploadStorageFileInput,
  ) {
    let fileId: string
    let name: string
    let mimeType: string
    let size: number

    try {
      const result = await drive.files.create({
        supportsAllDrives: true,
        requestBody: { name: file.originalName, parents: [folderId] },
        media: { mimeType: file.mimeType, body: Readable.from(file.buffer) },
        fields: 'id,name,mimeType,size',
      })
      if (!result.data.id) {
        throw new BadRequestException('Google Drive khong tra ve fileId sau khi upload')
      }
      fileId = result.data.id
      name = result.data.name ?? file.originalName
      mimeType = result.data.mimeType ?? file.mimeType
      size = Number(result.data.size ?? file.size)
    } catch (error: any) {
      if (error instanceof BadRequestException) throw error
      const googleMsg =
        error?.response?.data?.error?.message ??
        error?.message ??
        'Lỗi upload lên Google Drive'
      const httpCode: number = error?.response?.status ?? 0
      const normalizedGoogleMsg = String(googleMsg).toLowerCase()
      const isServiceAccountQuotaError =
        normalizedGoogleMsg.includes('service accounts do not have storage quota') ||
        normalizedGoogleMsg.includes('storage quota')
      const hint =
        isServiceAccountQuotaError
          ? ' — Service account không có dung lượng lưu trữ My Drive. Hãy tạo Shared Drive, thêm service account vào Shared Drive với quyền Content manager/Manager, đặt Root folder nằm trong Shared Drive và nhập Shared Drive ID; hoặc dùng OAuth delegation thay cho service account.'
          : httpCode === 403
            ? ` — Service account thiếu quyền Editor trên folder "${folderId}".`
            : httpCode === 404
              ? ` — Folder ID "${folderId}" không tồn tại.`
              : ''
      throw new BadRequestException(`Google Drive upload: ${googleMsg}${hint}`)
    }

    return { fileId, name, mimeType, size }
  }

  private async findOrCreateChildFolder(
    drive: ReturnType<typeof google.drive>,
    parentId: string,
    folderName: StorageUploadScope,
    sharedDriveId: string | null,
  ) {
    const escapedFolderName = folderName.replace(/'/g, "\\'")
    const listed = await drive.files.list({
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      ...(sharedDriveId
        ? {
          corpora: 'drive',
          driveId: sharedDriveId,
        }
        : {}),
      q: [
        `'${parentId}' in parents`,
        `name = '${escapedFolderName}'`,
        `mimeType = 'application/vnd.google-apps.folder'`,
        'trashed = false',
      ].join(' and '),
      pageSize: 1,
      fields: 'files(id,name)',
    })

    const existingId = listed.data.files?.[0]?.id
    if (existingId) {
      return existingId
    }

    const created = await drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      },
      fields: 'id',
    })

    if (!created.data.id) {
      throw new BadRequestException(`Khong the tao thu muc Google Drive cho scope "${folderName}"`)
    }

    return created.data.id
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

    try {
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
      } else {
        // No folder configured — just validate auth by calling about
        await drive.about.get({ fields: 'user' })
      }
    } catch (error: any) {
      // Extract the real Google API error message for display
      const googleMsg =
        error?.response?.data?.error?.message ??
        error?.response?.data?.error_description ??
        error?.message ??
        'Lỗi không xác định từ Google API'

      const httpCode = error?.response?.status ?? error?.code ?? ''
      const networkErrorCodes = ['ENOTFOUND', 'ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET', 'ERR_NETWORK']
      const isNetworkError =
        networkErrorCodes.includes(error?.code) ||
        googleMsg.toLowerCase().includes('network error') ||
        googleMsg.toLowerCase().includes('getaddrinfo')

      const isApiDisabled =
        httpCode === 403 &&
        (googleMsg.includes('has not been used') || googleMsg.includes('disabled'))

      let hint = ''
      if (isNetworkError) {
        hint = ' — Lỗi mạng: server không thể kết nối tới Google API. Kiểm tra kết nối internet của server, DNS, hoặc firewall.'
      } else if (isApiDisabled) {
        hint = ' — Google Drive API chưa được bật. Vào Google Cloud Console → APIs & Services → Library → tìm "Google Drive API" → bấm Enable.'
      } else if (httpCode === 403) {
        hint = ' — Service account thiếu quyền. Kiểm tra: (1) Google Drive API đã Enable, (2) folder đã Share cho service account với quyền Editor.'
      } else if (httpCode === 404) {
        hint = ' — Folder ID không tồn tại hoặc chưa được share cho service account.'
      } else if (httpCode === 401) {
        hint = ' — Xác thực thất bại. Kiểm tra file JSON service account có đúng và chưa hết hạn không.'
      }

      throw new BadRequestException(`Google Drive: ${googleMsg}${hint}`)
    }

    return {
      clientEmail: config.clientEmail,
      sharedDriveId: config.sharedDriveId,
      rootFolderId: config.rootFolderId,
      storageProvider: 'GOOGLE_DRIVE',
    }
  }
}
