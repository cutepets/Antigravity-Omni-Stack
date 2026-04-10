import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/login', '/forgot-password']

export function middleware(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl
    const token = request.cookies.get('access_token')?.value

    const isPublic = PUBLIC_ROUTES.some((route) => pathname.startsWith(route))

    // Redirect unauthenticated users to login
    if (!isPublic && !token) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // Redirect authenticated users away from login page
    if (isPublic && token) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    return NextResponse.next()
  } catch (error) {
    // If we fail parsing cookies or URLs due to edge cases, gracefully allow next()
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/|mockServiceWorker.js).*)',
  ],
}
