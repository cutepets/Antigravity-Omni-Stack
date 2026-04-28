jest.mock('../../common/utils/upload.util.js', () => {
  const actual = jest.requireActual('../../common/utils/upload.util.js')
  return {
    ...actual,
    createDiskUploadOptions: jest.fn(() => ({})),
    createMemoryUploadOptions: jest.fn(() => ({})),
    validateUploadedFile: jest.fn(),
    deleteUploadedFile: jest.fn(),
  }
})

import { PetController } from './pet.controller'
import { validateUploadedFile } from '../../common/utils/upload.util.js'

const mockedValidateUploadedFile = jest.mocked(validateUploadedFile)
const makeStorageService = () => ({
  uploadAsset: jest.fn().mockResolvedValue({
    id: 'asset-1',
    url: 'http://localhost:3001/api/storage/assets/asset-1/content',
    reused: false,
  }),
  unbindAssetReference: jest.fn(),
})

const makeActor = () => ({
  userId: 'user-1',
  role: 'STAFF',
  permissions: ['pet.update'],
  branchId: 'branch-1',
  authorizedBranchIds: ['branch-1'],
})

describe('PetController uploads', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('dispatches UpdatePetAvatarCommand after validating the uploaded avatar', async () => {
    const commandBus = { execute: jest.fn().mockResolvedValue({ success: true, data: { id: 'pet-1' } }) }
    const queryBus = { execute: jest.fn() }
    const storageService = makeStorageService()
    const controller = new PetController(commandBus as any, queryBus as any, storageService as any)
    const file = {
      filename: 'avatar.png',
      originalname: 'avatar.png',
      mimetype: 'image/png',
      size: 1024,
      buffer: Buffer.from('avatar'),
    } as Express.Multer.File

    const result = await controller.uploadAvatar('pet-1', { user: makeActor() } as any, file)

    expect(mockedValidateUploadedFile).toHaveBeenCalledWith(
      file,
      expect.objectContaining({ maxFileSize: 5 * 1024 * 1024 }),
    )
    expect(storageService.uploadAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'image',
        scope: 'pets',
        ownerType: 'PET',
        ownerId: 'pet-1',
        fieldName: 'avatar',
      }),
    )
    expect(commandBus.execute).toHaveBeenCalledTimes(1)
    expect((commandBus.execute.mock.calls[0][0] as { avatarUrl: string }).avatarUrl).toBe('http://localhost:3001/api/storage/assets/asset-1/content')
    expect(result.success).toBe(true)
  })

  it('unbinds the uploaded avatar asset when the command fails', async () => {
    const commandError = new Error('command failed')
    const commandBus = { execute: jest.fn().mockRejectedValue(commandError) }
    const queryBus = { execute: jest.fn() }
    const storageService = makeStorageService()
    const controller = new PetController(commandBus as any, queryBus as any, storageService as any)
    const file = {
      filename: 'avatar.png',
      originalname: 'avatar.png',
      mimetype: 'image/png',
      size: 1024,
      buffer: Buffer.from('avatar'),
    } as Express.Multer.File

    await expect(controller.uploadAvatar('pet-1', { user: makeActor() } as any, file)).rejects.toThrow(commandError)

    expect(storageService.unbindAssetReference).toHaveBeenCalledWith({
      assetUrl: 'http://localhost:3001/api/storage/assets/asset-1/content',
      entityType: 'PET',
      entityId: 'pet-1',
      fieldName: 'avatar',
    })
  })

  it('returns vaccine photo url after validation', async () => {
    const storageService = makeStorageService()
    const controller = new PetController({ execute: jest.fn() } as any, { execute: jest.fn() } as any, storageService as any)
    const file = {
      filename: 'vaccine.png',
      originalname: 'vaccine.png',
      mimetype: 'image/png',
      size: 1024,
      buffer: Buffer.from('vaccine'),
    } as Express.Multer.File

    const result = await controller.uploadVaccinePhoto('pet-1', file)

    expect(mockedValidateUploadedFile).toHaveBeenCalledWith(
      file,
      expect.objectContaining({ maxFileSize: 5 * 1024 * 1024 }),
    )
    expect(result).toEqual({
      photoUrl: 'http://localhost:3001/api/storage/assets/asset-1/content',
      assetId: 'asset-1',
      reused: false,
    })
  })
})
