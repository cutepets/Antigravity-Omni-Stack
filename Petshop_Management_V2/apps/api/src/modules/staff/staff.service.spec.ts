import { StaffService } from './staff.service'

describe('StaffService documents', () => {
  it('stores staff document as a private storage key instead of a public uploads URL', async () => {
    const db = {
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'user-1' }),
      },
      employeeDocument: {
        create: jest.fn().mockResolvedValue({ id: 'doc-1' }),
      },
    }
    const service = new StaffService(db as any)

    await service.uploadDocument(
      'user-1',
      'admin-1',
      {
        originalname: 'contract.pdf',
        mimetype: 'application/pdf',
        size: 128,
        filename: 'stored.pdf',
      } as Express.Multer.File,
      { type: 'CONTRACT' as any },
    )

    expect(db.employeeDocument.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fileUrl: 'documents/user-1/stored.pdf',
      }),
    })
  })
})
