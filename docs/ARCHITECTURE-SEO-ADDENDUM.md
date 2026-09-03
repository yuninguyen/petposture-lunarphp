# PETPOSTURE — ARCHITECTURE SEO ADDENDUM

> **Purpose:** Nội dung cần merge vào repo `ARCHITECTURE.md`.  
> `ARCHITECTURE.md` gốc không có trong workspace hiện tại nên tài liệu này không giả định hay ghi đè nội dung hiện có.

---

# 1. CANONICAL URL RESOLUTION

Architecture phải có một canonical resolver/service duy nhất.

Responsibilities:

- Product authoritative route;
- category validation;
- slug history redirects;
- canonical metadata;
- OG URL;
- JSON-LD entity URL;
- sitemap URL;
- internal Product links;
- Product card links;
- Related Product links;
- Admin preview URL.

Không để mỗi layer tự build URL độc lập.

---

# 2. AUTHORITATIVE SITEMAP

Architecture phải chọn một authoritative sitemap owner.

Requirements:

- canonical URLs only;
- indexable only;
- HTTP 200 only;
- pagination complete;
- real `lastModified`;
- no legacy taxonomy;
- no private/transactional routes;
- no redirect URLs.

Nếu Laravel và Next.js đều đang sinh sitemap, phải consolidate ownership hoặc có một orchestration contract rõ ràng; không cho hai hệ tự xuất các URL set mâu thuẫn.

---

# 3. PUBLIC SEO DTO

Laravel public API phải expose một normalized SEO DTO.

Consumers:

- Next.js metadata;
- JSON-LD;
- sitemap;
- preview where appropriate.

Admin SEO fields không được coi là complete nếu DTO/storefront chưa consume.

---

# 4. INDEXABILITY MODEL

Architecture phải có explicit indexability state:

```text
draft
published_noindex
published_indexable
```

hoặc equivalent field.

Indexability controls:

- robots HTML;
- sitemap inclusion;
- preview behavior.

---

# 5. TRUST / EVIDENCE RULES

Architecture must enforce:

- Verified requires verification evidence;
- Tested requires test record;
- aggregateRating requires eligible real reviews;
- affiliate link requires disclosure;
- comparison price/rating should carry provenance/update context;
- production never falls back to fabricated operational data.

---

# 6. AI SEO BOUNDARY

AI SEO is a helper, not source of truth.

AI must consume:

- Blueprint positioning;
- Claim Safety;
- real entity data;
- SEO page type/context.

AI must not override:

- canonical resolver;
- robots/indexability;
- evidence truth;
- real rating/price;
- sitemap;
- schema eligibility.

---

# 7. PAGE TYPE SEO CONTEXTS

Architecture should distinguish:

```text
blog_article
product
breed_editorial_hub
solution_editorial_hub
breed_commerce_collection
solution_commerce_collection
```

Do not reuse generic `blog` context for all editorial hubs.

---

# 8. TEST BOUNDARY

Contract invariants require integration/SSR tests covering:

- canonical redirects;
- SSR metadata;
- JSON-LD canonical consistency;
- sitemap inclusion/exclusion;
- noindex;
- review verification;
- rating evidence;
- fake fallback prevention;
- affiliate disclosure.

This addendum should be merged into the project architecture document after reconciling exact class/service names with the codebase.
