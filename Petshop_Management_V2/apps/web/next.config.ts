import type { NextConfig } from 'next'
import { join } from 'path'

const output: NextConfig['output'] =
  process.platform === 'win32' && process.env['NEXT_STANDALONE'] !== '1'
    ? undefined
    : 'standalone'

const nextConfig: NextConfig = {
  output,
  outputFileTracingRoot: join(__dirname, '../..'),
  transpilePackages: ['@petshop/shared', '@petshop/auth', '@petshop/config', '@petshop/ui'],
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: '127.0.0.1' },
      { protocol: 'https', hostname: '**' },
    ],
  },
  async rewrites() {
    const apiUrl = (
      process.env['INTERNAL_API_URL'] ||
      process.env['NEXT_PUBLIC_API_URL'] ||
      'http://localhost:3001'
    ).replace(/\/+$/, '')
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${apiUrl}/uploads/:path*` // proxy to API server
      }
    ]
  }
}

export default nextConfig
