# PetPosture — Canonical Product & Content Blueprint (v5)

> **Status**: current source of truth for positioning, taxonomy, content structure, and claim-safety rules. Supersedes any earlier positioning language still lingering in old copy/commits (the "posture/ergonomic health" framing described below under "Superseded direction").
> **Scope**: does not replace `ARCHITECTURE.md` (system design) or `RULES.md` (enforceable coding rules) — this file is *why* certain routes/labels/content exist the way they do; those two files are *how* the code is built. Cross-reference, don't duplicate.

## 1. Positioning

**Brand**: PetPosture
**Primary positioning**: *Better products for the way your dog is built.*
**Brand line**: *Because every dog is built differently.*

PetPosture is a **breed-focused product recommendation brand** that helps dog owners narrow down product choices using: Breed → Body Type → Everyday Challenge → Solution → Product Type → Product.

PetPosture is explicitly **not**: a general pet store, a veterinary-advice site, a medical-treatment site, a posture-correction brand, or a giant undifferentiated catalog.

### Superseded direction (do not reintroduce)

Earlier copy across the site described PetPosture as improving pets' "posture and health," used "Ergonomic Essentials" as a tagline, and implied medical/clinical benefit ("clinically tested," "vet-approved," "prevents injury," "IVDD"). That language is retired — see §7 (Claim Safety) for the full banned list and the reasoning. If you find leftover copy using this framing, it's drift, not intent — flag it.

## 2. Core user journey

```
Breed → Problem / Everyday Challenge → Solution → Product Type → Product → PetPosture Shop / Merchant
```

Example: *Dachshund → getting onto the sofa → Mobility → Dog Ramp → comparison/review → Shop or affiliate merchant.*

## 3. The 5 canonical breeds

| Breed | Slug | Body Type |
|---|---|---|
| Dachshund | `dachshund` | long-backed |
| French Bulldog | `french-bulldog` | flat-faced |
| Pug | `pug` | flat-faced |
| Corgi | `corgi` | long-backed |
| English Bulldog | `english-bulldog` | flat-faced |

**English Bulldog slug migration**: any older `bulldog` / `bulldogs` / `english-bulldogs` reference must normalize to `english-bulldog` — no duplicate indexable route for the same breed. 301 redirects exist in `frontend/next.config.ts` for both `/dogs/*` and `/shop/breeds/*` variants. The canonical DB row rename (not a migration — see `ARCHITECTURE.md`'s dated entry) has been applied to both local and production; if a fresh environment is ever seeded from scratch, `BreedSeeder.php` already writes the canonical `english-bulldog` row directly, so this migration note only matters for an *existing*, already-seeded database.

## 4. Body Type is not Breed

Body Type (`Flat-Faced Dogs`: French Bulldog/Pug/English Bulldog; `Long-Backed & Low-Bodied Dogs`: Dachshund/Corgi) is a **separate discovery/filter layer**, not a breed substitute. It never replaces Breed in a breed card, breed entity, breed URL, breed relation, or breed SEO landing page. It's used for the Homepage "Explore by Body Type" section, editorial cross-breed content, and `/shop/breeds/flat-faced` / `/shop/breeds/long-backed` (commerce-only, no editorial hub — that's intentional, not a gap).

## 5. The 4 canonical solutions

| Solution | Slug |
|---|---|
| Feeding | `feeding` |
| Comfort | `comfort` |
| Mobility | `mobility` |
| Walking | `walking` |

Public label is **"Solution"**, never **"Need"** — chosen so navigation/marketing copy doesn't read as clinical. (`Need` was the internal reasoning-chain term in an earlier internal strategy doc; it never belongs in a public-facing string.)

## 6. Parallel two-layer architecture (Editorial Hub vs. Commerce Collection)

This is the single most important structural decision in v5.

| Concept | Editorial / Discovery Hub | Commerce Collection |
|---|---|---|
| Breed | `/dogs/{breed}` | `/shop/breeds/{breed}` |
| Solution | `/solutions/{solution}` | `/shop/solutions/{solution}` |

**Editorial Hub** intent: learn / discover / understand / compare / navigate. Can contain context, everyday challenges, breed fit, product types, buying considerations, guides, comparisons, reviews, PetPosture Picks (only when real products are mapped), and a CTA into the matching Commerce Collection.

**Commerce Collection** intent: browse / filter / evaluate / buy. Product grid, filters, price, availability, variants, Add to Cart.

**No duplicate content** between an editorial hub and its commerce counterpart — they must have different search intent. Concretely: the commerce page's product-card blurb is a one-line DB `description`; the editorial hub's intro is a distinct, fuller paragraph (see `frontend/app/dogs/[slug]/page.tsx` and `frontend/app/solutions/[slug]/page.tsx` for the current implementation of both).

## 7. Claim safety — the non-negotiable list

**Never use** (in any customer-facing copy — components, blog content, product copy, admin-authored content):
`Vet-approved`, `Prevents injury`, `Protects spinal discs`, `Reduces breathing problems`, `Corrects posture`, `Prevents IVDD`, `Clinically proven`, or any medical-benefit claim without real supporting evidence. This includes the word **"posture"** used as an outcome/claim (the brand name itself is fine — see the `PetPosture` brand-name exception below).

**Prefer instead**: practical research, carefully selected, fit, usability, dimensions, materials, cleaning, everyday access, everyday comfort, product suitability.

**Brand-name exception**: "PetPosture" as a proper noun (logo, copyright line, "Welcome to PetPosture," email addresses) is always fine — the rule targets the word "posture" used as a claimed *outcome*, not the brand name itself.

**Evidence labels** (for review/trust content):
- **PetPosture Reviewed** — researched, specs reviewed, merchant/product analysis, not hands-on.
- **PetPosture Tested** — only with a real physical test record.
- **PetPosture Long-Term Tested** — only with real long-term usage evidence.
- Never claim `Verified Buyer`, a specific review count, or a specific average rating without real underlying data.

**This was audited and enforced 2026-08-20/21** across `/our-mission`, the Footer "About" blurb, `ShopPage.tsx`'s hero copy, `FaqsPage.tsx`'s guarantee name, `ProductReviews.tsx`'s placeholder text, and two live product-page components (`ScientificBreakdown.tsx`, `TrustBadgeBar.tsx`) that had fabricated clinical statistics ("Clinically tested to improve spinal alignment by 22%") and an unsupported "BVet Approved" badge — see `ARCHITECTURE.md`'s dated entry for the fix. **A production blog-post content audit found zero violations** on the (at the time) 2 real published posts — some *local-only mock/seed data* did contain violating language ("prevent long-term spinal issues," "IVDD-prone"), but that data never exists in production and was not touched.

## 8. Homepage discovery copy

| Old (retired) | v5 |
|---|---|
| `Shop by Breed` | **Explore by Breed** |
| `Shop by Solutions` | **Explore Solutions** |
| `View All Breeds` | **Explore All Breeds** |
| `View All Solutions` | **Explore All Solutions** |

Reasoning: this Homepage block is a discovery layer whose CTAs lead into the *editorial* hubs (`/dogs/{slug}`, `/solutions/{slug}`), not the shop — so it shouldn't say "Shop."

## 9. Header

Main nav stays `Home / Shop / Our Mission / Blog / Contact`. Do **not** add `Breeds`/`Solutions` as top-level nav items at this phase — they're reachable through Shop and through the Homepage discovery block. `Our Mission` already covers About/Brand Story/Mission/Method — no separate `About` page needed just to rename it.

## 10. Editorial Hub content specs

### Solution Hub (`/solutions/{slug}`) — minimum sections

1. H1 + intro (distinct prose, not the commerce blurb)
2. Common Challenges / Use Cases
3. Related Breeds ("Dogs We Focus On")
4. Product Types ("Explore Product Types")
5. What to Consider / buying considerations
6. Guides / Comparisons / Reviews (real posts only — omit the section if none exist, never a fake "coming soon" card)
7. PetPosture Picks — only when real products are mapped to that solution
8. Related Solutions (internal links to the other 3)
9. Commerce CTA → `/shop/solutions/{slug}` (always present, independent of whether Picks/Guides have content)

A page missing most of these is a "thin page" and should not be treated as done — this was the actual state before the 2026-08-21 rebuild (see `ARCHITECTURE.md`).

### Breed Hub (`/dogs/{breed}`) — minimum sections

1. H1 / Breed Overview (real `description` from the `breeds` table)
2. Why Product Fit Can Differ (breed-specific intro paragraph)
3. Common Everyday Challenges (breed-specific list)
4. Explore Solutions (links to all 4 solution hubs — every breed cross-links every solution; mobility/feeding emphasis differs by breed in the *content*, not in which links appear)
5. Recommended Product Types (curated subset, not every product type in the catalog)
6. Latest Breed Guides / PetPosture Picks — real data only, sections omitted (not empty-stated) when there's nothing to show
7. Explore by Body Type — computed from the breed's real `body_type` field, links to `/shop/breeds/flat-faced` or `/shop/breeds/long-backed`
8. Commerce CTA → `/shop/breeds/{breed}`

### Product Types (bridge layer between Solution and Product)

| Solution | Product Types |
|---|---|
| Feeding | Tilted Bowls, Slow Feeders, Water Fountains |
| Comfort | Supportive & Orthopedic Beds, Cooling Mats |
| Mobility | Dog Ramps, Dog Stairs, Dog Strollers |
| Walking | Dog Harnesses |

Product Type does not have its own route yet (`Explore Product Types` renders as static, unlinked chips on the editorial hubs) — that's a deliberate, not-yet-built future phase (see §12, Phase 4).

## 11. Content clusters (money content)

A cluster follows the internal-linking chain from §10's blueprint:

```
Solution Hub → Guide/Listicle → How-to-Choose → Comparison → Individual Review(s) → Shop Collection
```

**Comparison content must use real product data — never fabricated prices, ratings, or affiliate URLs.** Real published example: "Best Dog Ramps for Dachshunds" (`/blog/best-dog-ramps-for-dachshunds`) uses three real, currently-sold products with real Amazon/Chewy links and real (at-authoring-time) prices. If real per-SKU data isn't available yet, write the surrounding cluster pieces that *don't* require it first — a how-to-choose guide (general buying advice, no specific product needed) or a category-level comparison (ramps vs. stairs as concepts, not branded SKUs) — and either research real products (WebSearch a live retailer listing) or reuse already-verified real data from an existing post (e.g., a deeper single-product review of a pick already vetted in a comparison post) before publishing a comparison piece.

**First cluster built (2026-08-21): Dachshund Mobility.** All 4 pieces exist: the original comparison post (live), plus three new posts created as **drafts** pending review — `how-to-choose-a-dog-ramp`, `ramp-vs-stairs-for-dachshunds`, `priorpet-birchwood-dog-ramp-review`. The original post got two backlinks added into its existing "How to Choose a Ramp" section, pointing at the two new guide pieces, so the cluster interlinks in both directions. **Not yet published** — awaiting review, then flip Status → Published in Filament.

**Remaining clusters** (not started as of 2026-08-21): French Bulldog Feeding/Comfort, Pug Feeding/Comfort — both need real product research via WebSearch (no existing real comparison-item data to reuse for these categories yet).

## 12. Phasing (for anything not yet built)

1. **Breed** (done) — `breeds` table, Product↔Breed, Post↔Breed, canonical slug.
2. **Solution** (done) — `solutions` table, Product↔Solution, Post↔Solution, both route pairs.
3. **Content↔Product structured relations** (done, audited 2026-08-21) — `breed_product`/`solution_product`/`post_breed`/`post_solution` pivots all exist with working Eloquent relations both directions and Filament admin UI (Breed/Solution resources pick Products/Posts; **Post resource now also has Breeds/Solutions picker fields**, added 2026-08-21, closing the one missing direction).
4. **Product Intelligence** (not started) — `product_profiles`, suppliers, supplier products, product tests, evidence level. Do not start this without a concrete need — it's explicitly a later phase.
5. **Demand Intelligence** (not started) — affiliate click attribution rolled up by Breed × Solution × Product Type, article performance, conversion winners.

## 13. SEO / canonical rules

1. One concept → one canonical editorial route. A commerce route never duplicates its editorial hub's copy.
2. Old Bulldog-variant URLs 301, never 404 or duplicate-index.
3. Don't index a thin Solution/Breed hub — build the real content first (§10).
4. Don't mass-generate Breed × Product Type pages just to catch keywords.
5. Every page needs a genuinely unique search intent.
6. Internal links use canonical slugs only.

## 14. Non-negotiable rules (condensed)

1. Don't rebuild the site wholesale — extend Next.js + Laravel + Lunar + Filament + MySQL.
2. Don't hide Shop.
3. Laravel/MySQL is the source of truth — no parallel data store.
4. Breed and Body Type are not the same concept.
5. Public label is "Solution," never "Need."
6. Both Breed and Solution get an Editorial Hub *and* a Commerce Collection.
7. Homepage discovery CTAs into editorial hubs say "Explore," not "Shop."
8. `english-bulldog` is the only canonical Bulldog slug; old variants 301.
9. A Solution/Breed Hub is never a thin page.
10. No duplicate editorial/commerce copy.
11. "PetPosture Picks" only ever lists real, actually-mapped products.
12. "Tested"/"Verified" labels only with real evidence behind them.
13. No unsupported medical claims — see §7's full list.
14. Content should lead a reader from discovery → evaluation → commerce, not dead-end.
15. Product Type is the bridge layer between Solution and Product (not yet a routable page).

---

*This document consolidates and supersedes the working notes from the "v5" planning pass (2026-08-20/21 session). If a future decision changes something here, edit this file directly rather than letting a newer verbal decision drift out of sync with it.*
