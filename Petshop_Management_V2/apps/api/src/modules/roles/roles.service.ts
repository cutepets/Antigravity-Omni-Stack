import { Injectable, ConflictException, NotFoundException } from '@nestjs/common'
import { DatabaseService } from '../../database/database.service.js'
import { CreateRoleDto } from './dto/create-role.dto.js'
import { UpdateRoleDto } from './dto/update-role.dto.js'

@Injectable()
export class RolesService {
  constructor(private readonly db: DatabaseService) {}

  async findAll() {
    return this.db.role.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
         _count: {
            select: { users: true }
         }
      }
    })
  }

  async findById(id: string) {
    const role = await this.db.role.findUnique({ where: { id } })
    if (!role) throw new NotFoundException('Vai trò không tồn tại')
    return role
  }

  async create(dto: CreateRoleDto) {
    const existingCode = await (this.db.role as any).findUnique({ where: { code: dto.code } })
    if (existingCode) throw new ConflictException('Mã vai trò đã tồn tại')
    
    const existingName = await (this.db.role as any).findUnique({ where: { name: dto.name } })
    if (existingName) throw new ConflictException('Tên vai trò đã tồn tại')

    return (this.db.role as any).create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        permissions: dto.permissions,
        isSystem: false
      }
    })
  }

  async update(id: string, dto: UpdateRoleDto) {
    const role: any = await this.findById(id)
    if (role.isSystem) {
       throw new ConflictException('Không thể sửa vai trò hệ thống')
    }

    if (dto.code && dto.code !== role.code) {
       const existingCode = await (this.db.role as any).findUnique({ where: { code: dto.code } })
       if (existingCode) throw new ConflictException('Mã vai trò đã tồn tại')
    }
    
    if (dto.name && dto.name !== role.name) {
       const existingName = await (this.db.role as any).findUnique({ where: { name: dto.name } })
       if (existingName) throw new ConflictException('Tên vai trò đã tồn tại')
    }

    const updateData: any = {}
    if (dto.code !== undefined) updateData.code = dto.code
    if (dto.name !== undefined) updateData.name = dto.name
    if (dto.description !== undefined) updateData.description = dto.description
    if (dto.permissions !== undefined) updateData.permissions = dto.permissions

    return (this.db.role as any).update({
      where: { id },
      data: updateData
    })
  }

  async delete(id: string) {
    const role: any = await this.findById(id)
    if (role.isSystem) {
       throw new ConflictException('Không thể xóa vai trò hệ thống')
    }
    
    const usersWithRole = await (this.db.user as any).count({ where: { roleId: id } })
    if (usersWithRole > 0) {
       throw new ConflictException('Không thể xóa vai trò vì đang có nhân viên sử dụng')
    }

    await (this.db.role as any).delete({ where: { id } })
    return { success: true }
  }
}
