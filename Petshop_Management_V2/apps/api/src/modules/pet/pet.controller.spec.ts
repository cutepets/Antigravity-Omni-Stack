jest.mock('../../common/utils/upload.util.js', () => {
  const actual = jest.requireActual('../../common/utils/upload.util.js')
  return {
    ...actual,
    createDiskUploadOptions: jest.fn(() => ({})),
    validateUploadedFile: jest.fn(),
    deleteUploadedFile: jest.fn(),
  }
})

import { PetController } from './pet.controller'
import { deleteUploadedFile, validateUploadedFile } from '../../common/utils/upload.util.js'

const mockedValidateUploadedFile = jest.mocked(validateUploadedFile)
const mockedDeleteUploadedFile = jest.mocked(deleteUploadedFile)

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
    const controller = new PetController(commandBus as any, queryBus as any)
    const file = {
      filename: 'avatar.png',
      originalname: 'avatar.png',
      mimetype: 'image/png',
      size: 1024,
    } as Express.Multer.File

    const result = await controller.uploadAvatar('pet-1', { user: makeActor() } as any, file)

    expect(mockedValidateUploadedFile).toHaveBeenCalledWith(
      file,
      expect.objectContaining({ maxFileSize: 5 * 1024 * 1024 }),
    )
    expect(commandBus.execute).toHaveBeenCalledTimes(1)
    expect((commandBus.execute.mock.calls[0][0] as { avatarUrl: string }).avatarUrl).toBe('/uploads/pets/avatar.png')
    expect(result.success).toBe(true)
  })

  it('cleans up the uploaded avatar file when the command fails', async () => {
    const commandError = new Error('command failed')
    const commandBus = { execute: jest.fn().mockRejectedValue(commandError) }
    const queryBus = { execute: jest.fn() }
    const controller = new PetController(commandBus as any, queryBus as any)
    const file = {
      filename: 'avatar.png',
      originalname: 'avatar.png',
      mimetype: 'image/png',
      size: 1024,
    } as Express.Multer.File

    await expect(controller.uploadAvatar('pet-1', { user: makeActor() } as any, file)).rejects.toThrow(commandError)

    expect(mockedDeleteUploadedFile).toHaveBeenCalledWith('/uploads/pets/avatar.png', {
      publicPrefix: '/uploads/pets/',
      rootDir: './uploads/pets',
    })
  })

  it('returns vaccine photo url after validation', () => {
    const controller = new PetController({ execute: jest.fn() } as any, { execute: jest.fn() } as any)
    const file = {
      filename: 'vaccine.png',
      originalname: 'vaccine.png',
      mimetype: 'image/png',
      size: 1024,
    } as Express.Multer.File

    const result = controller.uploadVaccinePhoto('pet-1', file)

    expect(mockedValidateUploadedFile).toHaveBeenCalledWith(
      file,
      expect.objectContaining({ maxFileSize: 5 * 1024 * 1024 }),
    )
    expect(result).toEqual({ photoUrl: '/uploads/vaccines/vaccine.png' })
  })
})
