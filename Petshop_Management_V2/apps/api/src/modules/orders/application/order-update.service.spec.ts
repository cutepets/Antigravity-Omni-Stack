import { BadRequestException } from '@nestjs/common';
import { OrderUpdateService } from './order-update.service.js';

describe('OrderUpdateService', () => {
  const buildService = () => {
    const prisma = {
      order: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    const accessService = { assertOrderScope: jest.fn() };
    const orderItemService = {
      calculateOrderSubtotal: jest.fn().mockReturnValue(10_000),
      validateAndNormalizeCreateItems: jest.fn(),
      buildOrderItemData: jest.fn(),
      buildHotelOrderItemPricingSnapshot: jest.fn(),
    };
    const numberingService = { generateHotelStayCode: jest.fn() };
    const paymentHelperService = { calculatePaymentStatus: jest.fn().mockReturnValue('UNPAID') };
    const queryService = { findOne: jest.fn().mockResolvedValue({ id: 'order-1' }) };
    const syncService = {
      syncGroomingSession: jest.fn(),
      syncHotelStay: jest.fn(),
      syncGroupedHotelStay: jest.fn(),
    };

    return {
      prisma,
      orderItemService,
      syncService,
      queryService,
      service: new OrderUpdateService(
        prisma as any,
        accessService as any,
        orderItemService as any,
        numberingService as any,
        paymentHelperService as any,
        queryService as any,
        syncService as any,
      ),
    };
  };

  it('rejects items that are both grooming and hotel', async () => {
    const { prisma, service } = buildService();
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'PENDING',
      paidAmount: 0,
      createdAt: new Date(),
      items: [],
      customer: null,
    });

    await expect(service.updateOrder('order-1', {
      items: [{
        description: 'invalid',
        quantity: 1,
        unitPrice: 10_000,
        groomingDetails: { petId: 'pet-1' },
        hotelDetails: { petId: 'pet-1' },
      }],
    } as any, 'staff-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('groups hotel lines through the shared sync service', async () => {
    const { prisma, orderItemService, syncService, queryService, service } = buildService();
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-1',
      status: 'PENDING',
      paidAmount: 0,
      createdAt: new Date('2026-04-26T09:00:00.000Z'),
      items: [],
      customer: null,
    });
    const tx = {
      branch: {
        findUnique: jest.fn().mockResolvedValue({ id: 'branch-1', code: 'BR1', name: 'Branch 1', isMain: false }),
        findFirst: jest.fn(),
      },
      pet: {
        findUnique: jest.fn().mockResolvedValue({ id: 'pet-1', name: 'Milu' }),
      },
      hotelStay: {
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'stay-1' }),
        update: jest.fn(),
      },
      orderItem: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest
          .fn()
          .mockResolvedValueOnce({ id: 'item-1' })
          .mockResolvedValueOnce({ id: 'item-2' }),
        update: jest.fn(),
        delete: jest.fn(),
      },
      order: {
        update: jest.fn().mockResolvedValue({ id: 'order-1' }),
      },
    };
    prisma.$transaction.mockImplementation(async (callback: any) => callback(tx));
    orderItemService.validateAndNormalizeCreateItems.mockResolvedValue([
      {
        description: 'Ngay thuong',
        quantity: 1,
        unitPrice: 100_000,
        discountItem: 0,
        type: 'hotel',
        hotelDetails: {
          petId: 'pet-1',
          bookingGroupKey: 'group-1',
          chargeLineIndex: 0,
          chargeQuantityDays: 1,
          checkInDate: '2026-04-26',
          checkOutDate: '2026-04-27',
        },
      },
      {
        description: 'Ngay le',
        quantity: 1,
        unitPrice: 120_000,
        discountItem: 0,
        type: 'hotel',
        hotelDetails: {
          petId: 'pet-1',
          bookingGroupKey: 'group-1',
          chargeLineIndex: 1,
          chargeQuantityDays: 1,
          chargeDayType: 'HOLIDAY',
          checkInDate: '2026-04-26',
          checkOutDate: '2026-04-27',
        },
      },
    ]);
    orderItemService.buildOrderItemData.mockImplementation((item: any) => item);

    await service.updateOrder('order-1', {
      branchId: 'branch-1',
      items: [
        { description: 'Ngay thuong', quantity: 1, unitPrice: 100_000, type: 'hotel', hotelDetails: { petId: 'pet-1', bookingGroupKey: 'group-1', chargeLineIndex: 0, chargeQuantityDays: 1, checkInDate: '2026-04-26', checkOutDate: '2026-04-27' } },
        { description: 'Ngay le', quantity: 1, unitPrice: 120_000, type: 'hotel', hotelDetails: { petId: 'pet-1', bookingGroupKey: 'group-1', chargeLineIndex: 1, chargeQuantityDays: 1, chargeDayType: 'HOLIDAY', checkInDate: '2026-04-26', checkOutDate: '2026-04-27' } },
      ],
    } as any, 'staff-1');

    expect(tx.hotelStay.create).toHaveBeenCalledTimes(1);
    expect(tx.orderItem.update).toHaveBeenCalledTimes(2);
    expect(queryService.findOne).toHaveBeenCalledWith('order-1', undefined);
  });
});
