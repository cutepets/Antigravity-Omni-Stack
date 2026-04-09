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
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { randomUUID } from 'crypto'
import { extname } from 'path'
import * as fs from 'fs'
import type { Request } from 'express'
import type { JwtPayload } from '@petshop/shared'
import { Permissions } from '../../common/decorators/permissions.decorator.js'
import { PermissionsGuard } from '../../common/guards/permissions.guard.js'
import { getRequestedBranchId } from '../../common/utils/request-branch.util.js'
import { JwtGuard } from '../auth/guards/jwt.guard.js'
import { FindPetsDto } from './dto/find-pets.dto.js'
import { CreatePetDto } from './dto/create-pet.dto.js'
import { UpdatePetDto } from './dto/update-pet.dto.js'
import { PetService } from './pet.service.js'

interface AuthenticatedRequest extends Request {
  user?: JwtPayload
}

@Controller('pets')
@UseGuards(JwtGuard, PermissionsGuard)
export class PetController {
  constructor(private readonly petService: PetService) {}

  @Post()
  @Permissions('pet.create')
  create(@Body() createPetDto: CreatePetDto, @Req() req: AuthenticatedRequest) {
    return this.petService.create(createPetDto, req.user, getRequestedBranchId(req))
  }

  @Get()
  @Permissions('pet.read')
  findAll(@Query() query: FindPetsDto, @Req() req: AuthenticatedRequest) {
    return this.petService.findAll(query, req.user)
  }

  @Get(':id')
  @Permissions('pet.read')
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.petService.findOne(id, req.user)
  }

  @Put(':id')
  @Permissions('pet.update')
  update(@Param('id') id: string, @Body() updatePetDto: UpdatePetDto, @Req() req: AuthenticatedRequest) {
    return this.petService.update(id, updatePetDto, req.user, getRequestedBranchId(req))
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
    }),
  )
  uploadAvatar(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB limit
          new FileTypeValidator({ fileType: '.(png|jpeg|jpg|webp)' }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    const avatarUrl = `/uploads/pets/${file.filename}`
    return this.petService.updateAvatar(id, avatarUrl, req.user)
  }

  @Delete(':id')
  @Permissions('pet.delete')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.petService.remove(id, req.user)
  }
}
