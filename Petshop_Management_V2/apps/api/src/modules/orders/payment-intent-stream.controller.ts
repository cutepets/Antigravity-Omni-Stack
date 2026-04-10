import {
  Controller,
  Get,
  Header,
  Param,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import type { JwtPayload } from '@petshop/shared'
import { Permissions } from '../../common/decorators/permissions.decorator.js'
import { PermissionsGuard } from '../../common/guards/permissions.guard.js'
import { JwtGuard } from '../auth/guards/jwt.guard.js'
import { OrdersService } from './orders.service.js'
import { PaymentIntentEventsService } from './payment-intent-events.service.js'

interface AuthenticatedRequest extends Request {
  user?: JwtPayload
}

@Controller('payment-intents')
@UseGuards(JwtGuard, PermissionsGuard)
export class PaymentIntentStreamController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly paymentIntentEvents: PaymentIntentEventsService,
  ) {}

  @Get(':code/stream')
  @Permissions('order.read.all', 'order.read.assigned', 'order.pay')
  @Header('Cache-Control', 'no-cache, no-transform')
  @Header('Connection', 'keep-alive')
  async streamPaymentIntent(
    @Param('code') code: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    if (!req.user) {
      throw new UnauthorizedException('Missing authenticated user')
    }

    const intent = await this.ordersService.getPaymentIntentByCode(code, req.user)

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders?.()

    const writeEvent = (event: string, data: unknown) => {
      res.write(`event: ${event}\n`)
      res.write(`data: ${JSON.stringify(data)}\n\n`)
    }

    writeEvent('snapshot', { intent })

    const unsubscribe = this.paymentIntentEvents.subscribe(code, async () => {
      const refreshedIntent = await this.ordersService.getPaymentIntentByCode(code, req.user)
      writeEvent('paid', { intent: refreshedIntent })
    })

    const heartbeat = setInterval(() => {
      res.write(': ping\n\n')
    }, 15_000)

    req.on('close', () => {
      clearInterval(heartbeat)
      unsubscribe()
      res.end()
    })
  }
}
