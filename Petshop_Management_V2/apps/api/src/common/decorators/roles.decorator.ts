import { SetMetadata } from '@nestjs/common'
import { StaffRole } from '@petshop/database'

export const ROLES_KEY = 'roles'
export const Roles = (...roles: StaffRole[]) => SetMetadata(ROLES_KEY, roles)
