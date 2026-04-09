import { Injectable, ConflictException, NotFoundException } from '@nestjs/common'
import * as bcrypt from 'bcryptjs'
import { DatabaseService } from '../../database/database.service.js'
import type { AuthUser } from '@petshop/shared'

export interface CreateStaffDto {
  username: string
  password?: string
  fullName: string
  role?: string
  phone?: string
  email?: string
  branchId?: string
  authorizedBranchIds?: string[]
  
  gender?: string
  dob?: string
  identityCode?: string
  emergencyContactTitle?: string
  emergencyContactPhone?: string
  shiftStart?: string
  shiftEnd?: string
  baseSalary?: number
  spaCommissionRate?: number
  employmentType?: string
  joinDate?: string
}

export interface UpdateStaffDto {
  fullName?: string
  role?: string
  status?: string
  phone?: string
  email?: string
  branchId?: string
  authorizedBranchIds?: string[]

  gender?: string
  dob?: string
  identityCode?: string
  emergencyContactTitle?: string
  emergencyContactPhone?: string
  shiftStart?: string
  shiftEnd?: string
  baseSalary?: number
  spaCommissionRate?: number
  employmentType?: string
  joinDate?: string
  password?: string
  avatar?: string
}

@Injectable()
export class StaffService {
  constructor(private readonly db: DatabaseService) {}

  async findAll() {
    return this.db.user.findMany({
      select: {
        id: true, staffCode: true, username: true, fullName: true,
        role: true, status: true, phone: true, email: true, avatar: true, createdAt: true,
        gender: true, employmentType: true, shiftStart: true, shiftEnd: true, baseSalary: true, branchId: true,
        branch: { select: { id: true, name: true } },
        authorizedBranches: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findById(idOrUsername: string) {
    const user = await this.db.user.findFirst({
      where: {
        OR: [{ id: idOrUsername }, { username: idOrUsername }]
      },
      select: {
        id: true, staffCode: true, username: true, fullName: true,
        role: true, status: true, phone: true, email: true, avatar: true,
        branchId: true, joinDate: true, createdAt: true,
        gender: true, dob: true, identityCode: true, emergencyContactTitle: true, emergencyContactPhone: true,
        shiftStart: true, shiftEnd: true, baseSalary: true, spaCommissionRate: true, employmentType: true,
        authorizedBranches: { select: { id: true, name: true } },
      },
    })
    if (!user) throw new NotFoundException('Không tìm thấy nhân viên')
    return user
  }

  async create(dto: CreateStaffDto) {
    const exists = await this.db.user.findFirst({
      where: {
        OR: [
          { username: dto.username },
          ...(dto.phone ? [{ phone: dto.phone }] : [])
        ],
      },
    })
    if (exists) throw new ConflictException('Username hoặc số điện thoại đã tồn tại')

    const count = await this.db.user.count()
    const staffCode = `NV${String(count + 1).padStart(5, '0')}`

    const passwordToHash = dto.password || 'Petshop@123'
    const passwordHash = await bcrypt.hash(passwordToHash, 12)

    return this.db.user.create({
      data: {
        staffCode,
        username: dto.username,
        passwordHash,
        fullName: dto.fullName,
        roleId: dto.role || null,
        phone: dto.phone || null,
        email: dto.email || null,
        branchId: dto.branchId || null,
        ...(dto.authorizedBranchIds && {
          authorizedBranches: { connect: dto.authorizedBranchIds.map(id => ({ id })) },
        }),
        
        gender: dto.gender || null,
        dob: dto.dob ? new Date(dto.dob) : null,
        identityCode: dto.identityCode || null,
        emergencyContactTitle: dto.emergencyContactTitle || null,
        emergencyContactPhone: dto.emergencyContactPhone || null,
        shiftStart: dto.shiftStart || null,
        shiftEnd: dto.shiftEnd || null,
        baseSalary: dto.baseSalary ? Number(dto.baseSalary) : null,
        spaCommissionRate: dto.spaCommissionRate ? Number(dto.spaCommissionRate) : null,
        employmentType: (dto.employmentType as any) || 'FULL_TIME',
        joinDate: dto.joinDate ? new Date(dto.joinDate) : null,
      },
      select: {
        id: true, staffCode: true, username: true, fullName: true,
        role: true, status: true, createdAt: true, branchId: true,
        authorizedBranches: { select: { id: true, name: true } },
      },
    })
  }

  async update(id: string, dto: UpdateStaffDto) {
    const user = await this.findById(id)

    if (dto.phone) {
      const exists = await this.db.user.findFirst({
        where: { phone: dto.phone, id: { not: id } },
      })
      if (exists) throw new ConflictException('Số điện thoại đã được sử dụng bởi người khác')
    }

    let passwordHash
    if (dto.password) {
      passwordHash = await bcrypt.hash(dto.password, 12)
    }

    return this.db.user.update({
      where: { id },
      data: {
        ...(passwordHash && { passwordHash }),
        ...('fullName' in dto && dto.fullName !== undefined && { fullName: dto.fullName }),
        ...('role' in dto && { roleId: dto.role || null }),
        ...('status' in dto && dto.status !== undefined && { status: dto.status as any }),
        ...('phone' in dto && { phone: dto.phone || null }),
        ...('email' in dto && { email: dto.email || null }),
        ...('branchId' in dto && { branchId: dto.branchId || null }),
        ...('avatar' in dto && { avatar: dto.avatar || null }),
        ...('authorizedBranchIds' in dto && {
          authorizedBranches: {
            set: (dto.authorizedBranchIds ?? []).map(bid => ({ id: bid })),
          },
        }),

        ...('gender' in dto && { gender: dto.gender || null }),
        ...('dob' in dto && { dob: dto.dob ? new Date(dto.dob) : null }),
        ...('identityCode' in dto && { identityCode: dto.identityCode || null }),
        ...('emergencyContactTitle' in dto && { emergencyContactTitle: dto.emergencyContactTitle || null }),
        ...('emergencyContactPhone' in dto && { emergencyContactPhone: dto.emergencyContactPhone || null }),
        ...('shiftStart' in dto && { shiftStart: dto.shiftStart || null }),
        ...('shiftEnd' in dto && { shiftEnd: dto.shiftEnd || null }),
        ...('baseSalary' in dto && { baseSalary: dto.baseSalary ? Number(dto.baseSalary) : null }),
        ...('spaCommissionRate' in dto && { spaCommissionRate: dto.spaCommissionRate ? Number(dto.spaCommissionRate) : null }),
        ...('employmentType' in dto && { employmentType: dto.employmentType as any }),
        ...('joinDate' in dto && { joinDate: dto.joinDate ? new Date(dto.joinDate) : null }),
      },
      select: {
        id: true, staffCode: true, username: true, fullName: true,
        role: true, status: true, phone: true, email: true, branchId: true,
        authorizedBranches: { select: { id: true, name: true } },
      },
    })
  }

  async deactivate(id: string) {
    await this.findById(id) // Ensure exists
    return this.db.user.update({
      where: { id },
      data: { status: 'RESIGNED' as any }, // Soft delete by marking as RESIGNED or QUIT
      select: { id: true, staffCode: true, status: true }
    })
  }
}
