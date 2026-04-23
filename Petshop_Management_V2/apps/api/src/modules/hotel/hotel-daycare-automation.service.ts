import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { DatabaseService } from '../../database/database.service.js'
import { OrdersService } from '../orders/orders.service.js'

@Injectable()
export class HotelDaycareAutomationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HotelDaycareAutomationService.name)
  private intervalRef: NodeJS.Timeout | null = null
  private readonly INTERVAL_MS = 5 * 60 * 1000

  constructor(
    private readonly db: DatabaseService,
    private readonly ordersService: OrdersService,
  ) {}

  onModuleInit() {
    void this.processDueDaycareStays()
    this.intervalRef = setInterval(() => {
      void this.processDueDaycareStays()
    }, this.INTERVAL_MS)
  }

  onModuleDestroy() {
    if (this.intervalRef) {
      clearInterval(this.intervalRef)
      this.intervalRef = null
    }
  }

  async processDueDaycareStays() {
    try {
      const dueStays = await this.db.hotelStay.findMany({
        where: {
          careMode: 'DAYCARE' as any,
          status: { in: ['BOOKED', 'CHECKED_IN'] as any },
          autoCompleteAt: { lte: new Date() },
        },
        select: {
          id: true,
          stayCode: true,
          orderId: true,
          createdById: true,
          autoCompleteAt: true,
        },
        take: 100,
        orderBy: { autoCompleteAt: 'asc' },
      })

      for (const stay of dueStays) {
        const checkoutAt = stay.autoCompleteAt ?? new Date()

        try {
          await this.db.hotelStay.update({
            where: { id: stay.id },
            data: {
              status: 'CHECKED_OUT' as any,
              checkOutActual: checkoutAt,
              checkOut: checkoutAt,
            },
          })
        } catch (error) {
          this.logger.error(`Failed to auto checkout daycare stay ${stay.stayCode ?? stay.id}`, error as any)
          continue
        }

        if (!stay.orderId) {
          continue
        }

        try {
          const order = await this.db.order.findUnique({
            where: { id: stay.orderId },
            select: {
              id: true,
              status: true,
              paymentStatus: true,
              total: true,
              paidAmount: true,
              staffId: true,
            },
          })

          if (!order) continue
          if (!['PROCESSING', 'CONFIRMED'].includes(order.status)) continue
          if (!['PAID', 'COMPLETED'].includes(order.paymentStatus)) continue
          if ((order.paidAmount ?? 0) + 0.0001 < (order.total ?? 0)) continue

          const actorId = order.staffId ?? stay.createdById
          if (!actorId) {
            this.logger.warn(`Skip auto completing order ${order.id} because no actor is available`)
            continue
          }

          await this.ordersService.completeOrder(order.id, { forceComplete: false, payments: [] }, actorId)
        } catch (error) {
          this.logger.error(`Failed to auto complete daycare order ${stay.orderId}`, error as any)
        }
      }
    } catch (error) {
      this.logger.error('Failed to process due daycare stays', error as any)
    }
  }
}
