import type { NextConfig } from 'next'
import { join } from 'path'

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: join(__dirname, '../..'),
  transpilePackages: ['@petshop/shared', '@petshop/auth', '@petshop/config'],
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  async rewrites() {
    const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'
    return [
      {
        source: '/uploads/:path*',
        destination: `${apiUrl}/uploads/:path*` // proxy to API server
      }
    ]
  }
}

export default nextConfig
