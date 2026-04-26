import { ForbiddenException } from '@nestjs/common';
import { OrderDeletionService } from './order-deletion.service.js';

describe('OrderDeletionService', () => {
  it('rejects permanent deletion outside SUPER_ADMIN scope', async () => {
    const service = new OrderDeletionService({} as any, {} as any);
    await expect(service.deleteOrderCascade('order-1', 'staff-1', { role: 'MANAGER' } as any)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('uses the shared bulk delete runner through deleteOrderCascade', async () => {
    const service = new OrderDeletionService({} as any, {} as any);
    jest.spyOn(service, 'deleteOrderCascade').mockResolvedValue({
      success: true,
      deletedIds: ['order-1'],
      deletedOrderNumbers: ['DH1'],
    });

    const result = await service.bulkDeleteOrders(['order-1'], 'staff-1', { role: 'SUPER_ADMIN' } as any);

    expect(service.deleteOrderCascade).toHaveBeenCalledWith('order-1', 'staff-1', { role: 'SUPER_ADMIN' });
    expect(result.deletedIds).toEqual(['order-1']);
  });
});
