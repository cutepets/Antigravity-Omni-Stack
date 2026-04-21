import { StorageProviderKind } from '@prisma/client'
import { StorageService } from './storage.service'

describe('StorageService', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('creates a stored asset record after local upload', async () => {
    const db = {
      systemConfig: {
        findFirst: jest.fn().mockResolvedValue({
          storageProvider: StorageProviderKind.LOCAL,
          googleDriveEnabled: false,
        }),
      },
      storedAsset: {
        create: jest.fn().mockResolvedValue({ id: 'asset-1', url: 'http://localhost:3001/api/storage/assets/asset-1/content' }),
      },
    } as any

    const service = new StorageService(db, {} as any)
    jest.spyOn(service as any, 'storeLocally').mockResolvedValue({
      provider: StorageProviderKind.LOCAL,
      storageKey: 'storage/image/test.png',
      googleFileId: null,
      previewUrl: null,
    })

    const result = await service.uploadAsset({
      category: 'image',
      uploadedById: 'user-1',
      file: {
        originalName: 'test.png',
        mimeType: 'image/png',
        size: 123,
        buffer: Buffer.from('file'),
      },
    })

    expect(db.storedAsset.create).toHaveBeenCalled()
    expect(result.url).toContain('/api/storage/assets/')
  })

  it('passes the storage scope through when uploading a scoped image asset', async () => {
    const db = {
      systemConfig: {
        findFirst: jest.fn().mockResolvedValue({
          storageProvider: StorageProviderKind.LOCAL,
          googleDriveEnabled: false,
        }),
      },
      storedAsset: {
        create: jest.fn().mockResolvedValue({ id: 'asset-2', url: 'http://localhost:3001/api/storage/assets/asset-2/content' }),
      },
    } as any

    const service = new StorageService(db, {} as any)
    const storeLocallySpy = jest.spyOn(service as any, 'storeLocally').mockResolvedValue({
      provider: StorageProviderKind.LOCAL,
      storageKey: 'storage/image/equipment/test.png',
      googleFileId: null,
      previewUrl: null,
    })

    await service.uploadAsset({
      category: 'image',
      scope: 'equipment',
      uploadedById: 'user-1',
      file: {
        originalName: 'test.png',
        mimeType: 'image/png',
        size: 123,
        buffer: Buffer.from('file'),
      },
    })

    expect(storeLocallySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'image',
        scope: 'equipment',
      }),
    )
    expect(db.storedAsset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          category: 'image',
          storageKey: 'storage/image/equipment/test.png',
        }),
      }),
    )
  })

  it('deletes a Google Drive asset and marks it deleted', async () => {
    const db = {
      storedAsset: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'asset-1',
          provider: StorageProviderKind.GOOGLE_DRIVE,
          googleFileId: 'drive-1',
          storageKey: null,
          deletedAt: null,
        }),
        update: jest.fn(),
      },
    } as any

    const googleDriveStorageProvider = {
      deleteFile: jest.fn(),
    } as any

    const service = new StorageService(db, googleDriveStorageProvider)
    await service.deleteAssetByUrl({ url: 'http://localhost:3001/api/storage/assets/asset-1/content' })

    expect(googleDriveStorageProvider.deleteFile).toHaveBeenCalledWith('drive-1')
    expect(db.storedAsset.update).toHaveBeenCalledWith({
      where: { id: 'asset-1' },
      data: {
        deletedAt: expect.any(Date),
      },
    })
  })

  it('allows backup uploads to force Google Drive even when the default provider is local', async () => {
    const db = {
      systemConfig: {
        findFirst: jest.fn().mockResolvedValue({
          storageProvider: StorageProviderKind.LOCAL,
          googleDriveEnabled: true,
        }),
      },
      storedAsset: {
        create: jest.fn().mockResolvedValue({
          id: 'asset-3',
          url: 'http://localhost:3001/api/storage/assets/asset-3/content',
        }),
      },
    } as any

    const service = new StorageService(db, {} as any)
    const storeInGoogleDriveSpy = jest
      .spyOn(service as any, 'storeInGoogleDrive')
      .mockResolvedValue({
        provider: StorageProviderKind.GOOGLE_DRIVE,
        storageKey: 'storage/backup/backup.appbak',
        googleFileId: 'drive-backup-1',
        previewUrl: null,
      })

    await service.uploadAsset({
      category: 'backup',
      providerOverride: StorageProviderKind.GOOGLE_DRIVE,
      uploadedById: 'user-1',
      file: {
        originalName: 'backup.appbak',
        mimeType: 'application/octet-stream',
        size: 321,
        buffer: Buffer.from('archive'),
      },
    })

    expect(storeInGoogleDriveSpy).toHaveBeenCalled()
    expect(db.storedAsset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          category: 'backup',
          provider: StorageProviderKind.GOOGLE_DRIVE,
        }),
      }),
    )
  })
})
