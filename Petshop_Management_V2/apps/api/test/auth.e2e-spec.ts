import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import type { Request } from 'express'
import type { JwtPayload, LoginResponse } from '@petshop/shared'
import { AuthController } from '../src/modules/auth/auth.controller'
import { AuthService } from '../src/modules/auth/auth.service'
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
    refreshTokens: jest.fn().mockResolvedValue({
      ...authResponse,
      accessToken: 'refreshed-access-token',
      refreshToken: 'refreshed-refresh-token',
    }),
    logout: jest.fn().mockResolvedValue(undefined),
    getMe: jest.fn().mockResolvedValue(authUser),
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
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
    authService.refreshTokens.mockResolvedValue({
      ...authResponse,
      accessToken: 'refreshed-access-token',
      refreshToken: 'refreshed-refresh-token',
    })
    authService.logout.mockResolvedValue(undefined)
    authService.getMe.mockResolvedValue(authUser)
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
})
