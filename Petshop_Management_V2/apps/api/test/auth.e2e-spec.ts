import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import type { Request } from 'express'
import type { JwtPayload, LoginResponse } from '@petshop/shared'
import { AuthController } from '../src/modules/auth/auth.controller'
import { AuthService } from '../src/modules/auth/auth.service'
import { GoogleAuthService } from '../src/modules/auth/google-auth.service'
import { JwtGuard } from '../src/modules/auth/guards/jwt.guard'

const authUser = {
  id: 'user-1',
  username: 'admin',
  fullName: 'Admin',
  role: 'ADMIN' as const,
  permissions: ['orders.read'],
  staffCode: 'NV001',
  branchId: 'branch-1',
  avatar: null,
  authorizedBranches: [{ id: 'branch-1', name: 'Main', address: null, isActive: true }],
  googleLinked: false,
  googleEmail: null,
}

const authResponse: LoginResponse = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  user: authUser,
}

function getSetCookies(response: request.Response): string[] {
  const header = response.headers['set-cookie']
  if (!header) return []
  return Array.isArray(header) ? header : [header]
}

class MockJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>()
    req.user = {
      userId: 'user-1',
      role: 'ADMIN',
      permissions: ['orders.read'],
      branchId: 'branch-1',
      authorizedBranchIds: ['branch-1'],
      iat: 0,
      exp: 0,
    }
    return true
  }
}

describe('AuthController (e2e)', () => {
  let app: INestApplication
  const authService = {
    login: jest.fn().mockResolvedValue(authResponse),
    createSessionForUserId: jest.fn().mockResolvedValue(authResponse),
    refreshTokens: jest.fn().mockResolvedValue({
      ...authResponse,
      accessToken: 'refreshed-access-token',
      refreshToken: 'refreshed-refresh-token',
    }),
    logout: jest.fn().mockResolvedValue(undefined),
    getMe: jest.fn().mockResolvedValue(authUser),
  }
  const googleAuthService = {
    getPublicConfig: jest.fn().mockResolvedValue({
      enabled: true,
      configured: true,
      allowedDomain: 'example.com',
      apiBaseUrl: 'http://localhost:3001',
      webAppBaseUrl: 'http://localhost:3000',
      callbackUrl: 'http://localhost:3001/api/auth/google/callback',
    }),
    createAuthorizationUrl: jest.fn().mockResolvedValue('https://accounts.google.com/o/oauth2/v2/auth'),
    loginWithAuthorizationCode: jest.fn().mockResolvedValue(authResponse),
    linkUserWithAuthorizationCode: jest.fn().mockResolvedValue({
      id: 'user-1',
      googleId: 'google-1',
      googleEmail: 'admin@example.com',
      googleAvatar: 'https://avatar.test/a.png',
    }),
    getWebAppBaseUrl: jest.fn().mockReturnValue('http://localhost:3000'),
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
        {
          provide: GoogleAuthService,
          useValue: googleAuthService,
        },
      ],
    })
      .overrideGuard(JwtGuard)
      .useClass(MockJwtGuard)
      .compile()

    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterEach(() => {
    jest.clearAllMocks()
    authService.login.mockResolvedValue(authResponse)
    authService.createSessionForUserId.mockResolvedValue(authResponse)
    authService.refreshTokens.mockResolvedValue({
      ...authResponse,
      accessToken: 'refreshed-access-token',
      refreshToken: 'refreshed-refresh-token',
    })
    authService.logout.mockResolvedValue(undefined)
    authService.getMe.mockResolvedValue(authUser)
    googleAuthService.getPublicConfig.mockResolvedValue({
      enabled: true,
      configured: true,
      allowedDomain: 'example.com',
      apiBaseUrl: 'http://localhost:3001',
      webAppBaseUrl: 'http://localhost:3000',
      callbackUrl: 'http://localhost:3001/api/auth/google/callback',
    })
    googleAuthService.createAuthorizationUrl.mockResolvedValue('https://accounts.google.com/o/oauth2/v2/auth')
    googleAuthService.loginWithAuthorizationCode.mockResolvedValue(authResponse)
    googleAuthService.linkUserWithAuthorizationCode.mockResolvedValue({
      id: 'user-1',
      googleId: 'google-1',
      googleEmail: 'admin@example.com',
      googleAvatar: 'https://avatar.test/a.png',
    })
    googleAuthService.getWebAppBaseUrl.mockReturnValue('http://localhost:3000')
  })

  afterAll(async () => {
    await app.close()
  })

  it('sets auth cookies on login', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'admin', password: 'secret' })
      .expect(200)

    expect(authService.login).toHaveBeenCalledWith({ username: 'admin', password: 'secret' })
    const cookies = getSetCookies(response)
    expect(cookies).toEqual(
      expect.arrayContaining([
        expect.stringContaining('access_token=access-token'),
        expect.stringContaining('refresh_token=refresh-token'),
        expect.stringContaining('petshop_auth=1'),
      ]),
    )
  })

  it('refreshes from cookie when body token is missing', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', ['refresh_token=cookie-refresh-token'])
      .send({})
      .expect(200)

    expect(authService.refreshTokens).toHaveBeenCalledWith('cookie-refresh-token')
    const cookies = getSetCookies(response)
    expect(cookies).toEqual(
      expect.arrayContaining([
        expect.stringContaining('access_token=refreshed-access-token'),
        expect.stringContaining('refresh_token=refreshed-refresh-token'),
        expect.stringContaining('petshop_auth=1'),
      ]),
    )
  })

  it('clears cookies on logout and prefers cookie refresh token fallback', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', ['refresh_token=cookie-refresh-token', 'access_token=access-token'])
      .send({})
      .expect(200)

    expect(authService.logout).toHaveBeenCalledWith('user-1', 'cookie-refresh-token')
    const cookies = getSetCookies(response)
    expect(cookies).toEqual(
      expect.arrayContaining([
        expect.stringContaining('access_token=;'),
        expect.stringContaining('refresh_token=;'),
        expect.stringContaining('petshop_auth=;'),
      ]),
    )
  })

  it('returns the authenticated user for /auth/me', async () => {
    const response = await request(app.getHttpServer()).get('/auth/me').expect(200)

    expect(authService.getMe).toHaveBeenCalledWith('user-1')
    expect(response.body).toEqual(authUser)
  })

  it('returns public google auth status for the login page', async () => {
    const response = await request(app.getHttpServer()).get('/auth/google/status').expect(200)

    expect(googleAuthService.getPublicConfig).toHaveBeenCalled()
    expect(response.body).toEqual({
      success: true,
      data: {
        enabled: true,
        configured: true,
        allowedDomain: 'example.com',
        apiBaseUrl: 'http://localhost:3001',
        webAppBaseUrl: 'http://localhost:3000',
        callbackUrl: 'http://localhost:3001/api/auth/google/callback',
      },
    })
  })

  it('starts google login by setting state cookie and redirecting to Google', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/google?redirect=%2Fequipment')
      .expect(302)

    expect(googleAuthService.createAuthorizationUrl).toHaveBeenCalled()
    expect(response.headers.location).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    const cookies = getSetCookies(response)
    expect(cookies).toEqual(
      expect.arrayContaining([
        expect.stringContaining('petshop_google_state='),
      ]),
    )
  })

  it('starts google link by setting state cookie and redirecting to Google', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/google/link?redirect=%2Fdashboard')
      .set('Cookie', ['access_token=access-token'])
      .expect(302)

    expect(googleAuthService.createAuthorizationUrl).toHaveBeenCalled()
    expect(response.headers.location).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    const cookies = getSetCookies(response)
    expect(cookies).toEqual(
      expect.arrayContaining([
        expect.stringContaining('petshop_google_state='),
      ]),
    )
  })

  it('links Google for the authenticated user and redirects back to the app', async () => {
    const startResponse = await request(app.getHttpServer())
      .get('/auth/google/link?redirect=%2Fdashboard')
      .set('Cookie', ['access_token=access-token'])
      .expect(302)

    const state = googleAuthService.createAuthorizationUrl.mock.calls.at(-1)?.[0]
    const stateCookie = getSetCookies(startResponse).find((cookie) => cookie.startsWith('petshop_google_state='))

    expect(state).toBeTruthy()
    expect(stateCookie).toBeTruthy()

    const callbackResponse = await request(app.getHttpServer())
      .get(`/auth/google/link/callback?code=google-code&state=${encodeURIComponent(String(state))}`)
      .set('Cookie', [String(stateCookie), 'access_token=access-token'])
      .expect(302)

    expect(googleAuthService.linkUserWithAuthorizationCode).toHaveBeenCalledWith('user-1', 'google-code')
    expect(callbackResponse.headers.location).toBe('http://localhost:3000/dashboard?google_link=success')
  })
})
