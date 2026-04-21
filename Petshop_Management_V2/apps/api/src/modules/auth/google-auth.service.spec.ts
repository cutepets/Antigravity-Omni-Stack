import { UnauthorizedException } from '@nestjs/common'
import { GoogleAuthService } from './google-auth.service'

describe('GoogleAuthService', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('links a single matching email and creates a session', async () => {
    const db = {
      systemConfig: {
        findFirst: jest.fn(),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([{ id: 'user-1', googleId: null }]),
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
        googleId: 'google-1',
        googleEmail: 'admin@example.com',
        googleAvatar: 'https://avatar.test/a.png',
      },
    })
    expect(authService.createSessionForUserId).toHaveBeenCalledWith('user-1')
    expect(result.accessToken).toBe('a')
  })

  it('rejects when the Google email matches multiple users', async () => {
    const db = {
      systemConfig: {
        findFirst: jest.fn(),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([{ id: 'user-1' }, { id: 'user-2' }]),
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
})
