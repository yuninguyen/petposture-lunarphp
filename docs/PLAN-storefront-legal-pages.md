# PLAN: Storefront          Legal & Policies Pages
**Goal:** Implement dynamic routing and display of Legal & Policies pages on the public Storefront using data from the Laravel Backend API.

## Phase -1: Context & Requirements
- **Backend Ready:** The endpoint `GET /api/pages/{slug}` is already available in Laravel (`ContentController::class, 'page'`).
- **Data Shape:** The endpoint returns `{ title, slug, content, updated_at, ... }`.
- **SEO Needs:** Legal pages (Privacy Policy, Terms of Service) need to be indexable by Google.
- **Frontend Stack:** Assuming Next.js or similar React framework for the public Storefront.

## Phase 0: Socratic Gate (Open Questions)
1. Are you using Next.js (App Router or Pages Router) for the Storefront?
2. Do you want these pages nested under a sub-path (e.g., `/policies/terms-of-service`) or at the root level (e.g., `/terms-of-service`)?
3. Do you have a standard layout (Header/Footer) ready for these text-heavy pages?

## Phase 1: Implementation Plan

### Step 1: Frontend Route Setup
- Create a dynamic route file. 
  - If Next.js App Router: `app/(legal)/[slug]/page.tsx`
  - If Next.js Pages Router: `pages/[slug].tsx`

### Step 2: Data Fetching Strategy (Recommended: SSG + ISR)
- Use `getStaticPaths` (or `generateStaticParams`) to fetch the list of active page slugs from the backend at build time.
- Use `getStaticProps` (or `fetch` with `next: { revalidate: 60 }`) to fetch the page content from `GET /api/pages/{slug}`.
- This ensures the pages load instantly (fast TTFB) and are great for SEO, while still updating automatically within 60 seconds when you edit them in the Admin.

### Step 3: UI Implementation
- Create a `LegalPageLayout` component optimized for readability:
  - Narrow max-width (`max-w-3xl`)
  - Good line-height and typography for long text (using `@tailwindcss/typography` plugin `prose` class)
  - Last updated date indicator
- Safely render the HTML content from TipTap using `dangerouslySetInnerHTML`.

### Step 4: SEO Metadata
- Dynamically generate the `<title>` and `<meta name="description">` based on the page's title and excerpt.

## Verification Checklist
- [ ] Endpoint `GET /api/pages/{slug}` returns valid data.
- [ ] Storefront dynamic route catches the slug successfully.
- [ ] HTML content is sanitized and rendered properly with Markdown/TipTap styles.
- [ ] 404 page is displayed if a user navigates to a non-existent slug.
- [ ] SEO tags are correctly injected into the page head.
