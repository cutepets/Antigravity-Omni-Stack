import { PERMISSIONS_KEY } from '../../common/decorators/permissions.decorator.js'
import { PublicSettingsController, SettingsController } from './settings.controller'

describe('SettingsController permissions', () => {
  it('allows authenticated users to read app branding and module availability', () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, SettingsController.prototype.getConfigs)).toBeUndefined()
    expect(Reflect.getMetadata(PERMISSIONS_KEY, SettingsController.prototype.getModules)).toBeUndefined()
  })

  it('keeps app config and module mutations restricted to settings updates', () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, SettingsController.prototype.updateConfigs)).toEqual([
      'settings.app.update',
    ])
    expect(Reflect.getMetadata(PERMISSIONS_KEY, SettingsController.prototype.toggleModule)).toEqual([
      'settings.app.update',
    ])
  })
})

describe('PublicSettingsController', () => {
  it('exposes branding without permissions metadata', async () => {
    const settingsService = {
      getPublicBranding: jest.fn().mockResolvedValue({
        success: true,
        data: { shopName: 'Cutepets Hanoi', shopLogo: null },
      }),
    } as any

    const controller = new PublicSettingsController(settingsService)

    await expect(controller.getPublicBranding()).resolves.toEqual({
      success: true,
      data: { shopName: 'Cutepets Hanoi', shopLogo: null },
    })
    expect(settingsService.getPublicBranding).toHaveBeenCalledWith()
    expect(Reflect.getMetadata(PERMISSIONS_KEY, PublicSettingsController.prototype.getPublicBranding)).toBeUndefined()
  })
})
