import { SetMetadata } from '@nestjs/common'
import { MODULE_KEY } from '../guards/module.guard.js'

/**
 * Decorator để đánh dấu controller/handler yêu cầu module phải được bật.
 *
 * @example
 * @RequireModule('pet')
 * @Controller('pets')
 * export class PetController { }
 */
export const RequireModule = (moduleKey: string) => SetMetadata(MODULE_KEY, moduleKey)
