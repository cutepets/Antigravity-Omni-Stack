export type QueueJobName =
  | 'session.cleanup'
  | 'upload.cleanup'
  | 'report.export'
  | 'stock.low_alert'
  | 'payment.postprocess'

export type QueueJobPayloadMap = {
  'session.cleanup': { sessionId?: string; userId?: string; olderThan?: string }
  'upload.cleanup': { url: string; reason?: string }
  'report.export': { reportType: string; requestedBy: string; params?: Record<string, unknown> }
  'stock.low_alert': { branchId: string; productId: string; productVariantId?: string | null; stock: number; minStock: number }
  'payment.postprocess': { paymentId: string; orderId?: string | null; transactionId?: string | null }
}

export type QueueJob<TName extends QueueJobName = QueueJobName> = {
  id: string
  name: TName
  payload: QueueJobPayloadMap[TName]
  attempts: number
  createdAt: Date
}

export type QueueJobHandler<TName extends QueueJobName = QueueJobName> = (
  job: QueueJob<TName>,
) => Promise<void> | void

export interface QueueRuntime {
  enqueue<TName extends QueueJobName>(
    name: TName,
    payload: QueueJobPayloadMap[TName],
    options?: { jobId?: string; attempts?: number },
  ): Promise<QueueJob<TName>>
  process<TName extends QueueJobName>(name: TName, handler: QueueJobHandler<TName>): void
  drain(): Promise<void>
}

export function createInMemoryQueueRuntime(): QueueRuntime {
  const handlers = new Map<QueueJobName, QueueJobHandler<any>>()
  const pending: QueueJob[] = []

  return {
    async enqueue(name, payload, options = {}) {
      const job: QueueJob<typeof name> = {
        id: options.jobId ?? `${name}:${Date.now()}:${pending.length}`,
        name,
        payload,
        attempts: options.attempts ?? 1,
        createdAt: new Date(),
      }
      pending.push(job)
      return job
    },
    process(name, handler) {
      handlers.set(name, handler)
    },
    async drain() {
      while (pending.length > 0) {
        const job = pending.shift()!
        const handler = handlers.get(job.name)
        if (!handler) continue
        await handler(job)
      }
    },
  }
}

export const queueJobCatalog = {
  sessionCleanup: 'session.cleanup',
  uploadCleanup: 'upload.cleanup',
  reportExport: 'report.export',
  lowStockAlert: 'stock.low_alert',
  paymentPostprocess: 'payment.postprocess',
} as const
