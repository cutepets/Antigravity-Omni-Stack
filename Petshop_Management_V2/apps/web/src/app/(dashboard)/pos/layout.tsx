import type { Metadata } from 'next';
import { PosLayoutClient } from './pos-layout-client';

export const metadata: Metadata = {
  title: 'POS',
};

// POS uses fullscreen layout — hide parent sidebar/header via CSS
export default function PosLayout({ children }: { children: React.ReactNode }) {
  return <PosLayoutClient>{children}</PosLayoutClient>;
}
