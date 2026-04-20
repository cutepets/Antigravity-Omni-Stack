import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { randomUUID } from 'crypto'
import { extname } from 'path'
import * as fs from 'fs'
import type { Request } from 'express'
import type { JwtPayload } from '@petshop/shared'
import { Permissions } from '../../common/decorators/permissions.decorator.js'
import { RequireModule } from '../../common/decorators/require-module.decorator.js'
import { PermissionsGuard } from '../../common/guards/permissions.guard.js'
import { getRequestedBranchId } from '../../common/utils/request-branch.util.js'
import { JwtGuard } from '../auth/guards/jwt.guard.js'
import { FindPetsDto } from './dto/find-pets.dto.js'
import { CreatePetDto } from './dto/create-pet.dto.js'
import { UpdatePetDto } from './dto/update-pet.dto.js'
import { AddVaccinationDto } from './dto/add-vaccination.dto.js'
import { AddWeightLogDto } from './dto/add-weight-log.dto.js'
import { SyncAttributeDto } from './dto/sync-attribute.dto.js'
import { PetService } from './pet.service.js'
// CQRS Commands
import { CreatePetCommand } from './application/commands/create-pet/create-pet.command.js'
import { UpdatePetCommand } from './application/commands/update-pet/update-pet.command.js'
import { DeletePetCommand } from './application/commands/delete-pet/delete-pet.command.js'
// CQRS Queries
import { FindPetQuery } from './application/queries/find-pet/find-pet.query.js'
import { FindPetsQuery } from './application/queries/find-pets/find-pets.query.js'

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

const imageUploadFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (ALLOWED_PET_IMAGE_MIME_TYPES.has(file.mimetype)) {
    cb(null, true)
    return
  }

  cb(new BadRequestException(`Định dạng ảnh không hợp lệ: ${file.mimetype}`), false)
}

@RequireModule('pet')
@Controller('pets')
@UseGuards(JwtGuard, PermissionsGuard)
export class PetController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    // PetService retained for special endpoints not yet migrated to CQRS
    private readonly petService: PetService,
  ) { }

  // ─────────────────────────────────────────────────────────────────────────────
  // Core CRUD — dispatched via CommandBus / QueryBus (Phase 2 complete)
  // ─────────────────────────────────────────────────────────────────────────────

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
  findOne(@Param('id') id: string, @Req() _req: AuthenticatedRequest) {
    return this.queryBus.execute(new FindPetQuery(id))
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

  // ─────────────────────────────────────────────────────────────────────────────
  // Special endpoints — still delegated to PetService (pending own CQRS handlers)
  // ─────────────────────────────────────────────────────────────────────────────

  @Get(':id/active-services')
  @Permissions('pet.read')
  async getActivePetServices(@Param('id') petId: string) {
    return this.petService.getActivePetServices(petId)
  }

  @Post(':id/weight')
  @Permissions('pet.update')
  addWeightLog(@Param('id') id: string, @Body() addWeightLogDto: AddWeightLogDto, @Req() req: AuthenticatedRequest) {
    return this.petService.addWeightLog(id, addWeightLogDto, req.user)
  }

  @Post(':id/vaccinations')
  @Permissions('pet.update')
  addVaccination(@Param('id') id: string, @Body() addVaccinationDto: AddVaccinationDto, @Req() req: AuthenticatedRequest) {
    return this.petService.addVaccination(id, addVaccinationDto, req.user)
  }

  @Post(':id/avatar')
  @Permissions('pet.update')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = './uploads/pets'
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true })
          }
          cb(null, uploadPath)
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = randomUUID()
          const ext = extname(file.originalname)
          cb(null, `${uniqueSuffix}${ext}`)
        },
      }),
      fileFilter: imageUploadFileFilter,
      limits: { fileSize: MAX_IMAGE_UPLOAD_SIZE },
    }),
  )
  uploadAvatar(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_IMAGE_UPLOAD_SIZE }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    const avatarUrl = `/uploads/pets/${file.filename}`
    return this.petService.updateAvatar(id, avatarUrl, req.user)
  }

  @Post(':id/vaccinations/photo')
  @Permissions('pet.update')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = './uploads/vaccines'
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true })
          }
          cb(null, uploadPath)
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = randomUUID()
          const ext = extname(file.originalname)
          cb(null, `${uniqueSuffix}${ext}`)
        },
      }),
      fileFilter: imageUploadFileFilter,
      limits: { fileSize: MAX_IMAGE_UPLOAD_SIZE },
    }),
  )
  uploadVaccinePhoto(
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_IMAGE_UPLOAD_SIZE }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    const photoUrl = `/uploads/vaccines/${file.filename}`
    return { photoUrl }
  }

  @Post('sync-attribute')
  @Permissions('settings.app.update')
  syncAttribute(@Body() syncDto: SyncAttributeDto, @Req() req: AuthenticatedRequest) {
    return this.petService.syncAttribute(syncDto, req.user)
  }
}
