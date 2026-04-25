import type { NextConfig } from 'next'
import { join } from 'path'

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: join(__dirname, '../..'),
  transpilePackages: ['@petshop/shared', '@petshop/auth', '@petshop/config'],
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: '127.0.0.1' },
      { protocol: 'https', hostname: '**' },
    ],
  },
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
