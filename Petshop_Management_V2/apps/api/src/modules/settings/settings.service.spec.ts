import { BadRequestException } from '@nestjs/common'
import { SettingsService } from './settings.service'

describe('SettingsService google auth config', () => {
  it('normalizes allowed Google domain when a root URL is pasted', async () => {
    const db = {
      systemConfig: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }) => ({ id: 'config-1', ...data })),
      },
    } as any
    const service = new SettingsService(db)

    const result = await service.updateConfigs({
      googleAuthAllowedDomain: 'https://app.petshophanoi.com/',
    })

    expect(db.systemConfig.create).toHaveBeenCalledWith({
      data: {
        googleAuthAllowedDomain: 'app.petshophanoi.com',
      },
    })
    expect((result.data as any).googleAuthAllowedDomain).toBe('app.petshophanoi.com')
  })

  it('rejects allowed Google domain values with URL paths', async () => {
    const db = {
      systemConfig: {
        findFirst: jest.fn().mockResolvedValue({ id: 'config-1' }),
        update: jest.fn(),
      },
    } as any
    const service = new SettingsService(db)

    await expect(
      service.updateConfigs({
        googleAuthAllowedDomain: 'https://app.petshophanoi.com/login',
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(db.systemConfig.update).not.toHaveBeenCalled()
  })
})
