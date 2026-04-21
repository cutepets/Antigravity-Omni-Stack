import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Request } from 'express'
import type { JwtPayload } from '@petshop/shared'
import { Permissions } from '../../common/decorators/permissions.decorator.js'
import { RequireModule } from '../../common/decorators/require-module.decorator.js'
import { PermissionsGuard } from '../../common/guards/permissions.guard.js'
import { getRequestedBranchId } from '../../common/utils/request-branch.util.js'
import {
  createDiskUploadOptions,
  deleteUploadedFile,
  IMAGE_UPLOAD_EXTENSIONS,
  validateUploadedFile,
} from '../../common/utils/upload.util.js'
import { JwtGuard } from '../auth/guards/jwt.guard.js'
import { AddVaccinationCommand } from './application/commands/add-vaccination/add-vaccination.command.js'
import { AddWeightLogCommand } from './application/commands/add-weight-log/add-weight-log.command.js'
import { CreatePetCommand } from './application/commands/create-pet/create-pet.command.js'
import { DeletePetCommand } from './application/commands/delete-pet/delete-pet.command.js'
import { SyncPetAttributeCommand } from './application/commands/sync-pet-attribute/sync-pet-attribute.command.js'
import { UpdatePetAvatarCommand } from './application/commands/update-pet-avatar/update-pet-avatar.command.js'
import { UpdatePetCommand } from './application/commands/update-pet/update-pet.command.js'
import { FindPetQuery } from './application/queries/find-pet/find-pet.query.js'
import { FindPetsQuery } from './application/queries/find-pets/find-pets.query.js'
import { GetActivePetServicesQuery } from './application/queries/get-active-pet-services/get-active-pet-services.query.js'
import { AddVaccinationDto } from './dto/add-vaccination.dto.js'
import { AddWeightLogDto } from './dto/add-weight-log.dto.js'
import { CreatePetDto } from './dto/create-pet.dto.js'
import { FindPetsDto } from './dto/find-pets.dto.js'
import { SyncAttributeDto } from './dto/sync-attribute.dto.js'
import { UpdatePetDto } from './dto/update-pet.dto.js'

interface AuthenticatedRequest extends Request {
  user?: JwtPayload
}

const MAX_IMAGE_UPLOAD_SIZE = 5 * 1024 * 1024
const ALLOWED_PET_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
])

const petImageUploadValidation = {
  allowedMimeTypes: ALLOWED_PET_IMAGE_MIME_TYPES,
  allowedExtensions: IMAGE_UPLOAD_EXTENSIONS,
  maxFileSize: MAX_IMAGE_UPLOAD_SIZE,
  errorMessage: 'Định dạng ảnh không hợp lệ',
}

@RequireModule('pet')
@Controller('pets')
@UseGuards(JwtGuard, PermissionsGuard)
export class PetController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @Permissions('pet.create')
  create(@Body() createPetDto: CreatePetDto, @Req() req: AuthenticatedRequest) {
    return this.commandBus.execute(
      new CreatePetCommand(createPetDto, req.user!, getRequestedBranchId(req)),
    )
  }

  @Get()
  @Permissions('pet.read')
  findAll(@Query() query: FindPetsDto, @Req() req: AuthenticatedRequest) {
    return this.queryBus.execute(
      new FindPetsQuery(
        {
          q: query.q,
          species: query.species,
          gender: query.gender,
          customerId: query.customerId,
          page: query.page,
          limit: query.limit,
        },
        req.user,
      ),
    )
  }

  @Get(':id')
  @Permissions('pet.read')
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.queryBus.execute(new FindPetQuery(id, req.user))
  }

  @Put(':id')
  @Permissions('pet.update')
  update(@Param('id') id: string, @Body() updatePetDto: UpdatePetDto, @Req() req: AuthenticatedRequest) {
    return this.commandBus.execute(
      new UpdatePetCommand(id, updatePetDto, req.user!, getRequestedBranchId(req)),
    )
  }

  @Delete(':id')
  @Permissions('pet.delete')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.commandBus.execute(new DeletePetCommand(id, req.user!))
  }

  @Get(':id/active-services')
  @Permissions('pet.read')
  getActivePetServices(@Param('id') petId: string, @Req() req: AuthenticatedRequest) {
    return this.queryBus.execute(new GetActivePetServicesQuery(petId, req.user))
  }

  @Post(':id/weight')
  @Permissions('pet.update')
  addWeightLog(@Param('id') id: string, @Body() addWeightLogDto: AddWeightLogDto, @Req() req: AuthenticatedRequest) {
    return this.commandBus.execute(new AddWeightLogCommand(id, addWeightLogDto, req.user))
  }

  @Post(':id/vaccinations')
  @Permissions('pet.update')
  addVaccination(@Param('id') id: string, @Body() addVaccinationDto: AddVaccinationDto, @Req() req: AuthenticatedRequest) {
    return this.commandBus.execute(new AddVaccinationCommand(id, addVaccinationDto, req.user))
  }

  @Post(':id/avatar')
  @Permissions('pet.update')
  @UseInterceptors(
    FileInterceptor('file', {
      ...createDiskUploadOptions({
        destination: './uploads/pets',
        ...petImageUploadValidation,
      }),
    }),
  )
  async uploadAvatar(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File,
  ) {
    validateUploadedFile(file, petImageUploadValidation)
    const avatarUrl = `/uploads/pets/${file.filename}`

    try {
      return await this.commandBus.execute(new UpdatePetAvatarCommand(id, avatarUrl, req.user))
    } catch (error) {
      try {
        await deleteUploadedFile(avatarUrl, {
          publicPrefix: '/uploads/pets/',
          rootDir: './uploads/pets',
        })
      } catch {
        // Preserve the original domain error when cleanup fails.
      }
      throw error
    }
  }

  @Post(':id/vaccinations/photo')
  @Permissions('pet.update')
  @UseInterceptors(
    FileInterceptor('file', {
      ...createDiskUploadOptions({
        destination: './uploads/vaccines',
        ...petImageUploadValidation,
      }),
    }),
  )
  uploadVaccinePhoto(
    @Param('id') _id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    validateUploadedFile(file, petImageUploadValidation)
    const photoUrl = `/uploads/vaccines/${file.filename}`
    return { photoUrl }
  }

  @Post('sync-attribute')
  @Permissions('settings.app.update')
  syncAttribute(@Body() syncDto: SyncAttributeDto, @Req() req: AuthenticatedRequest) {
    return this.commandBus.execute(new SyncPetAttributeCommand(syncDto, req.user))
  }
}
