import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'
import { ModuleGuard } from '../../common/guards/module.guard.js'
import { DatabaseModule } from '../../database/database.module.js'
import { StorageModule } from '../storage/storage.module.js'
import { AddVaccinationHandler } from './application/commands/add-vaccination/add-vaccination.handler.js'
import { AddWeightLogHandler } from './application/commands/add-weight-log/add-weight-log.handler.js'
import { CreatePetHandler } from './application/commands/create-pet/create-pet.handler.js'
import { DeletePetHandler } from './application/commands/delete-pet/delete-pet.handler.js'
import { SyncPetAttributeHandler } from './application/commands/sync-pet-attribute/sync-pet-attribute.handler.js'
import { UpdatePetAvatarHandler } from './application/commands/update-pet-avatar/update-pet-avatar.handler.js'
import { UpdatePetHandler } from './application/commands/update-pet/update-pet.handler.js'
import {
  PET_MEDICAL_RECORDS,
} from './application/ports/pet-medical-records.port.js'
import { PET_READ_MODEL } from './application/ports/pet-read-model.port.js'
import { PET_REFERENCE_LOOKUP } from './application/ports/pet-reference-lookup.port.js'
import { PetAccessPolicy } from './application/policies/pet-access.policy.js'
import { FindPetHandler } from './application/queries/find-pet/find-pet.handler.js'
import { FindPetsHandler } from './application/queries/find-pets/find-pets.handler.js'
import { GetActivePetServicesHandler } from './application/queries/get-active-pet-services/get-active-pet-services.handler.js'
import { PET_REPOSITORY } from './domain/ports/pet.repository.js'
import { PrismaPetMedicalRecords } from './infrastructure/adapters/prisma-pet-medical-records.js'
import { PrismaPetReadModel } from './infrastructure/adapters/prisma-pet-read-model.js'
import { PrismaPetReferenceLookup } from './infrastructure/adapters/prisma-pet-reference-lookup.js'
import { PrismaPetRepository } from './infrastructure/repositories/prisma-pet.repository.js'
import { PetController } from './pet.controller.js'

const CommandHandlers = [
  CreatePetHandler,
  UpdatePetHandler,
  DeletePetHandler,
  AddWeightLogHandler,
  AddVaccinationHandler,
  UpdatePetAvatarHandler,
  SyncPetAttributeHandler,
]

const QueryHandlers = [
  FindPetHandler,
  FindPetsHandler,
  GetActivePetServicesHandler,
]

@Module({
  imports: [CqrsModule, DatabaseModule, StorageModule],
  controllers: [PetController],
  providers: [
    PetAccessPolicy,
    {
      provide: PET_REPOSITORY,
      useClass: PrismaPetRepository,
    },
    {
      provide: PET_REFERENCE_LOOKUP,
      useClass: PrismaPetReferenceLookup,
    },
    {
      provide: PET_READ_MODEL,
      useClass: PrismaPetReadModel,
    },
    {
      provide: PET_MEDICAL_RECORDS,
      useClass: PrismaPetMedicalRecords,
    },
    ...CommandHandlers,
    ...QueryHandlers,
    ModuleGuard,
  ],
  exports: [PET_REPOSITORY, PET_REFERENCE_LOOKUP, PET_READ_MODEL, PET_MEDICAL_RECORDS, PetAccessPolicy],
})
export class PetModule {}
