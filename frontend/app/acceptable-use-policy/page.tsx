import { Metadata } from 'next';
import { notFound } from 'next/navigation';

import LegalPageLayout from '@/components/LegalPageLayout';
import { fetchCmsPage, formatPageUpdatedAt } from '@/lib/pages';

const SLUG = 'acceptable-use-policy';

export async function generateMetadata(): Promise<Metadata> {
    const page = await fetchCmsPage(SLUG);

    return {
        title: page?.meta_title || page?.title || 'Acceptable Use Policy',
        description: page?.meta_description || "Learn about the acceptable use standards for PetPosture services and products.",
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
