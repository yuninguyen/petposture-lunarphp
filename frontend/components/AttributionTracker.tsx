"use client";

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { trackPageView } from '@/lib/attribution';

export function AttributionTracker() {
    const pathname = usePathname();

    useEffect(() => {
        trackPageView();
    }, [pathname]);

    return null;
}
