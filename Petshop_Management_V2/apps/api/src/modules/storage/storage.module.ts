import { Module } from '@nestjs/common'
import { DatabaseModule } from '../../database/database.module.js'
import { StorageController } from './storage.controller.js'
import { GoogleDriveStorageProvider } from './google-drive-storage.provider.js'
import { StorageCleanupService } from './storage-cleanup.service.js'
import { StorageService } from './storage.service.js'

@Module({
  imports: [DatabaseModule],
  controllers: [StorageController],
  providers: [GoogleDriveStorageProvider, StorageService, StorageCleanupService],
  exports: [StorageService],
})
export class StorageModule {}
