import { getClientIp } from './request-ip.util'

describe('getClientIp', () => {
  it('prefers Cloudflare connecting IP', () => {
    expect(getClientIp({
      ip: '10.0.0.1',
      headers: {
        'cf-connecting-ip': '203.0.113.10',
        'x-forwarded-for': '203.0.113.11, 10.0.0.1',
      },
    })).toBe('203.0.113.10')
  })

  it('falls back to the first forwarded IP', () => {
    expect(getClientIp({
      ip: '10.0.0.1',
      headers: {
        'x-forwarded-for': '203.0.113.11, 10.0.0.1',
      },
    })).toBe('203.0.113.11')
  })

  it('uses Express IP when proxy headers are absent', () => {
    expect(getClientIp({
      ip: '198.51.100.2',
      headers: {},
    })).toBe('198.51.100.2')
  })
})
