import { Module } from '@nestjs/common'
import { PetService } from './pet.service.js'
import { PetController } from './pet.controller.js'
import { DatabaseModule } from '../../database/database.module.js'

@Module({
  imports: [DatabaseModule],
  controllers: [PetController],
  providers: [PetService],
  exports: [PetService],
})
export class PetModule {}
