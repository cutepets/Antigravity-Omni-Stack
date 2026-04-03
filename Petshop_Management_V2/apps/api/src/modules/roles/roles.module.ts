import { Module } from '@nestjs/common'
import { RolesService } from './roles.service.js'
import { RolesController } from './roles.controller.js'
import { DatabaseModule } from '../../database/database.module.js'

@Module({
  imports: [DatabaseModule],
  controllers: [RolesController],
  providers: [RolesService],
  exports: [RolesService]
})
export class RolesModule {}
