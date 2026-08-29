# SEO P1 round 2 — Public SEO DTO + SSR metadata + robots — brief cho ChatGPT (2026-08-29)

Context: Round 1 đã xong (`commit 58302ea`, hợp nhất sitemap). Đây là **round 2 của P1** — scope: P1.2 (Public SEO DTO), P1.3 (Next.js SSR đọc DTO cho Product), P1.5 (robots/indexability). **KHÔNG làm P1.7 (JSON-LD render + Breadcrumb/Collection/Blog/FAQ schema) hay P1.8 (verify cuối)** trong đợt này — để round 3.

## Quy tắc cứng đã đóng băng — đọc trước khi code

`docs/SEO-TECHNICAL-CONTRACT-v1.1.md` §2A quyết định #7: **"Product canonical override: disabled in P0/P1; admin field hidden/read-only/unsupported."** Nghĩa là: dù admin form có field `canonical_url` (`backend/app/Models/SeoMetadata.php` có cột này), **TUYỆT ĐỐI KHÔNG expose `canonical_url` ra public API và KHÔNG dùng nó ở frontend** trong đợt P1 này. Canonical URL của Product luôn luôn phải đến từ `ProductRouteService` (đã đúng từ P0), không bao giờ từ admin override. Field `canonical_url` cứ để nguyên trong admin (không cần ẩn UI, chỉ cần không đọc/dùng nó ở phía public).

## P1.2 — Public SEO DTO cho Product

**Mẫu có sẵn, copy đúng pattern**: `backend/app/Http/Resources/Api/PostResource.php:63-79` (`resolveSeo()`) — Post public resource đã trả `title, keyphrase, description, og_title, og_description, og_image` từ `$this->seo` (Post dùng trait `HasSeo`, `backend/app/Traits/HasSeo.php`).

`backend/app/Http/Resources/Api/ProductResource.php` (public, `toArray()` dòng 14-83) **hiện chưa có gì** — chỉ trả JSON-LD tự build ở key `seo` (khác nghĩa hoàn toàn, xem `buildJsonLd()` dòng 279+). Cần:

1. `Lunar\Models\Product` là model vendor, không tự thêm `HasSeo` trait được — **dùng đúng pattern query trực tiếp** mà `backend/app/Http/Resources/Admin/ProductResource.php:21-24` đã làm: `SeoMetadata::query()->where('seoable_type', Product::class)->where('seoable_id', $this->id)->first()`.
2. Thêm 1 key mới, ví dụ `seoMeta` (không được trùng key `seo` đang dùng cho JSON-LD — đặt tên khác để tránh xung đột, tự chọn tên miễn nhất quán với những gì frontend sẽ đọc ở P1.3), trả về (theo đúng thứ tự field như Post, KHÔNG có `canonical_url`):
   ```php
   'title' => $seo?->title,
   'description' => $seo?->description,
   'og_title' => $seo?->og_title,
   'og_description' => $seo?->og_description,
   'og_image' => $seo?->og_image,
   'is_indexable' => $seo?->is_indexable ?? true,
   'is_followable' => $seo?->is_followable ?? true,
   ```
3. **Đồng thời bổ sung `is_indexable`/`is_followable` vào `resolveSeo()` của `PostResource.php`** (public) — hiện Post cũng CHƯA expose 2 field này (đã kiểm tra `resolveSeo()` dòng 63-79, không có), mà P1.5 cần chúng cho cả Product lẫn Post. Không đổi các key khác đang có, chỉ thêm 2 field mới, giữ `array_filter` cho các field có thể null nhưng để `is_indexable`/`is_followable` luôn có mặt (dùng default `true` như trên, không filter mất nếu true).
4. `og_image` cho Product: `SeoMetadata.og_image` là string thô, kiểm tra Post có resolve qua `resolveAssetUrl()` (dòng 77) — Product cần logic tương đương nếu `og_image` không phải URL tuyệt đối (tự kiểm tra cách `resolveAssetUrl` hoạt động, dùng lại nếu đã có helper chung, đừng viết lại logic asset-url).

## P1.3 — Next.js SSR metadata cho Product

**Mẫu có sẵn**: `frontend/app/blog/[slug]/page.tsx:123-155` (`generateMetadata`) — Product page cần làm y hệt pattern này.

`frontend/app/shop/[category]/[slug]/page.tsx` (`generateMetadata`, khoảng dòng 91-111 sau các lần sửa P0) hiện chỉ build từ `product.name`/`product.description`. Cần đổi sang đọc field SEO mới (`product.seoMeta` hoặc tên đã chọn ở P1.2) với fallback y hệt cấu trúc blog:
```ts
const title = seo?.title || product.name;
const description = seo?.description || <mô tả cũ đang dùng làm fallback, giữ nguyên>;
const ogTitle = seo?.og_title || title;
const ogDescription = seo?.og_description || description;
const ogImage = seo?.og_image || product.image || undefined;
```
Giữ nguyên `alternates.canonical` đang dùng `product.categorySlug`/`product.slug` (đã đúng từ P0, **không đổi**, không dùng bất kỳ override nào ở đây).

Cập nhật `frontend/types/shop.ts` — thêm field `seo`/`seoMeta` (tên khớp với P1.2) vào type `Product` với shape optional, tất cả field optional.

## P1.5 — Robots/indexability

Thêm `robots: { index: boolean, follow: boolean }` vào `Metadata` return của **cả 2 nơi**:
- `frontend/app/shop/[category]/[slug]/page.tsx` (`generateMetadata`) — dùng `is_indexable`/`is_followable` từ field mới ở P1.2 (default `true`/`true` nếu không có SEO record, khớp default backend).
- `frontend/app/blog/[slug]/page.tsx` (`generateMetadata`) — tương tự, dùng field mới thêm ở `resolveSeo()` P1.2.

Không cần đụng tới `frontend/app/robots.ts` (static disallow list cho account/cart/checkout) — đó là robots.txt tĩnh, khác với per-page `noindex` meta, không thuộc scope round này.

## Test cần có

- Backend: test public `GET /api/products/{id}` trả đúng `title/description/og_title/og_description/og_image/is_indexable/is_followable` khi có `SeoMetadata` row, và default `is_indexable=true`/`is_followable=true` khi không có row. Test riêng xác nhận **`canonical_url` KHÔNG xuất hiện** ở bất kỳ đâu trong response public (kể cả field mới lẫn field JSON-LD cũ).
- Backend: test tương tự cho public `GET /api/posts/{slug}` xác nhận `is_indexable`/`is_followable` mới thêm hoạt động đúng, không phá vỡ các field cũ đã có.
- Frontend: test (source-contract kiểu `.test.mjs` như đã dùng ở P0/round 1) cho `generateMetadata` của Product page — override có mặt thì dùng override, không có thì fallback đúng như cũ; `robots.index`/`robots.follow` phản ánh đúng `is_indexable`/`is_followable` (bao gồm trường hợp `false`).
- Tương tự cho Blog page `generateMetadata` — thêm test cho `robots` mới.

## Không cần làm trong round này

- JSON-LD render ra `<script type="application/ld+json">` cho trang Product — để round 3 (P1.7).
- BreadcrumbList/CollectionPage/BlogPosting/FAQPage schema — round 3.
- Không đổi gì ở `ProductRouteService.php`, `sitemap.ts`, hay bất kỳ chỗ nào round 1 đã sửa.

## Kết quả review 2026-08-29 (Claude)

Code đúng scope, canonical_url không leak (đã tự verify lại), test kỹ, TypeScript/build/PHP lint sạch. **Nhưng finding N+1 mà chính ChatGPT tự nêu ở báo cáo là CÓ THẬT, đã verify bằng test đo query count**: seed 5 sản phẩm, gọi `GET /api/products?per_page=100` → đúng 5 query `seo_metadata` riêng lẻ (1 query/sản phẩm). Vì `ProductController::productQuery()` (helper dùng chung cho `index()`, `related()`, và — qua `resolvePublishedProduct()`/`hasValidPreviewToken()`/`resolveRedirectProduct()` — cả `show()`) đã có sẵn pattern correlated-subquery để tránh N+1 cho rating từ P0, nhưng `ProductResource::toArray()` ở round 2 lại tự chạy 1 query `SeoMetadata::query()->where(...)->first()` riêng cho từng instance thay vì dùng chung pattern đó.

**Tác động thật**: endpoint `/api/products` được `frontend/app/sitemap.ts` (round 1) gọi để lấy TOÀN BỘ catalog qua nhiều trang — nghĩa là mỗi lần Next.js build lại sitemap sẽ phát sinh thêm N query `seo_metadata` (N = tổng số sản phẩm published). Không phải lý thuyết, là chi phí thật mỗi lần sitemap regenerate.

**Cần fix trước khi commit** — áp dụng đúng pattern đã dùng cho rating aggregate ở P0:

1. Mở rộng `ProductController::productQuery()` (chỗ đã có 2 `selectSub()` cho `approved_reviews_avg_rating`/`approved_reviews_count`) thêm 1 `leftJoin` vào bảng `seo_metadata` theo điều kiện `seo_metadata.seoable_id = lunar_products.id AND seo_metadata.seoable_type = <Product::class morph value>`, rồi `select` thêm các cột với alias tránh đụng cột gốc, ví dụ:
   ```php
   ->leftJoin('seo_metadata', function ($join) {
       $join->on('seo_metadata.seoable_id', '=', 'lunar_products.id')
            ->where('seo_metadata.seoable_type', \Lunar\Models\Product::class);
   })
   ->addSelect([
       'seo_metadata.title as seo_meta_title',
       'seo_metadata.description as seo_meta_description',
       'seo_metadata.og_title as seo_meta_og_title',
       'seo_metadata.og_description as seo_meta_og_description',
       'seo_metadata.og_image as seo_meta_og_image',
       'seo_metadata.is_indexable as seo_meta_is_indexable',
       'seo_metadata.is_followable as seo_meta_is_followable',
   ])
   ```
   (tên bảng `seo_metadata` và điều kiện `seoable_type` — verify lại đúng migration/model, đã xem `backend/app/Models/SeoMetadata.php` dùng `$fillable` với `seoable_id`/`seoable_type` chuẩn Laravel polymorphic, nhưng tự kiểm tra tên bảng thật trong migration trước khi viết raw SQL).
2. Sửa `ProductResource::toArray()` — xóa hẳn dòng `SeoMetadata::query()->where(...)->first()`, đọc trực tiếp từ các thuộc tính đã join sẵn trên `$this` (ví dụ `$this->seo_meta_title`, `$this->seo_meta_is_indexable ?? true`, ...). Vì `is_indexable`/`is_followable` là cột boolean nhưng khi lấy qua raw `leftJoin` sẽ ra kiểu int/string (`0`/`1`) thay vì cast boolean tự động như khi query qua Eloquent model `SeoMetadata` — cần ép kiểu tường minh (`(bool)`) và xử lý đúng trường hợp `NULL` (không có row) → default `true`, phân biệt với `0` (explicit false) → phải giữ `false`, không được để `(bool) null` với `?? true` áp sai thứtự (viết test cho đúng cả 2 case, giống test đã có cho case JSON path hiện tại).
3. Giữ nguyên `resolveSeoImageUrl()` helper, không đổi logic asset-url.
4. Thêm lại test đo query count (giống cách `test_product_index_uses_one_set_based_review_aggregate_query_for_multiple_products` đã làm cho rating ở P0) để khẳng định N+1 đã hết — seed nhiều sản phẩm, gọi `/api/products`, assert số query chứa `seo_metadata` là ≤ 1 (không tăng theo số sản phẩm).
5. Sau khi sửa, chạy lại đúng 2 test đã có ở round 2 (`test_public_product_exposes_seo_meta_without_canonical_url`, `test_public_product_seo_meta_defaults_follow_and_index_true_without_metadata`) để đảm bảo hành vi cũ không đổi, chỉ đổi cách lấy dữ liệu.

Không cần đổi gì ở phía Post — `PostController::index()` đã eager-load quan hệ `'seo'` sẵn (dòng `Post::with([..., 'seo', ...])`), không có N+1 tương tự.

## Sau khi code xong

Không commit/push — báo lại để Claude (session này) review + verify bằng test thật trước khi commit, theo đúng quy trình đã dùng cho P0 và round 1. User sẽ push gộp cả round 1 + round 2 sau khi cả 2 đã review xong.
