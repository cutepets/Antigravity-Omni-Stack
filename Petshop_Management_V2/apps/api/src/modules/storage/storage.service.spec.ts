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

  it('normalizes Vietnamese display names before storing new files', async () => {
    const db = {
      systemConfig: {
        findFirst: jest.fn().mockResolvedValue({
          storageProvider: StorageProviderKind.LOCAL,
          googleDriveEnabled: false,
        }),
      },
      storedAsset: {
        create: jest.fn().mockResolvedValue({ id: 'asset-normalized', url: 'http://localhost:3001/api/storage/assets/asset-normalized/content' }),
      },
    } as any

    const service = new StorageService(db, {} as any)
    const storeLocallySpy = jest.spyOn(service as any, 'storeLocally').mockResolvedValue({
      provider: StorageProviderKind.LOCAL,
      storageKey: 'storage/image/pets/pets-avatar-meo-anh-long-dai-20260428-153000-hash12.png',
      googleFileId: null,
      previewUrl: null,
    })

    await service.uploadAsset({
      category: 'image',
      scope: 'pets',
      fieldName: 'avatar',
      displayName: 'Mèo Anh Lông Dài',
      file: {
        originalName: 'Ảnh gốc.png',
        mimeType: 'image/png',
        size: 123,
        buffer: Buffer.from('pet-avatar'),
      },
    })

    const uploadInput = storeLocallySpy.mock.calls[0]?.[0] as any
    expect(uploadInput.file.originalName).toMatch(/^pets-avatar-meo-anh-long-dai-\d{8}-\d{6}-[a-f0-9]{6}\.png$/)
    expect([...uploadInput.file.originalName].every((char) => char.charCodeAt(0) <= 0x7f)).toBe(true)
    expect(db.storedAsset.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          originalName: uploadInput.file.originalName,
          extension: '.png',
        }),
      }),
    )
  })

  it('sends the normalized file name to Google Drive uploads', async () => {
    const db = {
      systemConfig: {
        findFirst: jest.fn().mockResolvedValue({
          storageProvider: StorageProviderKind.GOOGLE_DRIVE,
          googleDriveEnabled: true,
        }),
      },
      storedAsset: {
        create: jest.fn().mockResolvedValue({ id: 'asset-drive', url: 'http://localhost:3001/api/storage/assets/asset-drive/content' }),
      },
    } as any
    const googleDriveStorageProvider = {
      uploadFile: jest.fn().mockResolvedValue({ fileId: 'drive-1', name: 'stored-name.png' }),
    } as any
    const service = new StorageService(db, googleDriveStorageProvider)

    await service.uploadAsset({
      category: 'image',
      scope: 'products',
      fieldName: 'image',
      displayName: 'Sữa Tắm Chó Mèo',
      file: {
        originalName: 'ảnh.png',
        mimeType: 'image/png',
        size: 123,
        buffer: Buffer.from('product-image'),
      },
    })

    expect(googleDriveStorageProvider.uploadFile).toHaveBeenCalledWith(
      expect.objectContaining({
        file: expect.objectContaining({
          originalName: expect.stringMatching(/^products-image-sua-tam-cho-meo-\d{8}-\d{6}-[a-f0-9]{6}\.png$/),
        }),
      }),
    )
  })

  it('deletes a Google Drive asset and removes DB metadata', async () => {
    const db = {
      storedAsset: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'asset-1',
          provider: StorageProviderKind.GOOGLE_DRIVE,
          googleFileId: 'drive-1',
          storageKey: null,
          deletedAt: null,
        }),
        delete: jest.fn(),
      },
      storedAssetReference: {
        deleteMany: jest.fn(),
      },
    } as any

    const googleDriveStorageProvider = {
      deleteFile: jest.fn(),
    } as any

    const service = new StorageService(db, googleDriveStorageProvider)
    await service.deleteAssetByUrl({ url: 'http://localhost:3001/api/storage/assets/asset-1/content' })

    expect(googleDriveStorageProvider.deleteFile).toHaveBeenCalledWith('drive-1')
    expect(db.storedAssetReference.deleteMany).toHaveBeenCalledWith({ where: { assetId: 'asset-1' } })
    expect(db.storedAsset.delete).toHaveBeenCalledWith({ where: { id: 'asset-1' } })
  })

  it('removes local asset metadata even when the physical file is already missing', async () => {
    const db = {
      storedAsset: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'asset-local',
          provider: StorageProviderKind.LOCAL,
          googleFileId: null,
          storageKey: 'missing-local.png',
          deletedAt: null,
        }),
        delete: jest.fn(),
      },
      storedAssetReference: {
        deleteMany: jest.fn(),
      },
    } as any

    const service = new StorageService(db, {} as any)
    await service.deleteAssetByUrl({ url: 'http://localhost:3001/api/storage/assets/asset-local/content' })

    expect(db.storedAssetReference.deleteMany).toHaveBeenCalledWith({ where: { assetId: 'asset-local' } })
    expect(db.storedAsset.delete).toHaveBeenCalledWith({ where: { id: 'asset-local' } })
  })

  it('bulk deletes stored assets and reports failures', async () => {
    const db = {
      storedAsset: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ id: 'asset-1', provider: StorageProviderKind.GOOGLE_DRIVE, googleFileId: 'drive-1', storageKey: null })
          .mockResolvedValueOnce(null),
        delete: jest.fn(),
      },
      storedAssetReference: {
        deleteMany: jest.fn(),
      },
    } as any
    const googleDriveStorageProvider = { deleteFile: jest.fn() } as any
    const service = new StorageService(db, googleDriveStorageProvider)

    const result = await service.bulkDeleteAssets(['asset-1', 'missing'])

    expect(result).toMatchObject({ success: false, deleted: 1 })
    expect(result.failed).toEqual([expect.objectContaining({ id: 'missing' })])
    expect(db.storedAsset.delete).toHaveBeenCalledWith({ where: { id: 'asset-1' } })
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

  it('reuses an active stored asset when the uploaded file has the same content hash', async () => {
    const existingAsset = {
      id: 'asset-existing',
      url: 'http://localhost:3001/api/storage/assets/asset-existing/content',
      sha256: '3a6eb0790f39ac87c94f3856b2dd2c5d110e6811602261a9a923d3bb23adc8b7',
      referenceCount: 1,
    }
    const db = {
      systemConfig: {
        findFirst: jest.fn().mockResolvedValue({
          storageProvider: StorageProviderKind.GOOGLE_DRIVE,
          googleDriveEnabled: true,
        }),
      },
      storedAsset: {
        findFirst: jest.fn().mockResolvedValue(existingAsset),
        update: jest.fn().mockResolvedValue(existingAsset),
        create: jest.fn(),
      },
    } as any

    const googleDriveStorageProvider = {
      uploadFile: jest.fn(),
    } as any
    const service = new StorageService(db, googleDriveStorageProvider)

    const result = await service.uploadAsset({
      category: 'image',
      uploadedById: 'user-1',
      file: {
        originalName: 'same.png',
        mimeType: 'image/png',
        size: 4,
        buffer: Buffer.from('data'),
      },
    })

    expect(result).toMatchObject({ id: 'asset-existing' })
    expect(googleDriveStorageProvider.uploadFile).not.toHaveBeenCalled()
    expect(db.storedAsset.create).not.toHaveBeenCalled()
    expect(db.storedAsset.update).toHaveBeenCalledWith({
      where: { id: 'asset-existing' },
      data: expect.objectContaining({
        status: 'ACTIVE',
        orphanedAt: null,
        lastReferencedAt: expect.any(Date),
      }),
    })
  })

  it('marks the previous asset orphaned when unbinding the last reference', async () => {
    const db = {
      storedAssetReference: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        count: jest.fn().mockResolvedValue(0),
      },
      storedAsset: {
        update: jest.fn(),
      },
    } as any

    const service = new StorageService(db, {} as any)
    await service.unbindAssetReference({
      assetUrl: 'http://localhost:3001/api/storage/assets/asset-old/content',
      entityType: 'SYSTEM_CONFIG',
      entityId: 'config-1',
      fieldName: 'shopLogo',
    })

    expect(db.storedAssetReference.deleteMany).toHaveBeenCalledWith({
      where: {
        asset: { url: 'http://localhost:3001/api/storage/assets/asset-old/content' },
        entityType: 'SYSTEM_CONFIG',
        entityId: 'config-1',
        fieldName: 'shopLogo',
      },
    })
    expect(db.storedAsset.update).toHaveBeenCalledWith({
      where: { url: 'http://localhost:3001/api/storage/assets/asset-old/content' },
      data: expect.objectContaining({
        referenceCount: 0,
        status: 'ORPHANED',
        orphanedAt: expect.any(Date),
      }),
    })
  })

  it('scans DB file fields, binds stored asset references, and reports legacy URLs', async () => {
    const storedUrl = 'http://localhost:3001/api/storage/assets/asset-logo/content'
    const legacyUrl = '/uploads/products/legacy.png'
    const db = {
      systemConfig: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'config-1', shopLogo: storedUrl, spaServiceImages: JSON.stringify([{ packageCode: 'BATH', imageUrl: legacyUrl }]) },
        ]),
      },
      product: { findMany: jest.fn().mockResolvedValue([{ id: 'product-1', image: legacyUrl }]) },
      productVariant: { findMany: jest.fn().mockResolvedValue([]) },
      pet: { findMany: jest.fn().mockResolvedValue([]) },
      user: { findMany: jest.fn().mockResolvedValue([]) },
      employeeDocument: { findMany: jest.fn().mockResolvedValue([]) },
      storedAsset: {
        findFirst: jest.fn().mockResolvedValue({ id: 'asset-logo', url: storedUrl, storageKey: null, googleFileId: null, sha256: 'hash' }),
        update: jest.fn(),
      },
      storedAssetReference: {
        upsert: jest.fn(),
        count: jest.fn().mockResolvedValue(1),
      },
    } as any

    const service = new StorageService(db, {} as any)
    const result = await service.scanAssetReferences({ dryRun: false })

    expect(db.storedAssetReference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          assetId: 'asset-logo',
          entityType: 'SYSTEM_CONFIG',
          entityId: 'config-1',
          fieldName: 'shopLogo',
        }),
      }),
    )
    expect(result.boundReferences).toBe(1)
    expect(result.legacyAssets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ url: legacyUrl, entityType: 'SPA_SERVICE_IMAGE' }),
        expect.objectContaining({ url: legacyUrl, entityType: 'PRODUCT' }),
      ]),
    )
  })

  it('restores an orphaned asset by binding a selected reference', async () => {
    const db = {
      storedAsset: {
        findFirst: jest.fn().mockResolvedValue({ id: 'asset-1', url: 'http://localhost:3001/api/storage/assets/asset-1/content' }),
        update: jest.fn().mockResolvedValue({ id: 'asset-1', status: 'ACTIVE' }),
      },
      storedAssetReference: {
        upsert: jest.fn(),
        count: jest.fn().mockResolvedValue(1),
      },
    } as any

    const service = new StorageService(db, {} as any)
    const result = await service.restoreAssetReference('asset-1', {
      entityType: 'SYSTEM_CONFIG',
      entityId: 'config-1',
      fieldName: 'shopLogo',
    })

    expect(result).toMatchObject({ id: 'asset-1', status: 'ACTIVE' })
    expect(db.storedAssetReference.upsert).toHaveBeenCalled()
    expect(db.storedAsset.update).toHaveBeenCalledWith({
      where: { id: 'asset-1' },
      data: expect.objectContaining({ status: 'ACTIVE', referenceCount: 1, orphanedAt: null }),
    })
  })

  it('cleans up only orphaned assets older than the retention window', async () => {
    const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000)
    const db = {
      storedAsset: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'old-local', provider: StorageProviderKind.LOCAL, storageKey: 'missing.png', googleFileId: null, orphanedAt: oldDate },
        ]),
        delete: jest.fn(),
      },
      storedAssetReference: {
        deleteMany: jest.fn(),
      },
    } as any

    const service = new StorageService(db, {} as any)
    const result = await service.cleanupOrphanedAssets({ retentionDays: 30 })

    expect(db.storedAsset.findMany).toHaveBeenCalledWith({
      where: {
        status: 'ORPHANED',
        orphanedAt: { lte: expect.any(Date) },
        deletedAt: null,
      },
      take: 100,
    })
    expect(db.storedAssetReference.deleteMany).toHaveBeenCalledWith({ where: { assetId: 'old-local' } })
    expect(db.storedAsset.delete).toHaveBeenCalledWith({ where: { id: 'old-local' } })
    expect(result.deleted).toBe(1)
  })

  it('excludes deleted assets from the default all filter but allows explicit deleted filter', async () => {
    const db = {
      storedAsset: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    } as any

    const service = new StorageService(db, {} as any)
    jest.spyOn(service, 'scanAssetReferences').mockResolvedValue({
      scannedReferences: 0,
      boundReferences: 0,
      missingStoredAssets: 0,
      legacyAssets: [],
      legacyCount: 0,
    })

    await service.listAssets({ status: 'all', page: 1, limit: 25 })
    expect(db.storedAsset.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ where: { status: { not: 'DELETED' } } }),
    )

    await service.listAssets({ status: 'DELETED', page: 1, limit: 25 })
    expect(db.storedAsset.findMany).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ where: { status: 'DELETED' } }),
    )
  })
})
