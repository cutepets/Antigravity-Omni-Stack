import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service.js';
import { OrdersController } from './orders.controller.js';
import { DatabaseModule } from '../../database/database.module.js';
import { PaymentIntentEventsService } from './payment-intent-events.service.js';
import { PaymentWebhookService } from './payment-webhook.service.js';
import { PaymentWebhookController } from './payment-webhook.controller.js';
import { PaymentIntentStreamController } from './payment-intent-stream.controller.js';
import { OrderAccessService } from './domain/order-access.service.js';
import { OrderItemService } from './domain/order-item.service.js';
import { OrderNumberingService } from './domain/order-numbering.service.js';
import { OrderPaymentHelperService } from './domain/order-payment-helper.service.js';
import { OrderCatalogService } from './application/order-catalog.service.js';
import { OrderCommandService } from './application/order-command.service.js';
import { OrderDeletionService } from './application/order-deletion.service.js';
import { OrderInventoryService } from './application/order-inventory.service.js';
import { OrderLifecycleService } from './application/order-lifecycle.service.js';
import { OrderPaymentIntentService } from './application/order-payment-intent.service.js';
import { OrderPaymentService } from './application/order-payment.service.js';
import { OrderQueryService } from './application/order-query.service.js';
import { OrderReturnService } from './application/order-return.service.js';
import { OrderServiceSyncService } from './application/order-service-sync.service.js';
import { OrderSwapService } from './application/order-swap.service.js';
import { OrderTimelineService } from './application/order-timeline.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [OrdersController, PaymentWebhookController, PaymentIntentStreamController],
  providers: [
    OrdersService,
    PaymentIntentEventsService,
    PaymentWebhookService,
    OrderAccessService,
    OrderNumberingService,
    OrderItemService,
    OrderPaymentHelperService,
    OrderCommandService,
    OrderCatalogService,
    OrderQueryService,
    OrderPaymentService,
    OrderPaymentIntentService,
    OrderLifecycleService,
    OrderReturnService,
    OrderDeletionService,
    OrderSwapService,
    OrderInventoryService,
    OrderServiceSyncService,
    OrderTimelineService,
  ],
  exports: [OrdersService, PaymentIntentEventsService, PaymentWebhookService],
})
export class OrdersModule {}
