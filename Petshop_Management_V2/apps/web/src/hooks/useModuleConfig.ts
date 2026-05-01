'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, SKIP_AUTH_REDIRECT_HEADER } from '@/lib/api'

export interface ModuleConfig {
    id: string
    key: string
    displayName: string
    description: string | null
    isActive: boolean
    isCore: boolean
    version: string
    icon: string | null
}

const QUERY_KEY = ['settings', 'modules'] as const

async function fetchModules(): Promise<ModuleConfig[]> {
    try {
        const res = await api.get('/settings/modules', {
            headers: { [SKIP_AUTH_REDIRECT_HEADER]: 'true' },
        })
        return res.data?.data ?? []
    } catch {
        // Fail open: if API is down, don't hide nav
        return []
    }
}

/**
 * Hook: useModuleConfig
 * Fetches module config from the API and exposes isModuleActive() helper.
 * Caches for 1 minute — refetches after toggle mutations.
 *
 * Usage:
 *   const { isModuleActive } = useModuleConfig()
 *   {isModuleActive('pet') && <NavItem href="/pets">Thú cưng</NavItem>}
 */
export function useModuleConfig() {
    const queryClient = useQueryClient()

    const { data: modules = [] } = useQuery({
        queryKey: QUERY_KEY,
        queryFn: fetchModules,
        staleTime: 60 * 1000, // 1 minute
    })

    const toggleMutation = useMutation({
        mutationFn: async ({ key, isActive }: { key: string; isActive: boolean }) => {
            await api.patch(`/settings/modules/${key}`, { isActive })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: QUERY_KEY })
        },
    })

    function isModuleActive(key: string): boolean {
        const mod = modules.find((m) => m.key === key)
        if (!mod) return true // Not in config → allow (fail open)
        if (mod.isCore) return true
        return mod.isActive
    }

    return {
        modules,
        isModuleActive,
        toggle: toggleMutation.mutate,
        isToggling: toggleMutation.isPending,
    }
}
