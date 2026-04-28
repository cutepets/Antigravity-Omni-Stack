import { OrderNumberingService } from './order-numbering.service.js';

describe('OrderNumberingService', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('generates the next order number from the highest existing daily sequence', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-28T10:00:00.000Z'));

    const prisma = {
      order: {
        findFirst: jest.fn().mockResolvedValue({ orderNumber: 'DH260428009' }),
      },
    };
    const service = new OrderNumberingService();

    await expect(service.generateOrderNumber(prisma as any)).resolves.toBe('DH260428010');
    expect(prisma.order.findFirst).toHaveBeenCalledWith({
      where: { orderNumber: { startsWith: 'DH260428' } },
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true },
    });
  });
});
