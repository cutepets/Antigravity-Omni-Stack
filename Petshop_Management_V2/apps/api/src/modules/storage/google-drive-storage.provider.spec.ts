import { GoogleDriveStorageProvider } from './google-drive-storage.provider'

describe('GoogleDriveStorageProvider', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('uploads scoped images into the matching child folder under the image root', async () => {
    const provider = new GoogleDriveStorageProvider({} as any)
    const drive = {
      files: {
        create: jest.fn().mockResolvedValue({
          data: {
            id: 'drive-file-1',
            name: 'equipment.png',
            mimeType: 'image/png',
            size: '123',
          },
        }),
      },
    }

    jest.spyOn(provider as any, 'createDriveClient').mockResolvedValue({
      drive,
      config: {
        clientEmail: 'storage@test.local',
        privateKey: 'private-key',
        sharedDriveId: 'shared-drive-1',
        rootFolderId: 'root-folder-1',
        imageFolderId: 'image-root-1',
        documentFolderId: 'doc-root-1',
        backupFolderId: 'backup-root-1',
      },
    })
    const findOrCreateChildFolderSpy = jest
      .spyOn(provider as any, 'findOrCreateChildFolder')
      .mockResolvedValue('equipment-folder-1')

    const result = await provider.uploadFile({
      category: 'image',
      scope: 'equipment',
      file: {
        originalName: 'equipment.png',
        mimeType: 'image/png',
        size: 123,
        buffer: Buffer.from('file'),
      },
    })

    expect(findOrCreateChildFolderSpy).toHaveBeenCalledWith(
      drive,
      'image-root-1',
      'equipment',
      'shared-drive-1',
    )
    expect(drive.files.create).toHaveBeenCalledWith(
      expect.objectContaining({
        supportsAllDrives: true,
        requestBody: expect.objectContaining({
          parents: ['equipment-folder-1'],
        }),
      }),
    )
    expect(result.fileId).toBe('drive-file-1')
  })
})
