export const AUTH_SESSION_COOKIE = 'petshop_auth'

export function setAuthSessionCookie() {
  if (typeof document === 'undefined') return
  document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax'
  document.cookie = `${AUTH_SESSION_COOKIE}=1; path=/; max-age=604800; SameSite=Lax`
}

export function clearAuthSessionCookie() {
  if (typeof document === 'undefined') return
  document.cookie = `${AUTH_SESSION_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`
  document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax'
}
