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
})
