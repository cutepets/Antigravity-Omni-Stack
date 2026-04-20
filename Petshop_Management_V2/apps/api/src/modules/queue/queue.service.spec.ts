import { QueueService } from './queue.service'

describe('QueueService', () => {
  it('tracks upload cleanup jobs without external infrastructure', async () => {
    const service = new QueueService()
    service.onModuleInit()

    const job = await service.enqueueUploadCleanup({
      url: '/uploads/files/demo.pdf',
      reason: 'test',
    })

    expect(job.name).toBe('upload.cleanup')
    expect(job.payload.url).toBe('/uploads/files/demo.pdf')
  })

  it('tracks report export jobs without external infrastructure', async () => {
    const service = new QueueService()
    service.onModuleInit()

    const job = await service.enqueueReportExport({
      reportType: 'product_export',
      requestedBy: 'test',
      params: { rows: 1 },
    })

    expect(job.name).toBe('report.export')
    expect(job.payload.reportType).toBe('product_export')
  })
})
