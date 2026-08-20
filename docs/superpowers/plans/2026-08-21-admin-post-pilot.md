# Admin Frontend — Post Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working, standalone admin app (`admin/`, a Vite + React SPA) that can list, create, edit, and delete blog Posts — including a real image upload/picker — against the existing Laravel API, establishing the architecture pattern (auth, layout, table, form, media upload) that every future resource migration will reuse.

**Architecture:** New `Admin\MediaController` + an extension to the existing `Admin\PostController`-equivalent (`App\Http\Controllers\Api\PostController`) on the backend provide the two missing pieces (image upload, `featured_media_id` support) on top of the REST API that already exists for Posts. A new Vite/React SPA in `admin/` consumes that API via Sanctum bearer-token auth (matching the existing token mechanism used by `frontend/`, not CSRF-cookie SPA auth), renders the approved on-brand layout shell (dark topbar+sidebar, light content, PetPosture tokens), and implements Post list/create/edit with TanStack Query/Table, React Hook Form + Zod, and TipTap.

**Tech Stack:** Backend: Laravel 11, Sanctum, Pest. Frontend: Vite, React 18, TypeScript, React Router 6, Tailwind CSS, TanStack Query v5, TanStack Table v8, React Hook Form 7 + Zod 3, TipTap 2.

## Global Constraints

- Reuse the existing `/api/admin/*` route group and its `auth:sanctum` + `role:super_admin|admin|staff` middleware for every new endpoint — do not invent a new auth/role check.
- Auth on the frontend is bearer-token, not cookie-session: store the token from `POST /login`'s JSON response, send `Authorization: Bearer <token>` + `credentials: 'include'` on every request (mirrors `frontend/lib/fetchApi.ts`).
- Brand tokens (from `frontend/tailwind.config.ts`) must be ported exactly: `primary: #3e4c57`, `primary-light: #5a6c7a`, `primary-dark: #2c3840`, `secondary: #df8448`, `secondary-light: #fdf2ea`, `secondary-dark: #c9713a`, `ink: #1a2128`. Font: Hanken Grotesk (Google Fonts).
- Do not modify any Filament resource, page, or the `AdminPanelProvider.php` styling — Filament must keep working unchanged while this ships alongside it.
- Curator media defaults (from `backend/config/curator.php`): disk `public` (via `FILAMENT_FILESYSTEM_DISK` env, default `public`), directory `media`.
- New app lives at `admin/` in the monorepo root (sibling to `backend/`, `frontend/`).

---

## Backend Tasks

### Task 1: Admin Media API (list + upload)

**Files:**
- Create: `backend/app/Http/Controllers/Api/Admin/MediaController.php`
- Create: `backend/app/Http/Resources/Api/CuratorMediaResource.php`
- Modify: `backend/routes/api.php` (add routes inside the existing `/admin` group)
- Test: `backend/tests/Feature/Api/Admin/MediaControllerTest.php`

**Interfaces:**
- Produces: `GET /api/admin/media` → `{ data: CuratorMediaResource[] }` (paginated is not needed for pilot — return latest 100). `POST /api/admin/media` (multipart, field `file`) → `201 { data: CuratorMediaResource }`.
- `CuratorMediaResource` shape: `{ id: string, url: string, thumbnail_url: string, name: string, alt: string|null, width: number|null, height: number|null }` — later tasks (frontend media picker) rely on exactly these field names.

- [ ] **Step 1: Write the failing feature test**

Create `backend/tests/Feature/Api/Admin/MediaControllerTest.php`:

```php
<?php

namespace Tests\Feature\Api\Admin;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class MediaControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        Role::firstOrCreate(['name' => 'customer', 'guard_name' => 'web']);
        Storage::fake('public');
    }

    public function test_unauthenticated_request_is_rejected(): void
    {
        $this->getJson('/api/admin/media')->assertUnauthorized();
    }

    public function test_customer_role_cannot_upload_media(): void
    {
        $user = User::factory()->create();
        $user->assignRole('customer');
        Sanctum::actingAs($user);

        $file = UploadedFile::fake()->image('photo.jpg', 400, 300);

        $this->postJson('/api/admin/media', ['file' => $file])->assertForbidden();
    }

    public function test_admin_can_upload_an_image_and_get_back_a_url(): void
    {
        $user = User::factory()->create();
        $user->assignRole('admin');
        Sanctum::actingAs($user);

        $file = UploadedFile::fake()->image('photo.jpg', 400, 300);

        $response = $this->postJson('/api/admin/media', ['file' => $file])
            ->assertCreated()
            ->assertJsonStructure(['data' => ['id', 'url', 'thumbnail_url', 'name', 'width', 'height']]);

        $this->assertSame(400, $response->json('data.width'));
        $this->assertDatabaseCount('curator_media', 1);
    }

    public function test_admin_can_list_media(): void
    {
        $user = User::factory()->create();
        $user->assignRole('admin');
        Sanctum::actingAs($user);

        $file = UploadedFile::fake()->image('photo.jpg');
        $this->postJson('/api/admin/media', ['file' => $file])->assertCreated();

        $this->getJson('/api/admin/media')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && php artisan test tests/Feature/Api/Admin/MediaControllerTest.php`
Expected: FAIL — route `/api/admin/media` does not exist (404) or class not found.

- [ ] **Step 3: Write `CuratorMediaResource`**

Create `backend/app/Http/Resources/Api/CuratorMediaResource.php`:

```php
<?php

namespace App\Http\Resources\Api;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CuratorMediaResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'url' => $this->url,
            'thumbnail_url' => $this->thumbnail_url,
            'name' => $this->name,
            'alt' => $this->alt,
            'width' => $this->width,
            'height' => $this->height,
        ];
    }
}
```

- [ ] **Step 4: Write `MediaController`**

Create `backend/app/Http/Controllers/Api/Admin/MediaController.php`:

```php
<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\CuratorMediaResource;
use App\Models\CuratorMedia;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class MediaController extends Controller
{
    public function index()
    {
        $media = CuratorMedia::latest()->limit(100)->get();

        return CuratorMediaResource::collection($media);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'file' => 'required|image|max:10240',
        ]);

        $file = $validated['file'];
        $disk = config('curator.disk');
        $directory = config('curator.directory');

        $path = $file->store($directory, $disk);
        [$width, $height] = getimagesize($file->getRealPath()) ?: [null, null];

        $media = CuratorMedia::create([
            'disk' => $disk,
            'directory' => $directory,
            'visibility' => 'public',
            'name' => $file->getClientOriginalName(),
            'path' => $path,
            'width' => $width,
            'height' => $height,
            'size' => $file->getSize(),
            'type' => 'image',
            'ext' => $file->getClientOriginalExtension(),
        ]);

        return (new CuratorMediaResource($media))
            ->response()
            ->setStatusCode(201);
    }
}
```

- [ ] **Step 5: Register routes**

In `backend/routes/api.php`, inside the existing `Route::prefix('/admin')->middleware([...])->group(function () { ... })` block (the one already containing `/posts` routes), add:

```php
        Route::get('/media', [\App\Http\Controllers\Api\Admin\MediaController::class, 'index']);
        Route::post('/media', [\App\Http\Controllers\Api\Admin\MediaController::class, 'store'])->middleware('throttle:api-write');
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd backend && php artisan test tests/Feature/Api/Admin/MediaControllerTest.php`
Expected: PASS (4 tests)

- [ ] **Step 7: Commit**

```bash
git add backend/app/Http/Controllers/Api/Admin/MediaController.php backend/app/Http/Resources/Api/CuratorMediaResource.php backend/routes/api.php backend/tests/Feature/Api/Admin/MediaControllerTest.php
git commit -m "feat(admin-api): add media upload and list endpoints"
```

---

### Task 2: Extend Post API to accept `featured_media_id`

**Files:**
- Modify: `backend/app/Http/Controllers/Api/PostController.php`
- Test: `backend/tests/Feature/Api/Admin/PostControllerMediaTest.php`

**Interfaces:**
- Consumes: `CuratorMedia` model (Task 1).
- Produces: `POST /api/admin/posts` and `PUT/PATCH /api/admin/posts/{post}` now also accept `featured_media_id: string|null` in the body; `featured_image` (plain string) remains supported as before, unchanged. `PostResource` (used by both list and show responses) now also returns `featured_media_id: string|null` — later tasks (frontend `PostFormPage`, Task 8) rely on this exact field name to restore the selected image when editing.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/Feature/Api/Admin/PostControllerMediaTest.php`:

```php
<?php

namespace Tests\Feature\Api\Admin;

use App\Models\BlogCategory;
use App\Models\CuratorMedia;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class PostControllerMediaTest extends TestCase
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

    public function test_creating_a_post_with_featured_media_id_links_it(): void
    {
        $category = BlogCategory::factory()->create();
        $media = CuratorMedia::create([
            'disk' => 'public', 'directory' => 'media', 'visibility' => 'public',
            'name' => 'photo.jpg', 'path' => 'media/photo.jpg', 'type' => 'image', 'ext' => 'jpg',
        ]);

        $response = $this->postJson('/api/admin/posts', [
            'title' => 'A Post With A Real Image',
            'content' => '<p>Body</p>',
            'blog_category_id' => $category->id,
            'featured_media_id' => $media->id,
            'status' => 'draft',
        ])->assertCreated();

        $post = Post::find($response->json('data.id'));
        $this->assertSame($media->id, $post->featured_media_id);
    }

    public function test_updating_a_post_can_change_featured_media_id(): void
    {
        $category = BlogCategory::factory()->create();
        $post = Post::create([
            'blog_category_id' => $category->id,
            'title' => 'Existing', 'slug' => 'existing', 'content' => '<p>x</p>', 'status' => 'draft',
        ]);
        $media = CuratorMedia::create([
            'disk' => 'public', 'directory' => 'media', 'visibility' => 'public',
            'name' => 'photo.jpg', 'path' => 'media/photo.jpg', 'type' => 'image', 'ext' => 'jpg',
        ]);

        $this->putJson("/api/admin/posts/{$post->id}", ['featured_media_id' => $media->id])
            ->assertOk();

        $this->assertSame($media->id, $post->fresh()->featured_media_id);
    }

    public function test_show_response_includes_featured_media_id(): void
    {
        $category = BlogCategory::factory()->create();
        $media = CuratorMedia::create([
            'disk' => 'public', 'directory' => 'media', 'visibility' => 'public',
            'name' => 'photo.jpg', 'path' => 'media/photo.jpg', 'type' => 'image', 'ext' => 'jpg',
        ]);
        $post = Post::create([
            'blog_category_id' => $category->id,
            'title' => 'Existing', 'slug' => 'existing', 'content' => '<p>x</p>', 'status' => 'draft',
            'featured_media_id' => $media->id,
        ]);

        $this->getJson("/api/admin/posts/{$post->id}")
            ->assertOk()
            ->assertJsonPath('data.featured_media_id', (string) $media->id);
    }
}
```

Note: if `BlogCategory` has no factory yet, check `backend/database/factories/BlogCategoryFactory.php` — if missing, add a minimal one alongside this task (`BlogCategory::factory()->create()` needs `name` and `slug` at minimum; base it on the existing migration columns).

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && php artisan test tests/Feature/Api/Admin/PostControllerMediaTest.php`
Expected: FAIL — `featured_media_id` is silently dropped (not in the validated array), so `$post->featured_media_id` stays `null`.

- [ ] **Step 3: Update validation in `PostController`**

In `backend/app/Http/Controllers/Api/PostController.php`, in both `store()` and `update()`, add one line to each `$request->validate([...])` array, right after the `'featured_image'` line:

```php
            'featured_media_id' => 'nullable|exists:curator_media,id',
```

(In `store()` it's `'nullable|exists:curator_media,id'`; in `update()` use the same rule string — both are already optional fields, no `sometimes|required` needed since it's nullable.)

- [ ] **Step 4: Add `featured_media_id` to `PostResource`'s output**

In `backend/app/Http/Resources/Api/PostResource.php`, in `toArray()`, add one line right after the existing `'featured_image_alt' => $this->featured_image_alt,` line:

```php
            'featured_media_id' => $this->featured_media_id ? (string) $this->featured_media_id : null,
```

This is required so the admin frontend can tell which media item is currently selected when editing a post (the existing `featured_image` field only carries a resolved URL, not the underlying id).

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd backend && php artisan test tests/Feature/Api/Admin/PostControllerMediaTest.php`
Expected: PASS (3 tests)

- [ ] **Step 6: Run the full existing Post test suite to check for regressions**

Run: `cd backend && php artisan test --filter=Post`
Expected: PASS — no existing Post-related test should break.

- [ ] **Step 7: Commit**

```bash
git add backend/app/Http/Controllers/Api/PostController.php backend/app/Http/Resources/Api/PostResource.php backend/tests/Feature/Api/Admin/PostControllerMediaTest.php
git commit -m "feat(admin-api): accept and expose featured_media_id on posts"
```

---

### Task 3: CORS config for the new admin domain

**Files:**
- Modify: `backend/.env.example` (document only)
- Modify (local dev only, not committed): `backend/.env` — add note in step, this file is gitignored

**Interfaces:** None — configuration only, no code interface.

- [ ] **Step 1: Add the new origins to `backend/.env.example`**

Find the `FRONTEND_URL` line in `backend/.env.example` and update it to document the admin origin, e.g.:

```
FRONTEND_URL=https://petposture.vercel.app,http://localhost:3000,https://admin.petposture.com,http://localhost:5173
```

- [ ] **Step 2: Update local `backend/.env`**

Manually add `http://localhost:5173` (the Vite dev server's default port) and `https://admin.petposture.com` to the `FRONTEND_URL` value in `backend/.env` (this file is gitignored, so this step is a manual local action, not a commit).

- [ ] **Step 3: Verify CORS is picked up**

Run: `cd backend && php artisan config:clear`
Expected: no error. `backend/config/cors.php` reads `FRONTEND_URL` at request time via `env()`, so no further step is needed — this will be exercised end-to-end in Task 6 when the frontend makes its first cross-origin request.

- [ ] **Step 4: Commit**

```bash
git add backend/.env.example
git commit -m "docs(admin-api): document admin frontend origins in FRONTEND_URL"
```

---

## Frontend Tasks (`admin/`)

### Task 4: Scaffold the Vite app with brand-token Tailwind and base UI primitives

**Files:**
- Create: `admin/package.json`, `admin/vite.config.ts`, `admin/tsconfig.json`, `admin/tsconfig.node.json`, `admin/index.html`, `admin/postcss.config.js`, `admin/tailwind.config.ts`, `admin/.env.example`
- Create: `admin/src/main.tsx`, `admin/src/App.tsx`, `admin/src/index.css`
- Create: `admin/src/components/ui/button.tsx`, `admin/src/components/ui/input.tsx`, `admin/src/components/ui/textarea.tsx`, `admin/src/components/ui/card.tsx`

**Interfaces:**
- Produces: `<Button>`, `<Input>`, `<Textarea>`, `<Card>` React components (Tailwind-styled, brand tokens) — later tasks (Login page, Post form) import these directly from `@/components/ui/*`.

- [ ] **Step 1: Create `admin/package.json`**

```json
{
  "name": "petposture-admin",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.2",
    "@tanstack/react-query": "^5.59.0",
    "@tanstack/react-table": "^8.20.5",
    "react-hook-form": "^7.53.0",
    "@hookform/resolvers": "^3.9.0",
    "zod": "^3.23.8",
    "@tiptap/react": "^2.8.0",
    "@tiptap/starter-kit": "^2.8.0",
    "clsx": "^2.1.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.6.2",
    "vite": "^5.4.6",
    "tailwindcss": "^3.4.11",
    "postcss": "^8.4.47",
    "autoprefixer": "^10.4.20",
    "vitest": "^2.1.1"
  }
}
```

- [ ] **Step 2: Create `admin/vite.config.ts`**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
});
```

- [ ] **Step 3: Create `admin/tsconfig.json` and `admin/tsconfig.node.json`**

`admin/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

`admin/tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler"
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: Create `admin/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PetPosture Admin</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `admin/tailwind.config.ts` with ported brand tokens**

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#3e4c57', light: '#5a6c7a', dark: '#2c3840' },
        secondary: { DEFAULT: '#df8448', light: '#fdf2ea', dark: '#c9713a' },
        ink: '#1a2128',
      },
      fontFamily: {
        sans: ["'Hanken Grotesk'", 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 6: Create `admin/postcss.config.js`**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 7: Create `admin/src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-gray-100 text-ink font-sans;
}
```

- [ ] **Step 8: Create `admin/.env.example`**

```
VITE_API_BASE_URL=http://localhost:8000
```

- [ ] **Step 9: Create the four base UI primitives**

`admin/src/components/ui/button.tsx`:

```tsx
import { ButtonHTMLAttributes, forwardRef } from 'react';
import clsx from 'clsx';

type ButtonVariant = 'primary' | 'secondary';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'secondary', ...props }, ref) => (
    <button
      ref={ref}
      className={clsx(
        'px-4 py-2 rounded-lg text-sm font-semibold border transition-colors',
        variant === 'secondary'
          ? 'bg-secondary border-secondary text-white hover:bg-secondary-dark'
          : 'bg-white border-gray-300 text-primary hover:bg-gray-50',
        className
      )}
      {...props}
    />
  )
);
Button.displayName = 'Button';
```

`admin/src/components/ui/input.tsx`:

```tsx
import { InputHTMLAttributes, forwardRef } from 'react';
import clsx from 'clsx';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={clsx(
        'w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm text-ink',
        'focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary-light',
        className
      )}
      {...props}
    />
  )
);
Input.displayName = 'Input';
```

`admin/src/components/ui/textarea.tsx`:

```tsx
import { TextareaHTMLAttributes, forwardRef } from 'react';
import clsx from 'clsx';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={clsx(
        'w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm text-ink',
        'focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary-light',
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = 'Textarea';
```

`admin/src/components/ui/card.tsx`:

```tsx
import { HTMLAttributes } from 'react';
import clsx from 'clsx';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('bg-white border border-gray-200 rounded-xl p-4', className)} {...props} />;
}
```

- [ ] **Step 10: Create `admin/src/App.tsx` and `admin/src/main.tsx` (placeholder root, wired properly in Task 6)**

`admin/src/App.tsx`:

```tsx
export default function App() {
  return <div className="p-8">PetPosture Admin — scaffold OK</div>;
}
```

`admin/src/main.tsx`:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 11: Install and verify it runs**

Run: `cd admin && npm install && npm run dev`
Expected: Vite dev server starts on `http://localhost:5173`, page shows "PetPosture Admin — scaffold OK". Stop the dev server (Ctrl+C) once confirmed.

- [ ] **Step 12: Commit**

```bash
git add admin/
git commit -m "feat(admin): scaffold Vite/React app with brand-token Tailwind and base UI primitives"
```

---

### Task 5: API client + auth (login, token storage, session check)

**Files:**
- Create: `admin/vitest.config.ts`
- Modify: `admin/package.json` (add `jsdom` devDependency)
- Create: `admin/src/lib/api.ts`
- Create: `admin/src/lib/auth.ts`
- Create: `admin/src/lib/auth.test.ts`
- Create: `admin/src/features/auth/LoginPage.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks except `Input`/`Button` (Task 4).
- Produces: `fetchApi(endpoint: string, options?: FetchApiOptions): Promise<Response>`, `getToken(): string | null`, `setToken(token: string | null): void`, `login(email: string, password: string): Promise<{ user: AdminUser; token: string }>` — later tasks (AppShell, Post pages) import `fetchApi` and `getToken`/`setToken` from `@/lib/auth` and `@/lib/api`. `AdminUser` type: `{ id: string; name: string; email: string; roles: string[] }`.

- [ ] **Step 0: Add a jsdom test environment before writing any test**

The tests in this task use `localStorage`, which does not exist in Vitest's default `node` environment — only in a browser or a simulated DOM like `jsdom`. Without this step, Step 2 (verify the test fails) would fail for the wrong reason (`localStorage is not defined`) rather than the real reason (module doesn't exist yet).

Create `admin/vitest.config.ts`:

```typescript
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
    },
  })
);
```

Add `"jsdom": "^25.0.0"` to `admin/package.json`'s `devDependencies`, then run `cd admin && npm install`.

(Task 9 will add `.gitignore` and `README.md` later — this file does not need to be created again there.)

- [ ] **Step 1: Write the failing test for token storage**

Create `admin/src/lib/auth.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { getToken, setToken, isAdminRole } from './auth';

describe('auth token storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when no token is stored', () => {
    expect(getToken()).toBeNull();
  });

  it('stores and retrieves a token', () => {
    setToken('abc123');
    expect(getToken()).toBe('abc123');
  });

  it('clears the token when set to null', () => {
    setToken('abc123');
    setToken(null);
    expect(getToken()).toBeNull();
  });

  it('recognizes admin, super_admin, and staff as admin roles', () => {
    expect(isAdminRole(['customer'])).toBe(false);
    expect(isAdminRole(['staff'])).toBe(true);
    expect(isAdminRole(['admin'])).toBe(true);
    expect(isAdminRole(['super_admin'])).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd admin && npx vitest run src/lib/auth.test.ts`
Expected: FAIL — `./auth` module does not exist.

- [ ] **Step 3: Write `admin/src/lib/api.ts`**

```typescript
import { getToken } from './auth';

export type FetchApiOptions = Omit<RequestInit, 'body'> & {
  body?: Record<string, unknown> | FormData | null;
};

function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
}

export async function fetchApi(endpoint: string, options: FetchApiOptions = {}): Promise<Response> {
  const { body, headers: customHeaders, ...rest } = options;
  const headers = new Headers(customHeaders as HeadersInit | undefined);

  if (!(body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const serializedBody =
    body instanceof FormData || body === null || body === undefined
      ? (body as BodyInit | null | undefined)
      : JSON.stringify(body);

  return fetch(`${getApiBaseUrl()}/api${endpoint}`, {
    ...rest,
    credentials: 'include',
    headers,
    ...(serializedBody !== undefined ? { body: serializedBody } : {}),
  });
}

export async function fetchJson<T = unknown>(endpoint: string, options: FetchApiOptions = {}): Promise<T> {
  const res = await fetchApi(endpoint, options);
  const data = await res.json();
  if (!res.ok) {
    throw Object.assign(new Error(data?.message ?? 'Request failed'), { status: res.status, data });
  }
  return data as T;
}
```

- [ ] **Step 4: Write `admin/src/lib/auth.ts`**

```typescript
import { fetchJson } from './api';

const TOKEN_KEY = 'petposture_admin_token';
const ADMIN_ROLES = ['super_admin', 'admin', 'staff'];

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  roles: string[];
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function isAdminRole(roles: string[]): boolean {
  return roles.some((role) => ADMIN_ROLES.includes(role));
}

export async function login(email: string, password: string): Promise<{ user: AdminUser; token: string }> {
  const res = await fetchJson<{ data: { user: AdminUser; token: string } }>('/login', {
    method: 'POST',
    body: { email, password },
  });
  return res.data;
}

export async function fetchCurrentUser(): Promise<AdminUser> {
  const res = await fetchJson<{ data: AdminUser }>('/me');
  return res.data;
}

export async function logout(): Promise<void> {
  await fetchJson('/logout', { method: 'POST' });
  setToken(null);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd admin && npx vitest run src/lib/auth.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Write the login page**

Create `admin/src/features/auth/LoginPage.tsx`:

```tsx
import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { login, setToken, isAdminRole } from '@/lib/auth';

export function LoginPage({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { user, token } = await login(email, password);
      if (!isAdminRole(user.roles)) {
        setError('Tài khoản này không có quyền truy cập admin.');
        return;
      }
      setToken(token);
      onLoggedIn();
    } catch {
      setError('Email hoặc mật khẩu không đúng.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold text-ink mb-6">PetPosture Admin</h1>
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
        <label className="block text-xs font-semibold text-primary-light mb-1">Email</label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mb-4" required />
        <label className="block text-xs font-semibold text-primary-light mb-1">Mật khẩu</label>
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mb-6" required />
        <Button type="submit" variant="secondary" className="w-full" disabled={submitting}>
          {submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add admin/vitest.config.ts admin/package.json admin/package-lock.json admin/src/lib/api.ts admin/src/lib/auth.ts admin/src/lib/auth.test.ts admin/src/features/auth/LoginPage.tsx
git commit -m "feat(admin): add API client, token-based auth, and login page"
```

---

### Task 6: AppShell layout + routing + protected routes

**Files:**
- Create: `admin/src/layouts/AppShell.tsx`
- Create: `admin/src/lib/queryClient.ts`
- Modify: `admin/src/App.tsx`

**Interfaces:**
- Consumes: `LoginPage` (Task 5), `fetchCurrentUser`/`isAdminRole`/`getToken`/`setToken` (Task 5).
- Produces: `AppShell` component wrapping routed pages — takes `children: ReactNode`; renders the approved dark topbar + dark sidebar + light content layout. Later tasks (Posts list/form pages) are rendered as `<AppShell>`'s children via routes.

- [ ] **Step 1: Create the shared TanStack Query client**

Create `admin/src/lib/queryClient.ts`:

```typescript
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});
```

- [ ] **Step 2: Create `AppShell`**

Create `admin/src/layouts/AppShell.tsx`, following the approved mockup (dark topbar with brand dot + user name, dark sidebar with nav items, light content area):

```tsx
import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { logout } from '@/lib/auth';

const NAV_ITEMS = [
  { to: '/posts', label: 'Bài viết' },
];

export function AppShell({ children, userName }: { children: ReactNode; userName: string }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-primary px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white font-bold text-sm">
          <span className="w-2 h-2 rounded-full bg-secondary" />
          PetPosture Admin
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-300 text-xs">{userName}</span>
          <button onClick={() => logout().then(() => window.location.reload())} className="text-gray-300 text-xs hover:text-white">
            Đăng xuất
          </button>
        </div>
      </header>
      <div className="flex flex-1">
        <nav className="w-44 bg-primary-dark py-4">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block px-5 py-2.5 text-sm ${isActive ? 'text-white bg-primary font-semibold border-r-4 border-secondary' : 'text-gray-300'}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <main className="flex-1 bg-gray-100 p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire routing, auth gate, and query provider into `App.tsx`**

Replace `admin/src/App.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { AppShell } from '@/layouts/AppShell';
import { LoginPage } from '@/features/auth/LoginPage';
import { AdminUser, fetchCurrentUser, getToken, isAdminRole } from '@/lib/auth';

export default function App() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      setChecked(true);
      return;
    }
    fetchCurrentUser()
      .then((u) => setUser(isAdminRole(u.roles) ? u : null))
      .catch(() => setUser(null))
      .finally(() => setChecked(true));
  }, []);

  if (!checked) return null;

  if (!user) {
    return <LoginPage onLoggedIn={() => window.location.reload()} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppShell userName={user.name}>
          <Routes>
            <Route path="/" element={<Navigate to="/posts" replace />} />
            <Route path="/posts" element={<div>Posts list — Task 7</div>} />
            <Route path="/posts/new" element={<div>Post form — Task 8</div>} />
            <Route path="/posts/:id" element={<div>Post form — Task 8</div>} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 4: Manually verify in the browser**

Run: `cd admin && npm run dev`. Open `http://localhost:5173`. Expected: login form appears (no token yet). This step can't be automated without a running backend + seeded admin user — verify visually that the login form renders and that submitting invalid credentials shows the Vietnamese error message. Stop the dev server once confirmed.

- [ ] **Step 5: Commit**

```bash
git add admin/src/layouts/AppShell.tsx admin/src/lib/queryClient.ts admin/src/App.tsx
git commit -m "feat(admin): add AppShell layout, routing, and auth gate"
```

---

### Task 7: Posts list page (TanStack Query + Table)

**Files:**
- Create: `admin/src/features/posts/postsApi.ts`
- Create: `admin/src/features/posts/PostsListPage.tsx`
- Modify: `admin/src/App.tsx` (wire the real page in for `/posts`)

**Interfaces:**
- Consumes: `fetchJson` (Task 5).
- Produces: `Post` type: `{ id: string; title: string; status: 'draft'|'published'; blog_category: { id: string; name: string } | null; created_at: string; published_at: string | null }`. `usePosts(): UseQueryResult<Post[]>` — Task 8 does not consume this directly, but reuses the `Post` type and `postsApi` module for its own detail fetch.

- [ ] **Step 1: Create the posts API module**

Create `admin/src/features/posts/postsApi.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '@/lib/api';

export interface Post {
  id: string;
  title: string;
  status: 'draft' | 'published';
  blog_category: { id: string; name: string } | null;
  created_at: string;
  published_at: string | null;
}

export function usePosts() {
  return useQuery({
    queryKey: ['posts'],
    queryFn: () => fetchJson<{ data: Post[] }>('/admin/posts').then((res) => res.data),
  });
}
```

- [ ] **Step 2: Create the list page**

Create `admin/src/features/posts/PostsListPage.tsx`:

```tsx
import { useReactTable, getCoreRowModel, createColumnHelper, flexRender } from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import { usePosts, Post } from './postsApi';
import { Button } from '@/components/ui/button';

const columnHelper = createColumnHelper<Post>();

const columns = [
  columnHelper.accessor('title', {
    header: 'Tiêu đề',
    cell: (info) => (
      <Link to={`/posts/${info.row.original.id}`} className="text-primary font-semibold hover:underline">
        {info.getValue()}
      </Link>
    ),
  }),
  columnHelper.accessor((row) => row.blog_category?.name ?? '—', { id: 'category', header: 'Chuyên mục' }),
  columnHelper.accessor('status', {
    header: 'Trạng thái',
    cell: (info) => (
      <span
        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
          info.getValue() === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
        }`}
      >
        {info.getValue() === 'published' ? 'Đã đăng' : 'Nháp'}
      </span>
    ),
  }),
];

export function PostsListPage() {
  const { data: posts, isLoading } = usePosts();

  const table = useReactTable({
    data: posts ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-ink">Bài viết</h1>
        <Link to="/posts/new">
          <Button variant="secondary">Bài viết mới</Button>
        </Link>
      </div>
      {isLoading ? (
        <p className="text-sm text-gray-500">Đang tải...</p>
      ) : (
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
      )}
    </div>
  );
}
```

- [ ] **Step 3: Wire it into routing**

In `admin/src/App.tsx`, replace the import and the `/posts` route:

```tsx
import { PostsListPage } from '@/features/posts/PostsListPage';
```

```tsx
            <Route path="/posts" element={<PostsListPage />} />
```

- [ ] **Step 4: Manually verify**

Run: `cd admin && npm run dev`, log in with a seeded admin user (backend must be running with `php artisan serve` and CORS configured per Task 3). Expected: Posts table renders with existing posts, "Bài viết mới" button visible. Stop the dev server once confirmed.

- [ ] **Step 5: Commit**

```bash
git add admin/src/features/posts/postsApi.ts admin/src/features/posts/PostsListPage.tsx admin/src/App.tsx
git commit -m "feat(admin): add posts list page with TanStack Table"
```

---

### Task 8: Post create/edit form (React Hook Form + Zod, TipTap, media picker)

**Files:**
- Create: `admin/src/features/posts/postSchema.ts`
- Create: `admin/src/features/posts/postSchema.test.ts`
- Create: `admin/src/features/media/MediaPicker.tsx`
- Create: `admin/src/features/posts/PostFormPage.tsx`
- Modify: `admin/src/App.tsx` (wire the real page in for `/posts/new` and `/posts/:id`)

**Interfaces:**
- Consumes: `fetchJson` (Task 5), `Post` type (Task 7), `Textarea`/`Input`/`Button`/`Card` (Task 4).
- Produces: `postFormSchema` (Zod), used only within this task.

- [ ] **Step 1: Write the failing test for the Zod schema**

Create `admin/src/features/posts/postSchema.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { postFormSchema } from './postSchema';

describe('postFormSchema', () => {
  it('accepts a valid draft post', () => {
    const result = postFormSchema.safeParse({
      title: 'A valid title',
      content: '<p>Body</p>',
      blog_category_id: '1',
      status: 'draft',
      featured_media_id: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty title', () => {
    const result = postFormSchema.safeParse({
      title: '',
      content: '<p>Body</p>',
      blog_category_id: '1',
      status: 'draft',
      featured_media_id: null,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a missing category', () => {
    const result = postFormSchema.safeParse({
      title: 'Title',
      content: '<p>Body</p>',
      blog_category_id: '',
      status: 'draft',
      featured_media_id: null,
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd admin && npx vitest run src/features/posts/postSchema.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the schema**

Create `admin/src/features/posts/postSchema.ts`:

```typescript
import { z } from 'zod';

export const postFormSchema = z.object({
  title: z.string().min(1, 'Tiêu đề không được để trống').max(255),
  content: z.string().min(1, 'Nội dung không được để trống'),
  blog_category_id: z.string().min(1, 'Vui lòng chọn chuyên mục'),
  status: z.enum(['draft', 'published']),
  featured_media_id: z.string().nullable(),
});

export type PostFormValues = z.infer<typeof postFormSchema>;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd admin && npx vitest run src/features/posts/postSchema.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Write the media picker**

Create `admin/src/features/media/MediaPicker.tsx`:

```tsx
import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from '@/lib/api';
import { Button } from '@/components/ui/button';

interface MediaItem {
  id: string;
  url: string;
  thumbnail_url: string;
  name: string;
}

export function MediaPicker({
  value,
  onChange,
}: {
  value: { id: string; url: string } | null;
  onChange: (media: { id: string; url: string } | null) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  const { data: library } = useQuery({
    queryKey: ['media'],
    queryFn: () => fetchJson<{ data: MediaItem[] }>('/admin/media').then((res) => res.data),
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetchJson<{ data: MediaItem }>('/admin/media', { method: 'POST', body: formData });
      onChange({ id: res.data.id, url: res.data.url });
      queryClient.invalidateQueries({ queryKey: ['media'] });
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  return (
    <div>
      {value ? (
        <div className="mb-3">
          <img src={value.url} alt="" className="w-full max-h-48 object-cover rounded-lg border border-gray-200" />
          <button type="button" onClick={() => onChange(null)} className="text-xs text-red-600 mt-1">
            Bỏ chọn
          </button>
        </div>
      ) : (
        <div className="border-2 border-dashed border-gray-300 rounded-lg h-32 flex items-center justify-center text-sm text-gray-400 mb-3">
          Chưa có ảnh
        </div>
      )}

      <input ref={fileInput} type="file" accept="image/*" onChange={handleFileChange} className="hidden" id="media-upload" />
      <label htmlFor="media-upload">
        <Button type="button" variant="primary" disabled={uploading} onClick={() => fileInput.current?.click()}>
          {uploading ? 'Đang tải lên...' : 'Tải ảnh lên'}
        </Button>
      </label>

      {library && library.length > 0 && (
        <div className="grid grid-cols-4 gap-2 mt-3">
          {library.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => onChange({ id: item.id, url: item.url })}
              className="border border-gray-200 rounded overflow-hidden hover:border-secondary"
            >
              <img src={item.thumbnail_url} alt={item.name} className="w-full h-16 object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Write the form page**

Create `admin/src/features/posts/PostFormPage.tsx`:

```tsx
import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { fetchJson } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MediaPicker } from '@/features/media/MediaPicker';
import { postFormSchema, PostFormValues } from './postSchema';

interface BlogCategory {
  id: number;
  name: string;
}

interface PostDetail {
  id: string;
  title: string;
  content: string;
  status: 'draft' | 'published';
  blog_category: { id: string; name: string } | null;
  featured_image: string | null;
  featured_media_id: string | null;
}

export function PostFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: categories } = useQuery({
    queryKey: ['blog-categories'],
    queryFn: () => fetchJson<BlogCategory[]>('/admin/blog/categories'),
  });

  const { data: existingPost } = useQuery({
    queryKey: ['posts', id],
    queryFn: () => fetchJson<{ data: PostDetail }>(`/admin/posts/${id}`).then((res) => res.data),
    enabled: isEdit,
  });

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PostFormValues>({
    resolver: zodResolver(postFormSchema),
    defaultValues: { title: '', content: '', blog_category_id: '', status: 'draft', featured_media_id: null },
  });

  const editor = useEditor({
    extensions: [StarterKit],
    content: '',
  });

  useEffect(() => {
    if (existingPost && editor) {
      reset({
        title: existingPost.title,
        content: existingPost.content,
        blog_category_id: existingPost.blog_category?.id ?? '',
        status: existingPost.status,
        featured_media_id: existingPost.featured_media_id,
      });
      editor.commands.setContent(existingPost.content);
    }
  }, [existingPost, editor, reset]);

  const mutation = useMutation({
    mutationFn: (values: PostFormValues) => {
      const method = isEdit ? 'PUT' : 'POST';
      const url = isEdit ? `/admin/posts/${id}` : '/admin/posts';
      return fetchJson(url, { method, body: values });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      navigate('/posts');
    },
  });

  function onSubmit(values: PostFormValues) {
    mutation.mutate({ ...values, content: editor?.getHTML() ?? values.content });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-ink">{isEdit ? 'Sửa bài viết' : 'Bài viết mới'}</h1>
        <Button type="submit" variant="secondary" disabled={isSubmitting}>
          {isSubmitting ? 'Đang lưu...' : 'Lưu bài viết'}
        </Button>
      </div>

      <div className="flex gap-5">
        <div className="flex-[2] space-y-4">
          <Card>
            <label className="block text-xs font-semibold text-primary-light mb-1">Tiêu đề</label>
            <Input {...register('title')} />
            {errors.title && <p className="text-xs text-red-600 mt-1">{errors.title.message}</p>}
          </Card>

          <Card>
            <label className="block text-xs font-semibold text-primary-light mb-1">Nội dung</label>
            <div className="border border-gray-300 rounded-lg p-3 min-h-[200px]">
              <EditorContent editor={editor} />
            </div>
          </Card>
        </div>

        <div className="flex-1 space-y-4">
          <Card>
            <label className="block text-xs font-semibold text-primary-light mb-1">Chuyên mục</label>
            <select {...register('blog_category_id')} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm">
              <option value="">Chọn chuyên mục</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {errors.blog_category_id && <p className="text-xs text-red-600 mt-1">{errors.blog_category_id.message}</p>}
          </Card>

          <Card>
            <label className="block text-xs font-semibold text-primary-light mb-1">Trạng thái</label>
            <select {...register('status')} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm">
              <option value="draft">Nháp</option>
              <option value="published">Đã đăng</option>
            </select>
          </Card>

          <Card>
            <label className="block text-xs font-semibold text-primary-light mb-2">Ảnh đại diện</label>
            <Controller
              name="featured_media_id"
              control={control}
              render={({ field }) => (
                <MediaPicker
                  value={field.value ? { id: field.value, url: existingPost?.featured_image ?? '' } : null}
                  onChange={(media) => field.onChange(media?.id ?? null)}
                />
              )}
            />
          </Card>
        </div>
      </div>
    </form>
  );
}
```

- [ ] **Step 7: Wire it into routing**

In `admin/src/App.tsx`, add the import:

```tsx
import { PostFormPage } from '@/features/posts/PostFormPage';
```

Replace the two placeholder routes:

```tsx
            <Route path="/posts/new" element={<PostFormPage />} />
            <Route path="/posts/:id" element={<PostFormPage />} />
```

- [ ] **Step 8: Manually verify end-to-end in the browser**

Run: `cd backend && php artisan serve` in one terminal, `cd admin && npm run dev` in another. Log in, click "Bài viết mới", fill in title/content/category, upload a real image via "Tải ảnh lên", save. Expected: redirected to `/posts`, new post appears in the table with the uploaded image linked. Open it again via the title link — form should be pre-filled including the uploaded image (the `MediaPicker` should show the existing image, not the empty "Chưa có ảnh" state). Save again **without** touching the image field, then reopen once more — the image must still be there (this specifically verifies the `featured_media_id` round-trip fix from Task 2 Step 4). Stop both dev servers once confirmed.

- [ ] **Step 9: Commit**

```bash
git add admin/src/features/posts/postSchema.ts admin/src/features/posts/postSchema.test.ts admin/src/features/media/MediaPicker.tsx admin/src/features/posts/PostFormPage.tsx admin/src/App.tsx
git commit -m "feat(admin): add post create/edit form with TipTap editor and image upload"
```

---

### Task 9: .gitignore and README

**Files:**
- Create: `admin/.gitignore`
- Create: `admin/README.md`

**Interfaces:** None — project hygiene only.

Note: `admin/vitest.config.ts` and the `jsdom` devDependency were already added in Task 5 (Step 0), because Task 5's tests needed a DOM environment for `localStorage` — nothing to do here for that.

- [ ] **Step 2: Create `admin/.gitignore`**

```
node_modules/
dist/
.env
```

- [ ] **Step 3: Create `admin/README.md`**

```markdown
# PetPosture Admin

Standalone admin frontend (Vite + React) that replaces Filament resource-by-resource. See `docs/superpowers/specs/2026-08-21-admin-frontend-rebuild-design.md` for architecture, and `docs/superpowers/plans/2026-08-21-admin-post-pilot.md` for how the Post pilot was built.

## Setup

```bash
npm install
cp .env.example .env   # set VITE_API_BASE_URL to your local backend
npm run dev
```

Requires the Laravel backend running locally with `FRONTEND_URL` including `http://localhost:5173` (see backend `.env`).

## Testing

```bash
npm test
```
```

- [ ] **Step 4: Run the full test suite once more**

Run: `cd admin && npm test`
Expected: PASS — all Vitest tests from Tasks 5 and 8 pass together.

- [ ] **Step 5: Commit**

```bash
git add admin/.gitignore admin/README.md
git commit -m "chore(admin): add vitest config, gitignore, and README"
```
