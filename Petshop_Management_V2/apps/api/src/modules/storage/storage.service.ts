import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { StorageProviderKind, type StoredAsset } from '@prisma/client'
import { createHash, randomUUID } from 'crypto'
import { createReadStream } from 'fs'
import { mkdir, readFile, unlink, writeFile } from 'fs/promises'
import { extname, resolve } from 'path'
import { DatabaseService } from '../../database/database.service.js'
import { GoogleDriveStorageProvider } from './google-drive-storage.provider.js'
import type {
  DeleteStoredAssetInput,
  GoogleDriveConnectionCheck,
  BindStoredAssetReferenceInput,
  ListStoredAssetsInput,
  StoredAssetContent,
  UnbindStoredAssetReferenceInput,
  UploadStoredAssetInput,
} from './storage.types.js'

type ScannedAssetReference = {
  url: string
  entityType: string
  entityId: string
  fieldName: string
  category: 'image' | 'document' | 'backup'
  label?: string | null
}

type LegacyAssetReference = ScannedAssetReference & {
  reason: 'legacy-url' | 'data-url' | 'remote-url' | 'private-storage' | 'missing-stored-asset'
}

@Injectable()
export class StorageService {
  constructor(
    private readonly db: DatabaseService,
    private readonly googleDriveStorageProvider: GoogleDriveStorageProvider,
  ) {}

  private async getSystemConfig() {
    return this.db.systemConfig.findFirst({
      select: {
        storageProvider: true,
        googleDriveEnabled: true,
      },
    })
  }

  private getPublicApiUrl() {
    const configured =
      process.env['PUBLIC_API_URL'] ??
      process.env['API_PUBLIC_URL'] ??
      process.env['NEXT_PUBLIC_API_URL']

    if (configured) {
      return configured.replace(/\/+$/, '')
    }

    return `http://localhost:${process.env['API_PORT'] ?? '3001'}`
  }

  private buildAssetUrl(assetId: string) {
    return `${this.getPublicApiUrl()}/api/storage/assets/${assetId}/content`
  }

  private resolveLocalAbsolutePath(storageKey: string) {
    return resolve(process.cwd(), 'uploads', storageKey)
  }

  private buildStorageKey(input: UploadStoredAssetInput, fileName: string) {
    const scopeSegment = input.scope?.trim() ? `${input.scope.trim()}/` : ''
    return `storage/${input.category}/${scopeSegment}${fileName}`
  }

  private get dbAny() {
    return this.db as any
  }

  private hashFile(buffer: Buffer) {
    return createHash('sha256').update(buffer).digest('hex')
  }

  private removeVietnameseMarks(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
  }

  private slugifyFileNamePart(value: string | null | undefined, fallback = 'file', maxLength = 64) {
    const normalized = this.removeVietnameseMarks(String(value ?? ''))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, maxLength)
      .replace(/^-+|-+$/g, '')

    return normalized || fallback
  }

  private formatFileTimestamp(date = new Date()) {
    const pad = (value: number) => String(value).padStart(2, '0')
    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate()),
      '-',
      pad(date.getHours()),
      pad(date.getMinutes()),
      pad(date.getSeconds()),
    ].join('')
  }

  private buildManagedOriginalName(input: UploadStoredAssetInput, sha256: string) {
    const extension = this.slugifyExtension(extname(input.file.originalName))
    const originalBaseName = input.file.originalName.slice(
      0,
      input.file.originalName.length - extname(input.file.originalName).length,
    )
    const businessName = input.displayName?.trim() || input.ownerId?.trim() || originalBaseName
    const scope = this.slugifyFileNamePart(input.scope ?? input.category, input.category, 32)
    const fieldName = this.slugifyFileNamePart(input.fieldName ?? input.category, input.category, 32)
    const displayName = this.slugifyFileNamePart(
      businessName,
      'file',
      64,
    )
    return `${scope}-${fieldName}-${displayName}-${this.formatFileTimestamp()}-${sha256.slice(0, 6)}${extension}`
  }

  private slugifyExtension(extension: string) {
    const cleaned = this.removeVietnameseMarks(extension.toLowerCase()).replace(/[^a-z0-9.]/g, '')
    if (!cleaned || cleaned === '.') return ''
    return cleaned.startsWith('.') ? cleaned : `.${cleaned}`
  }

  private withManagedOriginalName(input: UploadStoredAssetInput, sha256: string): UploadStoredAssetInput {
    return {
      ...input,
      file: {
        ...input.file,
        originalName: this.buildManagedOriginalName(input, sha256),
      },
    }
  }

  private async hashReadableStream(stream: NodeJS.ReadableStream) {
    const hash = createHash('sha256')
    for await (const chunk of stream as any) {
      hash.update(chunk)
    }
    return hash.digest('hex')
  }

  private isStorageAssetUrl(url: string | null | undefined) {
    return /\/api\/storage\/assets\/[^/]+\/content(?:$|[?#])/.test(String(url ?? '').trim())
  }

  private classifyLegacyUrl(url: string): LegacyAssetReference['reason'] | null {
    const normalized = String(url ?? '').trim()
    if (!normalized) return null
    if (this.isStorageAssetUrl(normalized)) return null
    if (normalized.startsWith('data:')) return 'data-url'
    if (normalized.startsWith('/uploads/')) return 'legacy-url'
    if (normalized.startsWith('storage/private/')) return 'private-storage'
    if (/^https?:\/\//i.test(normalized)) return 'remote-url'
    return 'legacy-url'
  }

  private parseJsonArray(value: unknown): any[] {
    if (!value) return []
    if (Array.isArray(value)) return value
    try {
      const parsed = JSON.parse(String(value))
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  private normalizeReferenceInput(input: UploadStoredAssetInput) {
    const entityType = input.ownerType?.trim()
    const entityId = input.ownerId?.trim()
    const fieldName = input.fieldName?.trim()

    if (!entityType || !entityId || !fieldName) {
      return null
    }

    return { entityType, entityId, fieldName }
  }

  private async storeLocally(input: UploadStoredAssetInput) {
    const storageKey = this.buildStorageKey(input, input.file.originalName)
    const absolutePath = this.resolveLocalAbsolutePath(storageKey)

    await mkdir(resolve(absolutePath, '..'), { recursive: true })
    await writeFile(absolutePath, input.file.buffer)

    return {
      provider: StorageProviderKind.LOCAL,
      storageKey,
      googleFileId: null,
      previewUrl: null,
    }
  }

  private async storeInGoogleDrive(input: UploadStoredAssetInput) {
    const uploaded = await this.googleDriveStorageProvider.uploadFile({
      file: input.file,
      category: input.category,
      scope: input.scope ?? null,
    })

    return {
      provider: StorageProviderKind.GOOGLE_DRIVE,
      storageKey: this.buildStorageKey(input, uploaded.name),
      googleFileId: uploaded.fileId,
      previewUrl: null,
    }
  }

  async uploadAsset(input: UploadStoredAssetInput) {
    const sha256 = this.hashFile(input.file.buffer)
    const existingAsset = await this.dbAny.storedAsset.findFirst?.({
      where: {
        sha256,
        deletedAt: null,
        status: { not: 'DELETED' },
      },
      orderBy: { createdAt: 'asc' },
    })

    if (existingAsset) {
      const reusedAsset = await this.dbAny.storedAsset.update({
        where: { id: existingAsset.id },
        data: {
          status: 'ACTIVE',
          orphanedAt: null,
          lastReferencedAt: new Date(),
          ownerType: input.ownerType ?? existingAsset.ownerType ?? null,
          ownerId: input.ownerId ?? existingAsset.ownerId ?? null,
          scope: input.scope ?? existingAsset.scope ?? null,
        },
      })
      const reference = this.normalizeReferenceInput(input)
      if (reference) {
        await this.bindAssetReference({
          assetUrl: reusedAsset.url,
          ...reference,
        })
      }
      return { ...reusedAsset, reused: true }
    }

    const uploadInput = this.withManagedOriginalName(input, sha256)
    const config = await this.getSystemConfig()
    const useGoogleDrive =
      input.providerOverride === StorageProviderKind.GOOGLE_DRIVE
        ? true
        : input.providerOverride === StorageProviderKind.LOCAL
          ? false
          : config?.storageProvider === StorageProviderKind.GOOGLE_DRIVE &&
            config?.googleDriveEnabled === true

    if (
      input.providerOverride === StorageProviderKind.GOOGLE_DRIVE &&
      config?.googleDriveEnabled !== true
    ) {
      throw new BadRequestException('Google Drive chua duoc bat trong cau hinh he thong')
    }

    const stored = useGoogleDrive
      ? await this.storeInGoogleDrive(uploadInput)
      : await this.storeLocally(uploadInput)

    const assetId = randomUUID()
    const asset = await this.dbAny.storedAsset.create({
      data: {
        id: assetId,
        provider: stored.provider,
        category: uploadInput.category,
        scope: uploadInput.scope ?? null,
        ownerType: uploadInput.ownerType ?? null,
        ownerId: uploadInput.ownerId ?? null,
        originalName: uploadInput.file.originalName,
        mimeType: uploadInput.file.mimeType,
        size: uploadInput.file.size,
        extension: extname(uploadInput.file.originalName).toLowerCase() || null,
        sha256,
        status: 'ACTIVE',
        referenceCount: 0,
        lastReferencedAt: new Date(),
        orphanedAt: null,
        storageKey: stored.storageKey,
        googleFileId: stored.googleFileId,
        previewUrl: stored.previewUrl,
        uploadedById: uploadInput.uploadedById ?? null,
        url: this.buildAssetUrl(assetId),
      },
    })

    const reference = this.normalizeReferenceInput(input)
    if (reference) {
      await this.bindAssetReference({
        assetUrl: asset.url,
        ...reference,
      })
    }

    return { ...asset, reused: false }
  }

  async bindAssetReference(input: BindStoredAssetReferenceInput) {
    const normalizedUrl = String(input.assetUrl ?? '').trim()
    if (!normalizedUrl) return null

    const asset = await this.dbAny.storedAsset.findFirst({
      where: {
        url: normalizedUrl,
        deletedAt: null,
      },
      select: { id: true },
    })
    if (!asset) return null

    await this.dbAny.storedAssetReference.upsert({
      where: {
        assetId_entityType_entityId_fieldName: {
          assetId: asset.id,
          entityType: input.entityType,
          entityId: input.entityId,
          fieldName: input.fieldName,
        },
      },
      create: {
        assetId: asset.id,
        entityType: input.entityType,
        entityId: input.entityId,
        fieldName: input.fieldName,
      },
      update: {},
    })

    const referenceCount = await this.dbAny.storedAssetReference.count({
      where: { assetId: asset.id },
    })

    return this.dbAny.storedAsset.update({
      where: { id: asset.id },
      data: {
        referenceCount,
        status: 'ACTIVE',
        orphanedAt: null,
        lastReferencedAt: new Date(),
      },
    })
  }

  async restoreAssetReference(
    assetId: string,
    input: { entityType: string; entityId: string; fieldName: string },
  ) {
    if (!input.entityType?.trim() || !input.entityId?.trim() || !input.fieldName?.trim()) {
      throw new BadRequestException('Thieu thong tin entity/field de khoi phuc file')
    }

    const asset = await this.dbAny.storedAsset.findFirst({
      where: { id: assetId, deletedAt: null },
      select: { id: true, url: true },
    })

    if (!asset) {
      throw new NotFoundException('Khong tim thay file de khoi phuc')
    }

    return this.bindAssetReference({
      assetUrl: asset.url,
      entityType: input.entityType,
      entityId: input.entityId,
      fieldName: input.fieldName,
    })
  }

  async unbindAssetReference(input: UnbindStoredAssetReferenceInput) {
    const normalizedUrl = String(input.assetUrl ?? '').trim()
    if (!normalizedUrl) return null

    await this.dbAny.storedAssetReference.deleteMany({
      where: {
        asset: { url: normalizedUrl },
        entityType: input.entityType,
        entityId: input.entityId,
        fieldName: input.fieldName,
      },
    })

    const remainingReferences = await this.dbAny.storedAssetReference.count({
      where: {
        asset: { url: normalizedUrl },
      },
    })
    const becameOrphaned = remainingReferences === 0

    return this.dbAny.storedAsset.update({
      where: { url: normalizedUrl },
      data: {
        referenceCount: remainingReferences,
        status: becameOrphaned ? 'ORPHANED' : 'ACTIVE',
        orphanedAt: becameOrphaned ? new Date() : null,
        lastReferencedAt: becameOrphaned ? undefined : new Date(),
      },
    })
  }

  async deleteAssetByUrl(input: DeleteStoredAssetInput) {
    const normalizedUrl = String(input.url ?? '').trim()
    if (!normalizedUrl) {
      throw new BadRequestException('Duong dan file khong hop le')
    }

    const asset = await this.dbAny.storedAsset.findFirst({
      where: {
        url: normalizedUrl,
      },
    })

    if (!asset) {
      return null
    }

    return this.hardDeleteAsset(asset)
  }

  private async hardDeleteAsset(asset: any) {
    if (asset.provider === StorageProviderKind.GOOGLE_DRIVE) {
      await this.googleDriveStorageProvider.deleteFile(asset.googleFileId)
    } else if (asset.storageKey) {
      try {
        await unlink(this.resolveLocalAbsolutePath(asset.storageKey))
      } catch (error: any) {
        if (error?.code !== 'ENOENT') {
          throw new BadRequestException('Khong the xoa file da upload')
        }
      }
    }

    await this.dbAny.storedAssetReference?.deleteMany?.({
      where: { assetId: asset.id },
    })

    await this.dbAny.storedAsset.delete({
      where: { id: asset.id },
    })

    return asset
  }

  async markAssetOrphaned(url: string) {
    const normalizedUrl = String(url ?? '').trim()
    if (!normalizedUrl) {
      throw new BadRequestException('Duong dan file khong hop le')
    }

    await this.dbAny.storedAssetReference.deleteMany({
      where: {
        asset: { url: normalizedUrl },
      },
    })

    return this.dbAny.storedAsset.update({
      where: { url: normalizedUrl },
      data: {
        referenceCount: 0,
        status: 'ORPHANED',
        orphanedAt: new Date(),
      },
    })
  }

  async markAssetOrphanedById(assetId: string) {
    const asset = await this.dbAny.storedAsset.findUnique({
      where: { id: assetId },
      select: { url: true },
    })
    if (!asset) {
      throw new NotFoundException('Khong tim thay file')
    }
    return this.markAssetOrphaned(asset.url)
  }

  async deleteAssetById(assetId: string) {
    const asset = await this.dbAny.storedAsset.findUnique({
      where: { id: assetId },
    })
    if (!asset) {
      throw new NotFoundException('Khong tim thay file')
    }
    return this.hardDeleteAsset(asset)
  }

  async bulkDeleteAssets(assetIds: string[]) {
    const uniqueIds = Array.from(new Set(assetIds.map((id) => String(id ?? '').trim()).filter(Boolean)))
    if (uniqueIds.length === 0) {
      return { success: true, deleted: 0, failed: [] }
    }

    let deleted = 0
    const failed: Array<{ id: string; message: string }> = []

    for (const id of uniqueIds) {
      try {
        await this.deleteAssetById(id)
        deleted += 1
      } catch (error: any) {
        failed.push({ id, message: error?.message ?? String(error) })
      }
    }

    return { success: failed.length === 0, deleted, failed }
  }

  private async collectScannedReferences() {
    const references: ScannedAssetReference[] = []
    const add = (entry: Partial<ScannedAssetReference> & Pick<ScannedAssetReference, 'url' | 'entityType' | 'entityId' | 'fieldName'>) => {
      const url = String(entry.url ?? '').trim()
      if (!url) return
      references.push({
        category: entry.category ?? 'image',
        label: entry.label ?? null,
        ...entry,
        url,
      } as ScannedAssetReference)
    }

    const safeFindMany = async (modelName: string, args: any) => {
      const model = this.dbAny[modelName]
      if (!model?.findMany) return []
      try {
        return await model.findMany(args)
      } catch {
        return []
      }
    }

    const configs = await safeFindMany('systemConfig', {
      select: {
        id: true,
        shopLogo: true,
        spaServiceImages: true,
        hotelServiceImages: true,
        hotelExtraServices: true,
      },
    })
    for (const config of configs) {
      add({ url: config.shopLogo, entityType: 'SYSTEM_CONFIG', entityId: config.id, fieldName: 'shopLogo', category: 'image' })
      for (const item of this.parseJsonArray(config.spaServiceImages)) {
        add({
          url: item?.imageUrl,
          entityType: 'SPA_SERVICE_IMAGE',
          entityId: `${item?.species || 'all'}:${item?.packageCode || 'unknown'}`,
          fieldName: 'imageUrl',
          category: 'image',
          label: item?.label ?? item?.packageCode ?? null,
        })
      }
      for (const item of this.parseJsonArray(config.hotelServiceImages)) {
        add({
          url: item?.imageUrl,
          entityType: 'HOTEL_SERVICE_IMAGE',
          entityId: `${item?.species || 'all'}:${item?.packageCode || 'HOTEL'}`,
          fieldName: 'imageUrl',
          category: 'image',
          label: item?.label ?? item?.species ?? null,
        })
      }
      for (const item of this.parseJsonArray(config.hotelExtraServices)) {
        add({
          url: item?.imageUrl,
          entityType: 'HOTEL_EXTRA_SERVICE',
          entityId: String(item?.sku ?? item?.name ?? 'unknown'),
          fieldName: 'imageUrl',
          category: 'image',
          label: item?.name ?? null,
        })
      }
    }

    for (const product of await safeFindMany('product', { select: { id: true, image: true, name: true } })) {
      add({ url: product.image, entityType: 'PRODUCT', entityId: product.id, fieldName: 'image', category: 'image', label: product.name })
    }
    for (const variant of await safeFindMany('productVariant', { select: { id: true, image: true, name: true } })) {
      add({ url: variant.image, entityType: 'PRODUCT_VARIANT', entityId: variant.id, fieldName: 'image', category: 'image', label: variant.name })
    }
    for (const pet of await safeFindMany('pet', { select: { id: true, avatar: true, name: true } })) {
      add({ url: pet.avatar, entityType: 'PET', entityId: pet.id, fieldName: 'avatar', category: 'image', label: pet.name })
    }
    for (const user of await safeFindMany('user', { select: { id: true, avatar: true, fullName: true, username: true } })) {
      add({ url: user.avatar, entityType: 'STAFF', entityId: user.id, fieldName: 'avatar', category: 'image', label: user.fullName ?? user.username })
    }
    for (const doc of await safeFindMany('employeeDocument', { select: { id: true, userId: true, fileUrl: true, fileName: true } })) {
      add({ url: doc.fileUrl, entityType: 'EMPLOYEE_DOCUMENT', entityId: doc.id, fieldName: 'fileUrl', category: 'document', label: doc.fileName })
    }
    for (const equipment of await safeFindMany('equipment', { select: { id: true, imageUrl: true, name: true } })) {
      add({ url: equipment.imageUrl, entityType: 'EQUIPMENT', entityId: equipment.id, fieldName: 'imageUrl', category: 'image', label: equipment.name })
    }
    for (const supplier of await safeFindMany('supplier', { select: { id: true, avatar: true, documents: true, name: true } })) {
      add({ url: supplier.avatar, entityType: 'SUPPLIER', entityId: supplier.id, fieldName: 'avatar', category: 'image', label: supplier.name })
      for (const doc of Array.isArray(supplier.documents) ? supplier.documents : this.parseJsonArray(supplier.documents)) {
        add({ url: doc?.url, entityType: 'SUPPLIER_DOCUMENT', entityId: `${supplier.id}:${doc?.id ?? doc?.name ?? 'document'}`, fieldName: 'url', category: 'document', label: doc?.name })
      }
    }

    return references
  }

  private async backfillMissingHash(asset: any) {
    if (asset.sha256 || asset.deletedAt) return null
    try {
      let sha256: string | null = null
      if (asset.provider === StorageProviderKind.LOCAL && asset.storageKey) {
        sha256 = this.hashFile(await readFile(this.resolveLocalAbsolutePath(asset.storageKey)))
      } else if (asset.provider === StorageProviderKind.GOOGLE_DRIVE && asset.googleFileId) {
        sha256 = await this.hashReadableStream(await this.googleDriveStorageProvider.downloadFile(asset.googleFileId))
      }
      if (!sha256) return null
      await this.dbAny.storedAsset.update({
        where: { id: asset.id },
        data: { sha256 },
      })
      return sha256
    } catch {
      await this.dbAny.storedAsset.update({
        where: { id: asset.id },
        data: {
          status: 'ORPHANED',
          orphanedAt: asset.orphanedAt ?? new Date(),
        },
      }).catch(() => null)
      return null
    }
  }

  async scanAssetReferences(input?: { dryRun?: boolean }) {
    const dryRun = Boolean(input?.dryRun)
    const references = await this.collectScannedReferences()
    const legacyAssets: LegacyAssetReference[] = []
    let boundReferences = 0
    let missingStoredAssets = 0

    for (const reference of references) {
      const legacyReason = this.classifyLegacyUrl(reference.url)
      if (legacyReason) {
        legacyAssets.push({ ...reference, reason: legacyReason })
        continue
      }

      const asset = await this.dbAny.storedAsset.findFirst({
        where: { url: reference.url, deletedAt: null },
      })
      if (!asset) {
        missingStoredAssets += 1
        legacyAssets.push({ ...reference, reason: 'missing-stored-asset' })
        continue
      }

      if (!dryRun) {
        await this.bindAssetReference({
          assetUrl: reference.url,
          entityType: reference.entityType,
          entityId: reference.entityId,
          fieldName: reference.fieldName,
        })
        await this.backfillMissingHash(asset)
      }
      boundReferences += 1
    }

    if (!dryRun) {
      const assets = this.dbAny.storedAsset.findMany
        ? await this.dbAny.storedAsset.findMany({
        where: { deletedAt: null },
        select: { id: true, sha256: true, storageKey: true, googleFileId: true, provider: true, deletedAt: true, orphanedAt: true },
          })
        : []
      for (const asset of assets) {
        await this.backfillMissingHash(asset)
      }
    }

    return {
      scannedReferences: references.length,
      boundReferences,
      missingStoredAssets,
      legacyAssets,
      legacyCount: legacyAssets.length,
    }
  }

  async cleanupOrphanedAssets(input?: { retentionDays?: number; limit?: number }) {
    const retentionDays = Math.max(0, Number(input?.retentionDays ?? 30))
    const limit = Math.min(500, Math.max(1, Number(input?.limit ?? 100)))
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
    const assets = await this.dbAny.storedAsset.findMany({
      where: {
        status: 'ORPHANED',
        orphanedAt: { lte: cutoff },
        deletedAt: null,
      },
      take: limit,
    })

    let deleted = 0
    const errors: Array<{ id: string; message: string }> = []
    for (const asset of assets) {
      try {
        await this.hardDeleteAsset(asset)
        deleted += 1
      } catch (error: any) {
        errors.push({ id: asset.id, message: error?.message ?? String(error) })
      }
    }

    return { scanned: assets.length, deleted, errors }
  }

  async listAssets(input: ListStoredAssetsInput) {
    const page = Math.max(1, Number(input.page ?? 1))
    const limit = Math.min(100, Math.max(1, Number(input.limit ?? 25)))
    const q = String(input.q ?? '').trim()
    const where: any = {}

    if (input.status && input.status !== 'all' && input.status !== 'LEGACY') {
      where.status = input.status
    } else {
      where.status = { not: 'DELETED' }
    }
    if (input.category && input.category !== 'all') {
      where.category = input.category
    }
    if (input.provider && input.provider !== 'all' && input.provider !== 'LEGACY') {
      where.provider = input.provider
    }
    if (q) {
      where.OR = [
        { originalName: { contains: q, mode: 'insensitive' } },
        { url: { contains: q, mode: 'insensitive' } },
        { ownerType: { contains: q, mode: 'insensitive' } },
        { ownerId: { contains: q, mode: 'insensitive' } },
      ]
    }

    const [items, total, allAssets, scanResult] = await Promise.all([
      this.dbAny.storedAsset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          references: {
            orderBy: { updatedAt: 'desc' },
          },
          uploadedBy: {
            select: { id: true, fullName: true, username: true },
          },
        },
      }),
      this.dbAny.storedAsset.count({ where }),
      this.dbAny.storedAsset.findMany({
        select: {
          id: true,
          size: true,
          status: true,
          sha256: true,
        },
      }).catch(() => []),
      this.scanAssetReferences({ dryRun: true }).catch(() => ({ legacyAssets: [] as LegacyAssetReference[] })),
    ])

    let legacyAssets = (scanResult.legacyAssets ?? []).filter((asset: LegacyAssetReference) => {
      if (input.status && input.status !== 'all' && input.status !== 'LEGACY') return false
      if (input.category && input.category !== 'all' && asset.category !== input.category) return false
      if (input.provider && input.provider !== 'all' && input.provider !== 'LEGACY') return false
      if (q) {
        const haystack = `${asset.url} ${asset.entityType} ${asset.entityId} ${asset.fieldName} ${asset.label ?? ''}`.toLowerCase()
        return haystack.includes(q.toLowerCase())
      }
      return true
    })

    if (input.status && input.status !== 'LEGACY') {
      legacyAssets = []
    }

    const duplicateHashes = new Set<string>()
    const hashCounts = new Map<string, number>()
    for (const asset of allAssets) {
      if (!asset.sha256) continue
      hashCounts.set(asset.sha256, (hashCounts.get(asset.sha256) ?? 0) + 1)
    }
    for (const [hash, count] of hashCounts) {
      if (count > 1) duplicateHashes.add(hash)
    }

    const stats = (allAssets as Array<{ size?: number | null; status?: string | null; sha256?: string | null }>).reduce(
      (acc: {
        totalFiles: number
        totalSize: number
        activeFiles: number
        orphanedFiles: number
        deletedFiles: number
        legacyFiles: number
        duplicateFiles: number
      }, asset) => {
        acc.totalFiles += 1
        acc.totalSize += Number(asset.size ?? 0)
        if (asset.status === 'ACTIVE') acc.activeFiles += 1
        if (asset.status === 'ORPHANED') acc.orphanedFiles += 1
        if (asset.status === 'DELETED') acc.deletedFiles += 1
        if (asset.sha256 && duplicateHashes.has(asset.sha256)) acc.duplicateFiles += 1
        return acc
      },
      {
        totalFiles: 0,
        totalSize: 0,
        activeFiles: 0,
        orphanedFiles: 0,
        deletedFiles: 0,
        legacyFiles: legacyAssets.length,
        duplicateFiles: 0,
      },
    )
    stats.legacyFiles = legacyAssets.length

    const storedItems = input.status === 'LEGACY' || input.provider === 'LEGACY' ? [] : items
    const storedTotal = input.status === 'LEGACY' || input.provider === 'LEGACY' ? 0 : total

    return {
      data: storedItems,
      legacyAssets,
      meta: {
        total: storedTotal,
        page,
        limit,
        totalPages: Math.ceil(storedTotal / limit),
      },
      stats,
    }
  }

  async getAssetContent(assetId: string): Promise<StoredAssetContent> {
    const asset = await this.db.storedAsset.findUnique({
      where: { id: assetId },
    })

    if (!asset || asset.deletedAt) {
      throw new NotFoundException('Khong tim thay tep')
    }

    if (asset.provider === StorageProviderKind.GOOGLE_DRIVE) {
      if (!asset.googleFileId) {
        throw new NotFoundException('Khong tim thay tep tren Google Drive')
      }

      const stream = await this.googleDriveStorageProvider.downloadFile(asset.googleFileId)
      return { asset, stream }
    }

    if (!asset.storageKey) {
      throw new NotFoundException('Khong tim thay tep luu tru cuc bo')
    }

    return {
      asset,
      stream: createReadStream(this.resolveLocalAbsolutePath(asset.storageKey)),
    }
  }

  async testGoogleDriveConnection(): Promise<GoogleDriveConnectionCheck> {
    return this.googleDriveStorageProvider.testConnection()
  }

  async resolveStoredAsset(url: string) {
    return this.db.storedAsset.findFirst({
      where: {
        url,
        deletedAt: null,
      },
    })
  }

  isStoredAssetUrl(url: string | null | undefined) {
    const normalizedUrl = String(url ?? '').trim()
    return normalizedUrl.startsWith(`${this.getPublicApiUrl()}/api/storage/assets/`)
  }
}
