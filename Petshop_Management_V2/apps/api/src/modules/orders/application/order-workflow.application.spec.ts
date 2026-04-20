import { buildCreateOrderDraft } from './order-workflow.application'

describe('order-workflow.application', () => {
  describe('buildCreateOrderDraft', () => {
    it('marks fully paid product-only orders as QUICK and COMPLETED', () => {
      const draft = buildCreateOrderDraft({
        items: [
          { unitPrice: 120_000, quantity: 2, type: 'product' },
          { unitPrice: 50_000, quantity: 1, discountItem: 10_000, type: 'product' },
        ],
        payments: [{ amount: 280_000 }],
        discount: 0,
        shippingFee: 0,
      })

      expect(draft).toMatchObject({
        orderType: 'QUICK',
        orderStatus: 'COMPLETED',
        paymentStatus: 'PAID',
        subtotal: 280_000,
        total: 280_000,
        totalPaid: 280_000,
        remainingAmount: 0,
      })
    })

    it('marks service orders as SERVICE and PROCESSING even when partially paid', () => {
      const draft = buildCreateOrderDraft({
        items: [
          {
            unitPrice: 300_000,
            quantity: 1,
            type: 'grooming',
            groomingDetails: { petId: 'pet-1' },
          },
        ],
        payments: [{ amount: 100_000 }],
        discount: 20_000,
        shippingFee: 0,
      })

      expect(draft).toMatchObject({
        orderType: 'SERVICE',
        orderStatus: 'PROCESSING',
        paymentStatus: 'PARTIAL',
        subtotal: 300_000,
        total: 280_000,
        totalPaid: 100_000,
        remainingAmount: 180_000,
      })
    })
  })
})
