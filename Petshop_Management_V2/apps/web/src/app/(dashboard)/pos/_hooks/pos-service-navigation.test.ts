import assert from 'node:assert/strict';
import test from 'node:test';
import type { CartItem } from '@petshop/shared';
import { resolvePosServiceNavigationTarget } from './pos-service-navigation';

const cartItem = (item: Partial<CartItem>): CartItem =>
  ({
    id: item.id ?? 'line-1',
    description: item.description ?? 'Line',
    quantity: item.quantity ?? 1,
    unitPrice: item.unitPrice ?? 0,
    discountItem: item.discountItem ?? 0,
    vatRate: item.vatRate ?? 0,
    type: item.type ?? 'product',
    unit: item.unit ?? 'cai',
    ...item,
  }) as CartItem;

test('opens grooming when the cart has grooming service items', () => {
  assert.deepEqual(
    resolvePosServiceNavigationTarget([
      cartItem({ type: 'grooming' }),
    ]),
    { href: '/grooming', target: 'petshop-grooming' },
  );
});

test('opens hotel when the cart only has hotel service items', () => {
  assert.deepEqual(
    resolvePosServiceNavigationTarget([
      cartItem({ type: 'hotel' }),
    ]),
    { href: '/hotel', target: 'petshop-hotel' },
  );
});

test('prefers grooming when the cart has grooming and hotel services', () => {
  assert.deepEqual(
    resolvePosServiceNavigationTarget([
      cartItem({ type: 'hotel' }),
      cartItem({ type: 'service', groomingDetails: { petId: 'pet-1' } }),
    ]),
    { href: '/grooming', target: 'petshop-grooming' },
  );
});

test('does not return a target for a cart without grooming or hotel services', () => {
  assert.equal(
    resolvePosServiceNavigationTarget([
      cartItem({ type: 'product' }),
      cartItem({ type: 'service' }),
    ]),
    null,
  );
});
