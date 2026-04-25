import { BadRequestException } from '@nestjs/common'
import { SettingsService } from './settings.service'

describe('SettingsService google auth config', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('normalizes allowed Google domain when a root URL is pasted', async () => {
    const db = {
      systemConfig: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }) => ({ id: 'config-1', ...data })),
      },
    } as any
    const service = new SettingsService(db)

    const result = await service.updateConfigs({
      googleAuthAllowedDomain: 'https://app.petshophanoi.com/',
    })

    expect(db.systemConfig.create).toHaveBeenCalledWith({
      data: {
        googleAuthAllowedDomain: 'app.petshophanoi.com',
      },
    })
    expect((result.data as any).googleAuthAllowedDomain).toBe('app.petshophanoi.com')
  })

  it('rejects allowed Google domain values with URL paths', async () => {
    const db = {
      systemConfig: {
        findFirst: jest.fn().mockResolvedValue({ id: 'config-1' }),
        update: jest.fn(),
      },
    } as any
    const service = new SettingsService(db)

    await expect(
      service.updateConfigs({
        googleAuthAllowedDomain: 'https://app.petshophanoi.com/login',
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(db.systemConfig.update).not.toHaveBeenCalled()
  })

  it('saves a valid order return window in days', async () => {
    const db = {
      systemConfig: {
        findFirst: jest.fn().mockResolvedValue({ id: 'config-1' }),
        update: jest.fn(async ({ data }) => ({ id: 'config-1', ...data })),
      },
    } as any
    const service = new SettingsService(db)

    const result = await service.updateConfigs({
      orderReturnWindowDays: 7,
    })

    expect(db.systemConfig.update).toHaveBeenCalledWith({
      where: { id: 'config-1' },
      data: {
        orderReturnWindowDays: 7,
      },
    })
    expect((result.data as any).orderReturnWindowDays).toBe(7)
  })

  it('rejects negative order return window days', async () => {
    const db = {
      systemConfig: {
        findFirst: jest.fn().mockResolvedValue({ id: 'config-1' }),
        update: jest.fn(),
      },
    } as any
    const service = new SettingsService(db)

    await expect(
      service.updateConfigs({
        orderReturnWindowDays: -1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(db.systemConfig.update).not.toHaveBeenCalled()
  })

  it('rejects non-integer order return window days', async () => {
    const db = {
      systemConfig: {
        findFirst: jest.fn().mockResolvedValue({ id: 'config-1' }),
        update: jest.fn(),
      },
    } as any
    const service = new SettingsService(db)

    await expect(
      service.updateConfigs({
        orderReturnWindowDays: 1.5,
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(db.systemConfig.update).not.toHaveBeenCalled()
  })

  it('creates a Google Drive OAuth URL with offline Drive consent', async () => {
    const db = {
      systemConfig: {
        findFirst: jest.fn().mockResolvedValue({
          googleAuthEnabled: true,
          googleAuthClientId: 'google-client-id',
          googleAuthClientSecretEnc: 'encrypted-secret',
        }),
      },
    } as any
    const service = new SettingsService(db)
    jest.spyOn(require('../../common/utils/secret-box.util.js'), 'decryptSecret').mockReturnValue('google-client-secret')
    jest.spyOn(service as any, 'getApiBaseUrl').mockReturnValue('http://localhost:3001')
    jest.spyOn(service as any, 'createGoogleDriveOAuthClient').mockResolvedValue({
      client: {
        generateAuthUrl: jest.fn().mockReturnValue('https://accounts.google.test/oauth'),
      },
    })

    const result = await service.createGoogleDriveOAuthUrl('state-1')

    expect(result).toBe('https://accounts.google.test/oauth')
    expect((service as any).createGoogleDriveOAuthClient).toHaveBeenCalledWith()
  })

  it('saves Google Drive OAuth refresh token and email', async () => {
    const previousEncryptionKey = process.env['APP_SECRET_ENCRYPTION_KEY']
    process.env['APP_SECRET_ENCRYPTION_KEY'] = 'settings-service-test-key'
    const db = {
      systemConfig: {
        findFirst: jest.fn().mockResolvedValue({ id: 'config-1' }),
        update: jest.fn().mockResolvedValue({ id: 'config-1' }),
      },
    } as any
    const service = new SettingsService(db)
    jest.spyOn(service as any, 'createGoogleDriveOAuthClient').mockResolvedValue({
      client: {
        getToken: jest.fn().mockResolvedValue({
          tokens: {
            refresh_token: 'refresh-token-1',
            id_token: 'id-token-1',
          },
        }),
        verifyIdToken: jest.fn().mockResolvedValue({
          getPayload: () => ({
            email: 'owner@gmail.com',
            email_verified: true,
          }),
        }),
      },
      config: { clientId: 'google-client-id' },
    })

    await service.connectGoogleDriveOAuthWithCode('code-1')

    expect(db.systemConfig.update).toHaveBeenCalledWith({
      where: { id: 'config-1' },
      data: {
        googleDriveAuthMode: 'OAUTH',
        googleDriveOAuthRefreshTokenEnc: expect.any(String),
        googleDriveOAuthEmail: 'owner@gmail.com',
        googleDriveClientEmail: 'owner@gmail.com',
      },
    })
    if (previousEncryptionKey === undefined) {
      delete process.env['APP_SECRET_ENCRYPTION_KEY']
    } else {
      process.env['APP_SECRET_ENCRYPTION_KEY'] = previousEncryptionKey
    }
  })

  it('rejects Google Drive OAuth callback without a refresh token', async () => {
    const service = new SettingsService({} as any)
    jest.spyOn(service as any, 'createGoogleDriveOAuthClient').mockResolvedValue({
      client: {
        getToken: jest.fn().mockResolvedValue({
          tokens: {
            id_token: 'id-token-1',
          },
        }),
      },
      config: { clientId: 'google-client-id' },
    })

    await expect(service.connectGoogleDriveOAuthWithCode('code-1')).rejects.toBeInstanceOf(BadRequestException)
  })

  it('disconnects Google Drive OAuth credentials', async () => {
    const db = {
      systemConfig: {
        findFirst: jest.fn().mockResolvedValue({ id: 'config-1' }),
        update: jest.fn().mockResolvedValue({ id: 'config-1' }),
      },
    } as any
    const service = new SettingsService(db)

    await service.disconnectGoogleDriveOAuth()

    expect(db.systemConfig.update).toHaveBeenCalledWith({
      where: { id: 'config-1' },
      data: {
        googleDriveOAuthRefreshTokenEnc: null,
        googleDriveOAuthEmail: null,
        googleDriveClientEmail: null,
      },
    })
  })
})
