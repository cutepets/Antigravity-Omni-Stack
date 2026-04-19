'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { usePosStore } from '@/stores/pos.store';

export function PosLayoutClient({ children }: { children: React.ReactNode }) {
    const { activeBranchId, allowedBranches } = useAuthStore();
    const posTheme = usePosStore((s) => s.posTheme);

    useEffect(() => {
        // Set browser tab title using active branch name as shop name
        const branch = allowedBranches.find((b: any) => b.id === activeBranchId) ?? allowedBranches[0];
        const shopName = branch?.name ?? 'Petshop';
        const prev = document.title;
        document.title = `POS | ${shopName}`;

        // Add fullscreen class to body to hide sidebar/header from parent layout
        document.body.classList.add('pos-fullscreen');

        return () => {
            document.title = prev;
            document.body.classList.remove('pos-fullscreen');
        };
    }, [activeBranchId, allowedBranches]);

    // Apply POS theme independently from system theme
    useEffect(() => {
        const htmlEl = document.documentElement;
        const prevDark = htmlEl.classList.contains('dark');
        const prevLight = htmlEl.classList.contains('light');

        if (posTheme === 'light') {
            htmlEl.classList.remove('dark');
            htmlEl.classList.add('light');
        } else if (posTheme === 'dark') {
            htmlEl.classList.remove('light');
            htmlEl.classList.add('dark');
        }
        // 'system' → don't touch classes, follow the app's theme provider

        return () => {
            // Restore previous state when leaving POS
            htmlEl.classList.toggle('dark', prevDark);
            htmlEl.classList.toggle('light', prevLight);
        };
    }, [posTheme]);

    return <>{children}</>;
}
