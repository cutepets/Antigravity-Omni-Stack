import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service.js';
import { OrdersController } from './orders.controller.js';
import { DatabaseModule } from '../../database/database.module.js';
import { PaymentIntentEventsService } from './payment-intent-events.service.js';
import { PaymentWebhookService } from './payment-webhook.service.js';
import { PaymentWebhookController } from './payment-webhook.controller.js';
import { PaymentIntentStreamController } from './payment-intent-stream.controller.js';

@Module({
  imports: [DatabaseModule],
  controllers: [OrdersController, PaymentWebhookController, PaymentIntentStreamController],
  providers: [OrdersService, PaymentIntentEventsService, PaymentWebhookService],
  exports: [OrdersService, PaymentIntentEventsService, PaymentWebhookService],
})
export class OrdersModule {}
