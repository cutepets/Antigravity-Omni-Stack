'use client';

import { useEffect } from 'react';

// POS uses fullscreen layout — hide parent sidebar/header via CSS
export default function PosLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Add fullscreen class to body to hide sidebar/header from parent layout
    document.body.classList.add('pos-fullscreen');
    
    // Force light mode for POS
    const htmlEl = document.documentElement;
    const wasDark = htmlEl.classList.contains('dark');
    if (wasDark) {
      htmlEl.classList.remove('dark');
      htmlEl.classList.add('light'); // Optionally add light explicitly
    }

    return () => {
      document.body.classList.remove('pos-fullscreen');
      // Restore dark mode if it was active
      if (wasDark) {
        htmlEl.classList.remove('light');
        htmlEl.classList.add('dark');
      }
    };
  }, []);

  return <>{children}</>;
}
