import { Injectable } from '@nestjs/common'
import { EventEmitter } from 'events'

type PaymentIntentPaidPayload = {
  code: string
  intentId: string
  orderId?: string | null
  amount: number
  paidAt?: string | Date | null
  provider?: string | null
  externalTxnId?: string | null
}

@Injectable()
export class PaymentIntentEventsService {
  private readonly emitter = new EventEmitter()

  subscribe(code: string, listener: (payload: PaymentIntentPaidPayload) => void): () => void {
    const channel = this.getChannel(code)
    this.emitter.on(channel, listener)

    return () => {
      this.emitter.off(channel, listener)
    }
  }

  emitPaid(payload: PaymentIntentPaidPayload) {
    this.emitter.emit(this.getChannel(payload.code), payload)
  }

  private getChannel(code: string) {
    return `payment-intent:${code}`
  }
}
