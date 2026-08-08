import { API_BASE_URL } from '@/lib/api';

export type CmsPage = {
    slug: string;
    title: string;
    content: string;
    meta_title: string | null;
    meta_description: string | null;
    updated_at: string | null;
};

export function formatPageUpdatedAt(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    });
}

export async function fetchCmsPage(slug: string): Promise<CmsPage | null> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/pages/${slug}`, {
            next: { revalidate: 60 },
        });

        if (!response.ok) {
            return null;
        }

        const payload = await response.json();
        return payload?.data ?? null;
    } catch (error) {
        console.error(`Failed to fetch CMS page "${slug}":`, error);
        return null;
    }
}
