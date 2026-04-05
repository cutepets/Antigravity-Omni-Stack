import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { PaymentStatus, Prisma } from '@petshop/database';
import { DatabaseService } from '../../database/database.service.js';
import { CreateHotelRateTableDto, CreateHotelStayDto, CreateCageDto } from './dto/create-hotel.dto.js';
import { CalculateHotelPriceDto, CheckoutHotelStayDto, UpdateHotelRateTableDto, UpdateHotelStayDto, UpdateCageDto } from './dto/update-hotel.dto.js';

const ACTIVE_STAY_STATUSES = ['BOOKED', 'CHECKED_IN'] as const;

@Injectable()
export class HotelService {
  constructor(private readonly prisma: DatabaseService) {}

  private readonly stayInclude = {
    pet: {
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            phone: true,
          },
        },
      },
    },
    customer: {
      select: {
        id: true,
        fullName: true,
        phone: true,
      },
    },
    branch: {
      select: {
        id: true,
        name: true,
      },
    },
    cage: true,
    rateTable: true,
    order: {
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        total: true,
        paidAmount: true,
        remainingAmount: true,
      },
    },
  } satisfies Prisma.HotelStayInclude;

  private calcNights(checkIn: Date, checkOut?: Date | null) {
    const end = checkOut ?? new Date();
    const diff = end.getTime() - checkIn.getTime();
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  private calcTotalPrice(params: {
    checkIn: Date;
    checkOut?: Date | null;
    dailyRate?: number | null;
    surcharge?: number | null;
    promotion?: number | null;
  }) {
    const nights = this.calcNights(params.checkIn, params.checkOut);
    const dailyRate = params.dailyRate ?? 0;
    const surcharge = params.surcharge ?? 0;
    const promotion = params.promotion ?? 0;
    return nights * dailyRate + surcharge - promotion;
  }

  private mapStay<T extends Record<string, any>>(stay: T) {
    return {
      ...stay,
      expectedPickup: stay.estimatedCheckOut ?? null,
      receiver: stay.customer ?? stay.pet?.customer ?? null,
    };
  }

  private mapCage<T extends Record<string, any>>(cage: T) {
    const activeStay = Array.isArray(cage.hotelStays)
      ? cage.hotelStays.find((stay: any) => ACTIVE_STAY_STATUSES.includes(stay.status))
      : null;

    return {
      ...cage,
      status: activeStay ? 'OCCUPIED' : 'AVAILABLE',
      currentStay: activeStay ? this.mapStay(activeStay) : null,
      hotelStays: Array.isArray(cage.hotelStays) ? cage.hotelStays.map((stay: any) => this.mapStay(stay)) : [],
    };
  }

  private buildStayCode(date = new Date()) {
    const yymmdd = date.toISOString().slice(2, 10).replace(/-/g, '');
    return `HOTEL-${yymmdd}`;
  }

  private async generateStayCode(checkIn: Date) {
    const prefix = this.buildStayCode(checkIn);
    const start = new Date(checkIn);
    start.setHours(0, 0, 0, 0);
    const end = new Date(checkIn);
    end.setHours(23, 59, 59, 999);

    const count = await this.prisma.hotelStay.count({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
      },
    });

    return `${prefix}-${String(count + 1).padStart(3, '0')}`;
  }

  private async getPetOrThrow(petId: string) {
    const pet = await this.prisma.pet.findUnique({
      where: { id: petId },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            phone: true,
          },
        },
      },
    });

    if (!pet) throw new NotFoundException('Không tìm thấy thú cưng');
    return pet;
  }

  private async ensureStayCanOccupyWindow(params: {
    petId: string;
    checkIn: Date;
    estimatedCheckOut?: Date | null;
    excludeId?: string;
  }) {
    const windowEnd = params.estimatedCheckOut ?? new Date(params.checkIn.getTime() + 24 * 60 * 60 * 1000);

    const overlap = await this.prisma.hotelStay.findFirst({
      where: {
        petId: params.petId,
        status: { in: [...ACTIVE_STAY_STATUSES] },
        ...(params.excludeId ? { NOT: { id: params.excludeId } } : {}),
        checkIn: { lt: windowEnd },
        OR: [
          { estimatedCheckOut: null },
          { estimatedCheckOut: { gt: params.checkIn } },
          { checkOutActual: { gt: params.checkIn } },
          { checkOut: { gt: params.checkIn } },
        ],
      },
      select: {
        id: true,
        stayCode: true,
      },
    });

    if (overlap) {
      throw new BadRequestException(
        `Thú cưng đã có lượt lưu trú trùng thời gian${overlap.stayCode ? ` (${overlap.stayCode})` : ''}.`,
      );
    }
  }

  private async syncLinkedOrder(stayId: string, orderId?: string | null) {
    if (!orderId) return;

    const stay = await this.prisma.hotelStay.findUnique({
      where: { id: stayId },
      select: {
        totalPrice: true,
      },
    });
    if (!stay) return;

    const orderItem = await this.prisma.orderItem.findFirst({
      where: {
        orderId,
        hotelStayId: stayId,
      },
      select: {
        id: true,
      },
    });
    if (!orderItem) return;

    await this.prisma.orderItem.update({
      where: { id: orderItem.id },
      data: {
        unitPrice: stay.totalPrice,
        quantity: 1,
        subtotal: stay.totalPrice,
      },
    });

    const [order, items] = await Promise.all([
      this.prisma.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          paidAmount: true,
          discount: true,
          shippingFee: true,
        },
      }),
      this.prisma.orderItem.findMany({
        where: { orderId },
        select: { subtotal: true },
      }),
    ]);

    if (!order) return;

    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const total = subtotal + order.shippingFee - order.discount;
    const remainingAmount = Math.max(0, total - order.paidAmount);

    let paymentStatus: PaymentStatus = 'UNPAID';
    if (order.paidAmount >= total && total > 0) paymentStatus = 'PAID';
    else if (order.paidAmount > 0) paymentStatus = 'PARTIAL';

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        subtotal,
        total,
        remainingAmount,
        paymentStatus,
      },
    });
  }

  // ================= CAGE =================
  async createCage(data: CreateCageDto) {
    return this.prisma.cage.create({
      data,
    });
  }

  async findAllCages() {
    const cages = await this.prisma.cage.findMany({
      where: { isActive: true },
      include: {
        hotelStays: {
          where: {
            status: { in: [...ACTIVE_STAY_STATUSES] },
          },
          include: this.stayInclude,
          orderBy: { checkIn: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    return cages.map((cage) => this.mapCage(cage));
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

  // ================= RATE TABLE =================
  async createRateTable(data: CreateHotelRateTableDto) {
    return this.prisma.hotelRateTable.create({
      data: {
        name: data.name,
        year: data.year,
        ...(data.species ? { species: data.species } : {}),
        ...(data.minWeight !== undefined ? { minWeight: data.minWeight } : {}),
        ...(data.maxWeight !== undefined ? { maxWeight: data.maxWeight } : {}),
        ...(data.lineType ? { lineType: data.lineType } : {}),
        ratePerNight: data.ratePerNight,
      },
    });
  }

  async findAllRateTables(query?: Record<string, any>) {
    const where: Prisma.HotelRateTableWhereInput = {};

    if (query?.year) where.year = Number(query.year);
    if (query?.lineType) where.lineType = query.lineType;
    if (query?.species) where.species = { contains: String(query.species), mode: 'insensitive' };
    if (query?.isActive !== undefined) where.isActive = `${query.isActive}` === 'true';

    return this.prisma.hotelRateTable.findMany({
      where,
      orderBy: [
        { year: 'desc' },
        { lineType: 'asc' },
        { species: 'asc' },
        { minWeight: 'asc' },
      ],
    });
  }

  async findRateTableById(id: string) {
    const rateTable = await this.prisma.hotelRateTable.findUnique({
      where: { id },
    });
    if (!rateTable) throw new NotFoundException('Không tìm thấy bảng giá hotel');
    return rateTable;
  }

  async updateRateTable(id: string, data: UpdateHotelRateTableDto) {
    await this.findRateTableById(id);
    return this.prisma.hotelRateTable.update({
      where: { id },
      data,
    });
  }

  async deleteRateTable(id: string) {
    await this.findRateTableById(id);
    const linkedStayCount = await this.prisma.hotelStay.count({
      where: { rateTableId: id },
    });

    if (linkedStayCount > 0) {
      return this.prisma.hotelRateTable.update({
        where: { id },
        data: { isActive: false },
      });
    }

    return this.prisma.hotelRateTable.delete({
      where: { id },
    });
  }

  // ================= STAY =================
  async createStay(data: CreateHotelStayDto) {
    const pet = await this.getPetOrThrow(data.petId);
    const checkIn = new Date(data.checkIn);
    const estimatedCheckOut = data.estimatedCheckOut ? new Date(data.estimatedCheckOut) : null;

    await this.ensureStayCanOccupyWindow({
      petId: data.petId,
      checkIn,
      estimatedCheckOut,
    });

    const dailyRate = data.dailyRate ?? data.price ?? 0;
    const totalPrice =
      data.totalPrice ??
      this.calcTotalPrice({
        checkIn,
        checkOut: estimatedCheckOut,
        dailyRate,
        ...(data.surcharge !== undefined ? { surcharge: data.surcharge } : {}),
        ...(data.promotion !== undefined ? { promotion: data.promotion } : {}),
      });

    const stayCode = await this.generateStayCode(checkIn);

    const created = await this.prisma.hotelStay.create({
      data: {
        stayCode,
        petId: pet.id,
        petName: data.petName?.trim() || pet.name,
        customerId: data.customerId ?? pet.customerId,
        branchId: data.branchId ?? null,
        cageId: data.cageId ?? null,
        checkIn,
        ...(data.checkOut ? { checkOut: new Date(data.checkOut) } : {}),
        ...(estimatedCheckOut ? { estimatedCheckOut } : {}),
        ...(data.lineType ? { lineType: data.lineType } : {}),
        ...(data.rateTableId ? { rateTableId: data.rateTableId } : {}),
        ...(data.orderId ? { orderId: data.orderId } : {}),
        ...(data.notes ? { notes: data.notes } : {}),
        ...(data.petNotes ? { petNotes: data.petNotes } : {}),
        ...(data.paymentStatus ? { paymentStatus: data.paymentStatus } : {}),
        price: data.price ?? dailyRate,
        dailyRate,
        depositAmount: data.depositAmount ?? 0,
        promotion: data.promotion ?? 0,
        surcharge: data.surcharge ?? 0,
        totalPrice,
      },
      include: this.stayInclude,
    });

    return this.mapStay(created);
  }

  async findStayById(id: string) {
    const stay = await this.prisma.hotelStay.findUnique({
      where: { id },
      include: this.stayInclude,
    });
    if (!stay) throw new NotFoundException('Không tìm thấy kỳ lưu trú');
    return this.mapStay(stay);
  }

  async updateStay(id: string, data: UpdateHotelStayDto) {
    const stay = await this.prisma.hotelStay.findUnique({
      where: { id },
      include: this.stayInclude,
    });
    if (!stay) throw new NotFoundException('Không tìm thấy kỳ lưu trú');

    const updateData: Prisma.HotelStayUpdateInput = {};
    const nextPetId = data.petId ?? stay.petId;
    const nextCheckIn = data.checkIn ? new Date(data.checkIn) : stay.checkIn;
    const nextEstimatedCheckOut = data.estimatedCheckOut
      ? new Date(data.estimatedCheckOut)
      : data.estimatedCheckOut === null
        ? null
        : stay.estimatedCheckOut;

    if (data.petId && data.petId !== stay.petId) {
      const pet = await this.getPetOrThrow(data.petId);
      updateData.pet = { connect: { id: pet.id } };
      updateData.petName = data.petName?.trim() || pet.name;
      updateData.customer = { connect: { id: data.customerId ?? pet.customerId } };
    } else if (typeof data.petName === 'string') {
      updateData.petName = data.petName.trim() || stay.petName;
    }

    if (
      data.petId !== undefined ||
      data.checkIn !== undefined ||
      data.estimatedCheckOut !== undefined
    ) {
      await this.ensureStayCanOccupyWindow({
        petId: nextPetId,
        checkIn: nextCheckIn,
        estimatedCheckOut: nextEstimatedCheckOut,
        excludeId: id,
      });
    }

    if (data.customerId !== undefined) {
      updateData.customer = data.customerId ? { connect: { id: data.customerId } } : { disconnect: true };
    }
    if (data.branchId !== undefined) {
      updateData.branch = data.branchId ? { connect: { id: data.branchId } } : { disconnect: true };
    }
    if (data.cageId !== undefined) {
      updateData.cage = data.cageId ? { connect: { id: data.cageId } } : { disconnect: true };
    }
    if (data.rateTableId !== undefined) {
      updateData.rateTable = data.rateTableId ? { connect: { id: data.rateTableId } } : { disconnect: true };
    }
    if (data.orderId !== undefined) {
      updateData.order = data.orderId ? { connect: { id: data.orderId } } : { disconnect: true };
    }

    if (data.checkIn) updateData.checkIn = new Date(data.checkIn);
    if (data.checkOut) updateData.checkOut = new Date(data.checkOut);
    if (data.estimatedCheckOut !== undefined) {
      updateData.estimatedCheckOut = data.estimatedCheckOut ? new Date(data.estimatedCheckOut) : null;
    }
    if (data.status) updateData.status = data.status;
    if (data.lineType) updateData.lineType = data.lineType;
    if (data.paymentStatus) updateData.paymentStatus = data.paymentStatus;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.petNotes !== undefined) updateData.petNotes = data.petNotes;
    if (data.price !== undefined) updateData.price = data.price;
    if (data.dailyRate !== undefined) updateData.dailyRate = data.dailyRate;
    if (data.depositAmount !== undefined) updateData.depositAmount = data.depositAmount;
    if (data.promotion !== undefined) updateData.promotion = data.promotion;
    if (data.surcharge !== undefined) updateData.surcharge = data.surcharge;

    const dailyRate = data.dailyRate ?? stay.dailyRate ?? data.price ?? stay.price ?? 0;
    const promotion = data.promotion ?? stay.promotion;
    const surcharge = data.surcharge ?? stay.surcharge;
    const checkOutForTotal = data.checkOut
      ? new Date(data.checkOut)
      : nextEstimatedCheckOut ?? stay.checkOutActual ?? stay.checkOut;

    updateData.totalPrice =
      data.totalPrice ??
      this.calcTotalPrice({
        checkIn: nextCheckIn,
        checkOut: checkOutForTotal,
        dailyRate,
        promotion,
        surcharge,
      });

    if (data.status === 'CHECKED_OUT' && stay.status !== 'CHECKED_OUT') {
      const finalCheckOut = data.checkOut ? new Date(data.checkOut) : new Date();
      updateData.checkOut = finalCheckOut;
      updateData.checkOutActual = finalCheckOut;
    }

    const updated = await this.prisma.hotelStay.update({
      where: { id },
      data: updateData,
      include: this.stayInclude,
    });

    if (
      data.totalPrice !== undefined ||
      data.dailyRate !== undefined ||
      data.surcharge !== undefined ||
      data.promotion !== undefined ||
      data.status === 'CHECKED_OUT'
    ) {
      await this.syncLinkedOrder(updated.id, updated.orderId);
    }

    return this.mapStay(updated);
  }

  async findAllStays(query?: Record<string, any>) {
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.max(1, Math.min(200, Number(query?.limit) || 50));
    const where: Prisma.HotelStayWhereInput = {};

    if (query?.status) {
      const statuses = String(query.status)
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      where.status = statuses.length > 1 ? { in: statuses as any[] } : (statuses[0] as any);
    }

    if (query?.paymentStatus) {
      const paymentStatuses = String(query.paymentStatus)
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      where.paymentStatus =
        paymentStatuses.length > 1 ? { in: paymentStatuses as any[] } : (paymentStatuses[0] as any);
    }

    if (query?.cageId) where.cageId = query.cageId;
    if (query?.branchId) where.branchId = query.branchId;
    if (query?.customerId) where.customerId = query.customerId;

    if (query?.search) {
      const q = String(query.search).trim();
      if (q) {
        where.OR = [
          { stayCode: { contains: q, mode: 'insensitive' } },
          { petName: { contains: q, mode: 'insensitive' } },
          { notes: { contains: q, mode: 'insensitive' } },
          { petNotes: { contains: q, mode: 'insensitive' } },
          { customer: { is: { fullName: { contains: q, mode: 'insensitive' } } } },
          { customer: { is: { phone: { contains: q, mode: 'insensitive' } } } },
        ];
      }
    }

    if (query?.date) {
      const start = new Date(query.date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(query.date);
      end.setHours(23, 59, 59, 999);

      const andFilters = Array.isArray(where.AND) ? [...where.AND] : where.AND ? [where.AND] : [];
      andFilters.push({
        OR: [
          {
            checkIn: {
              gte: start,
              lte: end,
            },
          },
          {
            estimatedCheckOut: {
              gte: start,
              lte: end,
            },
          },
          {
            checkOutActual: {
              gte: start,
              lte: end,
            },
          },
          {
            AND: [
              { checkIn: { lte: end } },
              {
                OR: [
                  { checkOutActual: null },
                  { checkOutActual: { gte: start } },
                ],
              },
            ],
          },
        ],
      });
      where.AND = andFilters;
    }

    const [items, total] = await Promise.all([
      this.prisma.hotelStay.findMany({
        where,
        orderBy: [{ status: 'asc' }, { checkIn: 'desc' }],
        include: this.stayInclude,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.hotelStay.count({ where }),
    ]);

    const mappedItems = items.map((stay) => this.mapStay(stay));

    if (query?.page || query?.limit || query?.withMeta === 'true') {
      return {
        items: mappedItems,
        total,
        page,
        limit,
      };
    }

    return mappedItems;
  }

  async updateStayPayment(id: string, paymentStatus: PaymentStatus) {
    const stay = await this.prisma.hotelStay.update({
      where: { id },
      data: { paymentStatus },
      include: this.stayInclude,
    });

    return this.mapStay(stay);
  }

  async checkoutStay(id: string, data: CheckoutHotelStayDto) {
    const stay = await this.prisma.hotelStay.findUnique({
      where: { id },
      include: this.stayInclude,
    });
    if (!stay) throw new NotFoundException('Không tìm thấy kỳ lưu trú');
    if (stay.status === 'CHECKED_OUT') throw new BadRequestException('Lượt lưu trú đã checkout');
    if (stay.status === 'CANCELLED') throw new BadRequestException('Lượt lưu trú đã bị hủy');

    const checkOutActual = data.checkOutActual ? new Date(data.checkOutActual) : new Date();
    const dailyRate = data.dailyRate ?? stay.dailyRate ?? stay.price ?? 0;
    const surcharge = data.surcharge ?? stay.surcharge;
    const promotion = data.promotion ?? stay.promotion;
    const totalPrice = this.calcTotalPrice({
      checkIn: stay.checkIn,
      checkOut: checkOutActual,
      dailyRate,
      surcharge,
      promotion,
    });

    const updated = await this.prisma.hotelStay.update({
      where: { id },
      data: {
        status: 'CHECKED_OUT',
        checkOut: checkOutActual,
        checkOutActual,
        dailyRate,
        surcharge,
        promotion,
        totalPrice,
        ...(data.paymentStatus ? { paymentStatus: data.paymentStatus } : {}),
        ...(data.notes ? { notes: data.notes } : {}),
      },
      include: this.stayInclude,
    });

    await this.syncLinkedOrder(updated.id, updated.orderId);

    return this.mapStay(updated);
  }

  async calculatePrice(data: CalculateHotelPriceDto) {
    const checkIn = new Date(data.checkIn);
    const checkOut = new Date(data.checkOut);

    if (checkOut <= checkIn) {
      throw new BadRequestException('Ngày check-out phải sau check-in');
    }

    const where: Prisma.HotelRateTableWhereInput = data.rateTableId
      ? { id: data.rateTableId }
      : {
          isActive: true,
          year: checkIn.getFullYear(),
          lineType: data.lineType ?? 'REGULAR',
          OR: [
            {
              species: null,
            },
            {
              species: {
                equals: data.species,
                mode: 'insensitive',
              },
            },
          ],
          AND: [
            {
              OR: [
                { minWeight: null },
                { minWeight: { lte: data.weight } },
              ],
            },
            {
              OR: [
                { maxWeight: null },
                { maxWeight: { gte: data.weight } },
              ],
            },
          ],
        };

    const rate = await this.prisma.hotelRateTable.findFirst({
      where,
      orderBy: [
        { year: 'desc' },
        { minWeight: 'desc' },
      ],
    });

    if (!rate) {
      throw new NotFoundException('Không tìm thấy mức giá hotel phù hợp');
    }

    const nights = this.calcNights(checkIn, checkOut);
    const totalPrice = nights * rate.ratePerNight;

    return {
      nights,
      ratePerNight: rate.ratePerNight,
      totalPrice,
      matchedRate: rate,
    };
  }

  async deleteStay(id: string) {
    const stay = await this.prisma.hotelStay.findUnique({
      where: { id },
      select: {
        id: true,
        orderId: true,
        status: true,
      },
    });
    if (!stay) throw new NotFoundException('Không tìm thấy kỳ lưu trú');
    if (stay.orderId && stay.status !== 'CANCELLED') {
      throw new BadRequestException('Không thể xóa kỳ lưu trú đang gắn với đơn hàng, hãy hủy trước');
    }

    return this.prisma.hotelStay.delete({
      where: { id },
    });
  }
}
