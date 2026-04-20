import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { AUTH_SESSION_COOKIE } from '@/lib/auth-session-cookie'

const PUBLIC_ROUTES = ['/login', '/forgot-password']

export function middleware(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl
    const hasSessionCookie = request.cookies.get(AUTH_SESSION_COOKIE)?.value === '1'

    const isPublic = PUBLIC_ROUTES.some((route) => pathname.startsWith(route))

    // Redirect unauthenticated users to login
    if (!isPublic && !hasSessionCookie) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // Redirect authenticated users away from login page
    if (isPublic && hasSessionCookie) {
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
