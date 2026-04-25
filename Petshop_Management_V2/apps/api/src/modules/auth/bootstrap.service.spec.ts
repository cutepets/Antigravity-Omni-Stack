import { Logger } from '@nestjs/common'
import { BootstrapService } from './bootstrap.service'

function makeDb() {
  const tx = {
    branch: {
      findFirst: jest.fn().mockResolvedValue({ id: 'branch-1' }),
      create: jest.fn(),
    },
    role: {
      findFirst: jest.fn().mockResolvedValue({ id: 'role-1' }),
      create: jest.fn(),
    },
    user: {
      create: jest.fn(),
    },
  }

  return {
    tx,
    db: {
      user: {
        count: jest.fn().mockResolvedValue(0),
      },
      serviceWeightBand: {
        count: jest.fn().mockResolvedValue(1),
      },
      moduleConfig: {
        count: jest.fn().mockResolvedValue(1),
      },
      paymentMethod: {
        findFirst: jest.fn().mockResolvedValue({ id: 'payment-method-1' }),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    },
  }
}

describe('BootstrapService', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    process.env = originalEnv
    jest.restoreAllMocks()
  })

  it('throws in production when BOOTSTRAP_ADMIN_PASSWORD is missing', async () => {
    process.env['NODE_ENV'] = 'production'
    delete process.env['BOOTSTRAP_ADMIN_PASSWORD']
    const { db } = makeDb()
    const service = new BootstrapService(db as any)

    await expect(service.onModuleInit()).rejects.toThrow('BOOTSTRAP_ADMIN_PASSWORD')
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it('uses configured bootstrap password without logging it', async () => {
    process.env['NODE_ENV'] = 'production'
    process.env['BOOTSTRAP_ADMIN_PASSWORD'] = 'LongRandomPassword!234'
    const { db, tx } = makeDb()
    const service = new BootstrapService(db as any)

    await service.onModuleInit()

    expect(tx.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        username: 'superadmin',
        passwordHash: expect.any(String),
      }),
    })
    const logged = [...(Logger.prototype.log as jest.Mock).mock.calls, ...(Logger.prototype.warn as jest.Mock).mock.calls]
      .flat()
      .join('\n')
    expect(logged).not.toContain('LongRandomPassword!234')
    expect(logged).not.toContain('Admin@123')
  })
})
