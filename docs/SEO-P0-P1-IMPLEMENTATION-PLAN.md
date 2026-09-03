# PETPOSTURE — SEO P0/P1 IMPLEMENTATION PLAN

> **Status:** Official execution plan  
> **Depends on:** Blueprint v5.1 + SEO Technical Contract v1  
> **Rule:** Không mở rộng content clusters hoặc AI SEO nâng cao trước khi Technical SEO Acceptance Gate pass.

---

# 1. EXECUTION ORDER

```text
P0 — Trust, Evidence & Canonical Emergency Fixes
↓
P0.5 — Define SEO Technical Contract
↓
P1 — Implement Contract End-to-End
↓
SSR / Canonical / Schema / Sitemap / Trust Tests
↓
Technical SEO Acceptance Gate
```

P0.5 được đáp ứng bởi `SEO-TECHNICAL-CONTRACT.md`.

---

# 2. P0 — TRUST, EVIDENCE & CANONICAL EMERGENCY FIXES

## P0.1 Product authoritative URL

Tasks:

- identify current Product route patterns;
- define one authoritative storefront route;
- validate route category/path against Product canonical category;
- wrong category → 301/308;
- old slug → 301/308;
- preserve redirect history;
- ensure canonical target returns 200;
- eliminate redirect chains;
- use canonical resolver for Product cards, related products and sitemap.

Acceptance:

- no duplicate Product 200 paths;
- invalid alternate routes redirect directly.

---

## P0.2 Remove production mock/fake fallback

Tasks:

- remove mock Product fallback in production;
- API error → explicit error state;
- empty API → explicit empty state;
- separate test fixtures from production seeders;
- remove default rating `5`;
- remove fabricated price/review count fallbacks.

Acceptance:

- no production page invents Product/review/price/rating data.

---

## P0.3 Review verification integrity

Tasks:

- render Verified only if `is_verified === true`;
- verification must link to order/evidence;
- admin default must not auto-verify;
- aggregate only approved/published eligible reviews;
- zero eligible reviews → no aggregateRating.

Acceptance:

- badge/schema/rating agree with review evidence.

---

## P0.4 Claims / positioning cleanup

Audit:

- global layout metadata;
- homepage copy;
- Product copy;
- FAQ;
- seeded/live settings;
- AI SEO prompt;
- social metadata fallback.

Retire unsupported framing:

```text
pet ergonomics
Ergonomic Essentials
posture and health
vet-approved
prevents injury
protects spinal discs
corrects posture
prevents IVDD
```

Replace with Blueprint language:

```text
breed-focused
practical research
carefully selected
fit
materials
dimensions
usability
cleaning
everyday access
everyday comfort
```

Acceptance:

- banned/retired positioning no longer generated or rendered unless supported context explicitly requires it.

---

## P0.5 Testing evidence

Tasks:

- Tested requires Product Test record;
- Long-Term Tested requires long-term evidence;
- Reviewed remains research-only label;
- audit existing live labels and seed data.

Acceptance:

- no unsupported Tested claim.

---

## P0.6 Affiliate/comparison integrity

Tasks:

- store/validate source provenance where applicable;
- maintain `source_url`;
- maintain `checked_at`;
- prohibit fabricated price/rating;
- affiliate link → disclosure automatically on;
- disclosure cannot be disabled when affiliate links exist.

Acceptance:

- affiliate/comparison content is traceable and disclosure-compliant.

---

## P0.7 AI SEO safety hotfix

Do now:

- replace `pet ergonomics` prompt framing;
- inject Blueprint positioning;
- inject Claim Safety;
- block unsupported medical/testing claims;
- block fabricated numeric evidence;
- keep advanced AI feature scope frozen.

Acceptance:

- AI can no longer create new strategic drift while P1 is being built.

---

# 3. P1 — IMPLEMENT SEO TECHNICAL CONTRACT END-TO-END

## P1.1 Decide primary admin and parity

Identify:

- React Admin responsibilities;
- Filament responsibilities;
- which UI is primary SEO authoring surface;
- parity requirements.

Rule:

> A field is not “implemented” until it persists, appears in Public API and is rendered by storefront.

---

## P1.2 Public SEO DTO

Create one normalized Public SEO DTO aligned with `SEO-TECHNICAL-CONTRACT.md`.

Must expose:

- title;
- description;
- canonical;
- robots;
- OG;
- Twitter;
- schema inputs/resolved schemas as architecture dictates;
- sitemap/indexability state.

---

## P1.3 Next.js SSR metadata

Implement:

```text
Laravel SEO DTO
→ Next.js generateMetadata
→ SSR HTML
```

Verify:

- title;
- description;
- canonical;
- robots;
- OG;
- Twitter;
- image fallback.

---

## P1.4 Canonical resolver

Create or formalize one resolver used by:

- redirects;
- metadata;
- sitemap;
- JSON-LD;
- Product cards;
- Related Products;
- admin preview;
- internal links.

No duplicate route-building logic.

---

## P1.5 Robots/indexability

Implement indexability states.

Noindex at minimum:

- account;
- cart;
- checkout;
- auth;
- preview;
- draft;
- private/transactional forms unless explicitly justified.

Noindex URLs excluded from sitemap.

---

## P1.6 Sitemap consolidation

Tasks:

- choose one authoritative sitemap;
- eliminate split URL ownership between Laravel/Next.js;
- fetch all pagination;
- use canonical resolver;
- remove redirects/noindex/private URLs;
- use real lastModified;
- add canonical 4 Solution editorial hubs;
- add 5 canonical Breed hubs as indexable-ready;
- migrate legacy Solution slugs;
- standardize `english-bulldog`.

---

## P1.7 JSON-LD / schema mapping

Implement page-type schema mapping:

- Homepage → Organization + WebSite;
- Breed/Solution Editorial → WebPage + BreadcrumbList;
- Commerce Collection → CollectionPage + BreadcrumbList;
- Product → Product + Offer + BreadcrumbList;
- Blog → BlogPosting/Article + BreadcrumbList;
- Comparison → Article + ItemList if justified;
- FAQ → FAQPage only when eligible.

Product:

- canonical storefront URL;
- real inventory;
- real price/currency;
- real rating only when eligible.

---

## P1.8 Canonical metadata consistency

Ensure:

```text
canonical tag
= OG URL
= JSON-LD URL
= sitemap URL
= internal canonical Product links
```

---

# 4. TEST PLAN

## 4.1 Canonical integration tests

- invalid Product category → direct 301/308;
- old Product slug → direct redirect;
- canonical target → 200;
- no duplicate 200 Product route;
- no redirect chain;
- canonical = OG = JSON-LD = sitemap.

## 4.2 SSR metadata tests

- custom admin title appears;
- custom description appears;
- custom OG image appears;
- noindex appears;
- fallback precedence passes.

## 4.3 Trust tests

- unverified review has no badge;
- zero eligible ratings → no aggregateRating;
- API error shows error state;
- empty collection shows empty state;
- no mock fallback;
- Tested requires record;
- affiliate disclosure always present.

## 4.4 Sitemap tests

- pagination complete;
- no redirect URLs;
- no noindex URLs;
- only 200 canonical URLs;
- 4 Solution editorial hubs;
- 5 canonical Breed hubs where indexable;
- no legacy Solution slug;
- `english-bulldog` canonical slug.

---

# 5. TECHNICAL SEO ACCEPTANCE GATE

P0/P1 only pass when:

- every Product has one authoritative public URL;
- all alternate Product URLs redirect directly;
- canonical URL returns 200;
- no redirect chain;
- metadata, OG, JSON-LD, sitemap and canonical internal links use same URL;
- robots/indexability render in SSR;
- noindex and redirects are excluded from sitemap;
- production has no mock/fake Product/review/rating/evidence;
- Verified/Tested labels are evidence-backed;
- rating schema is evidence-backed;
- affiliate disclosure invariant holds;
- automated/integration tests protect all of the above.

No content expansion before gate passes.

---

# 6. ALLOWED HUB CLEANUP BEFORE GATE

Still allowed during P0/P1:

- fix wrong claims;
- fix metadata;
- fix canonical;
- fix robots/schema;
- remove editorial/commerce duplicate copy;
- set thin pages noindex;
- fix taxonomy labels;
- fix canonical internal links;
- remove mock/fake content.

This is cleanup, not expansion.

---

# 7. AFTER THE GATE

Order:

1. Improve existing 4 Solution Hubs.
2. Improve existing 5 Breed Hubs.
3. Complete already-planned/draft clusters.
4. Expand evidence-backed clusters from real demand.
5. Add Product Type routes only with content/inventory justification.
6. Connect Search Console / Analytics feedback.
7. Add AI SEO/scoring/automation last.

---

# 8. OUT OF SCOPE UNTIL AFTER GATE

- mass-generated content;
- new Breed/Solution outside canonical set;
- AI scoring;
- AI internal-link automation;
- AI query ownership;
- automated SEO optimization;
- Product Type SEO page expansion;
- large content cluster expansion.

---

# 9. CHECKPOINT FORMAT

When reporting completion, do not say:

> “Canonical fixed.”

Report evidence:

```text
Product A canonical:
https://petposture.com/...

Alternate URL:
HTTP 308 → canonical

Canonical target:
HTTP 200

SSR canonical:
...

OG URL:
...

JSON-LD URL:
...

Sitemap URL:
...

Integration tests:
PASS
```

Same principle for review verification, schema and sitemap.
