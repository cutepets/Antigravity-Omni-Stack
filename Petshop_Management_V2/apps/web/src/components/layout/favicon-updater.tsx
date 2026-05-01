'use client'

import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, SKIP_AUTH_REDIRECT_HEADER } from '@/lib/api'

/**
 * Dynamically updates the browser tab favicon to match the shop logo
 * configured in Settings → General. Falls back to /favicon.svg.
 */
export function FaviconUpdater() {
    const { data: config } = useQuery({
        queryKey: ['settings', 'configs'],
        queryFn: async () => {
            try {
                const res = await api.get('/settings/configs', {
                    headers: { [SKIP_AUTH_REDIRECT_HEADER]: 'true' },
                })
                return res.data?.data || null
            } catch {
                return null
            }
        },
        staleTime: 30 * 60 * 1000,
        gcTime: 60 * 60 * 1000,
    })

    useEffect(() => {
        const logoUrl = config?.shopLogo
        if (!logoUrl) return

        // Remove ALL existing favicon links so the dynamic one always wins
        document.querySelectorAll("link[rel='icon'], link[rel='shortcut icon']")
            .forEach((el) => el.remove())

        // Create a fresh favicon link pointing to the shop logo
        const link = document.createElement('link')
        link.rel = 'icon'
        link.href = logoUrl
        document.head.appendChild(link)
    }, [config?.shopLogo])

    return null
}

