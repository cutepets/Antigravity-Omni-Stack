import { ReportsController } from './reports.controller'

describe('ReportsController attachments', () => {
  it('returns a private finance attachment key instead of a public uploads URL', () => {
    const controller = new ReportsController({} as any)

    const result = controller.uploadTransactionAttachment(
      { user: { userId: 'user-1' } } as any,
      {
        originalname: 'receipt.pdf',
        mimetype: 'application/pdf',
        size: 128,
        filename: 'stored.pdf',
      } as Express.Multer.File,
    )

    expect(result).toEqual({
      success: true,
      data: {
        attachmentUrl: 'finance/stored.pdf',
      },
    })
  })
})
