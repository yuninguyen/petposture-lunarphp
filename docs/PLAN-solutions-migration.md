# Migration Plan: Solutions Module

## Context
The objective is to migrate the "Solutions" module from the old admin system (`localhost:8000`) to the new React/Vite admin panel (`localhost:5173`). The UI/UX will perfectly match the newly refined `Breeds` module (6:6 layout), following the `/ui-ux-pro-max` guidelines for consistency and premium feel.

## Decisions Made
- **Image Field**: We will add `featured_image`, `featured_image_alt`, and `featured_media_id` to the `solutions` table via a new migration. This ensures the 6:6 layout perfectly matches the Breeds module and provides images for the frontend store (Explore by Solutions).
- **Relationships**: We will implement the multi-select UI to manage related `products` and `posts` directly from the Solution form, just like we did for Breeds.

## Proposed Changes

### Backend API (Laravel)

#### [NEW] `2026_08_23_xxxxxx_add_media_columns_to_solutions_table.php`
- Add `featured_image`, `featured_image_alt`, and `featured_media_id` columns to the `solutions` table.

#### [NEW] `SolutionController.php` (Api/Admin)
- Implement `index`, `show`, `store`, `update`, `destroy`.
- Handle `extractSeoData` to update the polymorphic `seo_metadata` table (just like in BreedController).
- Sync `products` and `posts` relationships.

#### [NEW] `SolutionResource.php` (Api/Admin)
- Return `id`, `name`, `slug`, `description`.
- Return nested `seo` data.
- Return related `products` and `posts`.

#### [MODIFY] `routes/api.php`
- Register `api/admin/solutions` resource routes.

### Frontend UI (React)

#### [NEW] `solutionsApi.ts`
- Create RTK Query endpoints for `getSolutions`, `getSolution`, `createSolution`, `updateSolution`, `deleteSolution`.

#### [NEW] `SolutionsPage.tsx`
- Data table listing all solutions.
- Search, pagination, and delete actions.

#### [NEW] `SolutionFormPage.tsx`
- **6:6 Layout Structure**:
  - **Left Column (Main Information)**: Name, Slug, Description (Rich Text Editor taking full width).
  - **Right Column (SEO & Social)**: Reusing `<SeoSettingsSection titleKey="name" contentKey="description" />`.
  - **Bottom Row**: Related Content (Products, Posts).
- Proper loading states and React Hook Form validation.

#### [MODIFY] `Sidebar.tsx`
- Ensure the "Solutions" link in the Catalogue menu points to `/admin/catalogue/solutions`.
