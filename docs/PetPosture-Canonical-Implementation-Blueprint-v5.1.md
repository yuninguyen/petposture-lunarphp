# PETPOSTURE — CANONICAL IMPLEMENTATION BLUEPRINT v5

> **Status:** CURRENT SOURCE OF TRUTH — Strategy/IA/Content + SEO invariants  
> **Purpose:** Tài liệu chuẩn để tiếp tục code, content, taxonomy, SEO và homepage PetPosture theo hướng đã chốt.  
> **Supersedes:** Các quyết định mâu thuẫn trong blueprint cũ liên quan đến `Need`, `Shop by Breed`, `Shop by Solutions`, Solution Hub và slug Bulldog.  
> **Core principle:** Không rebuild website. Giữ Next.js + Laravel + Lunar + Filament + MySQL, nhưng tổ chức lại discovery/content/data theo Breed → Problem → Solution → Product Type → Product.

---

# 1. POSITIONING CHỐT

## Brand

**PetPosture**

## Primary positioning

> **Better products for the way your dog is built.**

## Brand line

> **Because every dog is built differently.**

## PetPosture là gì?

PetPosture là **breed-focused product recommendation brand** giúp chủ nuôi thu hẹp lựa chọn sản phẩm dựa trên:

- Breed
- Body Type
- Everyday Challenge
- Solution
- Product Type
- Practical use

PetPosture **không** định vị là:

- general pet store;
- veterinary advice website;
- medical treatment website;
- posture-correction brand;
- giant product catalog.

---

# 2. CORE USER JOURNEY

Public-facing journey:

```text
Breed
→ Problem / Everyday Challenge
→ Solution
→ Product Type
→ Product
→ PetPosture Shop / Merchant
```

Ví dụ:

```text
Dachshund
→ Getting onto the sofa
→ Mobility
→ Dog Ramp
→ Compare / Review / Recommendation
→ PetPosture Shop or affiliate merchant
```

Hoặc:

```text
French Bulldog
→ Eating too quickly
→ Feeding
→ Slow Feeder
→ Guide / Comparison
→ PetPosture Shop or affiliate merchant
```

---

# 3. 5 BREEDS CHÍNH THỨC

Canonical breed entities:

1. Dachshund
2. French Bulldog
3. Pug
4. Corgi
5. English Bulldog

## Canonical slugs

```text
dachshund
french-bulldog
pug
corgi
english-bulldog
```

## Bulldog slug migration

Mọi slug cũ dùng:

```text
bulldog
bulldogs
english-bulldogs
```

nếu đang tồn tại public/live, phải được chuẩn hóa về:

```text
english-bulldog
```

### Required migration behavior

- 301 redirect route cũ → canonical route mới.
- Update internal links.
- Update sitemap.
- Update canonical URL.
- Update breadcrumbs.
- Update Breed relations.
- Update Shop Breed links.
- Update Blog/Post mappings.
- Không tạo duplicate route indexable cho cùng một breed.

Canonical examples:

```text
/dogs/english-bulldog
/shop/breeds/english-bulldog
```

> Nếu codebase hiện tại có convention trailing slash hoặc plural route khác, giữ convention kỹ thuật nhất quán nhưng **entity slug canonical vẫn là `english-bulldog`**.

---

# 4. BODY TYPE KHÔNG PHẢI BREED

Body Type là discovery/filter layer riêng.

## Flat-Faced Dogs

- French Bulldog
- Pug
- English Bulldog

## Long-Backed & Low-Bodied Dogs

- Dachshund
- Corgi

Body Type không được thay thế Breed trong:

- Breed cards;
- Breed entity;
- Breed URL;
- Breed relation;
- Breed SEO landing page.

Body Type dùng cho:

- Explore by Body Type;
- editorial grouping;
- filtering;
- cross-breed content.

---

# 5. 4 SOLUTIONS CHÍNH THỨC

Public-facing terminology:

```text
Feeding
Comfort
Mobility
Walking
```

Không dùng các label cũ như:

```text
Need
Eating & Digestion
Comfort & Safety
Mobility & Support
```

ở public navigation nếu không có lý do migration kỹ thuật.

## Canonical solution slugs

```text
feeding
comfort
mobility
walking
```

---

# 6. BREED VÀ SOLUTION DÙNG PARALLEL 2-LAYER ARCHITECTURE

Đây là quyết định kiến trúc quan trọng nhất của v5.

## Breed

```text
/dogs/{breed}
= Editorial / Discovery Breed Hub

/shop/breeds/{breed}
= Commerce Breed Collection
```

## Solution

```text
/solutions/{solution}
= Editorial / Discovery Solution Hub

/shop/solutions/{solution}
= Commerce Solution Collection
```

## Parallel structure

| Editorial / Discovery | Commerce |
|---|---|
| `/dogs/dachshund` | `/shop/breeds/dachshund` |
| `/dogs/french-bulldog` | `/shop/breeds/french-bulldog` |
| `/solutions/feeding` | `/shop/solutions/feeding` |
| `/solutions/mobility` | `/shop/solutions/mobility` |

---

# 7. EDITORIAL VS COMMERCE INTENT

## Editorial Hub

Mục tiêu:

```text
Learn
Discover
Understand
Compare
Navigate
```

Editorial Hub có thể chứa:

- context;
- challenge;
- use case;
- breed fit;
- product types;
- buying considerations;
- guides;
- comparisons;
- reviews;
- PetPosture Picks;
- CTA sang Shop.

## Commerce Collection

Mục tiêu:

```text
Browse
Filter
Evaluate products
Buy
```

Commerce Collection tập trung vào:

- product grid;
- filters;
- price;
- availability;
- variants;
- Add to Cart;
- product merchandising.

## Không duplicate content

Không copy nguyên một đoạn intro giữa:

```text
/solutions/feeding
```

và:

```text
/shop/solutions/feeding
```

Hai URL phải có search intent khác nhau.

---

# 8. HOMEPAGE — DISCOVERY COPY CHỐT

Các label live cần đổi:

| Hiện tại | v5 chốt |
|---|---|
| `Shop by Breed` | **Explore by Breed** |
| `Shop by Solutions` | **Explore Solutions** |
| `View All Breeds` | **Explore All Breeds** |
| `View All Solutions` | **Explore All Solutions** |

## Vì sao?

Homepage block này là **discovery layer** và CTA dẫn vào editorial hubs:

```text
/dogs/{slug}
/solutions/{slug}
```

nên không được dùng chữ `Shop`.

---

# 9. HOMEPAGE STRUCTURE CHỐT

```text
TOP UTILITY BAR

HEADER
HOME
SHOP
OUR MISSION
BLOG
CONTACT
+ Search / Wishlist / Account / Cart
+ Support utility

↓

HERO
Better products for the way your dog is built.

[Find Your Breed]
[Explore Solutions]

↓

TRUST STRIP
Breed-Focused
Curated Selection
30-Day Guarantee*
Free Shipping $50+*

↓

FIND WHAT FITS YOUR DOG

[Explore by Breed]
Dachshund
French Bulldog
Pug
Corgi
English Bulldog
[Explore All Breeds]

[Explore Solutions]
Feeding
Comfort
Mobility
Walking
[Explore All Solutions]

↓

WHY PETPOSTURE
Breed-Focused
Practical Research
Carefully Selected
Transparent Reviews

↓

PETPOSTURE PICKS

↓

PETPOSTURE APPROACH
Not every product fits every dog the same way.

↓

EXPLORE BY BODY TYPE
Flat-Faced Dogs
Long-Backed & Low-Bodied Dogs

↓

LATEST PETPOSTURE GUIDES

↓

CUSTOMER REVIEWS
Only verified real reviews

↓

NEWSLETTER

↓

FULL FOOTER

↓

BOTTOM BAR
KEEP
```

\* Chỉ giữ Guarantee / Free Shipping khi policy live thực sự đúng.

---

# 10. HEADER CHỐT

Không thêm `BREEDS` và `SOLUTIONS` thành top-level navigation ở phase hiện tại.

Main nav:

```text
HOME
SHOP
OUR MISSION
BLOG
CONTACT
```

Giữ utility/action:

- Support
- Business hours
- Phone nếu đang dùng
- Search
- Wishlist
- Account
- Cart

## Our Mission

`Our Mission` hiện đóng vai trò:

```text
About
Brand Story
Mission
Method
Why PetPosture Exists
```

Không cần tạo thêm `About` top-level chỉ để đổi tên.

---

# 11. SOLUTION HUB SPEC — BẮT BUỘC

Mỗi:

```text
/solutions/{slug}
```

phải có nội dung thật.

Không chấp nhận page kiểu:

```text
H1
1 câu mô tả
Recommended Products
No products selected
```

## Minimum content spec

Mỗi Solution Hub phải có:

1. H1 + introductory positioning
2. Common Challenges / Use Cases
3. Related Breeds
4. Product Types
5. What to Consider / Buying Considerations
6. Guides / Comparisons / Reviews
7. PetPosture Picks — chỉ khi có mapping thật
8. Related Solution links — optional
9. Commerce CTA
10. Internal links có chủ đích

---

# 12. TEMPLATE CHUẨN CHO `/solutions/{slug}`

```text
H1

INTRO
What this solution area covers.

COMMON CHALLENGES
What owners may be trying to solve.

DOGS WE FOCUS ON
Relevant breeds.

EXPLORE PRODUCT TYPES
Relevant product categories.

WHAT TO CONSIDER
Practical buying considerations.

LATEST GUIDES & COMPARISONS
Relevant editorial content.

PETPOSTURE PICKS
Only if actual mapped products exist.

RELATED SOLUTIONS
Optional.

READY TO SHOP?
Shop [Solution] Products →
/shop/solutions/{slug}
```

---

# 13. `/solutions/feeding` CONTENT SPEC

## H1

**Feeding Solutions for Dogs**

## Intro intent

Giúp owner khám phá sản phẩm và guide liên quan đến cách chó ăn và uống trong đời sống hằng ngày.

Không claim medical outcomes.

## Common Challenges

- Eating too quickly
- Bowl shape and accessibility
- Messy drinking
- Choosing bowl height or angle
- Stability during mealtime
- Ease of cleaning

## Related Breeds

- French Bulldog
- Pug
- English Bulldog
- Dachshund
- Corgi

## Product Types

- Tilted Bowls
- Slow Feeders
- Water Fountains

## What to Consider

- bowl material;
- bowl depth;
- angle;
- stability;
- cleaning;
- size;
- capacity;
- floor grip;
- replacement filters where relevant.

## Guide examples

- Best Slow Feeders for Pugs
- Best Tilted Bowls for French Bulldogs
- Tilted vs Elevated Dog Bowls
- How to Choose a Bowl for a French Bulldog
- Best Water Fountains for Small Dogs

## Commerce CTA

```text
Shop Feeding Products →
/shop/solutions/feeding
```

---

# 14. `/solutions/comfort` CONTENT SPEC

## H1

**Comfort Solutions for Dogs**

## Common Challenges

- Finding a comfortable resting surface
- Warm-weather comfort
- Choosing bed size and shape
- Easy-clean resting products
- Finding practical sleeping/resting options for different body shapes

## Related Breeds

All 5 breeds, with especially strong relevance for:

- French Bulldog
- Pug
- English Bulldog
- Dachshund

## Product Types

- Supportive & Orthopedic Beds
- Cooling Mats

## What to Consider

- size;
- thickness;
- foam/support structure;
- cover;
- washability;
- material;
- temperature behavior;
- durability;
- ease of cleaning.

## Guide examples

- Best Supportive Beds for Dachshunds
- Best Cooling Mats for French Bulldogs
- Best Cooling Mats for Pugs
- How to Choose a Dog Bed
- Supportive vs Memory Foam Dog Beds

## Commerce CTA

```text
Shop Comfort Products →
/shop/solutions/comfort
```

---

# 15. `/solutions/mobility` CONTENT SPEC

## H1

**Mobility Solutions for Dogs**

## Common Challenges

- Getting onto sofas or beds
- Furniture access
- Navigating steps
- Travel access
- Choosing between ramps and stairs
- Product dimensions for short-legged / low-bodied dogs

## Related Breeds

Primary:

- Dachshund
- Corgi

Secondary where relevant:

- French Bulldog
- Pug
- English Bulldog

## Product Types

- Dog Ramps
- Dog Stairs
- Dog Strollers

## What to Consider

- height;
- incline;
- width;
- grip;
- stability;
- weight capacity;
- foldability;
- portability;
- storage;
- product dimensions.

## Guide examples

- Best Dog Ramps for Dachshunds
- Best Dog Stairs for Dachshunds
- Ramp vs Stairs for Dachshunds
- How to Choose a Dog Ramp
- Best Dog Ramps for Corgis

## Commerce CTA

```text
Shop Mobility Products →
/shop/solutions/mobility
```

---

# 16. `/solutions/walking` CONTENT SPEC

## H1

**Walking Solutions for Dogs**

## Common Challenges

- Finding a comfortable harness fit
- Adjustment and sizing
- Everyday walking control
- Ease of putting on and taking off
- Fit differences across body shapes

## Related Breeds

All 5:

- Dachshund
- French Bulldog
- Pug
- Corgi
- English Bulldog

## Product Types

- Dog Harnesses

Future product types chỉ thêm khi có reason/data.

## What to Consider

- sizing;
- adjustment points;
- chest shape;
- strap placement;
- buckle quality;
- material;
- ease of use;
- leash attachment;
- washability.

## Guide examples

- Best Harnesses for French Bulldogs
- Best Harnesses for Dachshunds
- Best Harnesses for Pugs
- Best Harnesses for Corgis
- How to Choose a Harness for a French Bulldog

## Commerce CTA

```text
Shop Walking Products →
/shop/solutions/walking
```

---

# 17. BREED HUB SPEC

`/dogs/{breed}` là editorial hub.

Minimum sections:

```text
H1 / Breed Overview

Why Product Fit Can Differ

Common Everyday Challenges

Explore Solutions
- Feeding
- Comfort
- Mobility
- Walking

Recommended Product Types

Latest Breed Guides

PetPosture Picks
if mapped

Explore by Body Type
if relevant

Shop Breed Products →
/shop/breeds/{breed}
```

---

# 18. PRODUCT TYPE LAYER

Core Product Types:

## Feeding

- Tilted Bowls
- Slow Feeders
- Water Fountains

## Comfort

- Supportive & Orthopedic Beds
- Cooling Mats

## Mobility

- Dog Ramps
- Dog Stairs
- Dog Strollers

## Walking

- Dog Harnesses

Product Type là bridge giữa Solution và Product.

Journey:

```text
Solution
→ Product Type
→ Guide / Comparison
→ Product
```

---

# 19. TAXONOMY CHỐT

## Category

Dùng cho loại content:

- Buying Guides
- Product Reviews
- Comparisons
- Breed Guides
- PetPosture

## Breed

Structured entity:

- Dachshund
- French Bulldog
- Pug
- Corgi
- English Bulldog

## Solution

Structured entity:

- Feeding
- Comfort
- Mobility
- Walking

## Body Type

Structured entity hoặc controlled taxonomy:

- Flat-Faced
- Long-Backed & Low-Bodied

## Product Type

Structured taxonomy/entity.

## Tags

Chỉ dùng cho secondary/cross-cutting topics.

Không dùng Tags để thay Breed/Solution/Product Type lâu dài.

---

# 20. DATABASE / DOMAIN MODEL DIRECTION

Source of truth:

```text
Laravel + MySQL
```

Không tạo master database song song bên ngoài.

Core relation map:

```text
Breed
↔ Solution
↔ Product Type
↔ Lunar Product
↔ Post
↔ Affiliate Merchant
↔ Supplier
↔ Product Test
↔ Demand / Conversion Data
```

---

# 21. CODE PHASING CHỐT

## Phase 1 — Breed

- `breeds`
- Product ↔ Breed
- Post ↔ Breed
- canonical slug normalization
- English Bulldog migration

## Phase 2 — Solution

- `solutions`
- Product ↔ Solution
- Post ↔ Solution
- `/solutions/{slug}`
- `/shop/solutions/{slug}` mapping

## Phase 3 — Content ↔ Product

- `post_product`
- relation type
- featured
- position

## Phase 4 — Product Intelligence

- `product_profiles`
- suppliers
- supplier products
- product tests
- evidence level

## Phase 5 — Demand Intelligence

- affiliate click attribution
- Breed × Solution
- Solution × Product Type
- article performance
- Shop conversion
- product/category winners

---

# 22. API DIRECTION

Target public API/domain endpoints:

```text
GET /breeds
GET /breeds/{slug}

GET /solutions
GET /solutions/{slug}
```

Optional:

```text
GET /breeds/{slug}/products
GET /breeds/{slug}/posts

GET /solutions/{slug}/products
GET /solutions/{slug}/posts
```

Không rewrite Product API chỉ để support taxonomy.

---

# 23. FILAMENT DIRECTION

```text
COMMERCE
- Products
- Orders
- Customers
- Returns

CONTENT
- Posts
- Categories
- Tags
- Pages
- Affiliate

PETPOSTURE
- Breeds
- Solutions
- Body Types
- Product Types
- Product Intelligence
- Suppliers
- Product Tests

REPORTS
- Affiliate Demand
- Breed Demand
- Solution Demand
- Product Performance
```

---

# 24. CLAIM SAFETY

Không dùng unsupported claims như:

- Vet-approved
- Prevents injury
- Protects spinal discs
- Reduces breathing problems
- Corrects posture
- Prevents IVDD
- Clinically proven
- Medical benefit claims không có evidence

Ưu tiên:

- practical research;
- carefully selected;
- fit;
- usability;
- dimensions;
- materials;
- cleaning;
- everyday access;
- everyday comfort;
- product suitability.

---

# 25. REVIEW / TEST TRANSPARENCY

Evidence labels:

## PetPosture Reviewed

- researched;
- specifications reviewed;
- merchant/product analysis;
- chưa hands-on.

## PetPosture Tested

Chỉ khi có physical test record thật.

## PetPosture Long-Term Tested

Chỉ khi có long-term usage evidence thật.

Không dùng:

```text
Verified Buyer
10,000+ reviews
4.9 average rating
```

nếu không có data thật.

---

# 26. SHOP VS EDITORIAL CTA

## Editorial Breed Hub

```text
Explore Guides
View Product Types
Shop [Breed] Products
```

## Editorial Solution Hub

```text
Explore Guides
Compare Product Types
Shop [Solution] Products
```

## Commercial Article

Primary:

```text
Compare Prices
```

Secondary:

```text
Shop PetPosture Picks
```

## PetPosture Product

Primary:

```text
Add to Cart
```

---

# 27. INTERNAL LINKING

Solution example:

```text
/solutions/mobility
↓
Best Dog Ramps for Dachshunds
↓
How to Choose a Dog Ramp
↓
Ramp vs Stairs
↓
Individual Reviews
↓
/shop/solutions/mobility
```

Breed example:

```text
/dogs/dachshund
↓
Mobility Solution
↓
Best Dog Ramps for Dachshunds
↓
Product Review
↓
/shop/breeds/dachshund
```

Không để editorial pages thành islands.

---

# 28. SEO CANONICAL RULES

1. Một concept chỉ có một canonical editorial route.
2. Commerce route không copy editorial hub.
3. Old Bulldog routes phải 301.
4. Không index thin Solution Hub nếu content chưa đủ giá trị.
5. Không tạo hàng loạt breed × product page chỉ thay từ khóa.
6. Mỗi page phải có unique search intent và information.
7. Internal links dùng canonical slugs.

---

# 29. SOCIAL / WEBSITE RELATION

Website là source of truth.

Social platforms:

- Facebook
- Instagram
- Pinterest
- TikTok
- YouTube

là distribution layer.

Không tạo 5 Welcome pages riêng trên website.

Launch article hiện tại:

```text
/blog/dog-products-by-breed
```

có thể đóng vai trò brand introduction article.

---

# 30. EXECUTION ORDER TỪ THỜI ĐIỂM v5

## P0 — Normalize live taxonomy

- đổi homepage labels:
  - Explore by Breed
  - Explore Solutions
  - Explore All Breeds
  - Explore All Solutions
- chuẩn hóa English Bulldog slug;
- redirect old Bulldog URLs;
- kiểm tra internal links.

## P1 — Build real Solution Hubs

Theo thứ tự:

1. `/solutions/feeding`
2. `/solutions/mobility`
3. `/solutions/comfort`
4. `/solutions/walking`

Mỗi page phải đạt spec mục 11–16.

## P2 — Breed Hub consistency

Kiểm tra 5 `/dogs/{slug}` có:

- breed-specific intro;
- challenges;
- solution mappings;
- guides;
- product types;
- shop CTA.

## P3 — Commerce separation

Đảm bảo:

```text
/shop/breeds/{slug}
/shop/solutions/{slug}
```

là commerce pages thực sự, không duplicate editorial hubs.

## P4 — Structured relations

- Breed ↔ Post
- Breed ↔ Product
- Solution ↔ Post
- Solution ↔ Product
- Post ↔ Product

## P5 — Content cluster expansion

Bắt đầu money clusters:

- Dachshund Mobility
- French Bulldog Feeding / Comfort
- Pug Feeding / Comfort

---

# 31. NON-NEGOTIABLE RULES

1. **Không rebuild toàn bộ website.**
2. **Không ẩn Shop.**
3. **Không dùng Shopify.**
4. **Laravel/MySQL là source of truth.**
5. **Breed và Body Type không phải một.**
6. **Public label dùng Solution, không Need.**
7. **Breed và Solution đều có Editorial Hub + Commerce Collection.**
8. **Homepage discovery dùng Explore, không Shop, khi CTA vào editorial hub.**
9. **English Bulldog là canonical breed; slug canonical = `english-bulldog`.**
10. **Old Bulldog URLs phải redirect.**
11. **Solution Hub không được là thin page.**
12. **Không duplicate editorial copy với Shop collection.**
13. **PetPosture Picks chỉ dùng sản phẩm thực sự mapped/selected.**
14. **Tested chỉ dùng khi có test thật.**
15. **Verified reviews chỉ dùng khi có review thật.**
16. **Không dùng unsupported medical claims.**
17. **Content phải dẫn user từ discovery → evaluation → commerce.**
18. **Product Type là bridge giữa Solution và Product.**
19. **Không mở Cat ở phase hiện tại.**
20. **Không mở giant catalog chỉ để làm site trông đầy.**

---

# 32. CURRENT SOURCE-OF-TRUTH DIAGRAM

```text
                         PETPOSTURE
                              │
               ┌──────────────┴──────────────┐
               │                             │
             BREEDS                       SOLUTIONS
               │                             │
      /dogs/{breed}              /solutions/{solution}
       Editorial Hub               Editorial Hub
               │                             │
               ├──────────┬──────────────────┤
                          ↓
                     PRODUCT TYPE
                          ↓
            Guides / Reviews / Comparisons
                          ↓
                       PRODUCT
                    ↙           ↘
           PETPOSTURE SHOP     AFFILIATE
                    │
        ┌───────────┴───────────┐
        │                       │
/shop/breeds/{breed}   /shop/solutions/{solution}
        │                       │
        └───────────┬───────────┘
                    ↓
                  ORDER
                    ↓
             BEHAVIOR / DEMAND DATA
                    ↓
             PRODUCT INTELLIGENCE
                    ↓
          WINNING PRODUCTS / PRIVATE LABEL
```

---

# 33. NEXT ACTION

Không tiếp tục tranh luận taxonomy ở mức abstract.

**Action ngay:**

```text
1. Normalize homepage labels
2. Normalize English Bulldog slug + redirects
3. Build `/solutions/feeding` theo full editorial spec
4. Review template
5. Reuse template cho Mobility
6. Reuse template cho Comfort
7. Reuse template cho Walking
8. Sau đó mới hoàn thiện Product/Solution mappings
```

Checkpoint đầu tiên:

> **`/solutions/feeding` phải trở thành Editorial Solution Hub hoàn chỉnh, khác rõ ràng với `/shop/solutions/feeding`.**

Đây là hướng triển khai chuẩn của PetPosture từ v5 trở đi.

---

# 34. SEO IMPLEMENTATION INVARIANTS

Blueprint này quyết định **page nào tồn tại, phục vụ intent nào và được phép nói gì**.  
Chi tiết kỹ thuật nằm trong `SEO-TECHNICAL-CONTRACT.md`.

Các bất biến SEO bắt buộc:

1. Admin-authored SEO metadata phải được public storefront render trong SSR HTML.
2. Metadata canonical, Open Graph URL, JSON-LD primary entity URL, internal canonical links và sitemap phải resolve về **cùng một authoritative URL**.
3. Mỗi Product có đúng **một authoritative public storefront URL**.
4. URL Product thay thế/sai category/slug cũ phải **301/308 trực tiếp** về canonical URL; không được trả duplicate HTTP 200 chỉ dựa vào canonical tag.
5. Canonical URL phải trả HTTP 200; redirect URL không được tạo redirect chain.
6. URL `noindex` không được xuất hiện trong XML sitemap.
7. Redirect URL không được xuất hiện trong XML sitemap.
8. Sitemap chỉ chứa canonical, indexable, HTTP 200 URLs.
9. Editorial Hub và Commerce Collection phải target **distinct search intents, titles và descriptions**.
10. Product schema phải sử dụng dữ liệu thật đang hiển thị và canonical storefront URL.
11. Rating/review schema chỉ render khi có eligible review data thật.
12. `Verified`, `Tested`, rating, review count, price và evidence chỉ được render khi có dữ liệu/provenance thật.
13. AI-generated copy phải tuân thủ Positioning + Claim Safety của Blueprint; không được tạo unsupported medical/testing claims hoặc fabricated numbers.
14. SEO readiness dựa trên content completeness + technical validity, không dựa vào keyword-density score tùy ý.
15. Mọi indexable entity phải dùng cùng SEO contract và canonical resolver.
16. Private/transactional routes phải có indexability rule rõ ràng; `robots.txt Disallow` không được dùng thay cho `noindex`.
17. Affiliate/comparison data phải có provenance phù hợp; page có affiliate link phải luôn hiển thị disclosure bắt buộc.
18. Các invariant trên phải được bảo vệ bằng SSR/integration tests trước khi mở rộng content.

---

# 35. OFFICIAL SEO EXECUTION ROADMAP

Core architecture của Blueprint v5 **không thay đổi**.  
Thứ tự execution chính thức từ đây:

```text
Blueprint V5
        ↓
P0 — Trust, Evidence & Canonical Emergency Fixes
        ↓
P0.5 — Define SEO Technical Contract
        ↓
P1 — Implement Contract End-to-End
        ↓
SSR / Canonical / Schema / Sitemap / Trust Tests
        ↓
Technical SEO Acceptance Gate
        ↓
Improve Existing Breed & Solution Hubs
        ↓
Expand Evidence-Backed Content Clusters
        ↓
Search Console / Analytics Feedback Loop
        ↓
AI SEO / Scoring / Automation
```

### P0 được phép sửa ngay trên content/hubs hiện có

- claim sai;
- metadata sai;
- canonical sai;
- robots/schema sai;
- duplicate copy editorial vs commerce;
- thin-page indexability;
- taxonomy label cũ;
- internal link sai canonical;
- mock/fake data;
- AI prompt framing cũ.

### Chỉ sau Technical SEO Acceptance Gate mới mở rộng

- guide mới;
- comparison mới;
- review mới;
- content cluster mới;
- Product Type routes mới;
- Breed/Solution ngoài canonical set;
- mass content production;
- AI SEO/scoring/automation nâng cao.

### P0 AI safety hotfix

Sửa ngay, không chờ phase AI cuối roadmap:

- loại framing `pet ergonomics`;
- nhúng PetPosture positioning;
- nhúng Claim Safety;
- chặn unsupported medical/testing claims;
- chặn fabricated ratings, numbers, review counts và evidence.

### P0/P1 completion checkpoint

> **P0/P1 chỉ hoàn thành khi mỗi Product có đúng một authoritative public URL; mọi URL thay thế redirect trực tiếp bằng 301/308 về URL đó; canonical metadata, Open Graph URL, JSON-LD, internal links và sitemap dùng cùng URL; canonical URL trả HTTP 200; noindex/redirect URLs không xuất hiện trong sitemap; production không render mock data hoặc unsupported Verified/Tested/rating/review evidence; và toàn bộ invariant được bảo vệ bằng integration tests.**

Tài liệu chi tiết:

- `SEO-TECHNICAL-CONTRACT.md`
- `SEO-P0-P1-IMPLEMENTATION-PLAN.md`
- `ARCHITECTURE-SEO-ADDENDUM.md`

