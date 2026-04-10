import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { DatabaseService } from '../../database/database.service.js'

/**
 * Cleans up expired RefreshTokens every 24 hours.
 * Uses native setInterval — no extra dependency needed.
 */
@Injectable()
export class TokenCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TokenCleanupService.name)
  private intervalRef: NodeJS.Timeout | null = null

  // Run every 24 hours
  private readonly INTERVAL_MS = 24 * 60 * 60 * 1000

  constructor(private readonly db: DatabaseService) {}

  onModuleInit() {
    // Run once on startup, then every 24h
    void this.cleanExpiredTokens()
    this.intervalRef = setInterval(() => {
      void this.cleanExpiredTokens()
    }, this.INTERVAL_MS)
  }

  onModuleDestroy() {
    if (this.intervalRef) {
      clearInterval(this.intervalRef)
      this.intervalRef = null
    }
  }

  async cleanExpiredTokens(): Promise<void> {
    try {
      const result = await this.db.refreshToken.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      })

      if (result.count > 0) {
        this.logger.log(`🧹 Cleaned up ${result.count} expired refresh token(s)`)
      }
    } catch (err) {
      this.logger.error('Failed to clean up expired refresh tokens', err)
    }
  }
}
