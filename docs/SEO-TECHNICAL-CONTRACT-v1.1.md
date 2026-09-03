# PETPOSTURE — SEO TECHNICAL CONTRACT v1

> **Status:** Implementation contract  
> **Depends on:** `PetPosture-Canonical-Implementation-Blueprint-v5.1-AUTHORITATIVE.md`  
> **Purpose:** Định nghĩa một contract SEO kỹ thuật duy nhất cho Admin → Laravel → Next.js → SSR HTML → JSON-LD → Sitemap.

---

# 1. CONTRACT PRINCIPLE

Blueprint quyết định:

- page nào tồn tại;
- intent nào;
- taxonomy nào;
- claim nào được phép.

SEO Contract quyết định:

- metadata render thế nào;
- canonical URL là gì;
- robots/indexability;
- Open Graph/Twitter;
- JSON-LD;
- sitemap;
- fallback/preference;
- canonical resolver;
- tests.

---

# 2. PUBLIC SEO OBJECT

Reference shape:

```ts
type PublicSeo = {
  title: string;
  description: string;
  canonicalUrl: string;

  robots: {
    index: boolean;
    follow: boolean;
  };

  openGraph: {
    type: 'website' | 'article' | 'product';
    title: string;
    description: string;
    imageUrl?: string;
    url: string;
  };

  twitter: {
    card: 'summary' | 'summary_large_image';
    title: string;
    description: string;
    imageUrl?: string;
  };

  schemas: Record<string, unknown>[];

  sitemap: {
    include: boolean;
    lastModified?: string;
  };
};
```

Một indexable public entity chỉ có **một resolved SEO object**.

---

# 3. REQUIRED INVARIANTS

1. `canonicalUrl === openGraph.url`.
2. JSON-LD primary entity URL === `canonicalUrl`.
3. Sitemap URL === `canonicalUrl`.
4. Internal product links dùng `canonicalUrl`.
5. Canonical URL trả HTTP 200.
6. Alternate/legacy Product URLs 301/308 trực tiếp về canonical.
7. Không có redirect chain.
8. `robots.index === false` → sitemap `include === false`.
9. Redirect URL → sitemap `include === false`.
10. Sitemap chỉ chứa HTTP 200 canonical URLs.
11. Admin-authored metadata phải xuất hiện trong SSR HTML.
12. Schema chỉ chứa dữ liệu thật, visible/eligible trên page.
13. Không render `aggregateRating` khi không có eligible reviews.
14. Không render fake price, review count, Verified/Tested labels.
15. Page có affiliate links phải có affiliate disclosure.
16. Editorial/commerce page cùng topic phải có distinct metadata intent.

---

# 4. AUTHORITATIVE PRODUCT URL

Mỗi Product có đúng một storefront URL.

Ví dụ:

```text
Authoritative:
/shop/ramps/product-a

Invalid alternate:
/shop/beds/product-a

Response:
301/308 → /shop/ramps/product-a
```

Không chấp nhận:

```text
/shop/beds/product-a → HTTP 200
<link rel="canonical" href="/shop/ramps/product-a">
```

Canonical route normalization phải xảy ra ở **routing/request level**.

---

# 5. CANONICAL RESOLVER

## Product owner

Existing service:

```text
backend/app/Services/ProductRouteService.php
```

is the **official Product canonical route resolver for P0/P1**.

P0 must review and complete it rather than create a competing Product URL builder.

It must be reusable by:

- Product route validation/redirect;
- metadata canonical;
- Open Graph URL;
- sitemap data;
- Product cards;
- Related Products;
- Admin preview;
- internal Product links;
- JSON-LD composition inputs.

If a future generic `CanonicalUrlResolver` façade is introduced, it must delegate Product resolution to `ProductRouteService`.

No second service may independently construct Product canonical URLs.

---

# 6. METADATA PRECEDENCE / FALLBACK

## Product

### Title

```text
admin seo.title
→ product SEO title field
→ product name + PetPosture
→ site fallback
```

### Description

```text
admin seo.description
→ safe stripped product summary/description
→ controlled fallback
```

### OG title

```text
admin seo.og_title
→ resolved SEO title
```

### OG description

```text
admin seo.og_description
→ resolved SEO description
```

### OG image

```text
admin seo.og_image
→ primary product image
→ site default social image
```

### Canonical

```text
authoritative route resolver
```

### Product canonical override

During P0/P1, Product custom canonical override is **not supported**.

Product canonical always comes from `ProductRouteService`.

Any existing Product canonical field in Admin must be one of:

- hidden;
- read-only;
- explicitly marked future/unsupported.

Do not expose an editable control that the storefront ignores.

Editorial Blog/Page canonical override may be supported separately with validation:
- absolute URL;
- HTTPS in production;
- redirect/404 validation;
- cross-domain warning;
- sitemap ownership rules.

---

# 7. PAGE-TYPE MAPPING

| Page Type | Canonical Intent | Schema |
|---|---|---|
| Homepage | Brand / discovery | Organization, WebSite |
| Breed Editorial Hub | Learn / discover | WebPage, BreadcrumbList |
| Solution Editorial Hub | Learn / discover | WebPage, BreadcrumbList |
| Breed Commerce Collection | Browse / buy | CollectionPage, BreadcrumbList |
| Solution Commerce Collection | Browse / buy | CollectionPage, BreadcrumbList |
| Product | Buy / evaluate | Product, Offer, BreadcrumbList |
| Blog Guide | Informational/commercial editorial | BlogPosting or Article, BreadcrumbList |
| Comparison | Compare | Article; ItemList when appropriate |
| FAQ | Support content | WebPage; FAQPage only when policy/markup applies |
| Legal | Legal | WebPage |

---

# 7A. JSON-LD OWNERSHIP

## Laravel owns domain schema facts

Laravel determines eligibility and provides domain facts such as:

```json
{
  "schema": {
    "product": {
      "name": "...",
      "sku": "...",
      "price": "...",
      "currency": "USD",
      "availability": "...",
      "aggregateRating": null
    }
  }
}
```

Laravel is authoritative for:

- product/review data eligibility;
- approved review aggregation;
- price/currency;
- inventory/availability;
- SKU;
- testing/evidence eligibility.

## Next.js owns final public graph composition

Next.js composes:

- WebPage;
- Product;
- BreadcrumbList;
- Organization/WebSite references;
- canonical public URLs.

Next.js must not independently recompute review eligibility, rating aggregates, price truth, or testing evidence.


---

# 8. INTENT-SPECIFIC METADATA GUARDRAILS

## Breed Editorial Hub

Example intent:

```text
Dachshund product guidance
```

Possible title:

```text
Products & Buying Guides for Dachshunds | PetPosture
```

Không dùng title thiên commerce như:

```text
Shop Dachshund Products
```

## Breed Commerce Collection

Possible title:

```text
Shop Products for Dachshunds | PetPosture
```

Không dùng:

```text
Complete Dachshund Product Guide
```

Tương tự với Solution editorial vs commerce.

---

# 9. ROBOTS / INDEXABILITY

Use existing Product status + SEO flags where sufficient. Do not add a duplicate enum solely to represent the same state.

Resolved Product rules:

```text
status != published
→ noindex, nofollow
→ sitemap exclude

status == published && seo.is_indexable == false
→ noindex
→ follow according to seo.is_followable/policy
→ sitemap exclude

status == published && seo.is_indexable == true
→ index
→ follow according to seo.is_followable
→ sitemap eligible only if canonical URL is valid and HTTP 200
```

Other rules:

- account/cart/checkout/auth → noindex;
- preview/draft → noindex;
- transactional return/request forms → noindex unless explicitly justified;
- `robots.txt Disallow` is not a substitute for HTML/meta `noindex`.

The resolved SEO object is the single output consumed by storefront and sitemap logic.

---

# 10. SITEMAP CONTRACT

## Authoritative owner

**Public sitemap owner: Next.js storefront.**

Public endpoint:

```text
/sitemap.xml
```

Laravel provides a sitemap-oriented API/DTO containing:

- canonical path;
- indexability;
- published state;
- entity type;
- real updated/modified time.

Next.js is responsible for:

- joining public `SITE_URL`;
- rendering sitemap/sitemap index;
- pagination over all Laravel sitemap data;
- splitting sitemap when required;
- emitting only storefront-domain canonical URLs.

Any legacy public backend sitemap must be retired or permanently redirected after migration validation.

Sitemap must:

- contain canonical URLs only;
- contain indexable URLs only;
- contain HTTP 200 URLs only;
- exclude redirect URLs;
- exclude noindex URLs;
- exclude private/transactional routes;
- use real `lastModified`;
- include all 4 canonical Solution editorial hubs;
- include canonical Breed hubs;
- remove legacy solution slugs:
  - `eating-digestion`
  - `mobility-support`
  - `comfort-safety`;
- use `english-bulldog` canonical breed slug.

---

# 11. SCHEMA CONTRACT

## Product

Required data when available/eligible:

- canonical storefront URL;
- real product name;
- real image;
- real Offer;
- real price;
- real currency;
- real availability/inventory representation;
- real eligible aggregate rating only when reviews exist;
- BreadcrumbList.

Do not output:

- fabricated rating;
- default rating = 5;
- fake review count;
- non-visible price;
- legacy `/products/{slug}` if storefront canonical differs.

## Editorial Hubs

Use:

```text
WebPage
BreadcrumbList
```

Do not force Product schema onto editorial hubs.

---

# 12. REVIEW / EVIDENCE CONTRACT

`Verified` badge only when:

```text
review.is_verified === true
```

Verification must have evidence/order linkage or equivalent provenance.

Rating aggregation:

- approved/published eligible reviews only;
- zero eligible reviews → no aggregateRating;
- no fake default values.

Testing labels:

- Reviewed = researched;
- Tested = physical test record exists;
- Long-Term Tested = long-term evidence exists.

---

# 13. AFFILIATE / COMPARISON PROVENANCE

For affiliate/comparison items, preserve where applicable:

```text
source_url
checked_at
merchant
price source
rating source
```

Rules:

- affiliate link present → disclosure mandatory;
- UI/admin cannot disable required disclosure;
- stale prices/ratings must not be presented as current without provenance/update timestamp;
- AI cannot invent merchant/price/rating data.

---

# 14. AI SEO SAFETY CONTRACT

Immediate P0 prompt baseline:

```text
PetPosture is a breed-focused product recommendation brand
that helps dog owners narrow product choices based on how
their dog is built, everyday challenges, practical fit,
dimensions, materials, usability, cleaning, and access.

Never make veterinary, clinical, injury-prevention,
posture-correction, testing, or unsupported health claims.
Never invent ratings, review counts, prices, test evidence,
merchant availability, or numerical proof.
```

Retire:

```text
pet ergonomics
Ergonomic Essentials
posture and health
```

Advanced AI features remain out of scope until after Technical SEO Acceptance Gate.

---

# 15. ADMIN → PUBLIC PIPELINE

Required flow:

```text
Admin UI / Filament
        ↓
Laravel persistence
        ↓
Public API SEO DTO
        ↓
Next.js generateMetadata
        ↓
SSR HTML
        ↓
JSON-LD
        ↓
Sitemap / internal links
```

If multiple admin UIs exist, define primary admin and parity requirements.

No admin field may be considered implemented until storefront/API consume it.

---

# 16. ACCEPTANCE TESTS

## Canonical

- wrong Product category redirects;
- old Product slug redirects;
- no duplicate Product 200 routes;
- canonical URL returns 200;
- no redirect chain;
- canonical = OG URL = JSON-LD URL = sitemap URL.

## Metadata SSR

- custom SEO title visible in rendered HTML;
- custom description visible;
- custom OG image used;
- `noindex` visible when configured;
- fallback precedence behaves as contract.

## Trust

- non-verified review has no Verified badge;
- no eligible rating → no aggregateRating;
- API error → error state, not mock products;
- empty collection → empty state, not unrelated products;
- Tested requires test record;
- affiliate link always shows disclosure.

## Sitemap

- pagination fully fetched;
- no redirects;
- no noindex URLs;
- canonical only;
- 4 Solution editorial hubs included;
- canonical Breed hubs included;
- no legacy solution slugs;
- `english-bulldog` used.

---

# 17. QUERY OWNERSHIP

Maintain a query ownership map before creating new SEO pages.

Example:

| Query Cluster | Primary Owner |
|---|---|
| dachshund products / products for dachshunds | `/shop/breeds/dachshund` |
| dachshund product guide | `/dogs/dachshund` |
| dog ramps for dachshunds | relevant guide/comparison |
| how to choose a dog ramp | how-to guide |
| dog ramp vs dog stairs | comparison |
| named product review | individual review |
| dog ramps | future Product Type page only when justified |

Focus keyphrase is secondary to ownership and intent.

---

# 18. MEASUREMENT CONTRACT

After Technical SEO Acceptance Gate, connect:

- Search Console impressions;
- clicks;
- CTR;
- average position;
- indexed/not indexed;
- Google-selected canonical;
- query overlap/cannibalization;
- rich-result validity;
- content decay;
- organic conversion;
- affiliate conversion;
- Shop conversion.

This feedback loop informs content expansion; it does not replace Blueprint page-intent rules.
