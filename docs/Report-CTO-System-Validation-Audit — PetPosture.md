# Báo cáo CTO/System Validation Audit — PetPosture

**Đối tượng:** toàn bộ dự án `petposture`  
**Chuẩn đối chiếu chính:** `C:\laragon\www\petposture\docs\PetPosture-Canonical-Implementation-Blueprint-v5.1-AUTHORITATIVE.md`  
**Phạm vi:** kiến trúc, frontend, backend, commerce, bảo mật, SEO, schema, sitemap, email, admin, social, CI/CD, vận hành và rủi ro dữ liệu.  
**Chế độ thực hiện:** chỉ đọc và lập báo cáo; không thực hiện thay đổi code hay tài liệu.

---

## 1. Kết luận điều hành

### Trạng thái tổng thể

PetPosture đã có **khung sản phẩm tương đối đầy đủ**: Next.js App Router, Laravel/Lunar, Filament, admin React, thanh toán nhiều gateway, queue worker, scheduler, breed/solution taxonomy và các module commerce cơ bản.

Tuy nhiên, dự án **chưa đạt Technical SEO Acceptance Gate và chưa nên được xem là sẵn sàng go-live ở mức production commerce**.

Các vấn đề nghiêm trọng nhất hiện tại không nằm ở giao diện mà nằm ở:

1. **Authorization của checkout/payment đang dựa quá nhiều vào token possession**, chưa ràng buộc đủ với user/session/order.
2. **Canonical URL và Product JSON-LD không thống nhất** giữa Laravel và storefront.
3. **Rating/review/evidence có thể là dữ liệu giả hoặc dữ liệu không đủ provenance** nhưng vẫn được hiển thị như đã xác thực.
4. **Sitemap có hai owner cạnh tranh**, không áp dụng đầy đủ canonical/indexability/published rules.
5. **Frontend vẫn có fallback mock product trong production path**.
6. **Nội dung HTML từ CMS/API được render bằng `dangerouslySetInnerHTML` mà chưa thấy lớp sanitize bắt buộc ở frontend path**.
7. **Admin authorization mới chủ yếu là role gate cấp route, chưa nhất quán với policy/per-action permission**.
8. **Email/newsletter chưa đạt mức delivery reliability, double opt-in và observability cần thiết cho production.**

### Đánh giá định tính

| Khu vực | Đánh giá | Trạng thái |
|---|---:|---|
| Kiến trúc tổng thể | Khá về khung, yếu ở contract enforcement | 🟡 |
| Alignment với Blueprint v5.1 | Mới đạt một phần | 🟠 |
| Frontend UX/UI | Có nền tảng tốt, còn nhiều claim/taxonomy drift | 🟡 |
| Backend commerce | Có nhiều service đúng hướng nhưng boundary bảo mật chưa đủ | 🟠 |
| Checkout/payment security | Rủi ro nghiêm trọng | 🔴 |
| SEO/canonical/schema/sitemap | Chưa đạt acceptance gate | 🔴 |
| Review/evidence/trust | Chưa đạt yêu cầu Blueprint | 🔴 |
| Email/CRM operations | Chưa production-grade | 🟠 |
| Admin governance | Chức năng rộng, phân quyền chưa đủ chi tiết | 🟠 |
| CI/CD/observability | Thiếu frontend/admin/integration coverage và runtime visibility | 🟠 |

---

# 2. Phạm vi và giới hạn audit

Đã đọc và đối chiếu các tài liệu chính:

- `C:\laragon\www\petposture\docs\PetPosture-Canonical-Implementation-Blueprint-v5.1-AUTHORITATIVE.md`
- `C:\laragon\www\petposture\docs\SEO-TECHNICAL-CONTRACT.md`
- `C:\laragon\www\petposture\docs\SEO-P0-P1-IMPLEMENTATION-PLAN.md`
- `C:\laragon\www\petposture\docs\ARCHITECTURE-SEO-ADDENDUM.md`
- `C:\laragon\www\petposture\ARCHITECTURE.md`
- `C:\laragon\www\petposture\RULES.md`

Đã inspect các vùng frontend, backend, admin, migrations, seeders, routes, CI, mail, queue và deployment.

### Chưa thực hiện

- Không chạy browser/runtime smoke test.
- Không gọi HTTP production hoặc staging.
- Không query database thực tế.
- Không kiểm tra output SSR thực tế sau build.
- Không kiểm tra response HTTP 200/301/308 thực tế.
- Không đọc hoặc echo secret từ `backend/.env`.
- Không có GitNexus MCP namespace khả dụng trong runtime hiện tại, dù repository có tài liệu GitNexus.

Vì vậy, báo cáo phân biệt rõ:

- **Confirmed code-level finding:** thấy trực tiếp trong source.
- **Runtime verification required:** cần kiểm tra thêm bằng HTTP/browser/DB trước khi kết luận hành vi production thực tế.

---

# 3. Đối chiếu với Blueprint v5.1

## 3.1. Những phần đã đi đúng hướng

Các quyết định kiến trúc chính của Blueprint đã xuất hiện trong code:

- Có hai lớp breed:
  - Editorial: `/dogs/{breed}`
  - Commerce: `/shop/breeds/{breed}`
- Có hai lớp solution:
  - Editorial: `/solutions/{solution}`
  - Commerce: `/shop/solutions/{solution}`
- Có model và pivot cho `Breed`/`Solution`.
- Có redirect cho một số English Bulldog route trong `C:\laragon\www\petposture\frontend\next.config.ts`.
- Có `ProductRouteService` trong backend, đúng với vai trò owner được Blueprint chỉ định.
- Có admin resource cho nhiều domain sản phẩm, content, breed, solution, media.
- Có queue worker và scheduler thực sự được cấu hình qua `C:\laragon\www\petposture\backend\supervisord.conf`.
- Có payment webhook/idempotency-related infrastructure.
- Comment blog được đưa qua trạng thái moderation trước khi public.

Đây là nền móng tốt. Vấn đề chính là các contract này **chưa được enforce end-to-end**.

---

## 3.2. Taxonomy: đạt một phần nhưng vẫn còn drift

Blueprint quy định chính thức:

```text
Breeds:
dachshund
french-bulldog
pug
corgi
english-bulldog

Solutions:
feeding
comfort
mobility
walking
```

Frontend homepage hiện đã dùng đúng label chính:

- `Explore by Breed`
- `Explore Solutions`
- `Explore All Breeds`
- `Explore All Solutions`

Các link chính trong `C:\laragon\www\petposture\frontend\components\HomePage.tsx` cũng đang dẫn tới editorial route `/dogs/...` và `/solutions/...`, phù hợp với discovery layer.

Tuy nhiên vẫn còn các điểm không đồng nhất:

- FAQ chứa các label cũ như `Shop by Breed`, `Shop by Solution`, `Mobility & Support`, `Productivity` trong `C:\laragon\www\petposture\frontend\components\FaqsPage.tsx`.
- Mock data dùng solution tag cũ:
  - `eating-digestion`
  - `mobility-support`
  - `comfort-safety`
- Backend sitemap vẫn hardcode:
  - `flat-faced`
  - `long-backed`
  - `eating-digestion`
  - `mobility-support`
  - `comfort-safety`
- Legacy seeders vẫn tạo category/product model cũ song song với Lunar product model.

### Đánh giá

Taxonomy mới đã được triển khai ở một số UI chính, nhưng chưa được chuẩn hóa xuyên suốt data layer, sitemap, FAQ, mock data, legacy models và internal content.

**Mức độ:** P0/P1 — cần xử lý trước khi mở rộng SEO/content.

---

## 3.3. Editorial và Commerce intent

Cấu trúc route đã phân biệt editorial và commerce. Các editorial page hiện có section như:

- Common Challenges
- Explore Product Types
- What to Consider
- Latest Guides
- PetPosture Picks
- Related Solutions
- Breed/product navigation

Đây là hướng đúng với Blueprint.

Tuy nhiên cần xác minh thêm:

- Tất cả 4 solution hub có đủ nội dung thật theo full spec hay chỉ dùng template gần giống nhau.
- `/solutions/{slug}` và `/shop/solutions/{slug}` có bị trùng copy đáng kể hay không.
- Solution được tạo mới trong database nhưng chưa có entry trong local `SOLUTION_CONTENT` có bị index hay không.

Code hiện cho thấy unknown DB-created solution có thể vẫn được render, trong khi phần editorial content local không nhất thiết đầy đủ. Điều này tạo rủi ro **thin indexable page**.

---

# 4. Các rủi ro nghiêm trọng nhất

## R-01 — Checkout session authorization dựa vào token possession

**Mức độ:** Critical / P0  
**Độ tin cậy:** Confirmed code-level design flaw

Routes public trong `C:\laragon\www\petposture\backend\routes\api.php` gồm:

```text
GET  /checkout/session/{token}
POST /checkout/session/{token}/payment-intent
POST /checkout/session/{token}/confirm
```

Các route này chỉ có throttle, không có auth hoặc ownership binding.

`C:\laragon\www\petposture\backend\app\Services\CheckoutSessionService.php` sử dụng token để:

- resolve session;
- đọc payload;
- prepare payment;
- confirm và place order.

Rủi ro:

- Ai có token có thể đọc session.
- Có thể lấy payment-related data.
- Có thể gọi payment-intent hoặc confirm.
- Token leak qua log, browser history, referrer, analytics, support ticket hoặc client-side state có thể trở thành quyền thao tác commerce.

`CheckoutSessionResource` còn expose raw payload, payment intent/client secret và order reference.

### Khắc phục khái niệm

- Dùng session ID opaque, entropy cao, TTL rõ ràng.
- Binding session với:
  - authenticated user, hoặc
  - signed guest possession proof, hoặc
  - email + one-time verification token.
- Không để token đơn độc làm authorization cho payment mutation.
- Session phải có state machine:
  - open;
  - payment_pending;
  - paid;
  - expired;
  - confirmed;
  - consumed.
- Thêm idempotency key cho prepare/confirm.
- Không trả raw payload và payment secret trong resource public.
- Token phải được rotate hoặc invalidate sau confirm.

---

## R-02 — IDOR/order PII/payment intent exposure

**Mức độ:** Critical / P0-P1  
**Độ tin cậy:** Confirmed code-level risk

`C:\laragon\www\petposture\backend\app\Http\Controllers\Api\OrderController.php` có các flow public lookup order theo gateway/payment session hoặc theo reference/email.

`OrderResource` tại `C:\laragon\www\petposture\backend\app\Http\Resources\Api\OrderResource.php` bao gồm nhiều dữ liệu nhạy cảm như:

- email;
- tracking/reference;
- payment-related fields;
- address/order information.

Đáng chú ý, `tracking_number` có fallback về order reference. Điều này làm giảm tính bí mật của credential dùng để tracking.

Flow retry payment cũng nhận các credential kiểu tracking/email và trả payment-intent data. Throttle hiện tại chưa đủ để đảm bảo chống enumeration/brute-force.

### Khắc phục khái niệm

- Tách hoàn toàn:
  - internal `OrderResource`;
  - public tracking DTO tối thiểu.
- Không dùng order reference làm secret.
- Dùng tracking access token riêng, random, rotate được.
- Generic response cho lookup thất bại để tránh account/order enumeration.
- Rate limit theo cả IP, email hash, reference hash và device signal.
- Audit log toàn bộ retry/payment lookup.
- Không expose payment client secret nếu không cần.
- Chỉ cho phép retry trên order còn valid, chưa paid, chưa expired.

---

## R-03 — Product canonical URL và JSON-LD không thống nhất

**Mức độ:** Critical / P0  
**Độ tin cậy:** Confirmed

Storefront product route dùng:

```text
/shop/{category}/{slug}
```

Trong khi `C:\laragon\www\petposture\backend\app\Http\Resources\Api\ProductResource.php` build JSON-LD với:

```text
/products/{slug}
```

Cụ thể:

- JSON-LD `url` dùng `/products/{slug}`.
- Offer `url` cũng dùng `/products/{slug}`.
- Frontend page canonical lại dùng `/shop/{category}/{slug}`.
- `ProductCard` tự build URL riêng thay vì dùng canonical URL từ một resolver.

Đây là vi phạm trực tiếp các invariant:

- canonical URL;
- Open Graph URL;
- JSON-LD primary entity URL;
- internal links;
- sitemap;

phải cùng resolve về một authoritative URL.

### Khắc phục khái niệm

- `ProductRouteService` phải là resolver duy nhất.
- Backend chỉ cung cấp facts/DTO:
  - canonical path;
  - slug;
  - category;
  - indexability;
  - product facts.
- Next.js là owner của final public Product graph.
- Xóa hoặc retire backend JSON-LD độc lập.
- Product card, breadcrumb, metadata, schema và sitemap đều dùng `canonicalPath` từ cùng DTO.
- Viết table-driven test cho:
  - đúng category;
  - sai category;
  - old slug;
  - multiple collections;
  - missing canonical collection;
  - redirect chain.

---

## R-04 — Wrong-category product URL không được enforce

**Mức độ:** High / P0-P1  
**Độ tin cậy:** Confirmed code-level risk

`C:\laragon\www\petposture\frontend\app\shop\[category]\[slug]\page.tsx` nhận category nhưng fetch product chủ yếu theo slug.

Backend `ProductController` cũng resolve theo slug, không validate category được request.

Hệ quả: URL sai category có thể trả product HTTP 200 thay vì redirect trực tiếp về canonical URL.

Điều này tạo duplicate URL và vi phạm Blueprint:

> URL sai category/slug phải 301/308 trực tiếp về canonical URL.

### Khắc phục khái niệm

- API nhận cả `category` và `slug`, hoặc frontend gọi resolver endpoint.
- Nếu product tồn tại nhưng category sai:
  - trả canonical path + redirect intent;
  - Next trả 308/301 trực tiếp.
- Không dựa chỉ vào `<link rel="canonical">`.
- Kiểm tra không có redirect chain.

---

## R-05 — Canonical category có thể không deterministic

**Mức độ:** High  
**Độ tin cậy:** Confirmed

`C:\laragon\www\petposture\backend\app\Services\ProductRouteService.php` lấy collection đầu tiên để suy ra category.

Nếu một product thuộc nhiều collection, category có thể phụ thuộc vào thứ tự relation/load order thay vì:

- canonical collection flag;
- explicit priority;
- published canonical assignment;
- deterministic ordering.

### Khắc phục khái niệm

Xác định một policy duy nhất:

1. explicit `canonical_collection_id`, hoặc
2. collection priority thấp nhất, rồi ID thấp nhất, hoặc
3. category canonical bắt buộc trong admin.

Không dùng `first()` nếu không có order deterministic.

---

## R-06 — Rating/review schema tin vào attribute thay vì review evidence

**Mức độ:** Critical / P0  
**Độ tin cậy:** Confirmed

Trong `C:\laragon\www\petposture\backend\app\Http\Resources\Api\ProductResource.php`:

- `rating` lấy từ product attribute.
- `reviewCount` lấy từ product attribute.
- `aggregateRating` được render nếu hai attribute này lớn hơn 0.

Trong khi Blueprint yêu cầu:

- chỉ review eligible mới được tính;
- phải có provenance thật;
- không được render fake rating/review count;
- `Verified` chỉ được dùng khi có evidence.

Ngoài ra, `ProductDetails.tsx` hiển thị:

```text
(reviews Verified)
```

mà không kiểm tra từng review có `is_verified` hay không.

### Khắc phục khái niệm

- Tách:
  - raw review;
  - approved review;
  - verified purchase review;
  - eligible review.
- Aggregate rating phải tính từ approved/eligible rows.
- Không dùng `rating`/`reviews` attribute làm nguồn SEO nếu không phải snapshot được kiểm chứng.
- Không render `aggregateRating` khi không có review hợp lệ.
- UI phải phân biệt:
  - total reviews;
  - verified reviews;
  - unverified reviews.
- Lưu provenance hoặc snapshot generation metadata nếu cần cache.

---

## R-07 — Review submission thiếu purchase verification và moderation lifecycle

**Mức độ:** High / P0-P1  
**Độ tin cậy:** Confirmed

`ProductController` public review endpoint cho phép submit:

- name;
- rating;
- comment;

nhưng chưa thấy ràng buộc đầy đủ với:

- authenticated user;
- order line;
- paid order;
- verified purchase;
- approved status;
- abuse/mass submission controls.

Public review listing cũng chưa filter rõ ràng chỉ `approved` và chưa pagination đầy đủ.

Migration review ban đầu chỉ có:

```text
product
name
rating
comment
is_verified
```

Chưa có evidence relation đủ mạnh.

### Khắc phục khái niệm

- Review gắn với order line/customer.
- Chỉ order đã paid/fulfilled mới đủ điều kiện verified.
- Review mới phải `pending`.
- Chỉ approved review mới public.
- Rating validation chặt ở backend.
- Giới hạn comment length.
- Rate limit, honeypot/Turnstile hoặc anti-abuse.
- Không cho client tự set `is_verified`.
- Aggregate chỉ lấy approved eligible records.

---

## R-08 — Mock/fake product data vẫn có thể đi vào production UI

**Mức độ:** Critical / P0  
**Độ tin cậy:** Confirmed

`C:\laragon\www\petposture\frontend\lib\shopData.ts` chứa hardcoded products với:

- giá;
- rating 4–5;
- review count 97–425;
- product claims;
- solution tags cũ.

`C:\laragon\www\petposture\frontend\app\shop\page.tsx`, breed/solution pages và `C:\laragon\www\petposture\frontend\hooks\useShopLogic.ts` có fallback về `MOCK_PRODUCTS` khi API lỗi hoặc dữ liệu rỗng.

Đây là rủi ro trực tiếp đối với:

- trust;
- giá bán;
- availability;
- structured data;
- SEO;
- conversion;
- compliance với Blueprint.

### Khắc phục khái niệm

- Xóa mock fallback khỏi production bundle hoặc chặn bằng build flag development.
- API lỗi phải hiển thị:
  - error state;
  - retry;
  - empty state;
  - maintenance state.
- Không được biến “API empty” thành “show fake products”.
- Thêm test đảm bảo production không render mock SKU/price/review.

---

## R-09 — Stored XSS risk trong HTML từ CMS/API

**Mức độ:** High  
**Độ tin cậy:** Confirmed risk; mức khai thác thực tế cần runtime/DB verification

Các component có `dangerouslySetInnerHTML`:

- `C:\laragon\www\petposture\frontend\components\BlogPostPage.tsx`
- `C:\laragon\www\petposture\frontend\components\LegalPageLayout.tsx`
- `C:\laragon\www\petposture\frontend\components\product\ProductDetails.tsx`

Chưa thấy lớp sanitize bắt buộc trước khi render ở frontend path được inspect.

Nguồn content có thể đến từ admin/CMS/API. Nếu admin account bị chiếm hoặc content không được sanitize server-side, attacker có thể đưa script/event handler hoặc URL nguy hiểm vào HTML.

### Khắc phục khái niệm

- Sanitize tại server trước khi lưu và/hoặc trước khi render.
- Allowlist HTML tags/attributes.
- Chặn:
  - `script`;
  - inline event handlers;
  - `javascript:`;
  - data URI không cần thiết;
  - iframe ngoài allowlist.
- Dùng CSP có nonce/hash.
- Không coi “chỉ admin mới sửa được” là biện pháp chống XSS đầy đủ.
- Viết security test với payload XSS ở blog, legal, product description.

---

## R-10 — Sitemap và indexability chưa tuân theo contract

**Mức độ:** Critical / P0  
**Độ tin cậy:** Confirmed

### Next.js sitemap

`C:\laragon\www\petposture\frontend\app\sitemap.ts`:

- fetch product/post theo một lần phân trang;
- có khả năng chỉ lấy page đầu;
- hardcode static URL;
- đưa vào các route transactional như `/track-order` và `/returns`;
- không resolve canonical/indexability từ DTO;
- không filter đầy đủ draft/noindex/redirect;
- dùng `lastModified` không phản ánh entity update thực tế.

### Backend sitemap

`C:\laragon\www\petposture\backend\app\Http\Controllers\Api\SitemapController.php` là sitemap owner thứ hai và:

- hardcode taxonomy deprecated;
- không dùng `ProductRouteService`;
- dùng `now()` cho static page `lastmod`;
- load dữ liệu lớn một lần, không chunk;
- có nguy cơ memory/performance issue.

Blueprint đã quy định rõ:

- Next.js là public sitemap owner.
- Backend chỉ cung cấp sitemap-oriented DTO.
- Backend sitemap cũ phải retire hoặc redirect sau migration.

### Khắc phục khái niệm

- Chọn duy nhất Next.js `/sitemap.xml`.
- Backend trả DTO:
  - canonical path;
  - indexable;
  - published;
  - updatedAt;
  - entity type.
- Pagination/cursor đầy đủ.
- Exclude:
  - noindex;
  - draft;
  - redirect;
  - invalid canonical;
  - non-200.
- Chỉ dùng `lastModified` từ dữ liệu thật.
- Split sitemap khi vượt giới hạn.
- Có integration test so sánh sitemap với canonical resolver.

---

# 5. SEO audit chi tiết

## 5.1. Metadata

### Product page

`C:\laragon\www\petposture\frontend\app\shop\[category]\[slug]\page.tsx`:

- canonical được build từ params;
- không consume đầy đủ admin-authored SEO metadata;
- thiếu `openGraph.url`;
- không có Product JSON-LD ở storefront;
- fetch product riêng trong `generateMetadata` và page, tạo duplicate request;
- chưa resolve explicit indexability state.

Đây là vi phạm yêu cầu:

> Admin-authored SEO metadata phải xuất hiện trong SSR HTML.

### Blog page

`C:\laragon\www\petposture\frontend\app\blog\[slug]\page.tsx`:

- metadata/page fetch post hai lần;
- không kiểm tra rõ `published_at` ở single post route;
- thiếu BlogPosting JSON-LD;
- thiếu BreadcrumbList;
- description fallback có thể lấy raw content.

Backend `ContentController::post` filter `status=published` nhưng không filter đầy đủ `published_at <= now()`. Do đó scheduled/future post có thể bị public trước thời điểm.

### Root/global metadata

`C:\laragon\www\petposture\frontend\app\layout.tsx` có Organization/WebSite JSON-LD, đây là điểm tốt. Tuy nhiên vẫn còn positioning cũ như:

- `Ergonomic Essentials`;
- wording liên quan posture/health;
- claim có thể không còn phù hợp với v5.1 Positioning/Claim Safety.

Các page như FAQ, Blog, Contact cũng còn terminology/claim cũ.

---

## 5.2. JSON-LD

Hiện trạng:

- Global Organization/WebSite schema: có.
- Product schema ở backend: có nhưng sai URL và sai nguồn rating.
- Product schema ở storefront SSR: chưa thấy.
- BreadcrumbList: chưa thấy triển khai đồng bộ.
- BlogPosting: chưa thấy.
- FAQPage: chưa thấy.
- CollectionPage/ItemList: chưa thấy contract rõ ràng.

Cần tránh việc Laravel và Next cùng tự tính một phần schema khác nhau. Blueprint đã chỉ định:

- Laravel cung cấp facts;
- Next.js render final graph;
- một resolver duy nhất quyết định URL/indexability.

---

## 5.3. H1-H6 và cấu trúc heading

### Điểm tốt

Các trang chính đa số có H1:

- homepage;
- shop;
- breed hub;
- solution hub;
- blog;
- contact;
- FAQ;
- product;
- account;
- legal.

Các editorial breed/solution cũng có nhiều H2/H3 hợp lý.

### Vấn đề

- Có khả năng duplicate hoặc đặt H1 trong component dùng ở nhiều context.
- H1 hiện diện không đảm bảo search intent/content completeness.
- FAQ content có claim cũ và terminology cũ dù heading structure không quá xấu.
- Nội dung CMS có heading do editor tự nhập; regex heading ID trong `frontend/lib/text.ts` không phải HTML sanitizer.
- Chưa thấy automated test bảo đảm mỗi indexable page có đúng một H1 và heading sequence hợp lệ.

### Khuyến nghị

Tạo SSR/content lint kiểm tra:

- mỗi indexable document có đúng một H1;
- không skip heading level bất hợp lý;
- H1 phản ánh page intent;
- editorial và commerce có title/H1/description khác nhau;
- CMS HTML sau sanitize vẫn giữ heading hợp lệ.

---

## 5.4. On-page marketing SEO và claim safety

Một số claim cần đưa vào claim inventory và xác minh provenance:

### `C:\laragon\www\petposture\frontend\components\Hero.tsx`

- alt: `Ergonomic feeding stance`;
- CTA `Explore Solutions` lại dẫn tới `/shop/solutions`, trong khi homepage discovery CTA nên hướng về editorial `/solutions` hoặc trang discovery phù hợp.

### `C:\laragon\www\petposture\frontend\components\product\TrustBadgeBar.tsx`

Có các claim:

- `USA NEXT-DAY SHIPPING`;
- `LIFETIME REPLACEMENT`;
- `30-DAY RISK FREE`;
- `Orders over $50`.

Blueprint yêu cầu chỉ giữ guarantee/free shipping khi policy live thực sự đúng. Những claim này cần source-of-truth từ policy/fulfillment, không hardcode tùy ý trong component.

### `C:\laragon\www\petposture\frontend\components\product\ScientificBreakdown.tsx`

Có wording:

- `real breed measurements`;
- `reduce awkward pressure points`;
- `Practical research first`;
- `Comfort materials`.

Nếu không có evidence/provenance, đây có thể trở thành unsupported performance/health claim.

### `C:\laragon\www\petposture\backend\database\seeders\DatabaseSeeder.php`

Legacy seed chứa claim mạnh hơn:

- `Veterinary approved`;
- `spinal health`;
- `reduce neck strain`;
- `post-surgery`;
- `senior dog mobility`.

`ProductSeeder.php` cũng tạo các product có rating/review count hardcoded và description “high quality ergonomic product”.

Đây là vấn đề P0 về trust/evidence ngay cả khi seeder chưa chắc được chạy trong production. Code và data seed phải không tạo dữ liệu có thể bị hiểu là review/medical proof thật.

---

# 6. Backend, commerce và data flow

## 6.1. Client-controlled checkout payload

`CheckoutSessionService` dùng `array_replace_recursive()` để merge payload. Đây là pattern nguy hiểm nếu payload client có thể ghi đè các field nhạy cảm như:

- payment context;
- status;
- totals;
- customer data;
- session state;
- metadata.

Dù `CheckoutService` có recalculation inventory/cart ở một số flow, boundary giữa “input được phép” và “server authoritative data” chưa đủ rõ.

### Khuyến nghị

- DTO/FormRequest whitelist field.
- Bỏ mọi field server-controlled khỏi input.
- Server tự resolve:
  - variant;
  - quantity;
  - price;
  - discount;
  - tax;
  - shipping;
  - payment status.
- Không tin subtotal/discount/tax từ client.
- Dùng schema version và reject unknown keys.

---

## 6.2. Totals không nhất quán

`CheckoutSessionService` trả `subtotal_minor`, `discount_minor`, `tax_minor` là `null` trong một số non-empty cart path.

Điều này gây rủi ro:

- frontend hiển thị totals không đầy đủ;
- payment provider amount khác với UI;
- debugging/reconciliation khó;
- acceptance test không xác định.

Cần một totals DTO canonical duy nhất, có currency/minor units rõ ràng và được tạo từ server calculation.

---

## 6.3. Product search và performance

`ProductController` có query:

```text
LOWER(CAST(attribute_data AS CHAR)) LIKE ...
```

Rủi ro:

- không dùng index hiệu quả;
- false-positive matching;
- chi phí cao khi catalog lớn;
- khó kiểm soát taxonomy.

Related fallback sử dụng `inRandomOrder()`, thường gây chi phí lớn trên bảng lớn.

Sitemap cũng load nhiều dữ liệu mà không chunk.

### Khuyến nghị

- Dùng normalized columns hoặc JSON indexes.
- Search engine riêng nếu catalog tăng.
- Dùng deterministic related product selection/cache thay cho random SQL mỗi request.
- Cursor/chunk sitemap.
- Cache invalidation theo product/collection publish event.

---

## 6.4. Legacy product model và Lunar product model cùng tồn tại

Có hai hướng data:

- `Lunar\Models\Product`;
- `App\Models\Legacy\Product`;
- legacy `categories`/`products` table;
- Lunar product/variant/collection tables.

`DatabaseSeeder.php` vẫn import legacy product model và tạo sản phẩm cũ. Điều này tạo nguy cơ:

- hai source of truth;
- admin sửa một model, storefront đọc model khác;
- review mapping sai;
- SEO metadata nằm ở model không được public API dùng;
- seed/deploy tạo data không xuất hiện trên storefront.

### Khuyến nghị

- Chốt Lunar là commerce source of truth.
- Đánh dấu legacy tables read-only.
- Có migration/backfill và reconciliation report.
- Xóa hoặc cô lập legacy seeder khỏi production path.
- Viết invariant test: mọi public product phải trace được về một Lunar product canonical.

---

## 6.5. Review migration có nguy cơ orphan dữ liệu

Migration:

`C:\laragon\www\petposture\backend\database\migrations\2026_07_17_000002_migrate_reviews_to_lunar_products.php`

thêm `lunar_product_id` và drop `product_id`, nhưng chưa thấy explicit mapping/backfill cho review cũ.

Nếu migration chạy trên DB có dữ liệu thật, review có thể mất liên kết product.

### Khắc phục

- Preflight report số lượng review.
- Map legacy product → Lunar product bằng stable mapping.
- Fail migration nếu còn unmapped review.
- Chỉ drop cột cũ sau khi reconciliation pass.
- Backup và rollback plan.

---

# 7. Authentication, authorization và security

## 7.1. Token trong localStorage

`C:\laragon\www\petposture\frontend\context\AuthContext.tsx` lưu token/user vào `localStorage`.

Admin cũng lưu bearer token trong:

`C:\laragon\www\petposture\admin\src\lib\auth.ts`

Điều này làm tăng blast radius nếu có XSS: token có thể bị đọc và gửi đi.

Ngoài ra, frontend tạo cookie JavaScript-readable `petposture_token`/`petposture_user`, trong khi backend cũng có cơ chế HttpOnly cookie. Đây là thiết kế auth chồng chéo và khó audit.

### Khuyến nghị

- Ưu tiên HttpOnly, Secure, SameSite cookie/session.
- Không lưu bearer token vào localStorage nếu có thể tránh.
- Không lưu role JSON client-side làm nguồn authorization.
- Middleware chỉ là UI gate; backend phải là authority.
- Xóa duplicate auth channels hoặc xác định rõ từng channel.

---

## 7.2. Proxy tin vào client-controlled cookie

`C:\laragon\www\petposture\frontend\proxy.ts` kiểm tra token/user cookie và role để bảo vệ UI route.

Điều này chỉ nên được coi là navigation guard. Client có thể sửa cookie và tự mở admin shell; API mới là nơi quyết định quyền thật.

Hiện backend admin routes có auth, nhưng governance chưa đồng nhất. Cần tránh việc shell hiển thị chức năng mà API từ chối hoặc ngược lại.

---

## 7.3. Role mismatch giữa Filament, proxy và API

`User::ADMIN_PANEL_ROLES` gồm:

```text
super_admin
admin
staff
Product Manager
Order Manager
Support
```

`User::canAccessPanel()` cho phép cả nhóm trên.

Nhưng API admin route middleware trong `routes/api.php` chỉ cho:

```text
super_admin|admin|staff
```

Trong khi:

- frontend proxy nhận thêm `Product Manager`, `Order Manager`, `Support`;
- `OrderController` và `ReturnRequestController` có logic nhận `Order Manager`/`Support`.

Hệ quả:

- user được phép vào Filament nhưng không gọi được React admin API;
- user được frontend cho qua nhưng API trả 403;
- các role business-specific không có permission matrix thống nhất.

### Khuyến nghị

Tạo permission matrix rõ ràng theo action:

| Domain | View | Create | Update | Delete | Publish | Refund/payment |
|---|---|---|---|---|---|---|
| Products |  |  |  |  |  |  |
| Posts |  |  |  |  |  |  |
| Orders |  |  |  |  |  |  |
| Reviews |  |  |  |  |  |  |
| SEO |  |  |  |  |  |  |

Đồng nhất:

- Filament;
- React admin;
- API middleware;
- Laravel Policies;
- controller action checks.

---

## 7.4. Admin controllers thiếu per-action policy enforcement

Các controller như:

- `C:\laragon\www\petposture\backend\app\Http\Controllers\Api\Admin\PageController.php`
- `C:\laragon\www\petposture\backend\app\Http\Controllers\Api\Admin\CommentController.php`

thực hiện CRUD trực tiếp và chủ yếu dựa vào group middleware. Chưa thấy `authorize()`/policy check cho từng action trong các code path được inspect.

Các Policy class tồn tại, ví dụ `ProductPolicy` và `PostPolicy`, nhưng không đồng nghĩa mọi API admin controller đã dùng chúng.

### Rủi ro

- `staff` có thể có quyền rộng hơn dự kiến.
- Không tách được editor, reviewer, publisher, support, order manager.
- Khó audit ai được publish/delete/change SEO/payment.

---

## 7.5. CSRF/CORS/proxy configuration

`backend/bootstrap/app.php`:

- bật `statefulApi()`;
- exempt toàn bộ `api/*` khỏi CSRF;
- trust proxies `*`.

`backend/config/cors.php`:

- credentials bật;
- allowed origins kết hợp env và default localhost/Vercel.

Các điểm cần harden:

- xác định chính xác cookie-based auth hay bearer-only;
- chỉ exempt CSRF cho route thực sự cần;
- trust proxy chỉ cho dải proxy tin cậy;
- không để default production origin sai;
- test credentialed cross-origin requests;
- kiểm tra SameSite/Secure/Origin behavior thực tế.

Đây là rủi ro cấu hình cần kiểm tra runtime; chưa kết luận exploit production chỉ từ source.

---

# 8. Email, newsletter và outbound communication

## 8.1. Mail provider/configuration

`backend/config/mail.php` có mailer `log` làm default nếu không set env phù hợp.

Có cấu hình SMTP/Resend-related, nhưng:

- chưa thấy Mailgun service block;
- chưa thấy IMAP integration;
- chưa thấy bounce/complaint processing;
- chưa thấy delivery event reconciliation;
- `MailConfigSync` chủ yếu hỗ trợ SMTP dynamic config.

### Rủi ro

Production có thể “gửi thành công” ở application level nhưng chỉ ghi log nếu provider env không được cấu hình đúng.

### Khuyến nghị

- Chọn một provider production chính.
- Fail fast nếu production đang dùng `log`.
- Provider health check/startup check.
- Domain authentication: SPF, DKIM, DMARC.
- Webhook cho delivered/bounced/complained.
- Email delivery log có message ID, status, retry state.
- Không lưu toàn bộ nội dung nhạy cảm trong log.

---

## 8.2. Contact form gửi email đồng bộ

`C:\laragon\www\petposture\backend\app\Http\Controllers\Api\ContactController.php` gửi email trực tiếp trong HTTP request.

Rủi ro:

- request latency cao;
- provider timeout làm người dùng thấy lỗi dù email có thể đã gửi;
- retry HTTP tạo duplicate email;
- exception log có thể chứa dữ liệu user.

### Khuyến nghị

- Queue contact message.
- Tạo inbound contact record với idempotency key.
- Worker xử lý email.
- Admin UI có trạng thái:
  - received;
  - queued;
  - sent;
  - failed;
  - retried.
- Không hardcode recipient `support@petposture.com`; dùng verified settings.

---

## 8.3. Newsletter chưa đạt double opt-in

`C:\laragon\www\petposture\backend\app\Http\Controllers\Api\NewsletterController.php`:

- lưu subscriber ở trạng thái subscribed trước khi confirmation hoàn tất;
- không thấy signed confirm/unsubscribe flow đầy đủ;
- swallow lỗi gửi confirmation;
- callsite `Mail::send(new NewsletterConfirmation($email))` không thể hiện rõ recipient assignment.

Frontend `Newsletter.tsx` hiển thị:

```text
You're in! Check your inbox.
Your 10% discount code is on its way.
```

ngay sau response API, dù confirmation email có thể thất bại.

### Khuyến nghị

- `pending` trước confirmation.
- Confirmation token có expiry.
- Chỉ chuyển `subscribed` sau click xác nhận.
- Unsubscribe token signed.
- Không hứa discount cho subscriber chưa verified nếu business policy không cho phép.
- Không swallow mail failure; ghi trạng thái retry.
- Có consent timestamp, source, IP/hash phù hợp privacy policy.
- Có bounce suppression.

---

## 8.4. Email jobs thiếu delivery idempotency rõ ràng

Các job:

- `SendOrderConfirmationJob`
- `SendOrderLifecycleEmailJob`

được queue/after commit nhưng chưa thấy:

- explicit tries;
- backoff policy rõ;
- delivery record;
- deduplication key;
- provider message ID;
- idempotency guard.

Ngược lại `DispatchOutboundWebhook` có retry count nhưng non-2xx lại gọi `fail()` cho mọi trường hợp, làm mất cơ hội retry transient 5xx/network failure.

---

# 9. Admin Panel

## Điểm mạnh

- Filament auto-discovery và nhiều resource commerce/content.
- React admin có module cho:
  - posts;
  - pages;
  - breeds;
  - solutions;
  - products;
  - taxonomy;
  - media;
  - custom fields.
- Admin có một số unit/API tests.
- Product/Post policy classes đã được tạo.

## Khoảng trống

- Chưa thấy Email Delivery/Newsletter/Contact inbox resource chuyên dụng.
- Chưa thấy review moderation/evidence workflow đủ mạnh.
- Role gate hiện coarse.
- API admin và Filament có role matrix khác nhau.
- Một số `FormRequest::authorize()` trả `true`, phụ thuộc hoàn toàn vào middleware/controller.
- Chưa thấy audit log đầy đủ cho:
  - SEO changes;
  - canonical changes;
  - price changes;
  - publish/unpublish;
  - refund/payment action;
  - role changes.
- Product canonical override vẫn hiện diện trong admin dù Blueprint yêu cầu Product không hỗ trợ custom canonical override.

## Canonical override violation

`UpdateProductRequest.php` vẫn nhận:

```text
seo.canonical_url
```

Trong khi Blueprint quy định:

- Product canonical không được custom override.
- Chỉ được lấy từ `ProductRouteService`.
- Admin field phải hidden/read-only hoặc ghi rõ unsupported.

Đây là lỗi governance nghiêm trọng vì tạo ra UI control mà storefront có thể silently ignore.

---

# 10. Social, affiliate và analytics

## Social

Hiện có:

- Facebook;
- Instagram;
- một số profile links/icon;
- settings/footer/header/blog references.

Nhưng chưa thấy integration thực sự với:

- Facebook Graph/API;
- Instagram API;
- Pinterest API;
- TikTok API;
- YouTube API;
- OAuth;
- inbound social webhook;
- social publishing queue;
- analytics attribution sync.

`SettingSeeder.php` còn seed `twitter`, trong khi Blueprint xác định Facebook, Instagram, Pinterest, TikTok, YouTube là distribution layer chính.

### Đánh giá

Website đang có social profile linking, chưa có social platform integration. Đây không phải lỗi blocker commerce, nhưng chưa đạt mục tiêu social distribution/measurement dài hạn.

## Affiliate

Có driver/sync/report/click infrastructure cho các network kiểu Amazon/CJ/Impact.

Cần tiếp tục xác minh:

- provenance của giá/availability;
- reconciliation với network;
- expired link handling;
- affiliate disclosure hiển thị rõ trên page;
- `rel="sponsored nofollow"` đã có ở một số component, nhưng chưa đủ để kết luận visible disclosure hiện diện ở tất cả affiliate pages.

## Analytics

Google Analytics được consent-gated trong:

`C:\laragon\www\petposture\frontend\components\GoogleAnalytics.tsx`

Đây là điểm tốt.

Khoảng trống:

- chưa thấy ecommerce event taxonomy đầy đủ;
- chưa thấy server-side order reconciliation;
- chưa thấy consent audit/export;
- widget backend vẫn có placeholder analytics language;
- cần kiểm tra không fire analytics trước consent trong mọi layout/route.

---

# 11. Reliability, deployment và CI/CD

## Điểm tốt

- Queue worker và scheduler thực sự chạy qua supervisor.
- Redis được đưa vào Docker compose.
- Payment webhook có một số cấu trúc idempotency.
- Preview request dùng `no-store`.
- Backend có Pint/PHPStan/test command trong CI.
- Admin có Vitest script.

## Khoảng trống

### Docker/runtime

`docker-compose.prod.yml` chưa thấy:

- healthcheck đầy đủ;
- metrics;
- tracing;
- log shipping;
- queue lag monitoring;
- alerting;
- database backup/restore verification.

Không nên kết luận “không có worker/scheduler”; thực tế supervisor đã chạy chúng. Vấn đề là thiếu observability và failure visibility.

### CI

`C:\laragon\www\petposture\.github\workflows\ci.yml`:

- backend CI ép `QUEUE_CONNECTION=sync`, nên không kiểm tra behavior queue thực tế;
- frontend có lint/typecheck/build nhưng thiếu frontend integration tests;
- admin chưa được đưa đầy đủ vào CI gate;
- chưa thấy SSR/canonical/schema/sitemap tests;
- chưa thấy security tests cho checkout/payment/IDOR/XSS;
- chưa thấy migration data integrity test cho review mapping.

### Documentation drift

Các file:

- `ARCHITECTURE.md`;
- `frontend/README.md`;
- `backend/README.md`;

không hoàn toàn phản ánh trạng thái hiện tại.

Có mâu thuẫn giữa:

- Docker/VPS description;
- `frontend/vercel.json`;
- API/env assumptions;
- legacy/Lunar architecture;
- lịch sử “fixed” trong `RULES.md`.

Đây là rủi ro process: engineer có thể triển khai theo tài liệu sai.

---

# 12. Risk register tổng hợp

| ID | Mức độ | Khu vực | Rủi ro | Conceptual fix |
|---|---|---|---|---|
| R-01 | Critical | Checkout | Token-only session access | Owner binding, signed guest proof, TTL, state machine |
| R-02 | Critical | Payment/order | IDOR/PII/payment-intent leakage | Public DTO tối thiểu, opaque tracking token, anti-enumeration |
| R-03 | Critical | SEO | Laravel `/products` khác storefront `/shop` | Một canonical resolver, Next final graph |
| R-04 | High | Routing | Sai category có thể trả 200 | Validate category, direct 301/308 |
| R-05 | High | Routing | Collection đầu tiên không deterministic | Explicit canonical collection/priority |
| R-06 | Critical | Trust/schema | Rating/review từ attributes | Aggregate từ approved eligible reviews |
| R-07 | High | Reviews | Không purchase verification/approval đủ mạnh | Order-line evidence, moderation, anti-abuse |
| R-08 | Critical | Data trust | Mock products fallback production | Remove mock fallback, explicit error state |
| R-09 | High | Security | Raw CMS HTML/XSS | Server sanitizer, CSP, allowlist |
| R-10 | Critical | Sitemap | Hai sitemap owner, sai taxonomy/indexability | Next owner duy nhất, backend DTO |
| R-11 | High | SEO | Admin SEO chưa render đầy đủ SSR | Normalize `PublicSeo`, SSR integration tests |
| R-12 | High | SEO | Product canonical override trái contract | Hide/read-only/ignore with validation |
| R-13 | High | Auth | Token localStorage + duplicate cookie auth | HttpOnly session, single auth channel |
| R-14 | High | Admin | Coarse role, policy không nhất quán | Per-action permissions/policies |
| R-15 | High | Email | Contact gửi sync, duplicate khi retry | Queue + inbound record + idempotency |
| R-16 | High | Newsletter | Không double opt-in, swallow lỗi mail | Pending state, signed confirmation, delivery status |
| R-17 | High | Data | Review migration có thể orphan | Backfill/reconcile trước drop FK |
| R-18 | Medium | Content | Future post có thể public | Filter `published_at <= now()` |
| R-19 | Medium | Performance | JSON cast LIKE/unindexed search | Normalized/indexed fields/search engine |
| R-20 | Medium | Performance | `inRandomOrder`, sitemap load all | Deterministic cache/chunk/cursor |
| R-21 | Medium | API | `/api` và `/api/v1` cùng đăng ký | Versioning policy duy nhất |
| R-22 | Medium | Config | API env fallback localhost | Fail-fast env validation, correct CI variable |
| R-23 | Medium | Operations | Mail default `log`, thiếu bounce/metrics | Provider validation, delivery observability |
| R-24 | Medium | Documentation | Architecture/README drift | Cập nhật runbook và source of truth |
| R-25 | Medium | Social | Chỉ profile links, chưa có platform integrations | Distribution roadmap/API/OAuth nếu thực sự cần |
| R-26 | Medium | Affiliate | Disclosure/provenance chưa chứng minh đầy đủ | Visible disclosure, link provenance/reconciliation |
| R-27 | Medium | SEO content | Legacy health/ergonomic/verified claims | Claim inventory, evidence gate, content lint |
| R-28 | Medium | CI | Thiếu admin/frontend/SSR/security tests | Mở rộng acceptance gate |

---

# 13. Roadmap ưu tiên đề xuất

## P0 — Không mở rộng content trước khi hoàn tất

1. Khóa checkout session theo ownership/secure possession proof.
2. Bảo vệ payment intent, confirm, retry-payment và public order lookup.
3. Xác định canonical resolver duy nhất.
4. Sửa wrong-category routing và redirect direct.
5. Tắt backend Product JSON-LD độc lập hoặc chuyển về canonical contract.
6. Xóa mock/fake product fallback khỏi production.
7. Tắt các claim:
   - fake rating;
   - fake review count;
   - Verified không có evidence;
   - Veterinary approved;
   - unsupported medical/testing claims.
8. Chọn Next.js làm sitemap owner duy nhất.
9. Exclude noindex/draft/redirect/noncanonical URLs.
10. Sanitize toàn bộ HTML từ CMS/API.
11. Xác định Product indexability state duy nhất.

## P0.5 — Hoàn thiện technical contract

1. Chuẩn hóa `PublicSeo` DTO.
2. Chuẩn hóa metadata precedence.
3. Tách Laravel facts khỏi Next final graph.
4. Xóa/hide Product canonical override.
5. Làm deterministic `ProductRouteService`.
6. Chuẩn hóa canonical taxonomy/slugs.
7. Xây test harness cho SSR/canonical/schema/sitemap.

## P1 — Trust và commerce correctness

1. Review evidence/order linkage/moderation.
2. Server-authoritative checkout totals.
3. Idempotency cho payment/confirm/email.
4. Public order tracking DTO tối thiểu.
5. Review migration backfill/reconciliation.
6. Double opt-in newsletter.
7. Queue contact/email lifecycle.
8. Admin role/permission matrix.
9. Publish/schedule rules cho blog/page/product.

## P2 — Quality/performance

1. Chuẩn hóa search/index.
2. Cursor pagination và sitemap chunking.
3. Cache invalidation rõ ràng.
4. Frontend/admin integration tests.
5. Docker healthcheck, queue lag, metrics, logs, alerts.
6. Cập nhật README/runbook/deployment docs.

## P3-P5 — Chỉ triển khai sau acceptance gate

- Mở rộng content clusters.
- So sánh/affiliate content mới.
- AI SEO/scoring/automation.
- Social publishing integrations.
- Demand intelligence/private label flows.
- Mass page generation.
- Breed × product routes mới.

---

# 14. Acceptance tests bắt buộc

## Canonical/routing

- Product đúng category → canonical HTTP 200.
- Product sai category → direct 301/308.
- Old slug → direct 301/308.
- Không có redirect chain.
- `canonicalUrl === openGraph.url`.
- JSON-LD primary URL = canonical.
- Internal product links = canonical.
- Product nhiều collection vẫn cho cùng một canonical.

## Sitemap

- Lấy đủ toàn bộ product/post qua pagination.
- Không có draft/future/noindex.
- Không có redirect URL.
- Không có deprecated taxonomy.
- Mỗi URL trong sitemap là canonical.
- `lastModified` lấy từ entity update thật.
- Backend sitemap cũ không còn là competing owner.

## Schema/trust

- Product không có eligible review → không có `aggregateRating`.
- Review unverified → không render “Verified”.
- Rating aggregate khớp approved eligible reviews.
- Price/schema khớp giá đang hiển thị.
- Affiliate page có visible disclosure.
- Không có fake number/claim trong production fixture.

## Checkout/security

- User/session A không đọc được session B.
- Token expired bị từ chối.
- Token đã confirm không replay được.
- Tấn công sửa subtotal/discount/tax/payment status bị ignore/reject.
- Confirm retry không tạo duplicate order.
- Payment intent không lộ qua public order lookup.
- Retry-payment có anti-enumeration và rate limit.
- Public order response không chứa address/payment/PII dư thừa.

## Content/XSS

- Blog HTML có script/event handler → bị strip.
- Legal HTML có `javascript:` URL → bị strip.
- Product description unsafe HTML → bị strip.
- CSP được bật và không có inline script ngoài allowlist.

## Admin

- Từng role được test theo từng action.
- Product Manager không thể refund nếu không có permission.
- Support không thể publish content nếu không có permission.
- Editor không thể sửa canonical/payment.
- Filament, React admin và API trả cùng một quyết định authorization.

## Email

- Production fail fast nếu mailer là `log`.
- Contact retry không tạo duplicate.
- Newsletter chỉ subscribed sau confirmation.
- Confirmation email lỗi tạo retry state.
- Order email có delivery idempotency.
- Webhook 5xx được retry, 4xx được dead-letter/alert.

---

# 15. Kết luận cuối

PetPosture **không phải dự án thiếu nền tảng**. Nền tảng kiến trúc và chức năng đã khá rộng, đặc biệt ở:

- Next/Laravel separation;
- Lunar/Filament commerce foundation;
- breed/solution editorial model;
- payment gateway abstraction;
- queue/scheduler;
- admin module coverage.

Nhưng hiện tại dự án vẫn ở trạng thái:

> **Feature-complete ở mức prototype/early commerce, chưa contract-complete ở mức production SEO/security/trust.**

Ba điều kiện phải được ưu tiên cao nhất:

1. **Bảo vệ checkout, payment và order data.**
2. **Thống nhất canonical/SEO/schema/sitemap end-to-end.**
3. **Loại bỏ fake/mock/unsupported evidence và thiết lập review provenance.**

Nếu chưa hoàn tất ba nhóm này, việc tiếp tục mở rộng content, affiliate pages, AI SEO hoặc mass route generation sẽ làm tăng:

- duplicate index;
- trust/compliance exposure;
- payment attack surface;
- cleanup cost;
- khó khăn trong migration dữ liệu.

## Tình trạng file trong workspace

Tôi không dùng `write` hoặc `edit` trong lượt audit này. Tuy nhiên, lần kiểm tra cuối cho thấy working tree đã có nhiều file modified/untracked từ trước hoặc từ các hoạt động khác, gồm cả frontend, admin, backend và docs. Vì không có baseline clean tại đầu lượt audit, không thể quy kết từng diff cho lịch sử trước đó chỉ bằng trạng thái cuối. Không nên dùng trạng thái hiện tại để suy ra rằng toàn bộ thay đổi đó do audit này tạo ra.