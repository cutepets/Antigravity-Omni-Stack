import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { StorageService } from './storage.service.js'

const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000

@Injectable()
export class StorageCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StorageCleanupService.name)
  private timer: NodeJS.Timeout | null = null

  constructor(private readonly storageService: StorageService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      this.runCleanup().catch((error) => {
        this.logger.warn(`Storage cleanup failed: ${error?.message ?? String(error)}`)
      })
    }, CLEANUP_INTERVAL_MS)
    this.timer.unref?.()
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  async runCleanup() {
    const result = await this.storageService.cleanupOrphanedAssets({ retentionDays: 30 })
    if (result.scanned > 0 || result.errors.length > 0) {
      this.logger.log(`Storage cleanup scanned=${result.scanned} deleted=${result.deleted} errors=${result.errors.length}`)
    }
    return result
  }
}
