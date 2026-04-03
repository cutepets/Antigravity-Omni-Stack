import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { CreateHotelStayDto, CreateCageDto } from './dto/create-hotel.dto.js';
import { UpdateHotelStayDto, UpdateCageDto } from './dto/update-hotel.dto.js';

@Injectable()
export class HotelService {
  constructor(private readonly prisma: DatabaseService) {}

  // ================= CAGE =================
  async createCage(data: CreateCageDto) {
    return this.prisma.cage.create({
      data,
    });
  }

  async findAllCages() {
    return this.prisma.cage.findMany({
      where: { isActive: true },
      include: {
        hotelStays: {
          where: {
            status: { in: ['BOOKED', 'CHECKED_IN'] },
          },
          include: {
            pet: {
              include: { customer: true },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async updateCage(id: string, data: UpdateCageDto) {
    return this.prisma.cage.update({
      where: { id },
      data,
    });
  }

  async deleteCage(id: string) {
    return this.prisma.cage.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ================= STAY =================
  async createStay(data: CreateHotelStayDto) {
    return this.prisma.hotelStay.create({
      data: {
        petId: data.petId,
        petName: data.petName,
        customerId: data.customerId || null,
        cageId: data.cageId || null,
        checkIn: new Date(data.checkIn),
        estimatedCheckOut: data.estimatedCheckOut ? new Date(data.estimatedCheckOut) : null,
        notes: data.notes || '',
        price: data.price || 0,
        ...(data.lineType && { lineType: data.lineType }),
      },
      include: {
        pet: true,
        cage: true,
      },
    });
  }

  async updateStay(id: string, data: UpdateHotelStayDto) {
    const stay = await this.prisma.hotelStay.findUnique({ where: { id } });
    if (!stay) throw new NotFoundException('Không tìm thấy kỳ lưu trú');

    const updateData: any = { ...data };

    if (data.checkIn) updateData.checkIn = new Date(data.checkIn);
    if (data.checkOut) updateData.checkOut = new Date(data.checkOut);
    if (data.estimatedCheckOut) updateData.estimatedCheckOut = new Date(data.estimatedCheckOut);

    // Auto set checkout time if status -> CHECKED_OUT
    if (data.status === 'CHECKED_OUT' && stay.status !== 'CHECKED_OUT') {
      if (!data.checkOut && !stay.checkOut) {
        updateData.checkOut = new Date();
      }
    }

    return this.prisma.hotelStay.update({
      where: { id },
      data: updateData,
      include: {
        pet: true,
        cage: true,
      },
    });
  }

  async findAllStays(query?: any) {
    const where: any = {};
    if (query?.status) where.status = query.status;
    if (query?.cageId) where.cageId = query.cageId;

    return this.prisma.hotelStay.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        pet: {
          include: { customer: { select: { fullName: true, phone: true } } }
        },
        cage: true,
      },
    });
  }

  async deleteStay(id: string) {
    return this.prisma.hotelStay.delete({
      where: { id },
    });
  }
}
