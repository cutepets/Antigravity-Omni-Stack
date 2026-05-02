const FALLBACK_SHOP_NAME = 'PetShop'

export type LoginBranding = {
  shopName: string
  shopLogo: string | null
}

type PublicBrandingResponse = {
  success?: boolean
  data?: {
    shopName?: string | null
    shopLogo?: string | null
  } | null
} | null

export function normalizeLoginBranding(payload: PublicBrandingResponse): LoginBranding {
  const shopName = payload?.data?.shopName?.trim() || FALLBACK_SHOP_NAME
  const shopLogo = payload?.data?.shopLogo?.trim() || null

  return { shopName, shopLogo }
}

export async function getPublicLoginBranding(): Promise<LoginBranding> {
  const apiUrl = process.env['NEXT_PUBLIC_API_URL']?.replace(/\/+$/, '')
  if (!apiUrl) return normalizeLoginBranding(null)

  try {
    const response = await fetch(`${apiUrl}/api/public/branding`, {
      next: { revalidate: 300 },
    })
    if (!response.ok) return normalizeLoginBranding(null)

    return normalizeLoginBranding((await response.json()) as PublicBrandingResponse)
  } catch {
    return normalizeLoginBranding(null)
  }
}
