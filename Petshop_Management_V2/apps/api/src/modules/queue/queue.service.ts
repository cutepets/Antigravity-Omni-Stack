import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import {
  createInMemoryQueueRuntime,
  queueJobCatalog,
  type QueueJobPayloadMap,
  type QueueRuntime,
} from '@petshop/queue'

@Injectable()
export class QueueService implements OnModuleInit {
  private readonly logger = new Logger(QueueService.name)
  private readonly runtime: QueueRuntime = createInMemoryQueueRuntime()

  onModuleInit() {
    this.runtime.process(queueJobCatalog.uploadCleanup, (job) => {
      this.logger.debug(`Tracked upload cleanup job ${job.id}`)
    })

    this.runtime.process(queueJobCatalog.reportExport, (job) => {
      this.logger.debug(`Tracked report export job ${job.id}`)
    })

    this.runtime.process(queueJobCatalog.lowStockAlert, (job) => {
      this.logger.debug(`Tracked low-stock alert job ${job.id}`)
    })

    this.runtime.process(queueJobCatalog.paymentPostprocess, (job) => {
      this.logger.debug(`Tracked payment postprocess job ${job.id}`)
    })
  }

  async enqueueUploadCleanup(payload: QueueJobPayloadMap['upload.cleanup']) {
    const job = await this.runtime.enqueue(queueJobCatalog.uploadCleanup, payload)
    await this.runtime.drain()
    return job
  }

  async enqueueReportExport(payload: QueueJobPayloadMap['report.export']) {
    const job = await this.runtime.enqueue(queueJobCatalog.reportExport, payload)
    await this.runtime.drain()
    return job
  }

  async enqueueLowStockAlert(payload: QueueJobPayloadMap['stock.low_alert']) {
    const job = await this.runtime.enqueue(queueJobCatalog.lowStockAlert, payload)
    await this.runtime.drain()
    return job
  }

  async enqueuePaymentPostprocess(payload: QueueJobPayloadMap['payment.postprocess']) {
    const job = await this.runtime.enqueue(queueJobCatalog.paymentPostprocess, payload)
    await this.runtime.drain()
    return job
  }
}
