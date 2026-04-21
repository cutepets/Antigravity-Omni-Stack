import { ArrayNotEmpty, IsArray, IsIn, IsString, MinLength } from 'class-validator'

export const APP_BACKUP_EXTENSION = '.appbak'
export const APP_BACKUP_MIME_TYPE = 'application/octet-stream'
export const APP_BACKUP_FORMAT_NAME = 'App Backup Format'
export const APP_BACKUP_FORMAT_VERSION = 1

export const BACKUP_DESTINATIONS = ['download', 'google_drive'] as const
export const RESTORE_STRATEGIES = ['replace_selected'] as const

export type BackupDestination = (typeof BACKUP_DESTINATIONS)[number]
export type RestoreStrategy = (typeof RESTORE_STRATEGIES)[number]

export type BackupModuleId =
  | 'core.settings'
  | 'finance.configuration'
  | 'core.organization'
  | 'crm.contacts'
  | 'catalog.items'
  | 'inventory.stock'
  | 'operations.commerce'
  | 'hr.workforce'
  | 'assets.equipment'

export class CreateBackupDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  modules!: string[]

  @IsString()
  @IsIn(BACKUP_DESTINATIONS)
  destination!: BackupDestination

  @IsString()
  @MinLength(8)
  password!: string
}

export class InspectBackupDto {
  @IsString()
  @MinLength(8)
  password!: string
}

export class RestoreBackupDto {
  @IsString()
  @MinLength(8)
  password!: string

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  modules!: string[]

  @IsString()
  @IsIn(RESTORE_STRATEGIES)
  strategy!: RestoreStrategy
}

export interface BackupManifestModule {
  moduleId: string
  label: string
  moduleVersion: number
  dependencies: string[]
  recordCounts: Record<string, number>
}

export interface BackupManifest {
  appId: string
  appVersion: string
  formatName: string
  formatVersion: number
  createdAt: string
  createdBy: string | null
  schemaFingerprint: string
  selectedModules: string[]
  excludedBinaryContent: true
  keepsFileRefs: true
  containsSecrets: boolean
  modules: BackupManifestModule[]
}

export interface BackupArchiveModulePayload {
  moduleId: string
  moduleVersion: number
  datasets: Record<string, unknown[]>
}

export interface BackupArchivePayload {
  manifest: BackupManifest
  modules: Record<string, BackupArchiveModulePayload>
}

export interface BackupCatalogEntry {
  moduleId: string
  label: string
  moduleVersion: number
  dependencies: string[]
  requiredBy: string[]
  keepsFileRefs: boolean
  supportedImportVersions: number[]
}

export interface BackupInspectModuleResult extends BackupCatalogEntry {
  fileModuleVersion: number
  recordCounts: Record<string, number>
  compatible: boolean
  compatibilityReason: string | null
}
