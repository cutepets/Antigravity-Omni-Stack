import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { resolvePermissions } from '@petshop/auth'
import { Prisma } from '@petshop/database'
import type { JwtPayload } from '@petshop/shared'
import { resolveBranchIdentity } from '../../common/utils/branch-identity.util.js'
import { getNextSequentialCode } from '../../common/utils/sequential-code.util.js'
import { DatabaseService } from '../../database/database.service.js'
import { AddVaccinationDto } from './dto/add-vaccination.dto.js'
import { AddWeightLogDto } from './dto/add-weight-log.dto.js'
import { CreatePetDto } from './dto/create-pet.dto.js'
import { FindPetsDto } from './dto/find-pets.dto.js'
import { UpdatePetDto } from './dto/update-pet.dto.js'

type AccessUser = Pick<JwtPayload, 'userId' | 'role' | 'permissions' | 'branchId' | 'authorizedBranchIds'>

@Injectable()
export class PetService {
  constructor(private readonly db: DatabaseService) {}

  private async generatePetCode(): Promise<string> {
    return getNextSequentialCode(this.db, {
      table: 'pets',
      column: 'petCode',
      prefix: 'PET',
    })
  }

  private resolveUserPermissions(user?: AccessUser): Set<string> {
    return new Set(resolvePermissions(user?.permissions ?? []))
  }

  private getAuthorizedBranchIds(user?: AccessUser): string[] {
    return [...new Set([...(user?.authorizedBranchIds ?? []), ...(user?.branchId ? [user.branchId] : [])])]
  }

  private shouldRestrictToPetBranches(user?: AccessUser): boolean {
    if (!user) return false
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return false

    const permissions = this.resolveUserPermissions(user)
    return !permissions.has('branch.access.all')
  }

  private buildLegacyCustomerScope(authorizedBranchIds: string[]): Prisma.CustomerWhereInput {
    return {
      OR: [
        {
          orders: {
            some: {
              branchId: { in: authorizedBranchIds },
            },
          },
        },
        {
          hotelStays: {
            some: {
              branchId: { in: authorizedBranchIds },
            },
          },
        },
        {
          pets: {
            some: {
              branchId: { in: authorizedBranchIds },
            },
          },
        },
      ],
    }
  }

  private buildCustomerScope(user?: AccessUser): Prisma.CustomerWhereInput | null {
    if (!this.shouldRestrictToPetBranches(user)) return null

    const authorizedBranchIds = this.getAuthorizedBranchIds(user)
    const legacyScope = this.buildLegacyCustomerScope(authorizedBranchIds)

    return {
      OR: [
        { branchId: { in: authorizedBranchIds } },
        {
          AND: [
            { branchId: null },
            legacyScope,
          ],
        },
      ],
    }
  }

  private buildPetScope(user?: AccessUser): Prisma.PetWhereInput | null {
    if (!this.shouldRestrictToPetBranches(user)) return null

    const authorizedBranchIds = this.getAuthorizedBranchIds(user)
    const customerScope = this.buildCustomerScope(user)

    return {
      OR: [
        { branchId: { in: authorizedBranchIds } },
        {
          AND: [
            { branchId: null },
            ...(customerScope ? [{ customer: { is: customerScope } }] : []),
          ],
        },
      ],
    }
  }

  private mergePetScope(where: Prisma.PetWhereInput, user?: AccessUser): Prisma.PetWhereInput {
    const scope = this.buildPetScope(user)
    if (!scope) return where
    if (Object.keys(where).length === 0) return scope
    return { AND: [where, scope] }
  }

  private buildPetIdentityWhere(id: string): Prisma.PetWhereInput {
    return { OR: [{ id }, { petCode: id }] }
  }

  private async throwPetAccessError(id: string, user?: AccessUser): Promise<never> {
    if (this.shouldRestrictToPetBranches(user)) {
      const existingPet = await this.db.pet.findFirst({
        where: this.buildPetIdentityWhere(id),
        select: { id: true },
      })

      if (existingPet) {
        throw new ForbiddenException('Bạn chỉ được truy cập dữ liệu thuộc chi nhánh được phân quyền')
      }
    }

    throw new NotFoundException('Không tìm thấy thú cưng')
  }

  private async resolveWriteBranchId(user?: AccessUser, requestedBranchId?: string | null): Promise<string> {
    const branchId = requestedBranchId?.trim() || null

    if (this.shouldRestrictToPetBranches(user)) {
      const authorizedBranchIds = this.getAuthorizedBranchIds(user)
      const targetBranchId = branchId ?? user?.branchId ?? authorizedBranchIds[0] ?? null

      if (!targetBranchId || !authorizedBranchIds.includes(targetBranchId)) {
        throw new ForbiddenException('Bạn chỉ được thao tác dữ liệu thuộc chi nhánh được phân quyền')
      }

      return targetBranchId
    }

    const branch = await resolveBranchIdentity(this.db, branchId ?? user?.branchId ?? null)
    return branch.id
  }

  private async getAccessibleCustomer(customerId: string, user?: AccessUser) {
    const customerScope = this.buildCustomerScope(user)
    const customer = await this.db.customer.findFirst({
      where: customerScope ? { AND: [{ id: customerId }, customerScope] } : { id: customerId },
      select: { id: true, fullName: true, phone: true, branchId: true },
    })

    if (customer) return customer

    const existingCustomer = await this.db.customer.findUnique({
      where: { id: customerId },
      select: { id: true },
    })

    if (!existingCustomer) {
      throw new BadRequestException('Khách hàng không tồn tại')
    }

    throw new ForbiddenException('Bạn chỉ được thao tác dữ liệu thuộc chi nhánh được phân quyền')
  }

  async create(createPetDto: CreatePetDto, user?: AccessUser, requestedBranchId?: string) {
    const { customerId, ...petData } = createPetDto
    const customer = await this.getAccessibleCustomer(customerId, user)
    const fallbackBranchId = await this.resolveWriteBranchId(user, requestedBranchId)
    const effectiveBranchId = customer.branchId ?? fallbackBranchId

    if (!customer.branchId) {
      await this.db.customer.update({
        where: { id: customer.id },
        data: { branchId: effectiveBranchId },
      })
    }

    const petCode = await this.generatePetCode()

    const pet = await this.db.pet.create({
      data: {
        ...petData,
        branchId: effectiveBranchId,
        petCode,
        customerId,
        dateOfBirth: petData.dateOfBirth ? new Date(petData.dateOfBirth) : null,
      },
      include: {
        customer: {
          select: { id: true, fullName: true, phone: true },
        },
      },
    })

    return { success: true, data: pet }
  }

  async findAll(query: FindPetsDto, user?: AccessUser) {
    const { q, species, gender, customerId, page = 1, limit = 10 } = query
    const skip = (page - 1) * limit

    const where = this.mergePetScope({
      ...(species && { species }),
      ...(gender && { gender }),
      ...(customerId && { customerId }),
      ...(q && {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { petCode: { contains: q, mode: 'insensitive' } },
          { microchipId: { contains: q, mode: 'insensitive' } },
        ],
      }),
    }, user)

    const [total, data] = await Promise.all([
      this.db.pet.count({ where }),
      this.db.pet.findMany({
        where,
        skip: Number(skip),
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, fullName: true, phone: true } },
        },
      }),
    ])

    return {
      success: true,
      data,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  async findOne(id: string, user?: AccessUser) {
    const petScope = this.mergePetScope(this.buildPetIdentityWhere(id), user)

    const pet = await this.db.pet.findFirst({
      where: petScope,
      include: {
        customer: { select: { id: true, fullName: true, phone: true } },
        weightLogs: { orderBy: { date: 'desc' }, take: 10 },
        vaccinations: { orderBy: { date: 'desc' }, take: 20 },
        groomingSessions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            sessionCode: true,
            status: true,
            notes: true,
            startTime: true,
            createdAt: true,
          },
        },
        hotelStays: {
          orderBy: { checkIn: 'desc' },
          take: 20,
          select: {
            id: true,
            stayCode: true,
            status: true,
            checkIn: true,
            checkOut: true,
            lineType: true,
          },
        },
      },
    })

    if (!pet) return this.throwPetAccessError(id, user)
    return { success: true, data: pet }
  }

  async update(id: string, updatePetDto: UpdatePetDto, user?: AccessUser, requestedBranchId?: string) {
    const pet = await this.db.pet.findFirst({
      where: this.mergePetScope(this.buildPetIdentityWhere(id), user),
      select: {
        id: true,
        customerId: true,
        branchId: true,
        customer: { select: { branchId: true } },
      },
    })

    if (!pet) return this.throwPetAccessError(id, user)

    let effectiveBranchId = pet.branchId ?? pet.customer.branchId ?? null
    const { customerId, dateOfBirth, ...restData } = updatePetDto
    const dataToUpdate: Prisma.PetUpdateInput = { ...restData }

    if (customerId && customerId !== pet.customerId) {
      const customer = await this.getAccessibleCustomer(customerId, user)
      const fallbackBranchId = await this.resolveWriteBranchId(user, requestedBranchId)
      effectiveBranchId = customer.branchId ?? fallbackBranchId

      if (!customer.branchId) {
        await this.db.customer.update({
          where: { id: customer.id },
          data: { branchId: effectiveBranchId },
        })
      }

      dataToUpdate.customer = { connect: { id: customer.id } }
    }

    if (!effectiveBranchId) {
      effectiveBranchId = await this.resolveWriteBranchId(user, requestedBranchId)
    }

    if (dateOfBirth) {
      dataToUpdate.dateOfBirth = new Date(dateOfBirth)
    }

    dataToUpdate.branch = { connect: { id: effectiveBranchId } }

    const updated = await this.db.pet.update({
      where: { id: pet.id },
      data: dataToUpdate,
      include: {
        customer: { select: { id: true, fullName: true, phone: true } },
      },
    })

    return { success: true, data: updated }
  }

  async addWeightLog(id: string, addWeightLogDto: AddWeightLogDto, user?: AccessUser) {
    const pet = await this.db.pet.findFirst({
      where: this.mergePetScope(this.buildPetIdentityWhere(id), user),
      select: { id: true },
    })

    if (!pet) return this.throwPetAccessError(id, user)

    const weightLog = await this.db.petWeightLog.create({
      data: {
        petId: pet.id,
        weight: addWeightLogDto.weight,
        ...(addWeightLogDto.notes ? { notes: addWeightLogDto.notes } : {}),
        ...(addWeightLogDto.date ? { date: new Date(addWeightLogDto.date) } : {}),
      },
    })

    await this.db.pet.update({
      where: { id: pet.id },
      data: { weight: addWeightLogDto.weight },
    })

    return { success: true, data: weightLog }
  }

  async addVaccination(id: string, addVaccinationDto: AddVaccinationDto, user?: AccessUser) {
    const pet = await this.db.pet.findFirst({
      where: this.mergePetScope(this.buildPetIdentityWhere(id), user),
      select: { id: true },
    })

    if (!pet) return this.throwPetAccessError(id, user)

    const vaccination = await this.db.petVaccination.create({
      data: {
        petId: pet.id,
        vaccineName: addVaccinationDto.vaccineName,
        date: new Date(addVaccinationDto.date),
        ...(addVaccinationDto.nextDueDate ? { nextDueDate: new Date(addVaccinationDto.nextDueDate) } : {}),
        ...(addVaccinationDto.notes ? { notes: addVaccinationDto.notes } : {}),
        ...(addVaccinationDto.photoUrl ? { photoUrl: addVaccinationDto.photoUrl } : {}),
      },
    })

    return { success: true, data: vaccination }
  }

  async remove(id: string, user?: AccessUser) {
    const pet = await this.db.pet.findFirst({
      where: this.mergePetScope(this.buildPetIdentityWhere(id), user),
      select: { id: true },
    })
    if (!pet) return this.throwPetAccessError(id, user)

    await this.db.pet.delete({ where: { id: pet.id } })
    return { success: true }
  }
  async updateAvatar(id: string, avatarUrl: string, user?: AccessUser) {
    const pet = await this.db.pet.findFirst({
      where: this.mergePetScope(this.buildPetIdentityWhere(id), user),
      select: { id: true },
    })
    if (!pet) return this.throwPetAccessError(id, user)

    const updated = await this.db.pet.update({
      where: { id: pet.id },
      data: { avatar: avatarUrl },
    })

    return { success: true, data: updated }
  }

  async getActivePetServices(petId: string) {
    const [groomingSessions, hotelStays] = await Promise.all([
      this.db.groomingSession.findMany({
        where: { petId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
        select: { id: true, sessionCode: true, status: true, orderId: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.db.hotelStay.findMany({
        where: { petId, status: { in: ['BOOKED', 'CHECKED_IN'] } },
        select: { id: true, stayCode: true, status: true, orderId: true, checkIn: true, estimatedCheckOut: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ])
    return { groomingSessions, hotelStays }
  }
}
