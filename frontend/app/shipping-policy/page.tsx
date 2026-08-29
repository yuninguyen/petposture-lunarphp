import { Metadata } from 'next';
import { notFound } from 'next/navigation';

import LegalPageLayout from '@/components/LegalPageLayout';
import { fetchCmsPage, formatPageUpdatedAt } from '@/lib/pages';

export const dynamic = 'force-dynamic';

const SLUG = 'shipping-policy';

export async function generateMetadata(): Promise<Metadata> {
    const page = await fetchCmsPage(SLUG);

    return {
        title: page?.meta_title || page?.title || 'Shipping Policy',
        description: page?.meta_description || "Understand PetPosture's shipping times, rates, and zones for carefully selected pet products.",
        alternates: { canonical: `/${SLUG}` },
    };
}

export default async function Page() {
    const page = await fetchCmsPage(SLUG);

    if (!page) {
        notFound();
    }

    return (
        <LegalPageLayout
            page={{
                title: page.title,
                content: page.content,
                updatedAt: page.updated_at ? formatPageUpdatedAt(page.updated_at) : null,
            }}
        />
    );
}
