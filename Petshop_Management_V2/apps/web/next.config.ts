import type { NextConfig } from 'next'
import { join } from 'path'

const nextConfig: NextConfig = {
  outputFileTracingRoot: join(__dirname, '../..'),
  transpilePackages: ['@petshop/shared', '@petshop/auth', '@petshop/config'],
  async rewrites() {
    return [
      {
        source: '/uploads/:path*',
        destination: 'http://localhost:3001/uploads/:path*' // proxy to API server
      }
    ]
  }
}

export default nextConfig
