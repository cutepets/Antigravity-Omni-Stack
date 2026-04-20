import { UnauthorizedException } from '@nestjs/common'
import { JwtStrategy } from './jwt.strategy'

describe('JwtStrategy', () => {
  const previousSecret = process.env['JWT_SECRET']

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
    const strategy = new JwtStrategy()
    const extractor = (strategy as unknown as { _jwtFromRequest: (req: unknown) => string | null })._jwtFromRequest

    const token = extractor({
      headers: {
        cookie: 'petshop_auth=1; access_token=cookie-access-token; refresh_token=refresh-token',
      },
    })

    expect(token).toBe('cookie-access-token')
  })

  it('falls back to bearer auth before cookies', () => {
    const strategy = new JwtStrategy()
    const extractor = (strategy as unknown as { _jwtFromRequest: (req: unknown) => string | null })._jwtFromRequest

    const token = extractor({
      headers: {
        authorization: 'Bearer bearer-access-token',
        cookie: 'access_token=cookie-access-token',
      },
    })

    expect(token).toBe('bearer-access-token')
  })

  it('rejects payloads without userId', () => {
    const strategy = new JwtStrategy()

    expect(() => strategy.validate({ userId: '' } as any)).toThrow(UnauthorizedException)
  })
})
