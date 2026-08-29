# SEO P0 emergency fixes — brief cho ChatGPT (2026-08-29)

Context: `docs/SEO-P0-P1-IMPLEMENTATION-PLAN-v1.1.md` + `docs/SEO-TECHNICAL-CONTRACT-v1.1.md` là 2 doc gốc, đọc kỹ trước khi code — brief này chỉ tóm tắt điểm code cụ thể để tiết kiệm thời gian audit lại, không thay thế 2 doc đó. Phạm vi: **chỉ P0** (7 việc khẩn cấp — rủi ro pháp lý/uy tín). **KHÔNG làm P1** (canonical resolver dùng khắp nơi, Public SEO DTO, JSON-LD đầy đủ, hợp nhất sitemap) — P1 đã lưu backlog riêng, làm ở phiên sau.

Thứ tự khuyến nghị trong chính plan: T7 → T4 → T3 → T5 → T2 → T1 → T6.

## Đã làm xong (Claude, 3 file nhỏ, chưa commit)

- `backend/app/Services/AiSeoGeneratorService.php` — **P0-T7**: thay prompt "pet-ergonomics e-commerce/editorial" bằng Blueprint positioning + Claim Safety block đúng baseline ở Contract v1.1 §14.
- `frontend/app/layout.tsx` — **P0-T4** (một phần): bỏ "Ergonomic Essentials for Your Pet" / "posture and health needs" ở default title/OG/Twitter/description/alt text.
- `frontend/components/FaqsPage.tsx` — **P0-T4** (một phần): sửa nốt "Productivity" (không phải Solution có thật) → "Feeding"; bỏ "ergonomic bowls" / "ergonomic pet products".

## P0-T4 — còn lại (Claims/positioning cleanup)

Grep từ "ergonomic" ra thêm các chỗ sau, **chưa sửa**, cần rà và thay bằng ngôn ngữ Blueprint (breed-focused, practical research, carefully selected, fit, materials, dimensions, usability, cleaning, everyday access/comfort):

- `frontend/app/shop/[category]/[slug]/page.tsx:81` — `` `${product.name} — ergonomic essentials from PetPosture.` ``
- `frontend/components/ShopPage.tsx:32` — `heroTitle = 'Ergonomic essentials, organized like a real catalog.'`
- `frontend/app/shop/breeds/page.tsx:11,84` — `'Ergonomic essentials matched to your dog\'s anatomy.'`
- `frontend/app/shop/solutions/[slug]/page.tsx:77,127` — `` `Ergonomic essentials for ${solution.name.toLowerCase()}.` `` (dùng làm description fallback)
- `frontend/app/shop/breeds/[slug]/page.tsx:77,127` — `` `Ergonomic essentials built for ${breed.name}.` `` (dùng làm description fallback)
- `frontend/app/blog/[slug]/page.tsx:133` — fallback description `'Pet ergonomics tips'` khi post không có SEO description/content

Không cần sửa `frontend/scratch/*.html` (file scratch, không nằm trong route nào).

**P0-T5 liên quan (Testing evidence)** — `frontend/components/HomePage.tsx:401`: `"We clearly distinguish between products we've researched and products we've physical tested."` — đây là câu tuyên bố chung, không gắn với sản phẩm cụ thể nào, và **không có model/table nào ở backend lưu bằng chứng test thật** (đã grep `product_test`/`ProductTest`/`test_record` — không tìm thấy gì). Không có badge "Tested" nào gắn per-product trong `frontend/components/product/*`. Vì vậy rủi ro thấp hơn (không phải per-product false claim), nhưng vẫn nên quyết định 1 trong 2 hướng trước khi coi P0-T5 là xong:
1. Giữ câu này nhưng làm rõ đây là quy trình chung của công ty (không đổi), và **không thêm bất kỳ badge "Tested"/"Long-Term Tested" nào gắn per-product** cho tới khi có bảng evidence thật.
2. Hoặc bớt tuyệt đối hoá câu này nếu thấy vẫn có thể hiểu nhầm là mọi sản phẩm đều đã test.

## P0-T3 — Review verification integrity

- `backend/app/Models/Review.php:42-47` — `booted()` hook tự tính `is_verified` qua `ReviewPurchaseEvidenceService::qualifies()` mỗi lần save, đè lên bất kỳ giá trị nào set trước đó → **admin không thể tự ý set verified giả** (đã compliant về mặt data).
- Tuy nhiên `backend/app/Filament/Resources/ReviewResource.php:78` vẫn có `Forms\Components\Toggle::make('is_verified')` cho phép admin **tưởng là** họ đang set được — toggle này bị ghi đè âm thầm khi save, gây hiểu nhầm UX. Nên làm toggle này disabled/readonly (hiển thị trạng thái, không cho sửa) để tránh admin tưởng nhầm mình đang override được.
- **Vấn đề chính (P0-T2 cũng liên quan)**: `backend/app/Http/Resources/Api/ProductResource.php:57-59` và `:316-323` (`buildJsonLd()`) lấy `rating`/`reviews` từ **attribute admin tự gõ tay** (`translateAttribute('rating')`/`('reviews')`), KHÔNG tính từ bảng `reviews` thật (`status='approved'`). Đây chính là "fabricated evidence" plan cấm. Cần:
  - Thay `rating`/`reviewCount`/`reviews` trong `toArray()` bằng aggregate thật: `Review::where('lunar_product_id', $productId)->where('status', 'approved')->avg('rating')` và `count()`.
  - Trong `buildJsonLd()`: nếu `reviewCount === 0` thì **không** thêm `aggregateRating` vào JSON-LD (hiện tại logic `if ($rating > 0 && $reviewCount > 0)` đã đúng hướng — chỉ cần đổi nguồn dữ liệu đầu vào từ attribute sang aggregate thật).
  - `backend/app/Http/Controllers/Api/ProductController.php:211-213` — endpoint `reviews()` đã lọc đúng `status='approved'`, dùng làm tham chiếu cách query.
  - Cân nhắc N+1: nếu list nhiều sản phẩm cùng lúc (trang shop), nên eager-load review aggregate thay vì query riêng lẻ từng sản phẩm.

## P0-T2 — Remove production mock/fake fallback

- Trọng tâm chính đã nêu ở P0-T3 (rating/reviews giả).
- Rà thêm: kiểm tra `frontend/components/product/*` và trang danh sách sản phẩm có đường dẫn nào render dữ liệu mock/fake khi API lỗi hoặc rỗng không (chưa audit hết trong lượt này) — đảm bảo API error → error state rõ ràng, API rỗng → empty state rõ ràng, không tự bịa sản phẩm/giá/review.

## P0-T1 — Product authoritative URL

- `backend/app/Services/ProductRouteService.php` đã tồn tại (`categorySlug()`, `slug()`, `path()`) nhưng **chưa có logic validate category** — đúng theo plan, dùng resolver này làm canonical resolver chính thức, đừng viết resolver mới.
- `backend/app/Http/Controllers/Api/ProductController.php:162-199` (`show()`) hiện chỉ redirect khi **slug cũ** khớp `ProductRedirect` (dòng 180 `resolveRedirectProduct`) — **chưa có check category trong URL có khớp category thật của sản phẩm không**. Cần thêm: nếu request đến `/shop/{category}/{slug}` nhưng `{category}` không khớp `ProductRouteService::categorySlug($product)`, trả về redirect 301/308 sang URL đúng (dùng lại pattern `{redirect: {path, slug, categorySlug}}` đã có sẵn cho slug-redirect).
- `frontend/app/shop/[category]/[slug]/page.tsx:66-99` — `alternates.canonical` hiện build trực tiếp từ **category param trên URL request** (dòng 86), không phải từ resolver → cần đổi sang dùng category/slug trả về từ API (đã đi qua resolver ở backend) thay vì param thô. Dòng 70-72/111-113 đã có sẵn cơ chế gọi `redirect()` khi backend trả `redirect` — chỉ cần đảm bảo backend trả redirect cho cả 2 trường hợp (slug cũ VÀ category sai).
- Phạm vi P0-T1 (không phải P1.4 đầy đủ): chỉ cần sửa đúng chỗ này (canonical + redirect category sai). **Không cần** đổi sitemap/product-cards/related-products sang dùng resolver trong đợt P0 này — việc đó gộp vào P1.4 (đã lưu backlog).

## P0-T6 — Affiliate/comparison integrity

- Model liên quan: `backend/app/Models/AffiliateNetwork.php`, `AffiliateClick.php`, `AffiliateReport.php` — chưa audit field `source_url`/`checked_at`/disclosure logic trong lượt này. Cần tự kiểm tra: có lưu `source_url`/`checked_at` không, disclosure có tự động bật khi có affiliate link không, admin có thể tắt disclosure không (không được phép tắt khi có affiliate link).

## Kết quả review 2026-08-29 (Claude)

T1/T2/T3/T6 đã verify sạch bằng test thật (không chỉ tin báo cáo):
- Backend: `ProductControllerTest` 23/23, `ProductCatalogApiTest` 10/11 (1 fail pre-existing không liên quan — `oldPrice` chưa implement), `PostControllerComparisonTest` 16/16 pass.
- Full backend suite: 368 passed, 3 failed — cả 3 fail đều pre-existing, không liên quan (blog category slug, `ExampleTest` mặc định, `oldPrice`).
- Frontend: `tsc --noEmit` sạch, 10/10 source-contract test (`seo-error-states.test.mjs`, `ProductDetailCanonical.test.mjs`, `ProductReviews.test.mjs`) pass, `next build` production pass.
- Logic rating-aggregate (correlated subquery, không N+1), redirect category-sai, affiliate disclosure force-true đều đúng, code chất lượng cao.

**T4 (claims/positioning cleanup) CHƯA xong** — lỗi do brief gốc của Claude chỉ liệt kê 6 chỗ tìm thấy lúc đó, không phải audit toàn site như đúng yêu cầu P0-T4 ("global layout metadata, homepage copy, Product copy, FAQ, seeded/live settings, social metadata fallback"). Grep lại toàn bộ `frontend/` cho từ "ergonomic" (không phân biệt hoa thường) phát hiện các chỗ sau **chưa sửa**, cần sửa nốt bằng ngôn ngữ Blueprint (breed-focused, practical research, carefully selected, fit, materials, dimensions, usability, cleaning, everyday access/comfort) trước khi coi P0-T4 là xong:

- `frontend/app/blog/page.tsx:4-5` — page metadata: `title: "Blog - Ergonomic Pet Care Tips & Stories"`, `description: "...latest pet health tips, ergonomic guides..."` (cả "ergonomic" và "pet health" đều nằm trong banned list).
- `frontend/app/shop/page.tsx:9` — metadata `description: 'Elite ergonomic gear for your pet\'s best life...'`.
- `frontend/app/faqs/page.tsx:5` — metadata `description: "...PetPosture ergonomic products, shipping, and returns."` (khác với `frontend/components/FaqsPage.tsx` đã sửa nội dung trang — đây là file wrapper `metadata` export riêng, chưa đụng tới).
- `frontend/app/contact/page.tsx:6` — metadata `description: "...ergonomic pet essentials, order support, and expert posture advice."` (có cả "ergonomic" và "posture").
- `frontend/app/return-refund-policy/page.tsx:16` — metadata fallback description `"...ergonomic pet gear."`.
- `frontend/app/shipping-policy/page.tsx:16` — metadata fallback description `"...ergonomic pet essentials."`.
- `frontend/components/HomePage.tsx:581` — heading mục lớn trên trang chủ: `"The Ergonomic Difference"`.
- `frontend/components/product/ProductDetails.tsx:133` — hiển thị trên **mọi trang chi tiết sản phẩm** (live, không phải metadata): `{product.category} Ergonomics`.
- `frontend/components/Hero.tsx:32` — `alt="Ergonomic feeding stance"` (mức độ nhẹ hơn, vẫn nên sửa cho nhất quán).
- `frontend/components/ContactPage.tsx:143` — `"Have a question about ergonomics, order tracking, or breed-specific needs?"` (mức độ nhẹ hơn).

Không cần sửa `frontend/scratch/*.html` (dev scratch, không nằm trong route nào).

**Phát hiện thêm (không cần fix ngay, chỉ note)**: `frontend/components/ProductGrid.tsx` (khác với `frontend/components/shop/ProductGrid.tsx` mà `ShopPage.tsx` thực sự dùng) là **dead code không được import ở đâu cả** — chứa mock array với `rating: 5` giả, `oldPrice` giả hardcode. Không nguy hiểm vì không render, nhưng nếu tiện thì có thể dọn — không bắt buộc trong đợt P0 này.

## Sau khi code xong

Không tự commit/push — báo lại để Claude (session này) làm final review theo đúng quy trình đã dùng cho Catalogue: verify bằng test thật (không chỉ tin báo cáo), chạy full test suite, review diff, rồi mới commit/push.
