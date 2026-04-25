import { BadRequestException, ForbiddenException } from '@nestjs/common'
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
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
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
      orderReturnRequest: {
        create: jest.fn(),
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      orderReturnItem: {
        deleteMany: jest.fn(),
      },
      orderTimeline: {
        create: jest.fn(),
      },
      orderPayment: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      orderItem: {
        update: jest.fn(),
        deleteMany: jest.fn(),
      },
      productVariant: {
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      transaction: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
      paymentIntent: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      bankTransaction: {
        deleteMany: jest.fn(),
      },
      paymentWebhookEvent: {
        deleteMany: jest.fn(),
      },
      product: {
        findUnique: jest.fn(),
      },
      branch: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      branchStock: {
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      stockTransaction: {
        create: jest.fn(),
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      productSalesDaily: {
        upsert: jest.fn(),
      },
      customer: {
        update: jest.fn(),
      },
      systemConfig: {
        findFirst: jest.fn(),
      },
    }
    db.orderReturnRequest.findMany.mockResolvedValue([])
    db.systemConfig.findFirst.mockResolvedValue(null)
    db.transaction.findFirst.mockResolvedValue(null)
    db.transaction.findMany.mockResolvedValue([])
    db.transaction.create.mockResolvedValue({})
    db.transaction.deleteMany.mockResolvedValue({ count: 0 })
    db.paymentIntent.findMany.mockResolvedValue([])
    db.paymentIntent.deleteMany.mockResolvedValue({ count: 0 })
    db.bankTransaction.deleteMany.mockResolvedValue({ count: 0 })
    db.paymentWebhookEvent.deleteMany.mockResolvedValue({ count: 0 })
    db.orderPayment.findMany.mockResolvedValue([])
    db.orderItem.deleteMany.mockResolvedValue({ count: 0 })
    db.orderReturnRequest.deleteMany.mockResolvedValue({ count: 0 })
    db.orderReturnItem.deleteMany.mockResolvedValue({ count: 0 })
    db.order.deleteMany.mockResolvedValue({ count: 0 })
    db.stockTransaction.findMany.mockResolvedValue([])
    db.stockTransaction.deleteMany.mockResolvedValue({ count: 0 })
    db.productSalesDaily.upsert.mockResolvedValue({})
    db.customer.update.mockResolvedValue({})
    db.branch.findUnique.mockResolvedValue({ id: 'branch-1', code: 'BR1', name: 'To Hieu' })
    db.branch.findFirst.mockResolvedValue({ id: 'branch-1', code: 'BR1', name: 'To Hieu' })
    db.branchStock.findFirst.mockResolvedValue({ id: 'stock-1', stock: 100 })
    db.branchStock.update.mockResolvedValue({})
    db.branchStock.create.mockResolvedValue({})
    db.stockTransaction.create.mockResolvedValue({})
    db.productVariant.findUnique.mockImplementation(async ({ where }: any) => ({
      id: where.id,
      name: where.id,
      sku: where.id,
      product: { name: where.id },
    }))
    db.product.findUnique.mockImplementation(async ({ where }: any) => ({
      id: where.id,
      name: where.id,
      sku: where.id,
      variants: [
        { id: 'variant-1', productId: 'product-1', sku: 'V1', isActive: true },
        { id: 'variant-2', productId: 'product-2', sku: 'V2', isActive: true },
        { id: 'variant-new', productId: 'product-new', sku: 'NEW', isActive: true },
        { id: 'variant-return', productId: 'product-return', sku: 'RET', isActive: true },
        { id: 'variant-exchange', productId: 'product-exchange', sku: 'EXC', isActive: true },
      ],
    }))
    service = new OrdersService(db)
  })

  function createCompletedOrder(overrides?: Record<string, unknown>) {
    return {
      id: 'order-1',
      orderNumber: 'DH1',
      status: 'COMPLETED',
      branchId: 'branch-1',
      customerId: 'customer-1',
      customerName: 'Alice',
      customer: { fullName: 'Alice' },
      completedAt: new Date('2026-04-24T10:00:00Z'),
      createdAt: new Date('2026-04-24T09:00:00Z'),
      items: [
        {
          id: 'return-item',
          type: 'product',
          quantity: 2,
          unitPrice: 120_000,
          discountItem: 20_000,
          description: 'Pate Meo Wanpy 80g',
          sku: 'PMW80',
          productId: 'product-return',
          productVariantId: 'variant-return',
        },
        {
          id: 'exchange-item',
          type: 'product',
          quantity: 1,
          unitPrice: 10_000,
          discountItem: 0,
          description: 'Pate Meo Wanpy 10g',
          sku: 'PMW10',
          productId: 'product-exchange',
          productVariantId: 'variant-exchange',
        },
      ],
      ...overrides,
    }
  }

  function wireReturnTransaction(txOverrides?: Record<string, unknown>) {
    const tx = {
      orderReturnRequest: {
        create: jest.fn(async ({ data }: any) => ({
          id: 'return-request-1',
          ...data,
          items: data.items?.create ?? [],
        })),
      },
      branchStock: {
        findFirst: jest.fn(async () => ({ id: 'stock-1', stock: 100 })),
        update: jest.fn(async () => ({})),
        create: jest.fn(async () => ({})),
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
      branch: {
        findUnique: jest.fn(async () => ({ id: 'branch-1', code: 'BR1', name: 'To Hieu' })),
        findFirst: jest.fn(async () => ({ id: 'branch-1', code: 'BR1', name: 'To Hieu' })),
      },
      stockTransaction: {
        create: jest.fn(async ({ data }: any) => ({ id: 'stock-tx-1', ...data })),
      },
      order: {
        update: jest.fn(async ({ data }: any) => ({ id: 'order-1', ...data })),
        create: jest.fn(async ({ data }: any) => ({
          id: 'exchange-order-1',
          ...data,
          items: (data.items?.create ?? []).map((item: any, index: number) => ({
            id: `exchange-item-${index + 1}`,
            ...item,
          })),
        })),
      },
      product: {
        findMany: jest.fn(async ({ where }: any) => (
          (where?.id?.in ?? []).map((id: string) => ({ id }))
        )),
        findUnique: jest.fn(async ({ where }: any) => ({
          id: where.id,
          name: where.id,
          sku: where.id,
          variants: [
            { id: 'variant-return', productId: 'product-return', sku: 'RET', isActive: true },
            { id: 'variant-exchange', productId: 'product-exchange', sku: 'EXC', isActive: true },
            { id: 'variant-new', productId: 'product-new', sku: 'NEW', isActive: true },
          ],
        })),
      },
      productVariant: {
        findMany: jest.fn(async ({ where }: any) => (
          (where?.id?.in ?? []).map((id: string) => ({
            id,
            productId: id === 'variant-new' ? 'product-new' : 'product-extra',
          }))
        )),
        update: jest.fn(async () => ({})),
        findUnique: jest.fn(async ({ where }: any) => ({
          id: where.id,
          name: where.id,
          sku: where.id,
          product: { name: 'Product' },
        })),
      },
      service: {
        findMany: jest.fn(async () => []),
      },
      serviceVariant: {
        findMany: jest.fn(async () => []),
      },
      orderPayment: {
        create: jest.fn(async ({ data }: any) => ({ id: 'payment-1', ...data })),
      },
      orderItem: {
        update: jest.fn(async () => ({})),
      },
      orderTimeline: {
        create: jest.fn(async ({ data }: any) => ({ id: 'timeline-1', ...data })),
      },
      ...txOverrides,
    }

    db.$transaction.mockImplementation(async (callback: any) => callback(tx))
    return tx
  }

  function createDeleteOrder(overrides?: Record<string, unknown>) {
    return {
      id: 'order-1',
      orderNumber: 'DH1',
      status: 'COMPLETED',
      paymentStatus: 'PAID',
      branchId: 'branch-1',
      customerId: 'customer-1',
      customerName: 'Alice',
      total: 100_000,
      paidAmount: 130_000,
      completedAt: new Date('2026-04-24T10:00:00Z'),
      createdAt: new Date('2026-04-24T09:00:00Z'),
      items: [
        {
          id: 'item-1',
          type: 'product',
          productId: 'product-1',
          productVariantId: 'variant-1',
          quantity: 2,
          subtotal: 100_000,
        },
      ],
      ...overrides,
    }
  }

  function wireDeleteTransaction(txOverrides?: Record<string, unknown>) {
    const tx = {
      order: {
        findMany: jest.fn(async ({ where }: any) => {
          const ids = where?.id?.in ?? []
          return ids.includes('order-1') ? [createDeleteOrder()] : []
        }),
        deleteMany: jest.fn(async () => ({ count: 1 })),
      },
      orderReturnRequest: {
        findMany: jest.fn(async () => []),
        deleteMany: jest.fn(async () => ({ count: 0 })),
      },
      orderReturnItem: {
        deleteMany: jest.fn(async () => ({ count: 0 })),
      },
      orderPayment: {
        findMany: jest.fn(async () => [
          { orderId: 'order-1', method: 'POINTS', amount: 20_000 },
          { orderId: 'order-1', method: 'CASH', amount: 110_000 },
        ]),
      },
      transaction: {
        findMany: jest.fn(async () => []),
        deleteMany: jest.fn(async () => ({ count: 1 })),
      },
      paymentIntent: {
        findMany: jest.fn(async () => [{ id: 'pi-1' }]),
        deleteMany: jest.fn(async () => ({ count: 1 })),
      },
      paymentWebhookEvent: {
        deleteMany: jest.fn(async () => ({ count: 1 })),
      },
      bankTransaction: {
        deleteMany: jest.fn(async () => ({ count: 1 })),
      },
      stockTransaction: {
        findMany: jest.fn(async () => [
          {
            id: 'stock-tx-1',
            type: 'OUT',
            productId: 'product-1',
            productVariantId: 'variant-1',
            sourceProductVariantId: 'variant-1',
            branchId: 'branch-1',
            quantity: 2,
            sourceQuantity: 2,
          },
        ]),
        deleteMany: jest.fn(async () => ({ count: 1 })),
      },
      branchStock: {
        findFirst: jest.fn(async () => ({ id: 'stock-1', stock: 10 })),
        update: jest.fn(async () => ({})),
        create: jest.fn(async () => ({})),
      },
      customer: {
        update: jest.fn(async () => ({})),
      },
      productSalesDaily: {
        upsert: jest.fn(async () => ({})),
      },
      groomingSession: {
        deleteMany: jest.fn(async () => ({ count: 0 })),
      },
      hotelStay: {
        deleteMany: jest.fn(async () => ({ count: 0 })),
      },
      orderItem: {
        deleteMany: jest.fn(async () => ({ count: 1 })),
      },
      systemConfig: {
        findFirst: jest.fn(async () => ({ loyaltyPointValue: 1000 })),
      },
      ...txOverrides,
    }

    db.$transaction.mockImplementation(async (callback: any) => callback(tx))
    return tx
  }

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
      db.order.findFirst.mockResolvedValue({
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

    it('auto exports product-only exchange orders when payment becomes paid', async () => {
      const order = {
        id: 'exchange-order-1',
        orderNumber: 'DH2',
        status: 'PENDING',
        total: 130_000,
        paidAmount: 120_000,
        paymentStatus: 'PARTIAL',
        stockExportedAt: null,
        customerId: null,
        customerName: 'Alice',
        branchId: 'branch-1',
        customer: null,
        items: [
          {
            id: 'item-1',
            type: 'product',
            productId: 'product-1',
            productVariantId: 'variant-1',
            quantity: 1,
            subtotal: 100_000,
            isTemp: false,
            stockExportedAt: null,
            groomingSessionId: null,
            hotelStayId: null,
          },
          {
            id: 'item-2',
            type: 'product',
            productId: 'product-2',
            productVariantId: 'variant-2',
            quantity: 3,
            subtotal: 30_000,
            isTemp: false,
            stockExportedAt: null,
            groomingSessionId: null,
            hotelStayId: null,
          },
        ],
        hotelStays: [],
      }
      db.order.findUnique.mockResolvedValue(order)
      db.$transaction.mockImplementation(async (callback: any) => callback(db))
      db.order.update.mockImplementation(async ({ data }: any) => ({ ...order, ...data, items: order.items, payments: [] }))

      const result = await service.payOrder('exchange-order-1', {
        payments: [{ method: 'CASH', amount: 10_000 }],
      }, 'staff-1')

      expect(result.status).toBe('COMPLETED')
      expect(db.branchStock.update).toHaveBeenCalledTimes(2)
      expect(db.stockTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          type: 'OUT',
          productId: 'product-1',
          productVariantId: 'variant-1',
          referenceId: 'exchange-order-1',
          referenceType: 'ORDER',
        }),
      }))
      expect(db.orderItem.update).toHaveBeenCalledTimes(2)
      expect(db.order.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'exchange-order-1' },
        data: expect.objectContaining({
          paidAmount: 130_000,
          remainingAmount: 0,
          paymentStatus: 'PAID',
          status: 'COMPLETED',
          stockExportedAt: expect.any(Date),
          stockExportedBy: 'staff-1',
        }),
      }))
      expect(db.orderTimeline.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          action: 'STOCK_EXPORTED',
          toStatus: 'COMPLETED',
          metadata: expect.objectContaining({ source: 'PAYMENT_AUTO_EXPORT' }),
        }),
      }))
    })

    it('does not auto export paid orders when service items are present', async () => {
      const order = {
        id: 'service-order-1',
        orderNumber: 'DH3',
        status: 'PENDING',
        total: 130_000,
        paidAmount: 120_000,
        paymentStatus: 'PARTIAL',
        stockExportedAt: null,
        customerId: null,
        customerName: 'Alice',
        branchId: 'branch-1',
        customer: null,
        items: [
          {
            id: 'item-1',
            type: 'product',
            productId: 'product-1',
            productVariantId: 'variant-1',
            quantity: 1,
            subtotal: 100_000,
            isTemp: false,
            stockExportedAt: null,
            groomingSessionId: null,
            hotelStayId: null,
          },
          {
            id: 'service-item-1',
            type: 'grooming',
            productId: null,
            productVariantId: null,
            quantity: 1,
            subtotal: 30_000,
            isTemp: false,
            stockExportedAt: null,
            groomingSessionId: 'gs-1',
            hotelStayId: null,
          },
        ],
        hotelStays: [],
      }
      db.order.findUnique.mockResolvedValue(order)
      db.$transaction.mockImplementation(async (callback: any) => callback(db))
      db.order.update.mockImplementation(async ({ data }: any) => ({ ...order, ...data, items: order.items, payments: [] }))

      const result = await service.payOrder('service-order-1', {
        payments: [{ method: 'CASH', amount: 10_000 }],
      }, 'staff-1')

      expect(result.status).toBe('PENDING')
      expect(db.branchStock.update).not.toHaveBeenCalled()
      expect(db.stockTransaction.create).not.toHaveBeenCalled()
      expect(db.orderItem.update).not.toHaveBeenCalled()
      expect(db.order.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.not.objectContaining({
          stockExportedAt: expect.any(Date),
          status: 'COMPLETED',
        }),
      }))
    })

    it('exports stuck paid pending exchange orders without recreating them', async () => {
      const order = {
        id: 'exchange-order-1',
        orderNumber: 'DH260425010',
        linkedReturnId: 'return-request-1',
        status: 'PENDING',
        paymentStatus: 'PAID',
        stockExportedAt: null,
        branchId: 'branch-1',
        items: [
          {
            id: 'item-1',
            type: 'product',
            productId: 'product-1',
            productVariantId: 'variant-1',
            quantity: 1,
            isTemp: false,
            stockExportedAt: null,
            groomingSession: null,
            hotelStay: null,
          },
        ],
      }
      db.order.findFirst.mockResolvedValue(order)
      db.$transaction.mockImplementation(async (callback: any) => callback(db))
      db.order.update.mockResolvedValue({ ...order, status: 'COMPLETED', stockExportedAt: new Date() })
      jest.spyOn((service as any).command, 'findOne').mockResolvedValue({ ...order, status: 'COMPLETED' } as any)

      const result = await service.exportStock('exchange-order-1', { note: 'repair stuck exchange order' }, 'staff-1', undefined as any)

      expect(result.status).toBe('COMPLETED')
      expect(db.branchStock.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'stock-1' },
        data: { stock: { decrement: 1 } },
      }))
      expect(db.stockTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          type: 'OUT',
          productId: 'product-1',
          productVariantId: 'variant-1',
          referenceId: 'exchange-order-1',
          referenceType: 'ORDER',
          reason: 'Xuat kho don doi #DH260425010',
        }),
      }))
      expect(db.orderItem.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'item-1' },
        data: expect.objectContaining({
          stockExportedAt: expect.any(Date),
          stockExportedBy: 'staff-1',
        }),
      }))
      expect(db.order.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'exchange-order-1' },
        data: expect.objectContaining({
          status: 'COMPLETED',
          stockExportedAt: expect.any(Date),
          stockExportedBy: 'staff-1',
        }),
      }))
    })

    it('exports orders by order number when the UI routes with DH code', async () => {
      const order = {
        id: 'exchange-order-1',
        orderNumber: 'DH260425010',
        linkedReturnId: 'return-request-1',
        status: 'PENDING',
        paymentStatus: 'PAID',
        stockExportedAt: null,
        branchId: 'branch-1',
        items: [
          {
            id: 'item-1',
            type: 'product',
            productId: 'product-1',
            productVariantId: 'variant-1',
            quantity: 1,
            isTemp: false,
            stockExportedAt: null,
            groomingSession: null,
            hotelStay: null,
          },
        ],
      }
      db.order.findFirst.mockResolvedValue(order)
      db.$transaction.mockImplementation(async (callback: any) => callback(db))
      db.order.update.mockResolvedValue({ ...order, status: 'COMPLETED', stockExportedAt: new Date() })
      jest.spyOn((service as any).command, 'findOne').mockResolvedValue({ ...order, status: 'COMPLETED' } as any)

      await service.exportStock('DH260425010', {}, 'staff-1', undefined as any)

      expect(db.order.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: { OR: [{ id: 'DH260425010' }, { orderNumber: 'DH260425010' }] },
      }))
      expect(db.stockTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          referenceId: 'exchange-order-1',
          reason: 'Xuat kho don doi #DH260425010',
        }),
      }))
      expect(db.order.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'exchange-order-1' },
      }))
      expect((service as any).command.findOne).toHaveBeenCalledWith('exchange-order-1', undefined)
    })

    it('rejects completeOrder when linked service work is unfinished', async () => {
      db.order.findFirst.mockResolvedValue({
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

    it('records order returns with a valid refunded timeline action', async () => {
      db.order.findFirst.mockResolvedValue(createCompletedOrder())
      const tx = wireReturnTransaction()

      const result = await service.createReturnRequest('order-1', {
        type: 'PARTIAL',
        items: [{ orderItemId: 'return-item', quantity: 1, action: 'RETURN' }],
      }, 'staff-1')

      expect(result.refundAmount).toBe(110_000)
      expect(tx.orderReturnRequest.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          status: 'APPROVED',
          refundAmount: 110_000,
        }),
      }))
      expect(tx.orderTimeline.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          action: 'REFUNDED',
          metadata: expect.objectContaining({
            returnRequestId: 'return-request-1',
            returnFlow: 'ORDER_RETURN_EXCHANGE',
            hasReturn: true,
            hasExchange: false,
          }),
        }),
      }))
      expect(tx.branchStock.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'stock-1' },
        data: { stock: { increment: 1 } },
      }))
      expect(tx.stockTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          type: 'IN',
          productId: 'product-return',
          productVariantId: 'variant-return',
          referenceId: 'order-1',
          referenceType: 'ORDER',
        }),
      }))
    })

    it('creates an exchange order with pre-applied credit', async () => {
      db.order.findFirst.mockResolvedValue(createCompletedOrder())
      db.order.count.mockResolvedValue(0)
      const tx = wireReturnTransaction()

      const result = await service.createReturnRequest('DH1', {
        type: 'PARTIAL',
        items: [{ orderItemId: 'exchange-item', quantity: 1, action: 'EXCHANGE' }],
      }, 'staff-1')

      expect(result.exchangeOrderId).toBe('exchange-order-1')
      expect(result.refundAmount).toBe(0)
      expect(tx.order.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          status: 'PENDING',
          paidAmount: 10_000,
          creditAmount: 10_000,
          linkedReturnId: 'return-request-1',
        }),
      }))
      expect(tx.orderPayment.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          method: 'ORDER_CREDIT',
          amount: 10_000,
        }),
      }))
      expect(tx.branchStock.updateMany).not.toHaveBeenCalled()
    })

    it('creates an exchange order with selected replacement items and partial payment state', async () => {
      db.order.findFirst.mockResolvedValue(createCompletedOrder())
      db.order.count.mockResolvedValue(0)
      const tx = wireReturnTransaction()

      const result = await service.createReturnRequest('DH1', {
        type: 'PARTIAL',
        items: [{ orderItemId: 'exchange-item', quantity: 1, action: 'EXCHANGE' }],
        exchangeItems: [{
          productId: 'product-new',
          productVariantId: 'variant-new',
          description: 'Pate replacement 100g',
          sku: 'NEW100',
          quantity: 2,
          unitPrice: 15_000,
          discountItem: 5_000,
          vatRate: 0,
          type: 'product',
        }],
      } as any, 'staff-1')

      expect(result.exchangeOrderId).toBe('exchange-order-1')
      expect(tx.order.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          status: 'PENDING',
          paymentStatus: 'PARTIAL',
          subtotal: 25_000,
          total: 25_000,
          paidAmount: 10_000,
          remainingAmount: 15_000,
          creditAmount: 10_000,
          items: {
            create: [expect.objectContaining({
              productId: 'product-new',
              productVariantId: 'variant-new',
              description: 'Pate replacement 100g',
              quantity: 2,
              unitPrice: 15_000,
              discountItem: 5_000,
              subtotal: 25_000,
              type: 'product',
            })],
          },
        }),
      }))
    })

    it('marks exchange order paid when credit covers selected replacement items', async () => {
      db.order.findFirst.mockResolvedValue(createCompletedOrder())
      db.order.count.mockResolvedValue(0)
      const tx = wireReturnTransaction()

      await service.createReturnRequest('DH1', {
        type: 'PARTIAL',
        items: [{ orderItemId: 'exchange-item', quantity: 1, action: 'EXCHANGE' }],
        exchangeItems: [{
          productId: 'product-new',
          productVariantId: 'variant-new',
          description: 'Pate replacement 100g',
          quantity: 1,
          unitPrice: 8_000,
          discountItem: 0,
          vatRate: 0,
          type: 'product',
        }],
      } as any, 'staff-1')

      expect(tx.order.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          paymentStatus: 'PAID',
          subtotal: 8_000,
          total: 8_000,
          paidAmount: 10_000,
          remainingAmount: 0,
          creditAmount: 10_000,
        }),
      }))
      expect(tx.branchStock.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'stock-1' },
        data: { stock: { decrement: 1 } },
      }))
      expect(tx.stockTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          type: 'OUT',
          productId: 'product-new',
          productVariantId: 'variant-new',
          referenceId: 'exchange-order-1',
          referenceType: 'ORDER',
        }),
      }))
      expect(tx.order.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'exchange-order-1' },
        data: expect.objectContaining({
          status: 'COMPLETED',
          stockExportedAt: expect.any(Date),
          stockExportedBy: 'staff-1',
        }),
      }))
    })

    it('rejects replacement exchange items that are not products', async () => {
      db.order.findFirst.mockResolvedValue(createCompletedOrder())

      await expect(service.createReturnRequest('DH1', {
        type: 'PARTIAL',
        items: [{ orderItemId: 'exchange-item', quantity: 1, action: 'EXCHANGE' }],
        exchangeItems: [{
          serviceId: 'service-1',
          description: 'Grooming',
          quantity: 1,
          unitPrice: 50_000,
          type: 'service',
        }],
      } as any, 'staff-1')).rejects.toThrow(BadRequestException)
    })

    it('rejects non-temp replacement exchange items without product id', async () => {
      db.order.findFirst.mockResolvedValue(createCompletedOrder())

      await expect(service.createReturnRequest('DH1', {
        type: 'PARTIAL',
        items: [{ orderItemId: 'exchange-item', quantity: 1, action: 'EXCHANGE' }],
        exchangeItems: [{
          description: 'Missing product',
          quantity: 1,
          unitPrice: 50_000,
          type: 'product',
        }],
      } as any, 'staff-1')).rejects.toThrow(BadRequestException)
    })

    it('keeps refund amount limited to returned items for mixed return and exchange', async () => {
      db.order.findFirst.mockResolvedValue(createCompletedOrder())
      db.order.count.mockResolvedValue(0)
      const tx = wireReturnTransaction()

      const result = await service.createReturnRequest('order-1', {
        type: 'PARTIAL',
        items: [
          { orderItemId: 'return-item', quantity: 1, action: 'RETURN' },
          { orderItemId: 'exchange-item', quantity: 1, action: 'EXCHANGE' },
        ],
      }, 'staff-1')

      expect(result.totalCredit).toBe(120_000)
      expect(result.refundAmount).toBe(110_000)
      expect(tx.orderReturnRequest.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          refundAmount: 110_000,
        }),
      }))
      expect(tx.order.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          paidAmount: 10_000,
          creditAmount: 10_000,
        }),
      }))
      expect(tx.stockTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          type: 'IN',
          productId: 'product-return',
          productVariantId: 'variant-return',
        }),
      }))
    })

    it('allows another return for partially refunded orders when quantity remains', async () => {
      db.order.findFirst.mockResolvedValue(createCompletedOrder({ status: 'PARTIALLY_REFUNDED' }))
      db.orderReturnRequest.findMany.mockResolvedValue([
        { items: [{ orderItemId: 'return-item', quantity: 1, action: 'RETURN' }] },
      ])
      const tx = wireReturnTransaction()

      await expect(service.createReturnRequest('order-1', {
        type: 'PARTIAL',
        items: [{ orderItemId: 'return-item', quantity: 1, action: 'EXCHANGE' }],
      }, 'staff-1')).resolves.toEqual(expect.objectContaining({
        exchangeOrderId: 'exchange-order-1',
      }))

      expect(tx.order.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'PARTIALLY_REFUNDED' }),
      }))
    })

    it('rejects return quantity above remaining quantity after previous returns', async () => {
      db.order.findFirst.mockResolvedValue(createCompletedOrder({ status: 'PARTIALLY_REFUNDED' }))
      db.orderReturnRequest.findMany.mockResolvedValue([
        { items: [{ orderItemId: 'return-item', quantity: 2, action: 'RETURN' }] },
      ])

      await expect(service.createReturnRequest('order-1', {
        type: 'PARTIAL',
        items: [{ orderItemId: 'return-item', quantity: 1, action: 'RETURN' }],
      }, 'staff-1')).rejects.toThrow(BadRequestException)
    })

    it('keeps original order partially refunded while any product quantity remains', async () => {
      db.order.findFirst.mockResolvedValue(createCompletedOrder())
      const tx = wireReturnTransaction()

      await service.createReturnRequest('order-1', {
        type: 'FULL',
        items: [{ orderItemId: 'return-item', quantity: 2, action: 'RETURN' }],
      }, 'staff-1')

      expect(tx.order.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'PARTIALLY_REFUNDED' }),
      }))
    })

    it('marks the original order fully refunded only when all product quantity is consumed', async () => {
      db.order.findFirst.mockResolvedValue(createCompletedOrder())
      const tx = wireReturnTransaction()

      await service.createReturnRequest('order-1', {
        type: 'FULL',
        items: [
          { orderItemId: 'return-item', quantity: 2, action: 'RETURN' },
          { orderItemId: 'exchange-item', quantity: 1, action: 'EXCHANGE' },
        ],
      }, 'staff-1')

      expect(tx.order.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'FULLY_REFUNDED' }),
      }))
    })

    it('rejects returns after the configured return window', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-04-25T10:00:00Z'))
      db.order.findFirst.mockResolvedValue(createCompletedOrder({
        completedAt: new Date('2026-04-10T10:00:00Z'),
      }))

      await expect(service.createReturnRequest('order-1', {
        type: 'PARTIAL',
        items: [{ orderItemId: 'return-item', quantity: 1, action: 'RETURN' }],
      }, 'staff-1')).rejects.toThrow(BadRequestException)

      jest.useRealTimers()
    })

    it('allows returns beyond the window when return window setting is zero', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-04-25T10:00:00Z'))
      db.systemConfig.findFirst.mockResolvedValue({ orderReturnWindowDays: 0 })
      db.order.findFirst.mockResolvedValue(createCompletedOrder({
        completedAt: new Date('2026-04-10T10:00:00Z'),
      }))
      const tx = wireReturnTransaction()

      await expect(service.createReturnRequest('order-1', {
        type: 'PARTIAL',
        items: [{ orderItemId: 'return-item', quantity: 1, action: 'RETURN' }],
      }, 'staff-1')).resolves.toEqual(expect.objectContaining({ refundAmount: 110_000 }))
      expect(tx.orderReturnRequest.create).toHaveBeenCalled()

      jest.useRealTimers()
    })

    it('rejects return requests for orders that are not completed', async () => {
      db.order.findFirst.mockResolvedValue(createCompletedOrder({ status: 'PROCESSING' }))

      await expect(
        service.createReturnRequest('order-1', {
          type: 'PARTIAL',
          items: [{ orderItemId: 'return-item', quantity: 1, action: 'RETURN' }],
        }, 'staff-1'),
      ).rejects.toThrow(BadRequestException)
    })

    it('rejects return items that do not belong to the order', async () => {
      db.order.findFirst.mockResolvedValue(createCompletedOrder())

      await expect(
        service.createReturnRequest('order-1', {
          type: 'PARTIAL',
          items: [{ orderItemId: 'missing-item', quantity: 1, action: 'RETURN' }],
        }, 'staff-1'),
      ).rejects.toThrow(BadRequestException)
    })

    it('rejects returned quantity greater than purchased quantity', async () => {
      db.order.findFirst.mockResolvedValue(createCompletedOrder())

      await expect(
        service.createReturnRequest('order-1', {
          type: 'PARTIAL',
          items: [{ orderItemId: 'return-item', quantity: 3, action: 'RETURN' }],
        }, 'staff-1'),
      ).rejects.toThrow(BadRequestException)
    })

    it('rejects permanent order deletion for non-superadmin users', async () => {
      await expect(service.deleteOrderCascade('order-1', 'staff-1', {
        userId: 'staff-1',
        role: 'ADMIN',
        permissions: ['FULL_BRANCH_ACCESS'],
        branchId: 'branch-1',
        authorizedBranchIds: ['branch-1'],
      })).rejects.toThrow(ForbiddenException)
    })

    it('permanently deletes an order and reverses stock, finance, payment, bank, customer, and sales records', async () => {
      db.order.findFirst.mockResolvedValue(createDeleteOrder())
      const tx = wireDeleteTransaction()

      const result = await service.deleteOrderCascade('DH1', 'super-1', {
        userId: 'super-1',
        role: 'SUPER_ADMIN',
        permissions: [],
        branchId: 'branch-1',
        authorizedBranchIds: ['branch-1'],
      })

      expect(result).toEqual(expect.objectContaining({
        success: true,
        deletedIds: ['order-1'],
      }))
      expect(tx.branchStock.update).toHaveBeenCalledWith({
        where: { id: 'stock-1' },
        data: { stock: { increment: 2 } },
      })
      expect(tx.stockTransaction.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['stock-tx-1'] } },
      })
      expect(tx.transaction.deleteMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { orderId: { in: ['order-1'] } },
            { refType: 'ORDER', refId: { in: ['order-1'] } },
          ]),
        }),
      }))
      expect(tx.paymentWebhookEvent.deleteMany).toHaveBeenCalled()
      expect(tx.bankTransaction.deleteMany).toHaveBeenCalled()
      expect(tx.paymentIntent.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['pi-1'] } },
      })
      expect(tx.customer.update).toHaveBeenCalledWith({
        where: { id: 'customer-1' },
        data: expect.objectContaining({
          totalSpent: { decrement: 100_000 },
          totalOrders: { decrement: 1 },
          points: { decrement: 80 },
          pointsUsed: { decrement: 20 },
          debt: { increment: 30_000 },
        }),
      })
      expect(tx.productSalesDaily.upsert).toHaveBeenCalledWith(expect.objectContaining({
        update: expect.objectContaining({
          quantitySold: { increment: -2 },
          revenue: { increment: -100_000 },
        }),
      }))
      expect(tx.order.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['order-1'] } },
      })
    })

    it('blocks order deletion when reversing an IN stock transaction would make stock negative', async () => {
      db.order.findFirst.mockResolvedValue(createDeleteOrder())
      const tx = wireDeleteTransaction({
        stockTransaction: {
          findMany: jest.fn(async () => [
            {
              id: 'stock-tx-in-1',
              type: 'IN',
              productId: 'product-1',
              productVariantId: 'variant-1',
              sourceProductVariantId: 'variant-1',
              branchId: 'branch-1',
              quantity: 5,
              sourceQuantity: 5,
            },
          ]),
          deleteMany: jest.fn(async () => ({ count: 0 })),
        },
        branchStock: {
          findFirst: jest.fn(async () => ({ id: 'stock-1', stock: 2 })),
          update: jest.fn(async () => ({})),
          create: jest.fn(async () => ({})),
        },
      })

      await expect(service.deleteOrderCascade('order-1', 'super-1', {
        userId: 'super-1',
        role: 'SUPER_ADMIN',
        permissions: [],
        branchId: 'branch-1',
        authorizedBranchIds: ['branch-1'],
      })).rejects.toThrow(BadRequestException)
      expect(tx.order.deleteMany).not.toHaveBeenCalled()
    })

    it('bulk deletes orders and returns blocked entries without failing the full batch', async () => {
      jest.spyOn((service as any).command, 'deleteOrderCascade')
        .mockResolvedValueOnce({ success: true, deletedIds: ['order-1'] } as any)
        .mockRejectedValueOnce(new BadRequestException('Ton kho khong du de dao giao dich'))

      const result = await service.bulkDeleteOrders(['order-1', 'order-2'], 'super-1', {
        userId: 'super-1',
        role: 'SUPER_ADMIN',
        permissions: [],
        branchId: 'branch-1',
        authorizedBranchIds: ['branch-1'],
      })

      expect(result).toEqual({
        success: true,
        deletedIds: ['order-1'],
        blocked: [{ id: 'order-2', reason: 'Ton kho khong du de dao giao dich' }],
      })
    })
  })
})
