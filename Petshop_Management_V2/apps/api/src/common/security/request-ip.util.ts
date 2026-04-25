type RequestLike = {
  ip?: string
  headers?: Record<string, string | string[] | undefined>
}

function firstHeaderValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

function firstForwardedIp(value: string) {
  return value
    .split(',')
    .map((part) => part.trim())
    .find(Boolean) ?? ''
}

export function getClientIp(req: RequestLike) {
  const headers = req.headers ?? {}
  const cloudflareIp = firstHeaderValue(headers['cf-connecting-ip'] ?? headers['CF-Connecting-IP']).trim()
  if (cloudflareIp) return cloudflareIp

  const forwardedFor = firstForwardedIp(firstHeaderValue(headers['x-forwarded-for'] ?? headers['X-Forwarded-For']))
  if (forwardedFor) return forwardedFor

  return String(req.ip ?? '').trim()
}
