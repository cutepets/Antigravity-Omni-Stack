import { BackupService } from './backup.service'

describe('BackupService', () => {
  const originalEnv = process.env['APP_SECRET_ENCRYPTION_KEY']

  beforeEach(() => {
    process.env['APP_SECRET_ENCRYPTION_KEY'] = 'backup-test-secret-key'
  })

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env['APP_SECRET_ENCRYPTION_KEY']
    } else {
      process.env['APP_SECRET_ENCRYPTION_KEY'] = originalEnv
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
