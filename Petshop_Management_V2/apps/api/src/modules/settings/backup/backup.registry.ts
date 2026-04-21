import { BadRequestException } from '@nestjs/common'
import { decryptSecret, encryptSecret } from '../../../common/utils/secret-box.util.js'
import type { BackupCatalogEntry, BackupModuleId } from './backup.types.js'

type BackupDbClient = Record<string, any>

type BackupModelSpec = {
  dataset: string
  delegate: string
  where?: Record<string, unknown>
  exportTransform?: (record: any) => any
  restoreTransform?: (record: any) => any
}

type BackupModuleExportResult = {
  datasets: Record<string, unknown[]>
  recordCounts: Record<string, number>
  containsSecrets: boolean
}

export interface BackupModuleDefinition {
  moduleId: BackupModuleId
  label: string
  moduleVersion: number
  dependencies: BackupModuleId[]
  keepsFileRefs: boolean
  supportedImportVersions: number[]
  export(db: BackupDbClient): Promise<BackupModuleExportResult>
  clearForRestore(db: BackupDbClient): Promise<void>
  restore(db: BackupDbClient, moduleVersion: number, datasets: Record<string, unknown[]>): Promise<void>
}

function getDelegate(db: BackupDbClient, delegate: string) {
  const target = db[delegate]
  if (!target) {
    throw new BadRequestException(`Khong tim thay delegate Prisma cho ${delegate}`)
  }
  return target
}

function cloneRecord<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function createPrismaBackedModule(config: {
  moduleId: BackupModuleId
  label: string
  moduleVersion: number
  dependencies: BackupModuleId[]
  keepsFileRefs?: boolean
  models: BackupModelSpec[]
}) {
  const definition: BackupModuleDefinition = {
    moduleId: config.moduleId,
    label: config.label,
    moduleVersion: config.moduleVersion,
    dependencies: config.dependencies,
    keepsFileRefs: config.keepsFileRefs ?? false,
    supportedImportVersions: [config.moduleVersion],
    async export(db) {
      const datasets: Record<string, unknown[]> = {}
      const recordCounts: Record<string, number> = {}
      let containsSecrets = false

      for (const model of config.models) {
        const delegate = getDelegate(db, model.delegate)
        const records = await delegate.findMany(
          model.where ? { where: model.where } : undefined,
        )
        const normalized = records.map((record: any) => {
          const transformed = model.exportTransform
            ? model.exportTransform(record)
            : cloneRecord(record)

          if (
            transformed &&
            (transformed.googleAuthClientSecret ||
              transformed.googleDriveServiceAccountJson)
          ) {
            containsSecrets = true
          }

          return transformed
        })

        datasets[model.dataset] = normalized
        recordCounts[model.dataset] = normalized.length
      }

      return {
        datasets,
        recordCounts,
        containsSecrets,
      }
    },
    async clearForRestore(db) {
      for (const model of [...config.models].reverse()) {
        const delegate = getDelegate(db, model.delegate)
        await delegate.deleteMany(model.where ? { where: model.where } : undefined)
      }
    },
    async restore(db, moduleVersion, datasets) {
      if (!definition.supportedImportVersions.includes(moduleVersion)) {
        throw new BadRequestException(
          `Module ${config.moduleId} version ${moduleVersion} khong duoc ho tro`,
        )
      }

      for (const model of config.models) {
        const delegate = getDelegate(db, model.delegate)
        const rawRecords = Array.isArray(datasets[model.dataset])
          ? (datasets[model.dataset] as any[])
          : []

        if (rawRecords.length === 0) {
          continue
        }

        const data = rawRecords.map((record) =>
          model.restoreTransform ? model.restoreTransform(record) : cloneRecord(record),
        )

        await delegate.createMany({ data })
      }
    },
  }

  return definition
}

function exportSystemConfig(record: any) {
  const cloned = cloneRecord(record)
  const googleAuthClientSecret = cloned.googleAuthClientSecretEnc
    ? decryptSecret(cloned.googleAuthClientSecretEnc)
    : null
  const googleDriveServiceAccountJson = cloned.googleDriveServiceAccountEnc
    ? decryptSecret(cloned.googleDriveServiceAccountEnc)
    : null

  delete cloned.googleAuthClientSecretEnc
  delete cloned.googleDriveServiceAccountEnc

  return {
    ...cloned,
    googleAuthClientSecret,
    googleDriveServiceAccountJson,
  }
}

function restoreSystemConfig(record: any) {
  const cloned = cloneRecord(record)
  const googleAuthClientSecret = cloned.googleAuthClientSecret ?? null
  const googleDriveServiceAccountJson = cloned.googleDriveServiceAccountJson ?? null

  delete cloned.googleAuthClientSecret
  delete cloned.googleDriveServiceAccountJson

  return {
    ...cloned,
    googleAuthClientSecretEnc: googleAuthClientSecret
      ? encryptSecret(String(googleAuthClientSecret))
      : null,
    googleDriveServiceAccountEnc: googleDriveServiceAccountJson
      ? encryptSecret(String(googleDriveServiceAccountJson))
      : null,
  }
}

const registry = [
  createPrismaBackedModule({
    moduleId: 'core.settings',
    label: 'Cau hinh he thong',
    moduleVersion: 1,
    dependencies: [],
    keepsFileRefs: true,
    models: [
      {
        dataset: 'systemConfig',
        delegate: 'systemConfig',
        exportTransform: exportSystemConfig,
        restoreTransform: restoreSystemConfig,
      },
      { dataset: 'printTemplate', delegate: 'printTemplate' },
      { dataset: 'moduleConfig', delegate: 'moduleConfig' },
      {
        dataset: 'storedAsset',
        delegate: 'storedAsset',
        where: {
          category: {
            not: 'backup',
          },
        },
      },
    ],
  }),
  createPrismaBackedModule({
    moduleId: 'finance.configuration',
    label: 'Cau hinh tai chinh',
    moduleVersion: 1,
    dependencies: [],
    keepsFileRefs: false,
    models: [
      { dataset: 'cashbookCategory', delegate: 'cashbookCategory' },
      { dataset: 'bankTransferAccount', delegate: 'bankTransferAccount' },
      { dataset: 'paymentMethod', delegate: 'paymentMethod' },
      { dataset: 'paymentWebhookSecret', delegate: 'paymentWebhookSecret' },
    ],
  }),
  createPrismaBackedModule({
    moduleId: 'core.organization',
    label: 'To chuc va nguoi dung',
    moduleVersion: 1,
    dependencies: [],
    keepsFileRefs: true,
    models: [
      { dataset: 'branch', delegate: 'branch' },
      { dataset: 'role', delegate: 'role' },
      { dataset: 'user', delegate: 'user' },
    ],
  }),
  createPrismaBackedModule({
    moduleId: 'crm.contacts',
    label: 'Khach hang va doi tuong',
    moduleVersion: 1,
    dependencies: ['core.organization'],
    keepsFileRefs: true,
    models: [
      { dataset: 'customerGroup', delegate: 'customerGroup' },
      { dataset: 'customer', delegate: 'customer' },
      { dataset: 'pet', delegate: 'pet' },
      { dataset: 'petWeightLog', delegate: 'petWeightLog' },
      { dataset: 'petVaccination', delegate: 'petVaccination' },
      { dataset: 'petHealthNote', delegate: 'petHealthNote' },
      { dataset: 'petTimeline', delegate: 'petTimeline' },
    ],
  }),
  createPrismaBackedModule({
    moduleId: 'catalog.items',
    label: 'Danh muc va dich vu',
    moduleVersion: 1,
    dependencies: [],
    keepsFileRefs: true,
    models: [
      { dataset: 'category', delegate: 'category' },
      { dataset: 'brand', delegate: 'brand' },
      { dataset: 'unit', delegate: 'unit' },
      { dataset: 'priceBook', delegate: 'priceBook' },
      { dataset: 'service', delegate: 'service' },
      { dataset: 'serviceVariant', delegate: 'serviceVariant' },
      { dataset: 'serviceWeightBand', delegate: 'serviceWeightBand' },
      { dataset: 'hotelRateTable', delegate: 'hotelRateTable' },
      { dataset: 'cage', delegate: 'cage' },
      { dataset: 'hotelPriceRule', delegate: 'hotelPriceRule' },
      { dataset: 'spaPriceRule', delegate: 'spaPriceRule' },
      { dataset: 'holidayCalendarDate', delegate: 'holidayCalendarDate' },
    ],
  }),
  createPrismaBackedModule({
    moduleId: 'inventory.stock',
    label: 'Ton kho va nhap xuat',
    moduleVersion: 1,
    dependencies: ['core.organization', 'catalog.items'],
    keepsFileRefs: true,
    models: [
      { dataset: 'supplier', delegate: 'supplier' },
      { dataset: 'product', delegate: 'product' },
      { dataset: 'productVariant', delegate: 'productVariant' },
      { dataset: 'branchStock', delegate: 'branchStock' },
      { dataset: 'stockReceipt', delegate: 'stockReceipt' },
      { dataset: 'stockReceiptItem', delegate: 'stockReceiptItem' },
      { dataset: 'stockReceiptReceive', delegate: 'stockReceiptReceive' },
      { dataset: 'stockReceiptReceiveItem', delegate: 'stockReceiptReceiveItem' },
      { dataset: 'supplierPayment', delegate: 'supplierPayment' },
      { dataset: 'supplierPaymentAllocation', delegate: 'supplierPaymentAllocation' },
      { dataset: 'supplierReturn', delegate: 'supplierReturn' },
      { dataset: 'supplierReturnItem', delegate: 'supplierReturnItem' },
      { dataset: 'supplierReturnRefund', delegate: 'supplierReturnRefund' },
      { dataset: 'stockTransaction', delegate: 'stockTransaction' },
      { dataset: 'productSalesDaily', delegate: 'productSalesDaily' },
      { dataset: 'stockCountSession', delegate: 'stockCountSession' },
      { dataset: 'stockCountShiftSession', delegate: 'stockCountShiftSession' },
      { dataset: 'stockCountItem', delegate: 'stockCountItem' },
    ],
  }),
  createPrismaBackedModule({
    moduleId: 'operations.commerce',
    label: 'Van hanh giao dich',
    moduleVersion: 1,
    dependencies: [
      'finance.configuration',
      'core.organization',
      'crm.contacts',
      'catalog.items',
    ],
    keepsFileRefs: true,
    models: [
      { dataset: 'order', delegate: 'order' },
      { dataset: 'groomingSession', delegate: 'groomingSession' },
      { dataset: 'hotelStay', delegate: 'hotelStay' },
      { dataset: 'shiftSession', delegate: 'shiftSession' },
      { dataset: 'paymentIntent', delegate: 'paymentIntent' },
      { dataset: 'bankTransaction', delegate: 'bankTransaction' },
      { dataset: 'paymentWebhookEvent', delegate: 'paymentWebhookEvent' },
      { dataset: 'orderItem', delegate: 'orderItem' },
      { dataset: 'orderPayment', delegate: 'orderPayment' },
      { dataset: 'orderTimeline', delegate: 'orderTimeline' },
      { dataset: 'groomingTimeline', delegate: 'groomingTimeline' },
      { dataset: 'hotelStayTimeline', delegate: 'hotelStayTimeline' },
      { dataset: 'hotelStayChargeLine', delegate: 'hotelStayChargeLine' },
      { dataset: 'hotelStayAdjustment', delegate: 'hotelStayAdjustment' },
      { dataset: 'orderReturnRequest', delegate: 'orderReturnRequest' },
      { dataset: 'orderReturnItem', delegate: 'orderReturnItem' },
      { dataset: 'transaction', delegate: 'transaction' },
      { dataset: 'cashVaultEntry', delegate: 'cashVaultEntry' },
    ],
  }),
  createPrismaBackedModule({
    moduleId: 'hr.workforce',
    label: 'Nhan su va cong luong',
    moduleVersion: 1,
    dependencies: ['core.organization'],
    keepsFileRefs: true,
    models: [
      { dataset: 'staffSchedule', delegate: 'staffSchedule' },
      { dataset: 'leaveRequest', delegate: 'leaveRequest' },
      { dataset: 'attendanceRecord', delegate: 'attendanceRecord' },
      { dataset: 'payrollPeriod', delegate: 'payrollPeriod' },
      { dataset: 'payrollSlip', delegate: 'payrollSlip' },
      { dataset: 'payrollLineItem', delegate: 'payrollLineItem' },
      { dataset: 'faceEmbedding', delegate: 'faceEmbedding' },
      { dataset: 'employeeDocument', delegate: 'employeeDocument' },
    ],
  }),
  createPrismaBackedModule({
    moduleId: 'assets.equipment',
    label: 'Tai san va thiet bi',
    moduleVersion: 1,
    dependencies: ['core.organization'],
    keepsFileRefs: true,
    models: [
      { dataset: 'equipmentCategory', delegate: 'equipmentCategory' },
      { dataset: 'equipmentLocationPreset', delegate: 'equipmentLocationPreset' },
      { dataset: 'equipment', delegate: 'equipment' },
      { dataset: 'equipmentHistory', delegate: 'equipmentHistory' },
    ],
  }),
] satisfies BackupModuleDefinition[]

const registryMap = new Map(registry.map((entry) => [entry.moduleId, entry]))

const reverseDependencyMap = registry.reduce<Record<string, BackupModuleId[]>>((acc, entry) => {
  acc[entry.moduleId] = []
  return acc
}, {})

for (const entry of registry) {
  for (const dependency of entry.dependencies) {
    reverseDependencyMap[dependency] = [
      ...(reverseDependencyMap[dependency] ?? []),
      entry.moduleId,
    ]
  }
}

export function getBackupModuleRegistry() {
  return registry
}

export function getBackupModuleDefinition(moduleId: string) {
  return registryMap.get(moduleId as BackupModuleId) ?? null
}

export function getBackupCatalogEntries(): BackupCatalogEntry[] {
  return registry.map((entry) => ({
    moduleId: entry.moduleId,
    label: entry.label,
    moduleVersion: entry.moduleVersion,
    dependencies: [...entry.dependencies],
    requiredBy: [...(reverseDependencyMap[entry.moduleId] ?? [])],
    keepsFileRefs: entry.keepsFileRefs,
    supportedImportVersions: [...entry.supportedImportVersions],
  }))
}

export function getReverseDependencies(moduleId: string) {
  return [...(reverseDependencyMap[moduleId] ?? [])]
}

