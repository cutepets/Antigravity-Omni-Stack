import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common'
import { PetService } from './pet.service.js'
import { CreatePetDto } from './dto/create-pet.dto.js'
import { UpdatePetDto } from './dto/update-pet.dto.js'
import { FindPetsDto } from './dto/find-pets.dto.js'
import { JwtGuard } from '../auth/guards/jwt.guard.js'

@Controller('pets')
@UseGuards(JwtGuard)
export class PetController {
  constructor(private readonly petService: PetService) {}

  @Post()
  create(@Body() createPetDto: CreatePetDto) {
    return this.petService.create(createPetDto)
  }

  @Get()
  findAll(@Query() query: FindPetsDto) {
    return this.petService.findAll(query)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.petService.findOne(id)
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updatePetDto: UpdatePetDto) {
    return this.petService.update(id, updatePetDto)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.petService.remove(id)
  }
}
