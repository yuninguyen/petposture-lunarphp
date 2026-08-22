# Admin Post List/Form UI Redesign + Functional Gap Closing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Post List and Post Form pages (plus light `AppShell` polish) in the admin Vite/React app, and close the cheap functional gaps versus the old Filament admin (delete, search, filter, pagination, author field, updated_at column, view link).

**Architecture:** Backend adds `search` query param + switches `PostController::index()` from `->get()` to `->paginate(20)` (Laravel's standard `{data, links, meta}` envelope, no manual reshaping) and adds `updated_at` to `PostResource`. Frontend `postsApi.ts` gets a pure `buildPostsQuery()` helper + paginated types + a `useDeletePost()` mutation; `PostsListPage.tsx` gets search/filter/pagination/delete/view UI; `PostFormPage.tsx` gets an `author` field and is regrouped into two `Card` sections; `AppShell.tsx` gets spacing/hover polish only.

**Tech Stack:** Laravel 11 (PHP), Eloquent pagination, React 18 + Vite, React Query, React Hook Form + Zod, TanStack Table, react-i18next, Vitest.

## Global Constraints

- Spec source of truth: `docs/superpowers/specs/2026-08-21-admin-post-list-form-redesign-design.md` — do not implement anything listed there as "Explicitly OUT of scope" (type/breeds/solutions/tags, Comparison repeater, SEO+AI, Duplicate action). If any in-scope task turns out to require one of these, stop and report back instead of building it.
- All new/changed UI text must be added to **both** `admin/src/locales/en.json` and `admin/src/locales/vi.json` (per memory `feedback_admin_bilingual_ui`) — never add a key to only one file.
- `fetchJson()` in `admin/src/lib/api.ts` always calls `res.json()`, which throws on an empty-body 204 response. Any code calling `DELETE /admin/posts/{id}` MUST use `fetchApi()` directly, not `fetchJson()`.
- Match existing code style exactly (no added abstractions, no unrelated refactors, no comments/docstrings on unchanged code).
- Backend test command: `cd backend && php artisan test --filter=<TestClass>`. Frontend test command: `cd admin && npm run test -- <file>` (runs `vitest run`).

---

### Task 1: Backend — search, pagination, `updated_at`

**Files:**
- Modify: `backend/app/Http/Controllers/Api/PostController.php:22-39` (`index()` method)
- Modify: `backend/app/Http/Resources/Api/PostResource.php:32` (add `updated_at`)
- Test: `backend/tests/Feature/Api/Admin/PostControllerIndexTest.php` (new file)

**Interfaces:**
- Produces: `GET /api/admin/posts?search=&status=&category=&page=` now returns `{ data: [...], links: {...}, meta: { current_page, last_page, per_page, total, ... } }` instead of a bare array. Each item in `data` now includes `updated_at` (ISO string or `null`).

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/Feature/Api/Admin/PostControllerIndexTest.php`:

```php
<?php

namespace Tests\Feature\Api\Admin;

use App\Models\BlogCategory;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class PostControllerIndexTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        $user = User::factory()->create();
        $user->assignRole('admin');
        Sanctum::actingAs($user);
    }

    public function test_index_response_has_pagination_envelope(): void
    {
        $category = BlogCategory::factory()->create();
        Post::create([
            'blog_category_id' => $category->id,
            'title' => 'A Post', 'slug' => 'a-post', 'content' => '<p>x</p>', 'status' => 'draft',
        ]);

        $this->getJson('/api/admin/posts')
            ->assertOk()
            ->assertJsonStructure(['data', 'links', 'meta' => ['current_page', 'last_page', 'total']]);
    }

    public function test_index_filters_by_search(): void
    {
        $category = BlogCategory::factory()->create();
        Post::create([
            'blog_category_id' => $category->id,
            'title' => 'Feeding Your Senior Dog', 'slug' => 'feeding-senior-dog', 'content' => '<p>x</p>', 'status' => 'draft',
        ]);
        Post::create([
            'blog_category_id' => $category->id,
            'title' => 'Cat Grooming Tips', 'slug' => 'cat-grooming-tips', 'content' => '<p>x</p>', 'status' => 'draft',
        ]);

        $response = $this->getJson('/api/admin/posts?search=senior')->assertOk();

        $this->assertCount(1, $response->json('data'));
        $this->assertSame('Feeding Your Senior Dog', $response->json('data.0.title'));
    }

    public function test_index_includes_updated_at(): void
    {
        $category = BlogCategory::factory()->create();
        $post = Post::create([
            'blog_category_id' => $category->id,
            'title' => 'A Post', 'slug' => 'a-post', 'content' => '<p>x</p>', 'status' => 'draft',
        ]);

        $this->getJson('/api/admin/posts')
            ->assertOk()
            ->assertJsonPath('data.0.updated_at', $post->fresh()->updated_at->toISOString());
    }

    public function test_destroy_deletes_the_post(): void
    {
        $category = BlogCategory::factory()->create();
        $post = Post::create([
            'blog_category_id' => $category->id,
            'title' => 'A Post', 'slug' => 'a-post', 'content' => '<p>x</p>', 'status' => 'draft',
        ]);

        $this->deleteJson("/api/admin/posts/{$post->id}")->assertNoContent();

        $this->assertNull(Post::find($post->id));
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && php artisan test --filter=PostControllerIndexTest`
Expected: FAIL — `test_index_response_has_pagination_envelope` and `test_index_filters_by_search` fail because `index()` returns a bare array with no `search` filtering; `test_index_includes_updated_at` fails because `updated_at` is missing from the resource; `test_destroy_deletes_the_post` should already PASS (destroy already implemented) — confirms the new test file wiring itself is correct before touching `index()`.

- [ ] **Step 3: Implement the search filter and pagination**

In `backend/app/Http/Controllers/Api/PostController.php`, replace the `index()` method body:

```php
    public function index(Request $request)
    {
        $this->authorizeAdmin();

        $query = Post::with(['blogCategory', 'metadata', 'tags', 'seo', 'featuredMedia'])->latest();

        if ($request->has('category')) {
            $query->whereHas('blogCategory', function ($q) use ($request) {
                $q->where('slug', $request->category);
            });
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('search')) {
            $query->where('title', 'like', '%'.$request->search.'%');
        }

        return PostResource::collection($query->paginate(20));
    }
```

- [ ] **Step 4: Add `updated_at` to the resource**

In `backend/app/Http/Resources/Api/PostResource.php`, in `toArray()`, add a line right after `'created_at' => optional($this->created_at)?->toISOString(),`:

```php
            'created_at' => optional($this->created_at)?->toISOString(),
            'updated_at' => optional($this->updated_at)?->toISOString(),
            'published_at' => optional($this->published_at)?->toISOString(),
```

- [ ] **Step 5: Run the new tests to verify they pass**

Run: `cd backend && php artisan test --filter=PostControllerIndexTest`
Expected: PASS (all 4 tests)

- [ ] **Step 6: Run existing admin auth tests to confirm no regression**

Run: `cd backend && php artisan test --filter=AdminAuthTest`
Expected: PASS — these tests only assert HTTP status codes, not response body shape, so they are unaffected by the pagination envelope change.

- [ ] **Step 7: Commit**

```bash
git add backend/app/Http/Controllers/Api/PostController.php backend/app/Http/Resources/Api/PostResource.php backend/tests/Feature/Api/Admin/PostControllerIndexTest.php
git commit -m "feat(admin-api): add search + pagination to posts index, expose updated_at"
```

---

### Task 2: Frontend — `postsApi.ts` pagination, filters, delete mutation

**Files:**
- Modify: `admin/src/features/posts/postsApi.ts`
- Test: `admin/src/features/posts/postsApi.test.ts` (new file)

**Interfaces:**
- Consumes: backend envelope from Task 1 (`{ data: Post[], meta: { current_page, last_page, total } }`); `fetchApi`/`fetchJson` from `@/lib/api`.
- Produces: `Post` (adds `slug: string`, `updated_at: string`), `PostsFilters { search?: string; status?: 'draft' | 'published'; category?: string; page?: number }`, `PostsPage { data: Post[]; meta: { current_page: number; last_page: number; total: number } }`, `buildPostsQuery(filters: PostsFilters): string`, `usePosts(filters?: PostsFilters)` returning `PostsPage`, `useDeletePost()` returning a mutation taking a post `id: string`. Task 3 (`PostsListPage.tsx`) consumes all of these by name.

- [ ] **Step 1: Write the failing test for `buildPostsQuery`**

Create `admin/src/features/posts/postsApi.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildPostsQuery } from './postsApi';

describe('buildPostsQuery', () => {
  it('returns the base endpoint when no filters are set', () => {
    expect(buildPostsQuery({})).toBe('/admin/posts');
  });

  it('includes search, status, category, and page params when set', () => {
    expect(buildPostsQuery({ search: 'cat', status: 'published', category: 'nutrition', page: 2 })).toBe(
      '/admin/posts?search=cat&status=published&category=nutrition&page=2'
    );
  });

  it('omits an empty search string', () => {
    expect(buildPostsQuery({ search: '' })).toBe('/admin/posts');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd admin && npm run test -- postsApi.test.ts`
Expected: FAIL with "buildPostsQuery is not exported" / not defined

- [ ] **Step 3: Rewrite `postsApi.ts`**

Replace the full contents of `admin/src/features/posts/postsApi.ts`:

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi, fetchJson } from '@/lib/api';

export interface Post {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'published';
  blog_category: { id: string; name: string } | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface PostsPage {
  data: Post[];
  meta: {
    current_page: number;
    last_page: number;
    total: number;
  };
}

export interface PostsFilters {
  search?: string;
  status?: 'draft' | 'published';
  category?: string;
  page?: number;
}

export function buildPostsQuery(filters: PostsFilters): string {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.status) params.set('status', filters.status);
  if (filters.category) params.set('category', filters.category);
  if (filters.page) params.set('page', String(filters.page));
  const qs = params.toString();
  return qs ? `/admin/posts?${qs}` : '/admin/posts';
}

export function usePosts(filters: PostsFilters = {}) {
  return useQuery({
    queryKey: ['posts', filters],
    queryFn: () => fetchJson<PostsPage>(buildPostsQuery(filters)),
  });
}

export function useDeletePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetchApi(`/admin/posts/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error('Failed to delete post');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd admin && npm run test -- postsApi.test.ts`
Expected: PASS (all 3 tests)

- [ ] **Step 5: Commit**

```bash
git add admin/src/features/posts/postsApi.ts admin/src/features/posts/postsApi.test.ts
git commit -m "feat(admin): add pagination/filter query builder and delete mutation to postsApi"
```

---

### Task 3: Frontend — `PostsListPage.tsx` redesign (search, filter, pagination, view, delete)

**Files:**
- Modify: `admin/src/features/posts/PostsListPage.tsx`
- Modify: `admin/src/components/ui/button.tsx` (disabled state styling)
- Modify: `admin/src/locales/en.json`, `admin/src/locales/vi.json` (new keys)
- Modify: `admin/.env.example` (add `VITE_FRONTEND_URL`)

**Interfaces:**
- Consumes: `usePosts`, `useDeletePost`, `Post`, `PostsFilters` from `./postsApi` (Task 2); `fetchJson` from `@/lib/api`; `Button` from `@/components/ui/button`; `Input` from `@/components/ui/input`.

- [ ] **Step 1: Add the disabled-state style to `Button`**

In `admin/src/components/ui/button.tsx`, update the base class string in the `clsx(...)` call:

```tsx
      className={clsx(
        'px-4 py-2 rounded-lg text-sm font-semibold border transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        variant === 'secondary'
          ? 'bg-secondary border-secondary text-white hover:bg-secondary-dark'
          : 'bg-white border-gray-300 text-primary hover:bg-gray-50',
        className
      )}
```

- [ ] **Step 2: Add `VITE_FRONTEND_URL` to the admin env example**

In `admin/.env.example`, add a new line:

```
VITE_FRONTEND_URL=http://localhost:3000
```

- [ ] **Step 3: Add new locale keys**

In `admin/src/locales/en.json`, add these keys after `"posts.header_status": "Status",`:

```json
  "posts.header_updated": "Updated",
  "posts.action_view": "View",
  "posts.action_delete": "Delete",
  "posts.confirm_delete": "Delete \"{{title}}\"? This cannot be undone.",
  "posts.search_placeholder": "Search by title...",
  "posts.filter_status_all": "All statuses",
  "posts.filter_category_all": "All categories",
  "posts.empty_no_results": "No posts match your filters.",
  "posts.empty_no_posts": "No posts yet.",
  "posts.pagination_prev": "Previous",
  "posts.pagination_next": "Next",
  "posts.pagination_page_of": "Page {{current}} of {{last}}",
```

In `admin/src/locales/vi.json`, add these keys after `"posts.header_status": "Trạng thái",`:

```json
  "posts.header_updated": "Cập nhật",
  "posts.action_view": "Xem",
  "posts.action_delete": "Xóa",
  "posts.confirm_delete": "Xóa \"{{title}}\"? Không thể hoàn tác.",
  "posts.search_placeholder": "Tìm theo tiêu đề...",
  "posts.filter_status_all": "Tất cả trạng thái",
  "posts.filter_category_all": "Tất cả chuyên mục",
  "posts.empty_no_results": "Không có bài viết nào khớp bộ lọc.",
  "posts.empty_no_posts": "Chưa có bài viết nào.",
  "posts.pagination_prev": "Trước",
  "posts.pagination_next": "Sau",
  "posts.pagination_page_of": "Trang {{current}} / {{last}}",
```

- [ ] **Step 4: Rewrite `PostsListPage.tsx`**

Replace the full contents of `admin/src/features/posts/PostsListPage.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useReactTable, getCoreRowModel, createColumnHelper, flexRender } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { usePosts, useDeletePost, Post } from './postsApi';
import { fetchJson } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const columnHelper = createColumnHelper<Post>();

interface BlogCategoryOption {
  id: number;
  name: string;
  slug: string;
}

export function PostsListPage() {
  const { t } = useTranslation();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | 'draft' | 'published'>('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search, status, category]);

  const { data: categories } = useQuery({
    queryKey: ['blog-categories'],
    queryFn: async () => {
      const res = await fetchJson<BlogCategoryOption[]>('/admin/blog/categories');
      return Array.isArray(res) ? res : [];
    },
  });

  const { data: postsPage, isLoading } = usePosts({
    search: search || undefined,
    status: status || undefined,
    category: category || undefined,
    page,
  });

  const deletePost = useDeletePost();

  function handleDelete(post: Post) {
    if (window.confirm(t('posts.confirm_delete', { title: post.title }))) {
      deletePost.mutate(post.id);
    }
  }

  const columns = [
    columnHelper.accessor('title', {
      header: t('posts.header_title'),
      cell: (info) => (
        <Link to={`/posts/${info.row.original.id}`} className="text-primary font-semibold hover:underline">
          {info.getValue()}
        </Link>
      ),
    }),
    columnHelper.accessor((row) => row.blog_category?.name ?? '—', { id: 'category', header: t('posts.header_category') }),
    columnHelper.accessor('status', {
      header: t('posts.header_status'),
      cell: (info) => (
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
            info.getValue() === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
          }`}
        >
          {info.getValue() === 'published' ? t('posts.status_published') : t('posts.status_draft')}
        </span>
      ),
    }),
    columnHelper.accessor('updated_at', {
      header: t('posts.header_updated'),
      cell: (info) => new Date(info.getValue()).toLocaleDateString(),
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: (info) => (
        <div className="flex items-center gap-3 justify-end">
          {info.row.original.status === 'published' && (
            <a
              href={`${import.meta.env.VITE_FRONTEND_URL}/blog/${info.row.original.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
            >
              {t('posts.action_view')}
            </a>
          )}
          <button type="button" onClick={() => handleDelete(info.row.original)} className="text-xs text-red-600 hover:underline">
            {t('posts.action_delete')}
          </button>
        </div>
      ),
    }),
  ];

  const posts = postsPage?.data ?? [];
  const table = useReactTable({
    data: posts,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const hasFilters = Boolean(search || status || category);
  const meta = postsPage?.meta;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-ink">{t('posts.list_title')}</h1>
        <Link to="/posts/new">
          <Button variant="secondary">{t('posts.new_post')}</Button>
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t('posts.search_placeholder')}
          className="max-w-xs"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as '' | 'draft' | 'published')}
          className="px-3 py-2 rounded-lg border border-gray-300 text-sm"
        >
          <option value="">{t('posts.filter_status_all')}</option>
          <option value="draft">{t('posts.status_draft')}</option>
          <option value="published">{t('posts.status_published')}</option>
        </select>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-300 text-sm"
        >
          <option value="">{t('posts.filter_category_all')}</option>
          {categories?.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">{t('posts.loading')}</p>
      ) : posts.length === 0 ? (
        <p className="text-sm text-gray-500">{hasFilters ? t('posts.empty_no_results') : t('posts.empty_no_posts')}</p>
      ) : (
        <>
          <table className="w-full bg-white border border-gray-200 rounded-xl overflow-hidden">
            <thead className="bg-gray-50">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => (
                    <th key={header.id} className="text-left px-4 py-2 text-xs font-semibold text-primary-light uppercase">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-t border-gray-100">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-sm">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {meta && meta.last_page > 1 && (
            <div className="flex items-center justify-between mt-4">
              <Button type="button" variant="primary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                {t('posts.pagination_prev')}
              </Button>
              <span className="text-xs text-gray-500">
                {t('posts.pagination_page_of', { current: meta.current_page, last: meta.last_page })}
              </span>
              <Button type="button" variant="primary" disabled={page >= meta.last_page} onClick={() => setPage((p) => p + 1)}>
                {t('posts.pagination_next')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Manual verification**

Run: `cd admin && npm run dev`, open `/posts`. Verify: typing in search filters after ~400ms; Status/Category selects filter the list; Updated column shows a date; Delete shows a `confirm()` dialog and removes the row on confirm, does nothing on cancel; View link only appears on published posts and opens `{VITE_FRONTEND_URL}/blog/{slug}` in a new tab; pagination buttons appear only when `last_page > 1` and are disabled at the first/last page.

- [ ] **Step 6: Commit**

```bash
git add admin/src/features/posts/PostsListPage.tsx admin/src/components/ui/button.tsx admin/src/locales/en.json admin/src/locales/vi.json admin/.env.example
git commit -m "feat(admin): add search, filters, pagination, view, and delete to posts list"
```

---

### Task 4: Frontend — `PostFormPage.tsx` Author field + section regroup

**Files:**
- Modify: `admin/src/features/posts/postSchema.ts`
- Modify: `admin/src/features/posts/postSchema.test.ts`
- Modify: `admin/src/features/posts/PostFormPage.tsx`
- Modify: `admin/src/locales/en.json`, `admin/src/locales/vi.json` (new keys)

**Interfaces:**
- Consumes: `Card` from `@/components/ui/card`, `Input` from `@/components/ui/input`, `MediaPicker` from `@/features/media/MediaPicker` (all unchanged).
- Produces: `PostFormValues` now includes `author?: string`.

- [ ] **Step 1: Write the failing schema test**

In `admin/src/features/posts/postSchema.test.ts`, add a new test inside the existing `describe` block:

```ts
  it('accepts an optional author field', () => {
    const postFormSchema = getPostFormSchema(mockT);
    const result = postFormSchema.safeParse({
      title: 'Title',
      content: '<p>Body</p>',
      blog_category_id: '1',
      status: 'draft',
      featured_media_id: null,
      author: 'Yuni Nguyen',
    });
    expect(result.success).toBe(true);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd admin && npm run test -- postSchema.test.ts`
Expected: this test actually PASSES even before Step 3, because Zod's default (non-`.strict()`) object parsing silently strips unknown keys rather than rejecting them — `author` is accepted either way at the schema-parsing level. Run it anyway to record the baseline; the real verification that `author` is a first-class typed field happens via TypeScript compilation in Step 6 (`PostFormValues['author']` must exist for `register('author')` to type-check).

- [ ] **Step 3: Add `author` to the schema**

In `admin/src/features/posts/postSchema.ts`, add one line to the object:

```ts
export const getPostFormSchema = (t: TranslationFunction) =>
  z.object({
    title: z.string().min(1, t('posts.validation_title_required')).max(255),
    content: z.string().min(1, t('posts.validation_content_required')),
    blog_category_id: z.string().min(1, t('posts.validation_category_required')),
    status: z.enum(['draft', 'published']),
    featured_media_id: z.string().nullable(),
    author: z.string().optional(),
  });
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd admin && npm run test -- postSchema.test.ts`
Expected: PASS (all 4 tests)

- [ ] **Step 5: Add new locale keys**

In `admin/src/locales/en.json`, add after `"posts.form_label_status": "Status",`:

```json
  "posts.form_label_author": "Author",
  "posts.section_content": "Content",
  "posts.section_settings": "Post Settings",
```

In `admin/src/locales/vi.json`, add after `"posts.form_label_status": "Trạng thái",`:

```json
  "posts.form_label_author": "Tác giả",
  "posts.section_content": "Nội dung",
  "posts.section_settings": "Cài đặt bài viết",
```

- [ ] **Step 6: Update `PostFormPage.tsx`**

In `admin/src/features/posts/PostFormPage.tsx`:

1. Add `author: string | null;` to the `PostDetail` interface:

```ts
interface PostDetail {
  id: string;
  title: string;
  content: string;
  status: 'draft' | 'published';
  blog_category: { id: string; name: string } | null;
  featured_image: string | null;
  featured_media_id: string | null;
  author: string | null;
}
```

2. Add `author: ''` to the `useForm` `defaultValues`:

```ts
    defaultValues: { title: '', content: '', blog_category_id: '', status: 'draft', featured_media_id: null, author: '' },
```

3. Add `author: existingPost.author ?? ''` to the `reset(...)` call inside the `useEffect`:

```ts
      reset({
        title: existingPost.title,
        content: existingPost.content,
        blog_category_id: existingPost.blog_category?.id ?? '',
        status: existingPost.status,
        featured_media_id: existingPost.featured_media_id,
        author: existingPost.author ?? '',
      });
```

4. Replace the `return (...)` JSX block (from `<form onSubmit={handleSubmit(onSubmit)}>` through its closing `</form>`) with:

```tsx
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-ink">{isEdit ? t('posts.form_title_edit') : t('posts.form_title_new')}</h1>
        <Button type="submit" variant="secondary" disabled={isSubmitting}>
          {isSubmitting ? t('posts.form_button_saving') : t('posts.form_button_save')}
        </Button>
      </div>

      <div className="flex gap-5">
        <div className="flex-[2]">
          <Card>
            <h2 className="text-sm font-bold text-ink mb-3">{t('posts.section_content')}</h2>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-primary-light mb-1">{t('posts.form_label_title')}</label>
              <Input {...register('title')} />
              {errors.title && <p className="text-xs text-red-600 mt-1">{errors.title.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-primary-light mb-1">{t('posts.form_label_content')}</label>
              <div className="border border-gray-300 rounded-lg p-3 min-h-[200px]">
                <EditorContent editor={editor} />
              </div>
              {errors.content && <p className="text-xs text-red-600 mt-1">{errors.content.message}</p>}
            </div>
          </Card>
        </div>

        <div className="flex-1">
          <Card>
            <h2 className="text-sm font-bold text-ink mb-3">{t('posts.section_settings')}</h2>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-primary-light mb-1">{t('posts.form_label_category')}</label>
              <select {...register('blog_category_id')} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm">
                <option value="">{t('posts.form_label_category_placeholder')}</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {errors.blog_category_id && <p className="text-xs text-red-600 mt-1">{errors.blog_category_id.message}</p>}
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-primary-light mb-1">{t('posts.form_label_status')}</label>
              <select {...register('status')} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm">
                <option value="draft">{t('posts.status_draft')}</option>
                <option value="published">{t('posts.status_published')}</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-primary-light mb-1">{t('posts.form_label_author')}</label>
              <Input {...register('author')} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-primary-light mb-2">{t('posts.form_label_featured_image')}</label>
              <Controller
                name="featured_media_id"
                control={control}
                render={({ field }) => {
                  const mediaUrl = field.value && mediaLibrary
                    ? mediaLibrary.find(m => m.id === field.value)?.url ?? existingPost?.featured_image
                    : existingPost?.featured_image;

                  return (
                    <MediaPicker
                      value={field.value ? { id: field.value, url: mediaUrl ?? '' } : null}
                      onChange={(media) => field.onChange(media?.id ?? null)}
                    />
                  );
                }}
              />
            </div>
          </Card>
        </div>
      </div>
    </form>
```

- [ ] **Step 7: Manual verification**

Run: `cd admin && npm run dev`, open `/posts/new` and an existing `/posts/:id`. Verify: two `Card` sections ("Content" and "Post Settings") replace the previous five separate cards; Author input round-trips (type a value, save, reload the page, value persists); Save button still at the top; all previously-working fields (title, content, category, status, featured image) still function as before.

- [ ] **Step 8: Commit**

```bash
git add admin/src/features/posts/postSchema.ts admin/src/features/posts/postSchema.test.ts admin/src/features/posts/PostFormPage.tsx admin/src/locales/en.json admin/src/locales/vi.json
git commit -m "feat(admin): add author field and consolidate post form into two sections"
```

---

### Task 5: Frontend — `AppShell.tsx` visual polish

**Files:**
- Modify: `admin/src/layouts/AppShell.tsx`

**Interfaces:**
- No new interfaces — spacing/hover-state changes only, no structural or nav-item changes.

- [ ] **Step 1: Apply spacing and hover-state changes**

In `admin/src/layouts/AppShell.tsx`, make these four targeted changes:

1. Header padding + shadow — change:
```tsx
      <header className="bg-primary px-5 py-3 flex items-center justify-between">
```
to:
```tsx
      <header className="bg-primary px-6 py-4 flex items-center justify-between shadow-sm">
```

2. Nav width — change:
```tsx
        <nav className="w-44 bg-primary-dark py-4">
```
to:
```tsx
        <nav className="w-52 bg-primary-dark py-4">
```

3. Inactive nav-item hover state — change:
```tsx
              className={({ isActive }) =>
                `block px-5 py-2.5 text-sm ${isActive ? 'text-white bg-primary font-semibold border-r-4 border-secondary' : 'text-gray-300'}`
              }
```
to:
```tsx
              className={({ isActive }) =>
                `block px-5 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'text-white bg-primary font-semibold border-r-4 border-secondary'
                    : 'text-gray-300 hover:text-white hover:bg-primary/40'
                }`
              }
```

4. Main content padding — change:
```tsx
        <main className="flex-1 bg-gray-100 p-6">{children}</main>
```
to:
```tsx
        <main className="flex-1 bg-gray-100 p-8">{children}</main>
```

- [ ] **Step 2: Manual verification**

Run: `cd admin && npm run dev`, open any admin page. Verify: header has slightly more padding and a subtle shadow separating it from the content below; sidebar is a bit wider; hovering the inactive "Posts" nav item shows a visible hover state; main content area has more breathing room. No nav items were added or removed.

- [ ] **Step 3: Commit**

```bash
git add admin/src/layouts/AppShell.tsx
git commit -m "style(admin): polish AppShell header/nav/content spacing and hover states"
```

---

## Self-Review Notes

- **Spec coverage:** All in-scope items from the design spec are covered — delete (Task 2+3), search (Task 1+2+3), filter by status/category (Task 1 already supported it server-side, Task 3 wires the UI), pagination (Task 1+2+3), Author field (Task 4, `store`/`update` validation already accepted it — confirmed by reading `PostController.php`), `updated_at` on the list (Task 1+3), View link (Task 3), AppShell polish (Task 5). Out-of-scope items (type/breeds/solutions/tags, Comparison repeater, SEO+AI, Duplicate) are explicitly listed in Global Constraints and not touched by any task.
- **Placeholder scan:** No TBD/TODO markers; every step has literal, runnable code.
- **Type consistency:** `Post`, `PostsFilters`, `PostsPage` names/shapes introduced in Task 2 match exactly what Task 3 imports and uses. `PostFormValues.author` (Task 4) matches the `author` field added to `PostDetail` and the `reset()`/`defaultValues` calls in the same task.
