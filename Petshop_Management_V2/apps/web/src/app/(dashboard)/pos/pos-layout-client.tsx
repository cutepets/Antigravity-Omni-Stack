'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { usePosStore } from '@/stores/pos.store';

export function PosLayoutClient({ children }: { children: React.ReactNode }) {
    const { activeBranchId, allowedBranches } = useAuthStore();
    const posTheme = usePosStore((s) => s.posTheme);

    useEffect(() => {
        const branch = allowedBranches.find((b: any) => b.id === activeBranchId) ?? allowedBranches[0];
        const shopName = branch?.name ?? 'Petshop';
        const prev = document.title;
        document.title = `POS | ${shopName}`;
        document.body.classList.add('pos-fullscreen');

        return () => {
            document.title = prev;
            document.body.classList.remove('pos-fullscreen');
        };
    }, [activeBranchId, allowedBranches]);

    // Apply POS theme as data-pos-theme on body.
    // CSS variables are overridden in globals.css for body[data-pos-theme="dark/light"].
    // This cascades correctly to all children WITHOUT touching next-themes or html class.
    useEffect(() => {
        const body = document.body;

        if (posTheme === 'light') {
            body.setAttribute('data-pos-theme', 'light');
        } else if (posTheme === 'dark') {
            body.setAttribute('data-pos-theme', 'dark');
        } else {
            body.removeAttribute('data-pos-theme');
        }

        return () => {
            // Remove when leaving POS so system theme restores naturally
            body.removeAttribute('data-pos-theme');
        };
    }, [posTheme]);

    return <>{children}</>;
}
