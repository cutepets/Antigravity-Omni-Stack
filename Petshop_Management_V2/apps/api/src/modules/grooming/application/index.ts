import { CreateGroomingHandler } from './commands/create-grooming/create-grooming.handler.js'
import { UpdateGroomingHandler } from './commands/update-grooming/update-grooming.handler.js'
import { DeleteGroomingHandler } from './commands/delete-grooming/delete-grooming.handler.js'
import { FindGroomingsHandler } from './queries/find-groomings/find-groomings.handler.js'
import { FindGroomingHandler } from './queries/find-grooming/find-grooming.handler.js'
import { GetGroomingPackagesHandler } from './queries/get-grooming-packages/get-grooming-packages.handler.js'
import { CalculateGroomingPriceHandler } from './queries/calculate-grooming-price/calculate-grooming-price.handler.js'

export const CommandHandlers = [
    CreateGroomingHandler,
    UpdateGroomingHandler,
    DeleteGroomingHandler,
]

export const QueryHandlers = [
    FindGroomingsHandler,
    FindGroomingHandler,
    GetGroomingPackagesHandler,
    CalculateGroomingPriceHandler,
]
