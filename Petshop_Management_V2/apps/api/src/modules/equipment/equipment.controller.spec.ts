import { EquipmentController } from './equipment.controller'
import { PERMISSIONS_KEY } from '../../common/decorators/permissions.decorator.js'

describe('EquipmentController', () => {
  it('allows equipment.create to fetch categories and locations for create flow', () => {
    const categoryPermissions = Reflect.getMetadata(PERMISSIONS_KEY, EquipmentController.prototype.getCategories)
    const locationPermissions = Reflect.getMetadata(PERMISSIONS_KEY, EquipmentController.prototype.getLocations)

    expect(categoryPermissions).toEqual(
      expect.arrayContaining(['equipment.read', 'equipment.create', 'equipment.config']),
    )
    expect(locationPermissions).toEqual(
      expect.arrayContaining(['equipment.read', 'equipment.create', 'equipment.config']),
    )
  })

  it('uploads images through the equipment storage scope', async () => {
    const equipmentService = {} as any
    const storageService = {
      uploadAsset: jest.fn().mockResolvedValue({
        id: 'asset-1',
        url: 'http://localhost:3001/api/storage/assets/asset-1/content',
      }),
    }
    const controller = new EquipmentController(equipmentService, storageService as any)

    const result = await controller.uploadImage(
      {
        originalname: 'equipment.png',
        mimetype: 'image/png',
        size: 123,
        buffer: Buffer.from('file'),
      } as Express.Multer.File,
      { user: { userId: 'user-1' } } as any,
    )

    expect(storageService.uploadAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'image',
        scope: 'equipment',
      }),
    )
    expect(result).toEqual({
      success: true,
      url: 'http://localhost:3001/api/storage/assets/asset-1/content',
    })
  })
})
