import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { DatabaseService } from '../../database/database.service.js'

export const MODULE_KEY = 'module_key'

/** In-memory TTL cache entry */
interface CacheEntry {
    isActive: boolean
    isCore: boolean
    expiresAt: number
}

const CACHE_TTL_MS = 30_000 // 30 seconds

@Injectable()
export class ModuleGuard implements CanActivate {
    private readonly cache = new Map<string, CacheEntry>()

    constructor(
        private readonly reflector: Reflector,
        private readonly db: DatabaseService,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const moduleKey = this.reflector.getAllAndOverride<string | undefined>(MODULE_KEY, [
            context.getHandler(),
            context.getClass(),
        ])

        if (!moduleKey) return true

        const cached = this.cache.get(moduleKey)
        if (cached && cached.expiresAt > Date.now()) {
            return this.checkActive(moduleKey, cached.isActive, cached.isCore)
        }

        // Cache miss — query DB
        const db = this.db as any
        const module = await db.moduleConfig.findUnique({
            where: { key: moduleKey },
            select: { isActive: true, isCore: true },
        })

        if (!module) return true // Không có trong DB → cho phép (fallback safe)

        // Store in cache
        this.cache.set(moduleKey, {
            isActive: module.isActive,
            isCore: module.isCore,
            expiresAt: Date.now() + CACHE_TTL_MS,
        })

        return this.checkActive(moduleKey, module.isActive, module.isCore)
    }

    private checkActive(moduleKey: string, isActive: boolean, isCore: boolean): boolean {
        if (isCore) return true
        if (!isActive) {
            throw new ForbiddenException(`Module "${moduleKey}" chưa được kích hoạt trên hệ thống này`)
        }
        return true
    }

    /** Invalidate cache for a specific module (call after toggle). */
    invalidate(moduleKey: string): void {
        this.cache.delete(moduleKey)
    }

    /** Invalidate all cached entries (e.g., on system reset). */
    invalidateAll(): void {
        this.cache.clear()
    }
}
