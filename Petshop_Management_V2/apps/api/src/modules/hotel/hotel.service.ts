import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { HotelLineType, PaymentStatus, Prisma } from '@petshop/database';
import { generateHotelStayCode as formatHotelStayCode } from '@petshop/shared';
import { assertBranchAccess, getScopedBranchIds, resolveWritableBranchId, type BranchScopedUser } from '../../common/utils/branch-scope.util.js';
import { resolveBranchIdentity } from '../../common/utils/branch-identity.util.js';
import { DatabaseService } from '../../database/database.service.js';
import { CreateHotelRateTableDto, CreateHotelStayDto, CreateCageDto, HotelStayAdjustmentDto } from './dto/create-hotel.dto.js';
import { CalculateHotelPriceDto, CheckoutHotelStayDto, UpdateHotelRateTableDto, UpdateHotelStayDto, UpdateCageDto } from './dto/update-hotel.dto.js';

const ACTIVE_STAY_STATUSES = ['BOOKED', 'CHECKED_IN'] as const;
const HALF_DAY_HOURS = 12;
const SHORT_STAY_FULL_DAY_THRESHOLD_HOURS = 3;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

type ChargeDayType = 'REGULAR' | 'HOLIDAY';

type PricingWeightBand = {
  id: string | null;
  label: string;
  minWeight: number | null;
  maxWeight: number | null;
  source: 'RULE' | 'LEGACY';
};

type HotelChargeLineDraft = {
  label: string;
  dayType: ChargeDayType;
  quantityDays: number;
  unitPrice: number;
  subtotal: number;
  sortOrder: number;
  weightBandId: string | null;
  pricingSnapshot: Record<string, unknown>;
};

type HotelPricingPreview = {
  chargeLines: HotelChargeLineDraft[];
  totalDays: number;
  totalPrice: number;
  averageDailyRate: number;
  lineType: HotelLineType;
  weightAtPricing: number | null;
  weightBand: PricingWeightBand | null;
  pricingSnapshot: Record<string, unknown>;
};

type HotelAdjustmentInput = HotelStayAdjustmentDto | {
  id?: string;
  type?: string;
  label: string;
  amount: number;
  note?: string;
};

@Injectable()
export class HotelService {
  constructor(private readonly prisma: DatabaseService) { }

  private deriveHalfDayPrice(fullDayPrice: number) {
    return this.roundCurrency(fullDayPrice / 2);
  }

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
        code: true,
        name: true,
      },
    },
    createdBy: {
      select: {
        id: true,
        fullName: true,
        staffCode: true,
      },
    },
    cage: true,
    rateTable: true,
    weightBand: true,
    adjustments: {
      orderBy: [{ createdAt: 'asc' }],
    },
    chargeLines: {
      include: {
        weightBand: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    },
    order: {
      select: {
        id: true,
        orderNumber: true,
        status: true,
        branchId: true,
        paymentStatus: true,
        total: true,
        paidAmount: true,
        remainingAmount: true,
      },
    },
  } satisfies Prisma.HotelStayInclude;

  private getDateKey(date: Date) {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private startOfDay(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private addDays(date: Date, days: number) {
    return new Date(date.getTime() + days * DAY_IN_MS);
  }

  private shiftRecurringHolidayToYear(startDate: Date, endDate: Date | null, year: number) {
    const normalizedEndDate = endDate ?? startDate;
    const durationDays = Math.max(
      0,
      Math.round((this.startOfDay(normalizedEndDate).getTime() - this.startOfDay(startDate).getTime()) / DAY_IN_MS),
    );
    const shiftedStartDate = new Date(year, startDate.getMonth(), startDate.getDate());
    const shiftedEndDate = this.addDays(shiftedStartDate, durationDays);
    return { date: shiftedStartDate, endDate: shiftedEndDate };
  }

  private toDefaultPricingEnd(checkIn: Date) {
    return new Date(checkIn.getTime() + DAY_IN_MS);
  }

  private roundCurrency(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private normalizeStayAdjustments(adjustments?: HotelAdjustmentInput[] | null) {
    return (adjustments ?? [])
      .map((item) => ({
        type: String(item.type ?? '').trim() || null,
        label: String(item.label ?? '').trim(),
        amount: this.roundCurrency(Number(item.amount ?? 0)),
        note: String(item.note ?? '').trim() || null,
      }))
      .filter((item) => item.label && Number.isFinite(item.amount) && item.amount > 0);
  }

  private sumAdjustmentAmount(adjustments?: HotelAdjustmentInput[] | null) {
    return this.roundCurrency(
      this.normalizeStayAdjustments(adjustments).reduce((sum, item) => sum + item.amount, 0),
    );
  }

  private async replaceStayAdjustments(
    tx: Prisma.TransactionClient,
    stayId: string,
    adjustments?: HotelAdjustmentInput[] | null,
  ) {
    await tx.hotelStayAdjustment.deleteMany({ where: { hotelStayId: stayId } });
    const normalizedAdjustments = this.normalizeStayAdjustments(adjustments);
    if (normalizedAdjustments.length === 0) return;

    await tx.hotelStayAdjustment.createMany({
      data: normalizedAdjustments.map((item) => ({
        hotelStayId: stayId,
        type: item.type,
        label: item.label,
        amount: item.amount,
        note: item.note,
      })),
    });
  }

  private async logStayActivity(
    action: string,
    stay: { id: string; stayCode?: string | null; branchId?: string | null; petName?: string | null },
    user?: BranchScopedUser,
    details?: Record<string, unknown>,
  ) {
    await this.prisma.activityLog.create({
      data: {
        userId: user?.userId ?? null,
        action,
        target: 'HOTEL_STAY',
        targetId: stay.id,
        details: {
          stayCode: stay.stayCode ?? null,
          branchId: stay.branchId ?? null,
          petName: stay.petName ?? null,
          ...(details ?? {}),
        } as Prisma.InputJsonValue,
      },
    });
  }

  private buildWeightBandLabel(minWeight?: number | null, maxWeight?: number | null) {
    if (minWeight === null || minWeight === undefined) return 'Theo can nang';
    if (maxWeight === null || maxWeight === undefined) return `>${minWeight}kg`;
    return `${minWeight}-${maxWeight}kg`;
  }

  private resolveDisplayLineType(chargeLines: HotelChargeLineDraft[]): HotelLineType {
    if (chargeLines.length > 0 && chargeLines.every((line) => line.dayType === 'HOLIDAY')) {
      return 'HOLIDAY';
    }

    return 'REGULAR';
  }

  private buildChargeLineLabel(dayType: ChargeDayType, weightBandLabel: string, holidayName?: string | null) {
    if (dayType !== 'HOLIDAY') return `Hotel ${weightBandLabel}`;
    return holidayName ? `Hotel lễ ${holidayName} - ${weightBandLabel}` : `Hotel ngày lễ ${weightBandLabel}`;
  }

  private getChargeUnitsForSegment(start: Date, end: Date) {
    const diffMs = end.getTime() - start.getTime();
    if (diffMs <= 0) return 0;

    const hours = diffMs / (1000 * 60 * 60);
    return hours <= HALF_DAY_HOURS ? 0.5 : 1;
  }

  private getChargeUnitsForShortStay(start: Date, end: Date) {
    const diffMs = end.getTime() - start.getTime();
    if (diffMs <= 0) return 0;

    const hours = diffMs / (1000 * 60 * 60);
    return hours < SHORT_STAY_FULL_DAY_THRESHOLD_HOURS ? 0.5 : 1;
  }

  private mapStayChargeLine<T extends Record<string, any>>(line: T) {
    return {
      ...line,
      weightBandLabel: line.weightBand?.label ?? line.pricingSnapshot?.weightBandLabel ?? null,
    };
  }

  private mapStay<T extends Record<string, any>>(stay: T) {
    return {
      ...stay,
      expectedPickup: stay.estimatedCheckOut ?? null,
      receiver: stay.customer ?? stay.pet?.customer ?? null,
      adjustments: Array.isArray(stay.adjustments) ? stay.adjustments : [],
      chargeLines: Array.isArray(stay.chargeLines)
        ? stay.chargeLines.map((line: any) => this.mapStayChargeLine(line))
        : [],
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

  private async generateStayCode(date: Date, branchCode: string) {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    const codePrefix = formatHotelStayCode(date, branchCode, 0).slice(0, -3);

    const count = await this.prisma.hotelStay.count({
      where: {
        createdAt: {
          gte: start,
          lt: end,
        },
        stayCode: {
          startsWith: codePrefix,
        },
      },
    });

    return formatHotelStayCode(date, branchCode, count + 1);
  }

  private async getPetOrThrow(petId: string) {
    const pet = await this.prisma.pet.findFirst({
      where: { OR: [{ id: petId }, { petCode: petId }] },
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

  private async findAccessiblePet(petId: string, user?: BranchScopedUser) {
    const scopedBranchIds = getScopedBranchIds(user);
    if (!scopedBranchIds) {
      return this.getPetOrThrow(petId);
    }

    const pet = await this.prisma.pet.findFirst({
      where: {
        OR: [{ id: petId }, { petCode: petId }],
        AND: [
          {
            OR: [
              { branchId: { in: scopedBranchIds } },
              {
                AND: [
                  { branchId: null },
                  { customer: { is: { branchId: { in: scopedBranchIds } } } },
                ],
              },
            ],
          }
        ]
      },
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
        breakdownSnapshot: true,
        chargeLines: {
          select: { label: true },
          orderBy: { sortOrder: 'asc' },
        },
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
    const description = stay.chargeLines.length > 0
      ? stay.chargeLines.map((line) => line.label).join(' + ')
      : null;

    await this.prisma.orderItem.update({
      where: { id: orderItem.id },
      data: {
        ...(description ? { description } : {}),
        unitPrice: stay.totalPrice,
        quantity: 1,
        subtotal: stay.totalPrice,
        ...(stay.breakdownSnapshot !== null
          ? { pricingSnapshot: stay.breakdownSnapshot as Prisma.InputJsonValue }
          : {}),
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
      orderBy: { position: 'asc' },
    });

    return cages.map((cage) => this.mapCage(cage));
  }

  async reorderCages(cageIds: string[]) {
    if (!Array.isArray(cageIds) || cageIds.length === 0) return { success: true }

    const updates = cageIds.map((id, index) =>
      this.prisma.cage.update({
        where: { id },
        data: { position: index },
      })
    )

    await this.prisma.$transaction(updates)
    return { success: true }
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

  private async findConfiguredWeightBand(species: string, weight: number) {
    const candidates = await this.prisma.serviceWeightBand.findMany({
      where: {
        serviceType: 'HOTEL',
        isActive: true,
        minWeight: { lte: weight },
        OR: [
          { species: null },
          { species: { equals: species, mode: 'insensitive' } },
        ],
      },
      orderBy: [{ minWeight: 'desc' }, { sortOrder: 'asc' }],
    });

    const matched = candidates.find((band) => band.maxWeight === null || weight < band.maxWeight);
    if (!matched) return null;

    return {
      band: matched,
      weightBand: {
        id: matched.id,
        label: matched.label,
        minWeight: matched.minWeight,
        maxWeight: matched.maxWeight,
        source: 'RULE' as const,
      },
    };
  }

  private async findLegacyRateForSegment(params: {
    species: string;
    weight: number;
    date: Date;
    dayType: ChargeDayType;
    rateTableId?: string;
  }) {
    const where: Prisma.HotelRateTableWhereInput = params.rateTableId
      ? { id: params.rateTableId }
      : {
        isActive: true,
        year: params.date.getFullYear(),
        lineType: params.dayType,
        OR: [
          { species: null },
          { species: { equals: params.species, mode: 'insensitive' } },
        ],
        AND: [
          {
            OR: [
              { minWeight: null },
              { minWeight: { lte: params.weight } },
            ],
          },
          {
            OR: [
              { maxWeight: null },
              { maxWeight: { gt: params.weight } },
            ],
          },
        ],
      };

    const rate = await this.prisma.hotelRateTable.findFirst({
      where,
      orderBy: [{ year: 'desc' }, { minWeight: 'desc' }],
    });

    if (!rate) return null;

    return {
      unitPrice: rate.ratePerNight,
      weightBand: {
        id: null,
        label: this.buildWeightBandLabel(rate.minWeight, rate.maxWeight),
        minWeight: rate.minWeight ?? null,
        maxWeight: rate.maxWeight ?? null,
        source: 'LEGACY' as const,
      },
      snapshot: {
        source: 'legacy-rate-table',
        ruleId: rate.id,
        year: rate.year,
        species: rate.species,
        ratePerNight: rate.ratePerNight,
        minWeight: rate.minWeight,
        maxWeight: rate.maxWeight,
        lineType: rate.lineType,
      },
    };
  }

  private async buildHotelPricingPreview(params: {
    species: string;
    weight?: number | null;
    checkIn: Date;
    checkOut?: Date | null;
    branchId?: string | null;
    rateTableId?: string | null;
  }): Promise<HotelPricingPreview> {
    const weight = Number(params.weight ?? 0);
    if (!Number.isFinite(weight) || weight < 0) {
      throw new BadRequestException('Can nang thu cung khong hop le');
    }

    const pricingEnd = params.checkOut ?? this.toDefaultPricingEnd(params.checkIn);
    if (pricingEnd <= params.checkIn) {
      throw new BadRequestException('Ngay check-out phai sau check-in');
    }

    const configuredBand = await this.findConfiguredWeightBand(params.species, weight);
    const pricingStartDay = this.startOfDay(params.checkIn);
    const pricingEndDay = this.startOfDay(pricingEnd);
    const yearKeys = new Set<number>([params.checkIn.getFullYear(), pricingEnd.getFullYear()]);
    for (let year = params.checkIn.getFullYear(); year <= pricingEnd.getFullYear(); year += 1) {
      yearKeys.add(year);
    }
    const holidayDates = await this.prisma.holidayCalendarDate.findMany({
      where: {
        isActive: true,
        OR: [
          { isRecurring: true },
          {
            date: { lte: pricingEndDay },
            OR: [
              { endDate: null, date: { gte: pricingStartDay } },
              { endDate: { gte: pricingStartDay } },
            ],
          },
        ],
      },
      select: { date: true, endDate: true, name: true, isRecurring: true },
      orderBy: [{ date: 'asc' }, { endDate: 'asc' }],
    });
    const holidaysByDateKey = new Map<string, string>();
    for (const holiday of holidayDates) {
      const ranges = holiday.isRecurring
        ? [...yearKeys].map((year) => this.shiftRecurringHolidayToYear(holiday.date, holiday.endDate, year))
        : [{ date: holiday.date, endDate: holiday.endDate ?? holiday.date }];

      for (const range of ranges) {
        let holidayCursor = this.startOfDay(range.date);
        const holidayEnd = this.startOfDay(range.endDate ?? range.date);
        while (holidayCursor <= holidayEnd) {
          const dateKey = this.getDateKey(holidayCursor);
          if (!holidaysByDateKey.has(dateKey)) holidaysByDateKey.set(dateKey, holiday.name);
          holidayCursor = this.addDays(holidayCursor, 1);
        }
      }
    }

    const priceRules = configuredBand
      ? await this.prisma.hotelPriceRule.findMany({
        where: {
          isActive: true,
          year: { in: [...yearKeys] },
          weightBandId: configuredBand.band.id,
          AND: [
            ...(params.branchId
              ? [{ OR: [{ branchId: params.branchId }, { branchId: null }] }]
              : [{ branchId: null }]),
            {
              OR: [
                { species: null },
                { species: { equals: params.species, mode: 'insensitive' } },
              ],
            },
          ],
        },
      })
      : [];

    const segments: Array<HotelChargeLineDraft & { dateKey: string; holidayName?: string | null }> = [];
    const totalDurationMs = pricingEnd.getTime() - params.checkIn.getTime();
    const windows: Array<{ cursor: Date; quantityDays: number }> = [];

    if (totalDurationMs < DAY_IN_MS) {
      windows.push({
        cursor: this.startOfDay(params.checkIn),
        quantityDays: this.getChargeUnitsForShortStay(params.checkIn, pricingEnd),
      });
    } else {
      let cursor = this.startOfDay(params.checkIn);
      while (cursor < pricingEnd) {
        const nextDay = this.addDays(cursor, 1);
        const segmentStart = params.checkIn > cursor ? params.checkIn : cursor;
        const segmentEnd = pricingEnd < nextDay ? pricingEnd : nextDay;
        windows.push({
          cursor,
          quantityDays: this.getChargeUnitsForSegment(segmentStart, segmentEnd),
        });
        cursor = nextDay;
      }
    }

    for (const window of windows) {
      const { cursor, quantityDays } = window;
      if (quantityDays > 0) {
        const dateKey = this.getDateKey(cursor);
        const holidayName = holidaysByDateKey.get(dateKey) ?? null;
        const dayType: ChargeDayType = holidayName ? 'HOLIDAY' : 'REGULAR';
        const matchedRule = configuredBand
          ? priceRules
            .filter((rule) => rule.year === cursor.getFullYear() && rule.dayType === dayType)
            .sort((left, right) => {
              const leftBranchExact = left.branchId === params.branchId ? 1 : 0;
              const rightBranchExact = right.branchId === params.branchId ? 1 : 0;
              const leftExact = left.species?.toLowerCase() === params.species.toLowerCase() ? 1 : 0;
              const rightExact = right.species?.toLowerCase() === params.species.toLowerCase() ? 1 : 0;
              if (rightBranchExact !== leftBranchExact) return rightBranchExact - leftBranchExact;
              return rightExact - leftExact;
            })[0]
          : null;

        const resolvedRate =
          matchedRule
            ? {
              unitPrice: matchedRule.fullDayPrice,
              weightBand: configuredBand!.weightBand,
              snapshot: {
                source: 'hotel-price-rule',
                ruleId: matchedRule.id,
                branchId: matchedRule.branchId,
                year: matchedRule.year,
                species: matchedRule.species,
                weightBandId: matchedRule.weightBandId,
                dayType: matchedRule.dayType,
                halfDayPrice: this.deriveHalfDayPrice(matchedRule.fullDayPrice),
                fullDayPrice: matchedRule.fullDayPrice,
              },
            }
            : await this.findLegacyRateForSegment({
              species: params.species,
              weight,
              date: cursor,
              dayType,
              ...(params.rateTableId ? { rateTableId: params.rateTableId } : {}),
            });

        if (!resolvedRate) {
          throw new NotFoundException(`Khong tim thay gia hotel phu hop cho ngay ${dateKey}`);
        }

        const subtotal = this.roundCurrency(quantityDays * resolvedRate.unitPrice);
        const weightBandLabel = resolvedRate.weightBand.label;

        segments.push({
          dateKey,
          holidayName,
          label: this.buildChargeLineLabel(dayType, weightBandLabel, holidayName),
          dayType,
          quantityDays,
          unitPrice: resolvedRate.unitPrice,
          subtotal,
          sortOrder: segments.length,
          weightBandId: resolvedRate.weightBand.id,
          pricingSnapshot: {
            date: dateKey,
            dayType,
            holidayName,
            quantityDays,
            weight,
            weightBandLabel,
            ...resolvedRate.snapshot,
          },
        });
      }

    }

    const grouped = new Map<string, HotelChargeLineDraft>();
    for (const segment of segments) {
      const key = [segment.dayType, segment.weightBandId ?? 'legacy', segment.unitPrice, segment.label].join('|');
      const existing = grouped.get(key);

      if (existing) {
        existing.quantityDays = this.roundCurrency(existing.quantityDays + segment.quantityDays);
        existing.subtotal = this.roundCurrency(existing.subtotal + segment.subtotal);
        existing.pricingSnapshot = {
          ...(existing.pricingSnapshot ?? {}),
          dates: [...(((existing.pricingSnapshot as any)?.dates ?? []) as string[]), segment.dateKey],
        };
        continue;
      }

      grouped.set(key, {
        label: segment.label,
        dayType: segment.dayType,
        quantityDays: segment.quantityDays,
        unitPrice: segment.unitPrice,
        subtotal: segment.subtotal,
        sortOrder: grouped.size,
        weightBandId: segment.weightBandId,
        pricingSnapshot: {
          ...(segment.pricingSnapshot ?? {}),
          dates: [segment.dateKey],
        },
      });
    }

    const chargeLines = [...grouped.values()].map((line, index) => ({
      ...line,
      sortOrder: index,
    }));
    const totalDays = this.roundCurrency(chargeLines.reduce((sum, line) => sum + line.quantityDays, 0));
    const totalPrice = this.roundCurrency(chargeLines.reduce((sum, line) => sum + line.subtotal, 0));
    const averageDailyRate = totalDays > 0 ? this.roundCurrency(totalPrice / totalDays) : 0;
    const weightBand =
      configuredBand?.weightBand ??
      (chargeLines[0]
        ? {
          id: chargeLines[0].weightBandId,
          label: String((chargeLines[0].pricingSnapshot as any)?.weightBandLabel ?? 'Theo can nang'),
          minWeight: null,
          maxWeight: null,
          source: 'LEGACY' as const,
        }
        : null);

    return {
      chargeLines,
      totalDays,
      totalPrice,
      averageDailyRate,
      lineType: this.resolveDisplayLineType(chargeLines),
      weightAtPricing: weight,
      weightBand,
      pricingSnapshot: {
        species: params.species,
        weight,
        totalDays,
        baseTotalPrice: totalPrice,
        lineType: this.resolveDisplayLineType(chargeLines),
        weightBand,
        chargeLines: chargeLines.map((line) => ({
          label: line.label,
          dayType: line.dayType,
          quantityDays: line.quantityDays,
          unitPrice: line.unitPrice,
          subtotal: line.subtotal,
          weightBandId: line.weightBandId,
          pricingSnapshot: line.pricingSnapshot,
        })),
      },
    };
  }

  private buildStayBreakdownSnapshot(preview: HotelPricingPreview, promotion: number, surcharge: number, finalTotalPrice: number) {
    return {
      ...preview.pricingSnapshot,
      promotion,
      surcharge,
      finalTotalPrice,
    };
  }

  // ================= STAY =================
  async createStay(data: CreateHotelStayDto, user?: BranchScopedUser, requestedBranchId?: string) {
    const pet = await this.findAccessiblePet(data.petId, user);
    const checkIn = new Date(data.checkIn);
    const estimatedCheckOut = data.estimatedCheckOut
      ? new Date(data.estimatedCheckOut)
      : data.checkOut
        ? new Date(data.checkOut)
        : null;
    const writableBranchId = resolveWritableBranchId(user, data.branchId ?? requestedBranchId);
    const branch = await resolveBranchIdentity(this.prisma, writableBranchId);
    const linkedOrder = data.orderId
      ? await this.prisma.order.findUnique({
        where: { id: data.orderId },
        select: { createdAt: true },
      })
      : null;
    const codeDate = linkedOrder?.createdAt ?? new Date();

    await this.ensureStayCanOccupyWindow({
      petId: data.petId,
      checkIn,
      estimatedCheckOut,
    });

    const pricingPreview = await this.buildHotelPricingPreview({
      species: pet.species,
      weight: pet.weight,
      checkIn,
      branchId: branch.id,
      checkOut: estimatedCheckOut,
      ...(data.rateTableId ? { rateTableId: data.rateTableId } : {}),
    });
    const promotion = data.promotion ?? 0;
    const surcharge = data.adjustments ? this.sumAdjustmentAmount(data.adjustments) : (data.surcharge ?? 0);
    const totalPrice = data.totalPrice ?? this.roundCurrency(pricingPreview.totalPrice + surcharge - promotion);
    const dailyRate = data.dailyRate ?? data.price ?? pricingPreview.averageDailyRate;
    const breakdownSnapshot = this.buildStayBreakdownSnapshot(pricingPreview, promotion, surcharge, totalPrice);

    const stayCode = await this.generateStayCode(codeDate, branch.code);

    const stayCreateData: Prisma.HotelStayUncheckedCreateInput = {
      stayCode,
      petId: pet.id,
      petName: data.petName?.trim() || pet.name,
      customerId: data.customerId ?? pet.customerId,
      branchId: branch.id,
      cageId: data.cageId ?? null,
      createdById: user?.userId ?? null,
      checkIn,
      ...(data.checkOut ? { checkOut: new Date(data.checkOut) } : {}),
      ...(estimatedCheckOut ? { estimatedCheckOut } : {}),
      ...(data.rateTableId ? { rateTableId: data.rateTableId } : {}),
      ...(data.orderId ? { orderId: data.orderId } : {}),
      ...(data.notes ? { notes: data.notes } : {}),
      ...(data.petNotes ? { petNotes: data.petNotes } : {}),
      ...(data.paymentStatus ? { paymentStatus: data.paymentStatus } : {}),
      lineType: pricingPreview.lineType,
      price: data.price ?? dailyRate,
      dailyRate,
      depositAmount: data.depositAmount ?? 0,
      promotion,
      surcharge,
      totalPrice,
      weightAtBooking: pricingPreview.weightAtPricing,
      weightBandId: pricingPreview.weightBand?.id ?? null,
      pricingSnapshot: pricingPreview.pricingSnapshot as Prisma.InputJsonValue,
      breakdownSnapshot: breakdownSnapshot as Prisma.InputJsonValue,
    };

    const created = await this.prisma.$transaction(async (tx) => {
      const stay = await tx.hotelStay.create({
        data: stayCreateData,
        include: this.stayInclude,
      });

      await this.replaceStayAdjustments(tx, stay.id, data.adjustments);

      if (pricingPreview.chargeLines.length > 0) {
        await tx.hotelStayChargeLine.createMany({
          data: pricingPreview.chargeLines.map((line) => ({
            hotelStayId: stay.id,
            weightBandId: line.weightBandId,
            label: line.label,
            dayType: line.dayType,
            quantityDays: line.quantityDays,
            unitPrice: line.unitPrice,
            subtotal: line.subtotal,
            sortOrder: line.sortOrder,
            pricingSnapshot: line.pricingSnapshot as Prisma.InputJsonValue,
          })),
        });
      }

      return tx.hotelStay.findUniqueOrThrow({
        where: { id: stay.id },
        include: this.stayInclude,
      });
    });

    if (created.orderId) {
      await this.syncLinkedOrder(created.id, created.orderId);
    }

    await this.logStayActivity('HOTEL_STAY_CREATED', created, user, {
      status: created.status,
      estimatedCheckOut: created.estimatedCheckOut,
      surcharge: created.surcharge,
      totalPrice: created.totalPrice,
    });

    return this.mapStay(created);
  }

  async findStayById(id: string, user?: BranchScopedUser) {
    const stay = await this.prisma.hotelStay.findUnique({
      where: { id },
      include: this.stayInclude,
    });
    if (!stay) throw new NotFoundException('Không tìm thấy kỳ lưu trú');
    assertBranchAccess(stay.branchId, user);
    return this.mapStay(stay);
  }

  async updateStay(id: string, data: UpdateHotelStayDto, user?: BranchScopedUser, requestedBranchId?: string) {
    const stay = await this.prisma.hotelStay.findUnique({
      where: { id },
      include: this.stayInclude,
    });
    if (!stay) throw new NotFoundException('Không tìm thấy kỳ lưu trú');

    assertBranchAccess(stay.branchId, user);
    const updateData: Prisma.HotelStayUpdateInput = {};
    const nextPetId = data.petId ?? stay.petId;
    let nextCheckIn = data.checkIn ? new Date(data.checkIn) : stay.checkIn;
    let nextPet = stay.pet;
    const statusTransition = data.status && data.status !== stay.status ? data.status : null;
    const nextEstimatedCheckOut = data.estimatedCheckOut
      ? new Date(data.estimatedCheckOut)
      : data.estimatedCheckOut === null
        ? null
        : data.checkOut
          ? new Date(data.checkOut)
          : stay.estimatedCheckOut;

    if (data.petId && data.petId !== stay.petId) {
      const pet = await this.findAccessiblePet(data.petId, user);
      nextPet = pet;
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
    const nextBranchId = data.branchId !== undefined || requestedBranchId
      ? resolveWritableBranchId(user, data.branchId ?? requestedBranchId)
      : stay.branchId;

    if (data.branchId !== undefined || requestedBranchId) {
      const writableBranchId = nextBranchId;
      updateData.branch = writableBranchId ? { connect: { id: writableBranchId } } : { disconnect: true };
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
    if (data.accessories !== undefined) updateData.accessories = data.accessories;
    if (data.slotIndex !== undefined) updateData.slotIndex = data.slotIndex;
    if (data.price !== undefined) updateData.price = data.price;
    if (data.dailyRate !== undefined) updateData.dailyRate = data.dailyRate;
    if (data.depositAmount !== undefined) updateData.depositAmount = data.depositAmount;
    if (data.promotion !== undefined) updateData.promotion = data.promotion;
    if (data.surcharge !== undefined) updateData.surcharge = data.surcharge;

    if (statusTransition === 'CHECKED_IN') {
      if (!['BOOKED', 'CHECKED_IN'].includes(stay.status)) {
        throw new BadRequestException('Khong the nhan phong cho stay da ket thuc');
      }
      nextCheckIn = new Date();
      updateData.checkIn = nextCheckIn;
      updateData.checkedInAt = nextCheckIn;
    }

    if (statusTransition === 'CANCELLED') {
      if (stay.status === 'CHECKED_OUT') {
        throw new BadRequestException('Khong the huy stay da checkout');
      }
      updateData.cancelledAt = new Date();
    }

    const promotion = data.promotion ?? stay.promotion;
    const surcharge = data.adjustments
      ? this.sumAdjustmentAmount(data.adjustments)
      : data.surcharge ?? stay.surcharge;
    const finalCheckOut = statusTransition === 'CHECKED_OUT'
      ? new Date()
      : data.checkOut
        ? new Date(data.checkOut)
        : nextEstimatedCheckOut ?? stay.checkOutActual ?? stay.checkOut ?? null;
    const nextRateTableId = data.rateTableId !== undefined ? data.rateTableId : stay.rateTableId;
    const pricingPreview = await this.buildHotelPricingPreview({
      species: nextPet.species,
      weight: nextPet.weight,
      checkIn: nextCheckIn,
      branchId: nextBranchId,
      checkOut: finalCheckOut,
      ...(nextRateTableId ? { rateTableId: nextRateTableId } : {}),
    });
    const dailyRate = data.dailyRate ?? data.price ?? pricingPreview.averageDailyRate;
    const totalPrice = data.totalPrice ?? this.roundCurrency(pricingPreview.totalPrice + surcharge - promotion);

    updateData.totalPrice = totalPrice;
    updateData.dailyRate = dailyRate;
    updateData.lineType = pricingPreview.lineType;
    updateData.weightAtBooking = pricingPreview.weightAtPricing;
    updateData.weightBand = pricingPreview.weightBand?.id
      ? { connect: { id: pricingPreview.weightBand.id } }
      : { disconnect: true };
    updateData.pricingSnapshot = pricingPreview.pricingSnapshot as Prisma.InputJsonValue;
    updateData.breakdownSnapshot = this.buildStayBreakdownSnapshot(
      pricingPreview,
      promotion,
      surcharge,
      totalPrice,
    ) as Prisma.InputJsonValue;

    if (statusTransition === 'CHECKED_OUT') {
      if (!['BOOKED', 'CHECKED_IN'].includes(stay.status)) {
        throw new BadRequestException('Khong the checkout stay da ket thuc');
      }
      updateData.checkOut = finalCheckOut ?? new Date();
      updateData.checkOutActual = finalCheckOut ?? new Date();
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.hotelStay.update({
        where: { id },
        data: updateData,
      });

      await this.replaceStayAdjustments(tx, id, data.adjustments);

      await tx.hotelStayChargeLine.deleteMany({
        where: { hotelStayId: id },
      });

      if (pricingPreview.chargeLines.length > 0) {
        await tx.hotelStayChargeLine.createMany({
          data: pricingPreview.chargeLines.map((line) => ({
            hotelStayId: id,
            weightBandId: line.weightBandId,
            label: line.label,
            dayType: line.dayType,
            quantityDays: line.quantityDays,
            unitPrice: line.unitPrice,
            subtotal: line.subtotal,
            sortOrder: line.sortOrder,
            pricingSnapshot: line.pricingSnapshot as Prisma.InputJsonValue,
          })),
        });
      }

      return tx.hotelStay.findUniqueOrThrow({
        where: { id },
        include: this.stayInclude,
      });
    });

    if (
      data.totalPrice !== undefined ||
      data.dailyRate !== undefined ||
      data.checkIn !== undefined ||
      data.checkOut !== undefined ||
      data.estimatedCheckOut !== undefined ||
      data.petId !== undefined ||
      data.surcharge !== undefined ||
      data.promotion !== undefined ||
      data.adjustments !== undefined ||
      statusTransition === 'CHECKED_OUT'
    ) {
      await this.syncLinkedOrder(updated.id, updated.orderId);
    }

    await this.logStayActivity(
      statusTransition
        ? `HOTEL_STAY_${statusTransition}`
        : 'HOTEL_STAY_UPDATED',
      updated,
      user,
      {
        previousStatus: stay.status,
        nextStatus: updated.status,
        estimatedCheckOut: updated.estimatedCheckOut,
        surcharge: updated.surcharge,
        totalPrice: updated.totalPrice,
      },
    );

    return this.mapStay(updated);
  }

  async findAllStays(query?: Record<string, any>, user?: BranchScopedUser, requestedBranchId?: string) {
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.max(1, Math.min(200, Number(query?.limit) || 50));
    const where: Prisma.HotelStayWhereInput = {};
    const scopedBranchIds = getScopedBranchIds(user, query?.branchId ?? requestedBranchId);

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
      where.order = {
        is: {
          paymentStatus:
            paymentStatuses.length > 1 ? { in: paymentStatuses as any[] } : (paymentStatuses[0] as any),
        },
      };
    }

    if (query?.cageId) where.cageId = query.cageId;
    if (scopedBranchIds) {
      where.branchId = scopedBranchIds.length === 1 ? scopedBranchIds[0]! : { in: scopedBranchIds };
    }
    if (query?.customerId) where.customerId = query.customerId;
    if (query?.createdById) where.createdById = query.createdById;

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

  async updateStayPayment(id: string, paymentStatus: PaymentStatus, user?: BranchScopedUser) {
    const existing = await this.prisma.hotelStay.findUnique({
      where: { id },
      select: { branchId: true },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy kỳ lưu trú');
    assertBranchAccess(existing.branchId, user);

    const stay = await this.prisma.hotelStay.update({
      where: { id },
      data: { paymentStatus },
      include: this.stayInclude,
    });

    return this.mapStay(stay);
  }

  async checkoutStay(id: string, data: CheckoutHotelStayDto, user?: BranchScopedUser) {
    const stay = await this.prisma.hotelStay.findUnique({
      where: { id },
      include: this.stayInclude,
    });
    if (!stay) throw new NotFoundException('Không tìm thấy kỳ lưu trú');
    if (stay.status === 'CHECKED_OUT') throw new BadRequestException('Lượt lưu trú đã checkout');
    if (stay.status === 'CANCELLED') throw new BadRequestException('Lượt lưu trú đã bị hủy');

    assertBranchAccess(stay.branchId, user);
    const checkOutActual = data.checkOutActual ? new Date(data.checkOutActual) : new Date();
    const surcharge = data.adjustments
      ? this.sumAdjustmentAmount(data.adjustments)
      : data.surcharge ?? stay.surcharge;
    const promotion = data.promotion ?? stay.promotion;
    const pricingPreview = await this.buildHotelPricingPreview({
      species: stay.pet.species,
      weight: stay.pet.weight,
      checkIn: stay.checkIn,
      branchId: stay.branchId,
      checkOut: checkOutActual,
      ...(stay.rateTableId ? { rateTableId: stay.rateTableId } : {}),
    });
    const dailyRate = data.dailyRate ?? pricingPreview.averageDailyRate;
    const totalPrice = this.roundCurrency(pricingPreview.totalPrice + surcharge - promotion);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.hotelStay.update({
        where: { id },
        data: {
          status: 'CHECKED_OUT',
          checkOut: checkOutActual,
          checkOutActual,
          lineType: pricingPreview.lineType,
          dailyRate,
          surcharge,
          promotion,
          totalPrice,
          weightAtBooking: pricingPreview.weightAtPricing,
          weightBand: pricingPreview.weightBand?.id
            ? { connect: { id: pricingPreview.weightBand.id } }
            : { disconnect: true },
          pricingSnapshot: pricingPreview.pricingSnapshot as Prisma.InputJsonValue,
          breakdownSnapshot: this.buildStayBreakdownSnapshot(
            pricingPreview,
            promotion,
            surcharge,
            totalPrice,
          ) as Prisma.InputJsonValue,
          ...(data.paymentStatus ? { paymentStatus: data.paymentStatus } : {}),
          ...(data.notes ? { notes: data.notes } : {}),
        },
      });

      await this.replaceStayAdjustments(tx, id, data.adjustments);

      await tx.hotelStayChargeLine.deleteMany({
        where: { hotelStayId: id },
      });

      if (pricingPreview.chargeLines.length > 0) {
        await tx.hotelStayChargeLine.createMany({
          data: pricingPreview.chargeLines.map((line) => ({
            hotelStayId: id,
            weightBandId: line.weightBandId,
            label: line.label,
            dayType: line.dayType,
            quantityDays: line.quantityDays,
            unitPrice: line.unitPrice,
            subtotal: line.subtotal,
            sortOrder: line.sortOrder,
            pricingSnapshot: line.pricingSnapshot as Prisma.InputJsonValue,
          })),
        });
      }

      return tx.hotelStay.findUniqueOrThrow({
        where: { id },
        include: this.stayInclude,
      });
    });

    await this.syncLinkedOrder(updated.id, updated.orderId);
    await this.logStayActivity('HOTEL_STAY_CHECKED_OUT', updated, user, {
      previousStatus: stay.status,
      checkOutActual: updated.checkOutActual,
      surcharge: updated.surcharge,
      totalPrice: updated.totalPrice,
    });

    return this.mapStay(updated);
  }

  async calculatePrice(data: CalculateHotelPriceDto) {
    const checkIn = new Date(data.checkIn);
    const checkOut = new Date(data.checkOut);
    const pricingPreview = await this.buildHotelPricingPreview({
      species: data.species,
      weight: data.weight,
      checkIn,
      checkOut,
      ...(data.branchId ? { branchId: data.branchId } : {}),
      ...(data.rateTableId ? { rateTableId: data.rateTableId } : {}),
    });

    return {
      totalDays: pricingPreview.totalDays,
      totalPrice: pricingPreview.totalPrice,
      averageDailyRate: pricingPreview.averageDailyRate,
      lineType: pricingPreview.lineType,
      weightBand: pricingPreview.weightBand,
      chargeLines: pricingPreview.chargeLines,
      pricingSnapshot: pricingPreview.pricingSnapshot,
    };
  }

  async findStayTimeline(id: string, user?: BranchScopedUser) {
    const stay = await this.prisma.hotelStay.findUnique({
      where: { id },
      select: {
        id: true,
        stayCode: true,
        petName: true,
        branchId: true,
        createdAt: true,
        checkIn: true,
        checkedInAt: true,
        estimatedCheckOut: true,
        checkOutActual: true,
        cancelledAt: true,
        createdBy: { select: { id: true, fullName: true, staffCode: true } },
      },
    });
    if (!stay) throw new NotFoundException('Khong tim thay ky luu tru');
    assertBranchAccess(stay.branchId, user);

    const activityLogs = await this.prisma.activityLog.findMany({
      where: {
        target: 'HOTEL_STAY',
        targetId: id,
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            staffCode: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const findLatestActivityUser = (action: string) =>
      [...activityLogs].reverse().find((entry) => entry.action === action)?.user ?? null;

    const checkpointUsers = {
      created: activityLogs.find((entry) => entry.action === 'HOTEL_STAY_CREATED')?.user ?? stay.createdBy ?? null,
      checkedIn: findLatestActivityUser('HOTEL_STAY_CHECKED_IN'),
      checkedOut: findLatestActivityUser('HOTEL_STAY_CHECKED_OUT'),
      cancelled: findLatestActivityUser('HOTEL_STAY_CANCELLED'),
    };

    return {
      checkpoints: [
        { key: 'created', label: 'Tao don', at: stay.createdAt, user: checkpointUsers.created },
        { key: 'checked_in', label: 'Nhan phong', at: stay.checkedInAt ?? null, user: checkpointUsers.checkedIn },
        { key: 'expected_checkout', label: 'Du kien tra', at: stay.estimatedCheckOut ?? null, user: null },
        { key: 'checked_out', label: 'Da tra', at: stay.checkOutActual ?? null, user: checkpointUsers.checkedOut },
        { key: 'cancelled', label: 'Da huy', at: stay.cancelledAt ?? null, user: checkpointUsers.cancelled },
      ],
      activities: activityLogs.map((entry) => ({
        id: entry.id,
        action: entry.action,
        target: entry.target,
        targetId: entry.targetId,
        details: entry.details,
        createdAt: entry.createdAt,
        user: entry.user,
      })),
    };
  }

  async deleteStay(id: string, user?: BranchScopedUser) {
    const stay = await this.prisma.hotelStay.findUnique({
      where: { id },
      select: {
        id: true,
        orderId: true,
        status: true,
        branchId: true,
      },
    });
    if (!stay) throw new NotFoundException('Không tìm thấy kỳ lưu trú');
    assertBranchAccess(stay.branchId, user);
    if (stay.orderId && stay.status !== 'CANCELLED') {
      throw new BadRequestException('Không thể xóa kỳ lưu trú đang gắn với đơn hàng, hãy hủy trước');
    }

    return this.prisma.hotelStay.delete({
      where: { id },
    });
  }
}
