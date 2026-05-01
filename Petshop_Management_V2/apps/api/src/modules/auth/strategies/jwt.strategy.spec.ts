import { UnauthorizedException } from '@nestjs/common'
import { JwtStrategy } from './jwt.strategy'

describe('JwtStrategy', () => {
  const previousSecret = process.env['JWT_SECRET']
  const makeDb = (user?: any) => ({
    user: {
      findUnique: jest.fn().mockResolvedValue(user ?? {
        id: 'user-1',
        role: { code: 'STAFF', permissions: ['dashboard.read'] },
        branchId: 'branch-1',
        authorizedBranches: [{ id: 'branch-2' }],
      }),
    },
  } as any)

  beforeAll(() => {
    process.env['JWT_SECRET'] = 'test-secret'
  })

  afterAll(() => {
    if (previousSecret === undefined) {
      delete process.env['JWT_SECRET']
      return
    }

    process.env['JWT_SECRET'] = previousSecret
  })

  it('extracts the access token from cookies', () => {
    const strategy = new JwtStrategy(makeDb())
    const extractor = (strategy as unknown as { _jwtFromRequest: (req: unknown) => string | null })._jwtFromRequest

    const token = extractor({
      headers: {
        cookie: 'petshop_auth=1; access_token=cookie-access-token; refresh_token=refresh-token',
      },
    })

    expect(token).toBe('cookie-access-token')
  })

  it('falls back to bearer auth before cookies', () => {
    const strategy = new JwtStrategy(makeDb())
    const extractor = (strategy as unknown as { _jwtFromRequest: (req: unknown) => string | null })._jwtFromRequest

    const token = extractor({
      headers: {
        authorization: 'Bearer bearer-access-token',
        cookie: 'access_token=cookie-access-token',
      },
    })

    expect(token).toBe('bearer-access-token')
  })

  it('rejects payloads without userId', async () => {
    const strategy = new JwtStrategy(makeDb())

    await expect(strategy.validate({ userId: '' } as any)).rejects.toThrow(UnauthorizedException)
  })

  it('hydrates role permissions from the database instead of trusting token permissions', async () => {
    const db = makeDb({
      id: 'user-1',
      role: { code: 'QLCH', permissions: ['dashboard.read', 'stock_receipt.read'] },
      branchId: 'branch-1',
      authorizedBranches: [{ id: 'branch-2' }],
    })
    const strategy = new JwtStrategy(db)

    const result = await strategy.validate({
      userId: 'user-1',
      role: 'STALE',
      permissions: ['too.large'],
      branchId: null,
      authorizedBranchIds: [],
    } as any)

    expect(db.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: {
        id: true,
        branchId: true,
        authorizedBranches: { select: { id: true } },
        role: { select: { code: true, permissions: true } },
      },
    })
    expect(result).toEqual(expect.objectContaining({
      userId: 'user-1',
      role: 'QLCH',
      permissions: ['dashboard.read', 'stock_receipt.read'],
      branchId: 'branch-1',
      authorizedBranchIds: ['branch-1', 'branch-2'],
    }))
  })
})
