import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
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
