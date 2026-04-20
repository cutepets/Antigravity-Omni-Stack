import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { DatabaseModule } from '../../database/database.module.js'
import { ModuleGuard } from '../../common/guards/module.guard.js'

// Presentation
import { PetController } from './pet.controller.js'

// Application layer (legacy service — retained for special endpoints not yet migrated to CQRS)
// See: addWeightLog, addVaccination, updateAvatar, getActivePetServices, syncAttribute
import { PetService } from './pet.service.js'

// Domain
import { PET_REPOSITORY } from './domain/ports/pet.repository.js'

// Infrastructure adapter
import { PrismaPetRepository } from './infrastructure/repositories/prisma-pet.repository.js'

// CQRS — Command Handlers
import { CreatePetHandler } from './application/commands/create-pet/create-pet.handler.js'
import { UpdatePetHandler } from './application/commands/update-pet/update-pet.handler.js'
import { DeletePetHandler } from './application/commands/delete-pet/delete-pet.handler.js'

// CQRS — Query Handlers
import { FindPetHandler } from './application/queries/find-pet/find-pet.handler.js'
import { FindPetsHandler } from './application/queries/find-pets/find-pets.handler.js'

const CommandHandlers = [CreatePetHandler, UpdatePetHandler, DeletePetHandler]
const QueryHandlers = [FindPetHandler, FindPetsHandler]

@Module({
  imports: [CqrsModule, DatabaseModule],
  controllers: [PetController],
  providers: [
    // Legacy service (Phase 2 complete — only special endpoints remain)
    PetService,
    // Repository binding: IPetRepository → PrismaPetRepository
    {
      provide: PET_REPOSITORY,
      useClass: PrismaPetRepository,
    },
    // CQRS handlers — Phase 2 complete: PetController dispatches via CommandBus/QueryBus
    ...CommandHandlers,
    ...QueryHandlers,
    // Module toggle guard
    ModuleGuard,
  ],
  exports: [PetService, PET_REPOSITORY],
})
export class PetModule { }

