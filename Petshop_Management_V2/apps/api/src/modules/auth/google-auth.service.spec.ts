import { UnauthorizedException } from '@nestjs/common'
import { GoogleAuthService } from './google-auth.service'

describe('GoogleAuthService', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('creates a session when the Google account is already linked', async () => {
    const db = {
      systemConfig: {
        findFirst: jest.fn(),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'user-1' }),
        update: jest.fn(),
      },
    } as any

    const authService = {
      createSessionForUserId: jest.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r', user: { id: 'user-1' } }),
    } as any

    const service = new GoogleAuthService(db, authService)
    jest.spyOn(service as any, 'resolveGoogleUserFromCode').mockResolvedValue({
      googleId: 'google-1',
      email: 'admin@example.com',
      avatar: 'https://avatar.test/a.png',
    })

    const result = await service.loginWithAuthorizationCode('code')

    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        googleEmail: 'admin@example.com',
        googleAvatar: 'https://avatar.test/a.png',
      },
    })
    expect(authService.createSessionForUserId).toHaveBeenCalledWith('user-1')
    expect(result.accessToken).toBe('a')
  })

  it('rejects login when the Google account has not been linked yet', async () => {
    const db = {
      systemConfig: {
        findFirst: jest.fn(),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
    } as any

    const service = new GoogleAuthService(db, { createSessionForUserId: jest.fn() } as any)
    jest.spyOn(service as any, 'resolveGoogleUserFromCode').mockResolvedValue({
      googleId: 'google-1',
      email: 'admin@example.com',
      avatar: null,
    })

    await expect(service.loginWithAuthorizationCode('code')).rejects.toBeInstanceOf(UnauthorizedException)
    expect(db.user.update).not.toHaveBeenCalled()
  })

  it('links the current logged-in user to Google', async () => {
    const db = {
      systemConfig: {
        findFirst: jest.fn(),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({
          id: 'user-1',
          googleId: 'google-1',
          googleEmail: 'admin@example.com',
          googleAvatar: 'https://avatar.test/a.png',
        }),
      },
    } as any

    const service = new GoogleAuthService(db, { createSessionForUserId: jest.fn() } as any)
    const resolveSpy = jest.spyOn(service as any, 'resolveGoogleUserFromCode').mockResolvedValue({
      googleId: 'google-1',
      email: 'admin@example.com',
      avatar: 'https://avatar.test/a.png',
    })

    const result = await service.linkUserWithAuthorizationCode('user-1', 'code')

    expect(resolveSpy).toHaveBeenCalledWith('code', 'link')
    expect(db.user.findFirst).toHaveBeenCalledWith({
      where: {
        googleId: 'google-1',
        NOT: {
          id: 'user-1',
        },
      },
      select: {
        id: true,
      },
    })
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        googleId: 'google-1',
        googleEmail: 'admin@example.com',
        googleAvatar: 'https://avatar.test/a.png',
      },
      select: {
        id: true,
        googleId: true,
        googleEmail: true,
        googleAvatar: true,
      },
    })
    expect(result).toEqual({
      id: 'user-1',
      googleId: 'google-1',
      googleEmail: 'admin@example.com',
      googleAvatar: 'https://avatar.test/a.png',
    })
  })

  it('rejects link when the Google account belongs to another user', async () => {
    const db = {
      systemConfig: {
        findFirst: jest.fn(),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'user-2' }),
        update: jest.fn(),
      },
    } as any

    const service = new GoogleAuthService(db, { createSessionForUserId: jest.fn() } as any)
    jest.spyOn(service as any, 'resolveGoogleUserFromCode').mockResolvedValue({
      googleId: 'google-1',
      email: 'admin@example.com',
      avatar: null,
    })

    await expect(service.linkUserWithAuthorizationCode('user-1', 'code')).rejects.toBeInstanceOf(UnauthorizedException)
    expect(db.user.update).not.toHaveBeenCalled()
  })

  it('returns public config for login page and settings guidance', async () => {
    const db = {
      systemConfig: {
        findFirst: jest.fn().mockResolvedValue({
          googleAuthEnabled: true,
          googleAuthClientId: 'google-client-id',
          googleAuthClientSecretEnc: null,
          googleAuthAllowedDomain: 'example.com',
        }),
      },
    } as any

    const service = new GoogleAuthService(db, {} as any)
    jest.spyOn(service as any, 'getApiBaseUrl').mockReturnValue('http://localhost:3001')
    jest.spyOn(service, 'getWebAppBaseUrl').mockReturnValue('http://localhost:3000')
    const decryptSpy = jest.spyOn(require('../../common/utils/secret-box.util.js'), 'decryptSecret').mockReturnValue('client-secret')

    const result = await service.getPublicConfig()

    expect(decryptSpy).toHaveBeenCalled()
    expect(result).toEqual({
      enabled: true,
      configured: true,
      clientId: 'google-client-id',
      allowedDomain: 'example.com',
      apiBaseUrl: 'http://localhost:3001',
      webAppBaseUrl: 'http://localhost:3000',
      callbackUrl: 'http://localhost:3001/api/auth/google/callback',
      linkCallbackUrl: 'http://localhost:3001/api/auth/google/link/callback',
    })
  })

  it('does not expose client id when google auth is not configured', async () => {
    const db = {
      systemConfig: {
        findFirst: jest.fn().mockResolvedValue({
          googleAuthEnabled: true,
          googleAuthClientId: '',
          googleAuthClientSecretEnc: null,
          googleAuthAllowedDomain: null,
        }),
      },
    } as any

    const service = new GoogleAuthService(db, {} as any)
    jest.spyOn(service as any, 'getApiBaseUrl').mockReturnValue('http://localhost:3001')
    jest.spyOn(service, 'getWebAppBaseUrl').mockReturnValue('http://localhost:3000')

    await expect(service.getPublicConfig()).resolves.toMatchObject({
      enabled: true,
      configured: false,
      clientId: null,
    })
  })

  it('creates a session from a popup authorization code', async () => {
    const db = {
      systemConfig: {
        findFirst: jest.fn(),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'user-1' }),
        update: jest.fn(),
      },
    } as any

    const authService = {
      createSessionForUserId: jest.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r', user: { id: 'user-1' } }),
    } as any

    const service = new GoogleAuthService(db, authService)
    const resolveSpy = jest.spyOn(service as any, 'resolveGoogleUserFromCode').mockResolvedValue({
      googleId: 'google-1',
      email: 'admin@example.com',
      avatar: null,
    })

    const result = await service.loginWithPopupAuthorizationCode('popup-code')

    expect(resolveSpy).toHaveBeenCalledWith('popup-code', 'popup')
    expect(authService.createSessionForUserId).toHaveBeenCalledWith('user-1')
    expect(result.accessToken).toBe('a')
  })

  it('resolves a verified Google user from the ID token claims', async () => {
    const service = new GoogleAuthService({} as any, {} as any)
    jest.spyOn(service as any, 'createOAuthClient').mockResolvedValue({
      client: {
        getToken: jest.fn().mockResolvedValue({ tokens: { id_token: 'id-token' } }),
        verifyIdToken: jest.fn().mockResolvedValue({
          getPayload: () => ({
            sub: 'google-1',
            email: 'admin@example.com',
            email_verified: true,
            picture: 'https://avatar.test/a.png',
            hd: 'example.com',
          }),
        }),
      },
      config: {
        clientId: 'google-client-id',
        allowedDomain: 'example.com',
      },
    })

    await expect((service as any).resolveGoogleUserFromCode('popup-code', 'popup')).resolves.toEqual({
      googleId: 'google-1',
      email: 'admin@example.com',
      avatar: 'https://avatar.test/a.png',
    })
  })

  it('rejects Google users with unverified email claims', async () => {
    const service = new GoogleAuthService({} as any, {} as any)
    jest.spyOn(service as any, 'createOAuthClient').mockResolvedValue({
      client: {
        getToken: jest.fn().mockResolvedValue({ tokens: { id_token: 'id-token' } }),
        verifyIdToken: jest.fn().mockResolvedValue({
          getPayload: () => ({
            sub: 'google-1',
            email: 'admin@example.com',
            email_verified: false,
          }),
        }),
      },
      config: {
        clientId: 'google-client-id',
        allowedDomain: null,
      },
    })

    await expect((service as any).resolveGoogleUserFromCode('popup-code', 'popup')).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('rejects Google users outside the allowed domain', async () => {
    const service = new GoogleAuthService({} as any, {} as any)
    jest.spyOn(service as any, 'createOAuthClient').mockResolvedValue({
      client: {
        getToken: jest.fn().mockResolvedValue({ tokens: { id_token: 'id-token' } }),
        verifyIdToken: jest.fn().mockResolvedValue({
          getPayload: () => ({
            sub: 'google-1',
            email: 'admin@other.test',
            email_verified: true,
            hd: 'other.test',
          }),
        }),
      },
      config: {
        clientId: 'google-client-id',
        allowedDomain: 'example.com',
      },
    })

    await expect((service as any).resolveGoogleUserFromCode('popup-code', 'popup')).rejects.toBeInstanceOf(UnauthorizedException)
  })
})
