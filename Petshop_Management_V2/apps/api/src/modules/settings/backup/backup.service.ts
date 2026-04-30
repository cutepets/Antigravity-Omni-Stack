import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common'
import { StorageProviderKind } from '@prisma/client'
import { createHash } from 'crypto'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import * as bcrypt from 'bcryptjs'
import { DatabaseService } from '../../../database/database.service.js'
import { StorageService } from '../../storage/storage.service.js'
import { decodeBackupArchive, encodeBackupArchive } from './backup.format.js'
import {
  getBackupCatalogEntries,
  getBackupModuleDefinition,
  getBackupModuleRegistry,
  getReverseDependencies,
} from './backup.registry.js'
import type {
  BackupArchivePayload,
  BackupCatalogEntry,
  BackupInspectModuleResult,
  BackupManifest,
  BackupManifestModule,
  CreateBackupDto,
} from './backup.types.js'
import {
  APP_BACKUP_EXTENSION,
  APP_BACKUP_FORMAT_NAME,
  APP_BACKUP_FORMAT_VERSION,
  APP_BACKUP_MIME_TYPE,
} from './backup.types.js'

type AppMetadata = {
  appId: string
  appVersion: string
}

@Injectable()
export class BackupService {
  constructor(
    private readonly db: DatabaseService,
    private readonly storageService: StorageService,
  ) { }

  getCatalog() {
    return {
      success: true,
      data: getBackupCatalogEntries(),
    }
  }

  async exportBackup(dto: CreateBackupDto, createdBy: string | null) {
    const requestedModules = this.validateRequestedModules(dto.modules)
    const resolvedModules = this.expandDependencies(requestedModules)
    const manifestModules: BackupManifestModule[] = []
    const modules: BackupArchivePayload['modules'] = {}
    let containsSecrets = false

    for (const moduleId of resolvedModules) {
      const definition = this.requireDefinition(moduleId)
      const exported = await definition.export(this.db as any)

      modules[moduleId] = {
        moduleId,
        moduleVersion: definition.moduleVersion,
        datasets: exported.datasets,
      }

      manifestModules.push({
        moduleId,
        label: definition.label,
        moduleVersion: definition.moduleVersion,
        dependencies: [...definition.dependencies],
        recordCounts: exported.recordCounts,
      })
      containsSecrets = containsSecrets || exported.containsSecrets
    }

    const manifest: BackupManifest = {
      appId: this.getAppMetadata().appId,
      appVersion: this.getAppMetadata().appVersion,
      formatName: APP_BACKUP_FORMAT_NAME,
      formatVersion: APP_BACKUP_FORMAT_VERSION,
      createdAt: new Date().toISOString(),
      createdBy,
      schemaFingerprint: this.readSchemaFingerprint(),
      selectedModules: resolvedModules,
      excludedBinaryContent: true,
      keepsFileRefs: true,
      containsSecrets,
      modules: manifestModules,
    }

    const archive = encodeBackupArchive(
      {
        manifest,
        modules,
      },
      dto.password,
    )

    const fileName = this.buildBackupFileName()

    if (dto.destination === 'google_drive') {
      const asset = await this.storageService.uploadAsset({
        category: 'backup',
        scope: 'backups',
        fieldName: 'backup',
        displayName: fileName,
        providerOverride: StorageProviderKind.GOOGLE_DRIVE,
        uploadedById: createdBy,
        file: {
          originalName: fileName,
          mimeType: APP_BACKUP_MIME_TYPE,
          size: archive.length,
          buffer: archive,
        },
      })

      return {
        kind: 'google_drive' as const,
        data: {
          fileName,
          size: archive.length,
          asset,
          manifest,
        },
      }
    }

    return {
      kind: 'download' as const,
      fileName,
      buffer: archive,
      manifest,
    }
  }

  inspectBackup(fileBuffer: Buffer, password: string) {
    const archive = decodeBackupArchive(fileBuffer, password)
    this.assertArchiveShape(archive)

    return {
      success: true,
      data: {
        manifest: archive.manifest,
        modules: this.buildInspectModules(archive.manifest.modules),
        warnings: this.buildWarnings(archive.manifest),
      },
    }
  }

  async restoreBackup(
    fileBuffer: Buffer,
    password: string,
    requestedModules: string[],
    strategy: string,
  ) {
    if (strategy !== 'replace_selected') {
      throw new BadRequestException('Chien luoc restore khong duoc ho tro')
    }

    const archive = decodeBackupArchive(fileBuffer, password)
    this.assertArchiveShape(archive)

    const availableModuleIds = new Set(archive.manifest.modules.map((entry) => entry.moduleId))
    const validatedRequested = this.validateRequestedModules(requestedModules)

    for (const moduleId of validatedRequested) {
      if (!availableModuleIds.has(moduleId)) {
        throw new BadRequestException(`File backup khong chua module ${moduleId}`)
      }
    }

    const resolvedModules = this.expandDependencies(validatedRequested, availableModuleIds)
    const blockers = this.collectRestoreBlockers(resolvedModules)
    if (blockers.length > 0) {
      const blockerMessage = blockers
        .map((item) => `${item.moduleId} -> ${item.blockedBy.join(', ')}`)
        .join('; ')
      throw new BadRequestException(
        `Khong the restore voi tap module hien tai. Can chon them cac module phu thuoc nguoc: ${blockerMessage}`,
      )
    }

    const currentSchemaFingerprint = this.readSchemaFingerprint()
    const schemaMatches = archive.manifest.schemaFingerprint === currentSchemaFingerprint

    const manifestModuleMap = new Map(
      archive.manifest.modules.map((entry) => [entry.moduleId, entry]),
    )

    const incompatibleModules = resolvedModules.filter((moduleId) => {
      const definition = this.requireDefinition(moduleId)
      const manifestModule = manifestModuleMap.get(moduleId)
      return !manifestModule || !definition.supportedImportVersions.includes(manifestModule.moduleVersion)
    })

    if (incompatibleModules.length > 0) {
      throw new BadRequestException(
        `Module khong tuong thich de restore: ${incompatibleModules.join(', ')}`,
      )
    }

    const restoreOrder = this.sortModulesByDependencies(resolvedModules)
    const clearOrder = [...restoreOrder].reverse()

    await this.db.$transaction(async (tx) => {
      for (const moduleId of clearOrder) {
        const definition = this.requireDefinition(moduleId)
        await definition.clearForRestore(tx as any)
      }

      for (const moduleId of restoreOrder) {
        const definition = this.requireDefinition(moduleId)
        const payload = archive.modules[moduleId]
        if (!payload) {
          throw new BadRequestException(`Thieu du lieu cho module ${moduleId}`)
        }

        await definition.restore(tx as any, payload.moduleVersion, payload.datasets)
      }
    })

    return {
      success: true,
      data: {
        strategy: 'replace_selected',
        schemaMatched: schemaMatches,
        restoredModules: restoreOrder,
        warnings: schemaMatches
          ? this.buildWarnings(archive.manifest)
          : [
            ...this.buildWarnings(archive.manifest),
            'Schema fingerprint khac voi app hien tai; du lieu da restore dua tren tuong thich version cua module.',
          ],
      },
    }
  }

  async purgeModules(moduleIds: string[]) {
    const validated = this.validateRequestedModules(moduleIds)

    // Expand REVERSE dependencies: find all modules that depend on selected ones
    const toPurge = new Set<string>(validated)
    const expandReverse = (id: string) => {
      const rdeps = getReverseDependencies(id)
      for (const rdep of rdeps) {
        if (!toPurge.has(rdep)) {
          toPurge.add(rdep)
          expandReverse(rdep)
        }
      }
    }
    for (const id of validated) expandReverse(id)

    // Now expand forward dependencies and get topological order
    const resolvedModules = this.expandDependencies([...toPurge])
    // Reverse = clear dependents first, then their dependencies
    const clearOrder = [...resolvedModules].reverse()

    await this.db.$transaction(async (tx) => {
      for (const moduleId of clearOrder) {
        const definition = this.requireDefinition(moduleId)
        await definition.clearForRestore(tx as any)
      }
    }, { timeout: 60_000 })

    return {
      purgedModules: clearOrder,
    }
  }

  async purgeAllDataWithSuperAdminPassword(userId: string | null, superAdminPassword: string) {
    const password = String(superAdminPassword ?? '')
    if (!userId) {
      throw new ForbiddenException('Chi SUPER_ADMIN moi duoc xoa toan bo du lieu')
    }
    if (!password) {
      throw new BadRequestException('Can nhap mat khau Super Admin')
    }

    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        passwordHash: true,
        legacyRole: true,
        role: {
          select: {
            code: true,
          },
        },
      },
    })
    const roleCode = user?.role?.code ?? user?.legacyRole
    if (!user || roleCode !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Chi SUPER_ADMIN moi duoc xoa toan bo du lieu')
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash)
    if (!isPasswordValid) {
      throw new UnauthorizedException('Mat khau Super Admin khong chinh xac')
    }

    return this.purgeModules(getBackupCatalogEntries().map((entry) => entry.moduleId))
  }

  private requireDefinition(moduleId: string) {
    const definition = getBackupModuleDefinition(moduleId)
    if (!definition) {
      throw new BadRequestException(`Module ${moduleId} khong duoc ho tro`)
    }
    return definition
  }

  private validateRequestedModules(moduleIds: string[]) {
    if (!Array.isArray(moduleIds) || moduleIds.length === 0) {
      throw new BadRequestException('Can chon it nhat 1 module backup')
    }

    const normalized = Array.from(
      new Set(
        moduleIds
          .map((value) => String(value ?? '').trim())
          .filter(Boolean),
      ),
    )

    if (normalized.length === 0) {
      throw new BadRequestException('Can chon it nhat 1 module backup')
    }

    for (const moduleId of normalized) {
      this.requireDefinition(moduleId)
    }

    return normalized
  }

  private expandDependencies(moduleIds: string[], availableModuleIds?: Set<string>) {
    const visited = new Set<string>()
    const ordered: string[] = []

    const visit = (moduleId: string) => {
      if (visited.has(moduleId)) return
      visited.add(moduleId)

      const definition = this.requireDefinition(moduleId)
      for (const dependency of definition.dependencies) {
        if (availableModuleIds && !availableModuleIds.has(dependency)) {
          throw new BadRequestException(
            `Thieu module phu thuoc ${dependency} trong file backup`,
          )
        }
        visit(dependency)
      }

      ordered.push(moduleId)
    }

    for (const moduleId of moduleIds) {
      visit(moduleId)
    }

    return ordered
  }

  private sortModulesByDependencies(moduleIds: string[]) {
    return this.expandDependencies(moduleIds)
  }

  private collectRestoreBlockers(moduleIds: string[]) {
    const selected = new Set(moduleIds)
    return moduleIds
      .map((moduleId) => {
        const blockedBy = getReverseDependencies(moduleId).filter(
          (dependent) => !selected.has(dependent),
        )
        return {
          moduleId,
          blockedBy,
        }
      })
      .filter((entry) => entry.blockedBy.length > 0)
  }

  private buildInspectModules(
    manifestModules: BackupManifest['modules'],
  ): BackupInspectModuleResult[] {
    const catalogMap = new Map(
      getBackupCatalogEntries().map((entry) => [entry.moduleId, entry]),
    )

    return manifestModules.map((moduleEntry) => {
      const catalog = catalogMap.get(moduleEntry.moduleId)
      const compatible =
        catalog?.supportedImportVersions.includes(moduleEntry.moduleVersion) ?? false

      return {
        moduleId: moduleEntry.moduleId,
        label: catalog?.label ?? moduleEntry.label,
        moduleVersion: catalog?.moduleVersion ?? moduleEntry.moduleVersion,
        dependencies: catalog?.dependencies ?? moduleEntry.dependencies,
        requiredBy: catalog?.requiredBy ?? [],
        keepsFileRefs: catalog?.keepsFileRefs ?? true,
        supportedImportVersions: catalog?.supportedImportVersions ?? [],
        fileModuleVersion: moduleEntry.moduleVersion,
        recordCounts: moduleEntry.recordCounts,
        compatible,
        compatibilityReason: compatible
          ? null
          : catalog
            ? `Version ${moduleEntry.moduleVersion} chua co adapter import`
            : 'Module nay khong con duoc ho tro trong app hien tai',
      }
    })
  }

  private buildWarnings(manifest: BackupManifest) {
    const warnings: string[] = []
    if (manifest.keepsFileRefs) {
      warnings.push(
        'Backup giu URL/path tham chieu file, nhung khong bao gom file nhi phan anh hoac tai lieu.',
      )
    }
    if (manifest.containsSecrets) {
      warnings.push(
        'File backup co chua cau hinh nhay cam. Chi chia se file khi da bao ve mat khau.',
      )
    }
    return warnings
  }

  getAppMetadata(): AppMetadata {
    const fallback = {
      appId: 'application',
      appVersion: '0.0.0',
    }

    const candidates = [
      resolve(process.cwd(), 'package.json'),
      resolve(process.cwd(), '../../package.json'),
      resolve(process.cwd(), '../../../package.json'),
    ]

    for (const candidate of candidates) {
      if (!existsSync(candidate)) {
        continue
      }

      try {
        const parsed = JSON.parse(readFileSync(candidate, 'utf8')) as Record<string, unknown>
        return {
          appId: String(parsed['name'] ?? fallback.appId),
          appVersion: String(parsed['version'] ?? fallback.appVersion),
        }
      } catch {
        continue
      }
    }

    return fallback
  }

  private readSchemaFingerprint() {
    const candidates = [
      resolve(process.cwd(), 'packages/database/prisma/schema.prisma'),
      resolve(process.cwd(), '../packages/database/prisma/schema.prisma'),
      resolve(process.cwd(), '../../packages/database/prisma/schema.prisma'),
      resolve(process.cwd(), '../../../packages/database/prisma/schema.prisma'),
    ]

    for (const candidate of candidates) {
      if (!existsSync(candidate)) {
        continue
      }

      const content = readFileSync(candidate, 'utf8')
      return createHash('sha256').update(content, 'utf8').digest('hex')
    }

    throw new BadRequestException('Khong doc duoc schema de tao fingerprint backup')
  }

  private buildBackupFileName() {
    const now = new Date()
    const stamp = [
      now.getFullYear().toString().padStart(4, '0'),
      (now.getMonth() + 1).toString().padStart(2, '0'),
      now.getDate().toString().padStart(2, '0'),
      '-',
      now.getHours().toString().padStart(2, '0'),
      now.getMinutes().toString().padStart(2, '0'),
      now.getSeconds().toString().padStart(2, '0'),
    ].join('')

    return `backup-${stamp}${APP_BACKUP_EXTENSION}`
  }

  private assertArchiveShape(archive: BackupArchivePayload) {
    if (!archive || typeof archive !== 'object') {
      throw new BadRequestException('Noi dung backup khong hop le')
    }

    if (!archive.manifest || !Array.isArray(archive.manifest.modules)) {
      throw new BadRequestException('Manifest backup khong hop le')
    }

    if (!archive.modules || typeof archive.modules !== 'object') {
      throw new BadRequestException('Du lieu module trong backup khong hop le')
    }
  }
}
