'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';

export function PosLayoutClient({ children }: { children: React.ReactNode }) {
    const { activeBranchId, allowedBranches } = useAuthStore();

    useEffect(() => {
        // Set browser tab title using active branch name as shop name
        const branch = allowedBranches.find((b: any) => b.id === activeBranchId) ?? allowedBranches[0];
        const shopName = branch?.name ?? 'Petshop';
        const prev = document.title;
        document.title = `POS | ${shopName}`;

        // Add fullscreen class to body to hide sidebar/header from parent layout
        document.body.classList.add('pos-fullscreen');

        // Force light mode for POS
        const htmlEl = document.documentElement;
        const wasDark = htmlEl.classList.contains('dark');
        if (wasDark) {
            htmlEl.classList.remove('dark');
            htmlEl.classList.add('light');
        }

        return () => {
            document.title = prev;
            document.body.classList.remove('pos-fullscreen');
            if (wasDark) {
                htmlEl.classList.remove('light');
                htmlEl.classList.add('dark');
            }
        };
    }, [activeBranchId, allowedBranches]);

    return <>{children}</>;
}
