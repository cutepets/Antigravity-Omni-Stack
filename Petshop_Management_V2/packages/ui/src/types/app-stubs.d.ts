declare module '@/hooks/useAuthorization' {
  export function useAuthorization(): { hasRole: (role: string) => boolean };
}

declare module '@/lib/api' {
  export const api: any;
}

declare module '@/lib/utils' {
  export function cn(...classes: (string | undefined | null | false)[]): string;
}

declare module '@/stores/auth.store' {
  export const useAuthStore: any;
}

declare module '@/stores/theme.store' {
  export const useThemeStore: any;
}

declare module '@/stores/animation.store' {
  export const useAnimationStore: any;
}

declare module '@/components/ui/toast-with-copy' {
  export const ToastWithCopy: any;
}

declare module '@/app/(dashboard)/customers/_components/customer-settings-drawer' {
  const CustomerSettingsDrawer: any;
  export default CustomerSettingsDrawer;
}

declare module '@/app/(dashboard)/products/_components/inventory-settings-drawer' {
  const InventorySettingsDrawer: any;
  export default InventorySettingsDrawer;
}

declare module '@/app/(dashboard)/finance/_components/cashbook-settings-drawer' {
  const CashbookSettingsDrawer: any;
  export default CashbookSettingsDrawer;
}

declare module '@/app/(dashboard)/pets/_components/pet-settings-modal' {
  const PetSettingsModal: any;
  export default PetSettingsModal;
}