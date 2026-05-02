import { BackupService } from './backup.service'
import * as bcrypt from 'bcryptjs'

describe('BackupService', () => {
  const originalEnv = process.env['APP_SECRET_ENCRYPTION_KEY']
  const originalBuildNumber = process.env['BUILD_NUMBER']
  const originalGitSha = process.env['GIT_SHA']
  const originalBuildDate = process.env['BUILD_DATE']

  beforeEach(() => {
    process.env['APP_SECRET_ENCRYPTION_KEY'] = 'backup-test-secret-key'
  })

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env['APP_SECRET_ENCRYPTION_KEY']
    } else {
      process.env['APP_SECRET_ENCRYPTION_KEY'] = originalEnv
    }
    if (originalBuildNumber === undefined) {
      delete process.env['BUILD_NUMBER']
    } else {
      process.env['BUILD_NUMBER'] = originalBuildNumber
    }
    if (originalGitSha === undefined) {
      delete process.env['GIT_SHA']
    } else {
      process.env['GIT_SHA'] = originalGitSha
    }
    if (originalBuildDate === undefined) {
      delete process.env['BUILD_DATE']
    } else {
      process.env['BUILD_DATE'] = originalBuildDate
    }
    jest.restoreAllMocks()
  })

  function createService() {
    const systemConfigState: any[] = [
      {
        id: 'cfg-1',
        shopName: 'Demo App',
        googleAuthClientSecretEnc: null,
        googleDriveServiceAccountEnc: null,
      },
    ]
    const printTemplatesState: any[] = [
      {
        id: 'tpl-1',
        type: 'invoice',
        name: 'Invoice',
        content: '<div>invoice</div>',
        paperSize: 'a4',
        isSystem: false,
        createdAt: '2026-04-21T00:00:00.000Z',
        updatedAt: '2026-04-21T00:00:00.000Z',
      },
    ]
    const moduleConfigsState: any[] = [
      {
        id: 'mod-1',
        key: 'orders',
        displayName: 'Orders',
        isActive: true,
      },
    ]
    const storedAssetsState: any[] = [
      {
        id: 'asset-1',
        category: 'image',
        originalName: 'logo.png',
        mimeType: 'image/png',
        url: 'http://localhost:3001/api/storage/assets/asset-1/content',
      },
      {
        id: 'asset-backup',
        category: 'backup',
        originalName: 'old.appbak',
        mimeType: 'application/octet-stream',
        url: 'http://localhost:3001/api/storage/assets/asset-backup/content',
      },
    ]

    const delegate = (state: any[]) => ({
      findMany: jest.fn(async (args?: { where?: Record<string, unknown> }) => {
        const notCategory = (args?.where as any)?.category?.not
        if (notCategory) {
          return state.filter((entry) => entry.category !== notCategory)
        }
        return state
      }),
      deleteMany: jest.fn(async (args?: { where?: Record<string, unknown> }) => {
        const notCategory = (args?.where as any)?.category?.not
        if (notCategory) {
          for (let index = state.length - 1; index >= 0; index -= 1) {
            if (state[index].category !== notCategory) {
              state.splice(index, 1)
            }
          }
          return
        }
        state.splice(0, state.length)
      }),
      createMany: jest.fn(async ({ data }: { data: any[] }) => {
        state.push(...data)
      }),
    })

    const db = {
      user: {
        findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
          if (where.id !== 'super-admin-1') return null
          return {
            id: 'super-admin-1',
            passwordHash: bcrypt.hashSync('SuperAdmin@123', 4),
            legacyRole: 'SUPER_ADMIN',
            role: { code: 'SUPER_ADMIN' },
          }
        }),
      },
      systemConfig: delegate(systemConfigState),
      printTemplate: delegate(printTemplatesState),
      moduleConfig: delegate(moduleConfigsState),
      storedAsset: delegate(storedAssetsState),
      $transaction: jest.fn(async (callback: (tx: any) => Promise<void>) => callback(db)),
    } as any

    const storageService = {
      uploadAsset: jest.fn(),
    } as any

    return {
      service: new BackupService(db, storageService),
      db,
      storageService,
      states: {
        systemConfigState,
        printTemplatesState,
        moduleConfigsState,
        storedAssetsState,
      },
    }
  }

  it('rejects full data purge when the super admin password is invalid', async () => {
    const { service } = createService()
    jest.spyOn(service, 'purgeModules').mockResolvedValue({ purgedModules: [] })

    await expect(
      service.purgeAllDataWithSuperAdminPassword('super-admin-1', 'wrong-password'),
    ).rejects.toThrow('Mat khau Super Admin khong chinh xac')

    expect(service.purgeModules).not.toHaveBeenCalled()
  })

  it('purges every registered module after verifying the super admin password', async () => {
    const { service } = createService()
    const purgeModulesSpy = jest
      .spyOn(service, 'purgeModules')
      .mockResolvedValue({ purgedModules: ['operations.commerce'] })

    const result = await service.purgeAllDataWithSuperAdminPassword(
      'super-admin-1',
      'SuperAdmin@123',
    )

    expect(purgeModulesSpy).toHaveBeenCalledWith(
      expect.arrayContaining([
        'core.settings',
        'finance.configuration',
        'core.organization',
        'crm.contacts',
        'catalog.items',
        'inventory.stock',
        'operations.commerce',
        'hr.workforce',
        'assets.equipment',
      ]),
    )
    expect(result.purgedModules).toEqual(['operations.commerce'])
  })

  it('exposes business data blocks for backup selection', () => {
    const { service } = createService()

    const catalog = service.getCatalog()

    expect(catalog.data.dataBlocks).toEqual([
      {
        blockId: 'configuration',
        label: 'Cấu hình hệ thống và cấu hình ở các mục',
        description: expect.any(String),
        moduleIds: ['core.settings', 'finance.configuration', 'catalog.items'],
      },
      {
        blockId: 'staff_equipment',
        label: 'Nhân viên, chấm công, bảng lương, thưởng phạt, trang thiết bị',
        description: expect.any(String),
        moduleIds: ['core.organization', 'hr.workforce', 'assets.equipment'],
      },
      {
        blockId: 'customers_pets',
        label: 'Khách hàng, thú cưng, điểm',
        description: expect.any(String),
        moduleIds: ['crm.contacts'],
      },
      {
        blockId: 'operations',
        label: 'Đơn hàng, thu chi, grooming, hotel',
        description: expect.any(String),
        moduleIds: ['operations.commerce'],
      },
    ])
    expect(catalog.data.modules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ moduleId: 'core.settings' }),
        expect.objectContaining({ moduleId: 'operations.commerce' }),
      ]),
    )
  })

  it('reads app version from release metadata and build metadata from env', () => {
    process.env['BUILD_NUMBER'] = '128'
    process.env['GIT_SHA'] = 'abc1234'
    process.env['BUILD_DATE'] = '2026-05-01T15:30:00Z'
    const { service } = createService()

    const metadata = service.getAppMetadata()

    expect(metadata).toEqual(
      expect.objectContaining({
        appId: 'petshop-management-v2',
        appVersion: '2.5.3+6f56572',
        buildNumber: '128',
        gitSha: 'abc1234',
        buildDate: '2026-05-01T15:30:00Z',
      }),
    )
  })

  it('exports and inspects a .appbak archive for core.settings', async () => {
    const { service } = createService()

    const exported = await service.exportBackup(
      {
        modules: ['core.settings'],
        destination: 'download',
        password: 'backup-password',
      },
      'user-1',
    )

    if (exported.kind !== 'download') {
      throw new Error('Expected a download result')
    }

    expect(exported.fileName.endsWith('.appbak')).toBe(true)

    const inspected = service.inspectBackup(exported.buffer, 'backup-password')
    expect(inspected.data.manifest.formatName).toBe('App Backup Format')
    expect(inspected.data.manifest.selectedModules).toEqual(['core.settings'])
    expect(inspected.data.modules[0]?.moduleId).toBe('core.settings')
    expect(inspected.data.modules[0]?.recordCounts['storedAsset']).toBe(1)
  })

  it('restores selected core.settings datasets and keeps backup assets excluded', async () => {
    const { service, states } = createService()

    const exported = await service.exportBackup(
      {
        modules: ['core.settings'],
        destination: 'download',
        password: 'backup-password',
      },
      'user-1',
    )

    if (exported.kind !== 'download') {
      throw new Error('Expected a download result')
    }

    states.systemConfigState.splice(
      0,
      states.systemConfigState.length,
      { id: 'cfg-2', shopName: 'Changed App' },
    )
    states.printTemplatesState.splice(0, states.printTemplatesState.length)
    states.moduleConfigsState.splice(0, states.moduleConfigsState.length)
    states.storedAssetsState.splice(
      0,
      states.storedAssetsState.length,
      {
        id: 'asset-2',
        category: 'image',
        originalName: 'changed.png',
        mimeType: 'image/png',
        url: 'http://localhost:3001/api/storage/assets/asset-2/content',
      },
      {
        id: 'asset-backup-2',
        category: 'backup',
        originalName: 'backup-2.appbak',
        mimeType: 'application/octet-stream',
        url: 'http://localhost:3001/api/storage/assets/asset-backup-2/content',
      },
    )

    const restored = await service.restoreBackup(
      exported.buffer,
      'backup-password',
      ['core.settings'],
      'replace_selected',
    )

    expect(restored.data.restoredModules).toEqual(['core.settings'])
    expect(states.systemConfigState[0]?.shopName).toBe('Demo App')
    expect(states.printTemplatesState).toHaveLength(1)
    expect(states.moduleConfigsState).toHaveLength(1)
    expect(states.storedAssetsState).toHaveLength(2)
    expect(states.storedAssetsState.some((entry) => entry.category === 'backup')).toBe(true)
    expect(states.storedAssetsState.some((entry) => entry.originalName === 'logo.png')).toBe(true)
  })
})
