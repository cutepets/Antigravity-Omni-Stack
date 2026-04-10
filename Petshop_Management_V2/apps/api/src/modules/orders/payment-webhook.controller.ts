import { Body, Controller, Headers, Param, Post } from '@nestjs/common'
import { PaymentWebhookService } from './payment-webhook.service.js'

@Controller('payment-webhooks/bank-transfer')
export class PaymentWebhookController {
  constructor(private readonly paymentWebhookService: PaymentWebhookService) {}

  @Post(':provider')
  receiveBankTransferWebhook(
    @Param('provider') provider: string,
    @Body() payload: Record<string, unknown>,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    return this.paymentWebhookService.processBankTransferWebhook(provider, payload, headers)
  }
}
