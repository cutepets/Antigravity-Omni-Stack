export const AUTH_SESSION_COOKIE = 'petshop_auth'

function getCookieAttributes() {
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : ''
  return `path=/; SameSite=Lax${secure}`
}

export function setAuthSessionCookie() {
  if (typeof document === 'undefined') return
  document.cookie = `${AUTH_SESSION_COOKIE}=1; ${getCookieAttributes()}; max-age=604800`
}

export function clearAuthSessionCookie() {
  if (typeof document === 'undefined') return
  document.cookie = `${AUTH_SESSION_COOKIE}=; ${getCookieAttributes()}; expires=Thu, 01 Jan 1970 00:00:00 GMT`
}
