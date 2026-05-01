import * as bcrypt from 'bcryptjs'
import { createHash } from 'crypto'
import { AuthService } from './auth.service'

describe('AuthService', () => {
  const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')
  const originalEnv = process.env

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      JWT_REFRESH_SECRET: 'test-refresh-secret',
    }
  })

  afterEach(() => {
    process.env = originalEnv
    jest.restoreAllMocks()
  })

  it('stores hashed refresh tokens on login', async () => {
    const db = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'user-1',
          username: 'admin',
          fullName: 'Admin',
          branchId: 'branch-1',
          avatar: null,
          passwordHash: bcrypt.hashSync('secret', 4),
          status: 'WORKING',
          branch: { id: 'branch-1', name: 'Main', address: null, isActive: true },
          authorizedBranches: [],
          role: { code: 'ADMIN', permissions: ['MANAGE_STAFF', 'FULL_BRANCH_ACCESS'] },
        }),
      },
      branch: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'branch-1', name: 'Main', address: null, isActive: true },
        ]),
      },
      refreshToken: {
        create: jest.fn(),
      },
    } as any

    const jwt = {
      sign: jest
        .fn()
        .mockReturnValueOnce('access-token-1')
        .mockReturnValueOnce('refresh-token-1'),
      decode: jest.fn().mockReturnValue({ exp: 1_900_000_000 }),
    } as any

    const service = new AuthService(db, jwt)

    const result = await service.login({ username: 'admin', password: 'secret' })

    expect(db.refreshToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        token: hashToken('refresh-token-1'),
        expiresAt: new Date(1_900_000_000 * 1000),
      }),
    })
    expect(jwt.sign).toHaveBeenNthCalledWith(
      1,
      expect.not.objectContaining({
        permissions: expect.any(Array),
      }),
    )
    expect(result.refreshToken).toBe('refresh-token-1')
  })

  it('logs in with a staff phone number through the username field', async () => {
    const db = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'user-1',
          username: 'admin',
          fullName: 'Admin',
          branchId: 'branch-1',
          avatar: null,
          passwordHash: bcrypt.hashSync('secret', 4),
          status: 'WORKING',
          branch: { id: 'branch-1', name: 'Main', address: null, isActive: true },
          authorizedBranches: [],
          role: { code: 'STAFF', permissions: [] },
        }),
      },
      refreshToken: {
        create: jest.fn(),
      },
    } as any
    const jwt = {
      sign: jest
        .fn()
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token'),
      decode: jest.fn().mockReturnValue({ exp: 1_900_000_000 }),
    } as any
    const service = new AuthService(db, jwt)

    const result = await service.login({ username: '0901234567', password: 'secret' })

    expect(db.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        OR: [
          { username: '0901234567' },
          { phone: '0901234567' },
        ],
      },
    }))
    expect(result.user.username).toBe('admin')
  })

  it('rejects a phone login when the password is invalid', async () => {
    const db = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'user-1',
          username: 'admin',
          fullName: 'Admin',
          branchId: 'branch-1',
          avatar: null,
          passwordHash: bcrypt.hashSync('secret', 4),
          status: 'WORKING',
          branch: { id: 'branch-1', name: 'Main', address: null, isActive: true },
          authorizedBranches: [],
          role: { code: 'STAFF', permissions: [] },
        }),
      },
      refreshToken: {
        create: jest.fn(),
      },
    } as any
    const service = new AuthService(db, {} as any)

    await expect(service.login({ username: '0901234567', password: 'wrong-password' }))
      .rejects.toThrow('Tên đăng nhập hoặc mật khẩu không đúng')
    expect(db.refreshToken.create).not.toHaveBeenCalled()
  })

  it('runs bootstrap before login so a zero-user database can recreate superadmin', async () => {
    const db = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'root-1',
          username: 'superadmin',
          fullName: 'Super Admin',
          branchId: 'branch-1',
          avatar: null,
          passwordHash: bcrypt.hashSync('secret', 4),
          status: 'WORKING',
          branch: { id: 'branch-1', name: 'Main', address: null, isActive: true },
          authorizedBranches: [],
          role: { code: 'SUPER_ADMIN', permissions: ['FULL_BRANCH_ACCESS'] },
        }),
      },
      branch: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'branch-1', name: 'Main', address: null, isActive: true },
        ]),
      },
      refreshToken: {
        create: jest.fn(),
      },
    } as any
    const jwt = {
      sign: jest
        .fn()
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token'),
      decode: jest.fn().mockReturnValue({ exp: 1_900_000_000 }),
    } as any
    const bootstrap = {
      ensureDefaultSuperAdmin: jest.fn().mockResolvedValue(undefined),
    }
    const service = new AuthService(db, jwt, bootstrap as any)

    await service.login({ username: 'superadmin', password: 'secret' })

    expect(bootstrap.ensureDefaultSuperAdmin).toHaveBeenCalled()
    expect(db.user.findFirst).toHaveBeenCalled()
  })


  it('accepts legacy raw refresh tokens and rotates to hashed storage', async () => {
    const db = {
      refreshToken: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'token-1',
          user: {
            id: 'user-1',
            username: 'admin',
            fullName: 'Admin',
            branchId: 'branch-1',
            avatar: null,
            branch: { id: 'branch-1', name: 'Main', address: null, isActive: true },
            authorizedBranches: [],
            role: { code: 'ADMIN', permissions: ['MANAGE_STAFF', 'FULL_BRANCH_ACCESS'] },
          },
        }),
        deleteMany: jest.fn(),
        create: jest.fn(),
      },
      branch: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'branch-1', name: 'Main', address: null, isActive: true },
        ]),
      },
    } as any

    const jwt = {
      verify: jest.fn().mockReturnValue({
        userId: 'user-1',
        role: 'ADMIN',
        permissions: [],
        branchId: 'branch-1',
        authorizedBranchIds: ['branch-1'],
      }),
      sign: jest
        .fn()
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token'),
      decode: jest.fn().mockReturnValue({ exp: 1_900_000_000 }),
    } as any

    const service = new AuthService(db, jwt)

    const result = await service.refreshTokens('legacy-raw-refresh-token')

    expect(db.refreshToken.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          token: {
            in: ['legacy-raw-refresh-token', hashToken('legacy-raw-refresh-token')],
          },
        }),
      }),
    )
    expect(db.refreshToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        token: hashToken('new-refresh-token'),
        expiresAt: new Date(1_900_000_000 * 1000),
      }),
    })
    expect(jwt.sign).toHaveBeenNthCalledWith(
      1,
      expect.not.objectContaining({
        permissions: expect.any(Array),
      }),
    )
    expect(result.refreshToken).toBe('new-refresh-token')
  })

  it('deletes raw and hashed token candidates on logout', async () => {
    const db = {
      refreshToken: {
        deleteMany: jest.fn(),
      },
    } as any

    const service = new AuthService(db, {} as any)

    await service.logout('user-1', 'raw-refresh-token')

    expect(db.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        token: {
          in: ['raw-refresh-token', hashToken('raw-refresh-token')],
        },
      },
    })
  })

  it('returns google link status in getMe', async () => {
    const db = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          username: 'admin',
          fullName: 'Admin',
          branchId: 'branch-1',
          avatar: null,
          googleId: 'google-1',
          googleEmail: 'admin@example.com',
          branch: { id: 'branch-1', name: 'Main', address: null, isActive: true },
          authorizedBranches: [],
          role: { code: 'ADMIN', permissions: ['MANAGE_STAFF'] },
        }),
      },
    } as any

    const service = new AuthService(db, {} as any)

    const result = await service.getMe('user-1')

    expect(result).toEqual(expect.objectContaining({
      id: 'user-1',
      username: 'admin',
      fullName: 'Admin',
      role: 'ADMIN',
      branchId: 'branch-1',
      avatar: null,
      authorizedBranches: [{ id: 'branch-1', name: 'Main', address: null, isActive: true }],
      googleLinked: true,
      googleEmail: 'admin@example.com',
    }))
  })
})
