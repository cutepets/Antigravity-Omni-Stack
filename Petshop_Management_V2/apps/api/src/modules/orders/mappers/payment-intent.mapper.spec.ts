import { mapOrderPaymentIntentView } from './payment-intent.mapper'

describe('payment-intent.mapper', () => {
  it('maps payment intent records to stable API shape', () => {
    const view = mapOrderPaymentIntentView({
      id: 'pi-1',
      code: 'PI123',
      orderId: 'order-1',
      paymentMethodId: 'pm-1',
      amount: '250000',
      currency: 'VND',
      status: 'PENDING',
      provider: 'VIETQR',
      transferContent: 'PETCN001',
      qrUrl: 'data:image/png;base64,test',
      qrPayload: 'payload',
      expiresAt: new Date('2026-04-20T10:00:00.000Z'),
      paidAt: null,
      createdAt: new Date('2026-04-20T09:00:00.000Z'),
      updatedAt: new Date('2026-04-20T09:00:00.000Z'),
      paymentMethod: {
        id: 'pm-1',
        name: 'Techcombank',
        type: 'BANK',
        colorKey: null,
        bankName: 'Techcombank',
        accountNumber: '123456',
        accountHolder: 'PETSHOP',
        qrTemplate: null,
      },
      order: {
        id: 'order-1',
        orderNumber: 'DH260420001',
        total: '300000',
        paidAmount: '50000',
        remainingAmount: '250000',
        customerName: 'Alice',
      },
    })

    expect(view).toMatchObject({
      id: 'pi-1',
      code: 'PI123',
      amount: 250000,
      paymentMethodId: 'pm-1',
      paymentMethod: {
        id: 'pm-1',
        name: 'Techcombank',
        type: 'BANK',
      },
      order: {
        id: 'order-1',
        orderNumber: 'DH260420001',
        total: 300000,
        paidAmount: 50000,
        remainingAmount: 250000,
        customerName: 'Alice',
      },
    })
  })
})
