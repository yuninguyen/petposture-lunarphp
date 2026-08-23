import { fetchJson, fetchApi } from '@/lib/api';

export interface BlogTag {
    id: number;
    name: string;
    slug: string;
    posts_count?: number;
    created_at: string;
    updated_at: string;
}

interface TagsResponse {
    data: BlogTag[];
    meta: {
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
}

export async function fetchTags(params: { search?: string; page?: number }): Promise<TagsResponse> {
    const searchParams = new URLSearchParams();
    if (params.search) searchParams.set('search', params.search);
    if (params.page) searchParams.set('page', params.page.toString());
    
    const qs = searchParams.toString();
    return fetchJson(`/admin/blog/tags${qs ? '?' + qs : ''}`);
}

export async function createTag(data: { name: string; slug?: string }): Promise<{ data: BlogTag }> {
    return fetchJson('/admin/blog/tags', {
        method: 'POST',
        body: data,
    });
}

export async function updateTag(id: number, data: { name: string; slug?: string }): Promise<{ data: BlogTag }> {
    return fetchJson(`/admin/blog/tags/${id}`, {
        method: 'PUT',
        body: data,
    });
}

export async function deleteTag(id: number): Promise<void> {
    const res = await fetchApi(`/admin/blog/tags/${id}`, { method: 'DELETE' });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw Object.assign(new Error(data?.message ?? 'Failed to delete tag'), { status: res.status, data });
    }
}

export async function bulkDeleteTags(ids: number[]): Promise<void> {
    const res = await fetchApi('/admin/blog/tags/bulk-delete', {
        method: 'POST',
        body: { ids },
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw Object.assign(new Error(data?.message ?? 'Failed to delete tags'), { status: res.status, data });
    }
}
