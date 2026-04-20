import { BadRequestException } from '@nestjs/common'
import { OrdersService } from './orders.service'

describe('OrdersService', () => {
  let service: OrdersService
  let db: any

  beforeEach(() => {
    db = {
      $queryRaw: jest.fn(),
      $queryRawUnsafe: jest.fn(),
      $transaction: jest.fn(),
      order: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
      },
      paymentMethod: {
        findUnique: jest.fn(),
      },
      groomingSession: {
        findUnique: jest.fn(),
      },
      hotelStay: {
        findUnique: jest.fn(),
      },
    }
    service = new OrdersService(db)
  })

  describe('utility methods', () => {
    it('calculates remaining amount correctly', () => {
      expect((service as any).calculateRemainingAmount(1000, 400)).toBe(600)
      expect((service as any).calculateRemainingAmount(1000, 1500)).toBe(0)
    })

    it('calculates payment status correctly', () => {
      expect((service as any).calculatePaymentStatus(1000, 1000)).toBe('PAID')
      expect((service as any).calculatePaymentStatus(1000, 1500)).toBe('PAID')
      expect((service as any).calculatePaymentStatus(1000, 400)).toBe('PARTIAL')
      expect((service as any).calculatePaymentStatus(1000, 0)).toBe('UNPAID')
    })

    it('gets the expected payment label', () => {
      expect((service as any).getPaymentLabel('CASH')).toBe('Tiền mặt')
      expect((service as any).getPaymentLabel('UNKNOWN')).toBe('UNKNOWN')
    })
  })

  describe('generateOrderNumber', () => {
    it('generates an order number using YYMMDD prefix and latest sequence', async () => {
      const mockDate = new Date('2026-04-16T12:00:00Z')
      jest.useFakeTimers().setSystemTime(mockDate)

      db.order.count.mockResolvedValue(4)
      const orderNumber = await (service as any).generateOrderNumber()
      expect(orderNumber).toBe('DH260416005')

      db.order.count.mockResolvedValue(0)
      const orderNumber2 = await (service as any).generateOrderNumber()
      expect(orderNumber2).toBe('DH260416001')

      jest.useRealTimers()
    })
  })

  describe('regression guards', () => {
    it('rejects payment-intent creation for cancelled orders', async () => {
      db.order.findUnique.mockResolvedValue({
        id: 'order-1',
        orderNumber: 'DH1',
        branchId: 'branch-1',
        customerName: 'Alice',
        total: 300_000,
        paidAmount: 0,
        paymentStatus: 'UNPAID',
        status: 'CANCELLED',
      })

      await expect(
        service.createPaymentIntent('order-1', { paymentMethodId: 'pm-bank' }),
      ).rejects.toThrow(BadRequestException)
    })

    it('rejects payOrder for already paid orders', async () => {
      db.order.findUnique.mockResolvedValue({
        id: 'order-1',
        orderNumber: 'DH1',
        total: 300_000,
        paidAmount: 300_000,
        paymentStatus: 'PAID',
        customerId: null,
        customerName: 'Alice',
        branchId: 'branch-1',
        items: [],
        hotelStays: [],
      })

      await expect(
        service.payOrder('order-1', { payments: [{ method: 'CASH', amount: 100_000 }] }, 'staff-1'),
      ).rejects.toThrow(BadRequestException)
    })

    it('rejects completeOrder when linked service work is unfinished', async () => {
      db.order.findUnique.mockResolvedValue({
        id: 'order-1',
        status: 'PROCESSING',
        branchId: 'branch-1',
        customer: null,
        items: [{ id: 'item-1', groomingSessionId: 'gs-1', hotelStayId: null, productId: null }],
      })
      db.groomingSession.findUnique.mockResolvedValue({
        id: 'gs-1',
        sessionCode: 'GS001',
        status: 'IN_PROGRESS',
      })

      await expect(
        service.completeOrder('order-1', { payments: [] }, 'staff-1'),
      ).rejects.toThrow(BadRequestException)
    })

    it('rejects cancelOrder for completed orders', async () => {
      db.order.findUnique.mockResolvedValue({
        id: 'order-1',
        status: 'COMPLETED',
        branchId: 'branch-1',
        items: [],
      })

      await expect(service.cancelOrder('order-1', {}, 'staff-1')).rejects.toThrow(BadRequestException)
    })

    it('rejects settleOrder until service order is fully ready', async () => {
      db.order.findUnique.mockResolvedValue({
        id: 'order-1',
        status: 'PROCESSING',
        branchId: 'branch-1',
        paymentStatus: 'PARTIAL',
        stockExportedAt: null,
        items: [{ type: 'grooming' }],
        payments: [],
      })

      await expect(service.settleOrder('order-1', { note: 'finalize' }, 'staff-1', {
        userId: 'staff-1',
        role: 'STAFF',
        permissions: [],
        branchId: 'branch-1',
        authorizedBranchIds: ['branch-1'],
      })).rejects.toThrow(BadRequestException)
    })
  })
})
