import { GoogleDriveStorageProvider } from './google-drive-storage.provider'
import { google } from 'googleapis'

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
        media: expect.objectContaining({
          body: expect.objectContaining({
            pipe: expect.any(Function),
          }),
        }),
      }),
    )
    expect(result.fileId).toBe('drive-file-1')
  })

  it('explains that service account quota errors require a shared drive', async () => {
    const provider = new GoogleDriveStorageProvider({} as any)
    const drive = {
      files: {
        create: jest.fn().mockRejectedValue({
          response: {
            status: 403,
            data: {
              error: {
                message:
                  'Service Accounts do not have storage quota. Leverage shared drives instead.',
              },
            },
          },
        }),
      },
    }

    await expect(
      (provider as any).createDriveFile(drive, 'my-drive-folder-1', {
        originalName: 'logo.png',
        mimeType: 'image/png',
        size: 123,
        buffer: Buffer.from('file'),
      }),
    ).rejects.toThrow('Shared Drive')
  })

  it('creates an OAuth Drive client from the stored refresh token', async () => {
    const provider = new GoogleDriveStorageProvider({} as any)
    const setCredentials = jest.fn()
    const oauthClient = { setCredentials }
    const driveClient = { files: {} }
    const oauthSpy = jest.spyOn(google.auth as any, 'OAuth2').mockImplementation(() => oauthClient)
    const driveSpy = jest.spyOn(google as any, 'drive').mockReturnValue(driveClient)

    jest.spyOn(provider as any, 'loadRuntimeConfig').mockResolvedValue({
      authMode: 'OAUTH',
      clientId: 'google-client-id',
      clientSecret: 'google-client-secret',
      oauthRefreshToken: 'refresh-token-1',
      clientEmail: null,
      privateKey: null,
      sharedDriveId: null,
      rootFolderId: 'root-folder-1',
      imageFolderId: null,
      documentFolderId: null,
      backupFolderId: null,
    })

    const result = await (provider as any).createDriveClient()

    expect(oauthSpy).toHaveBeenCalledWith('google-client-id', 'google-client-secret')
    expect(setCredentials).toHaveBeenCalledWith({ refresh_token: 'refresh-token-1' })
    expect(driveSpy).toHaveBeenCalledWith({ version: 'v3', auth: oauthClient })
    expect(result.drive).toBe(driveClient)
  })
})
