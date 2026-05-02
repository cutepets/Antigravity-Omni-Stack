import type { CartItem } from '@petshop/shared';

export type PosServiceNavigationTarget = {
  href: '/grooming' | '/hotel';
  target: 'petshop-grooming' | 'petshop-hotel';
};

export function resolvePosServiceNavigationTarget(cart: CartItem[]): PosServiceNavigationTarget | null {
  const hasGrooming = cart.some((item) => item.type === 'grooming' || Boolean(item.groomingDetails));
  if (hasGrooming) {
    return { href: '/grooming', target: 'petshop-grooming' };
  }

  const hasHotel = cart.some((item) => item.type === 'hotel' || Boolean(item.hotelDetails));
  if (hasHotel) {
    return { href: '/hotel', target: 'petshop-hotel' };
  }

  return null;
}
