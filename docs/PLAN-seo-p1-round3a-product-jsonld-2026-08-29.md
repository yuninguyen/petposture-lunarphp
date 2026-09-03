# SEO P1 round 3a — Product JSON-LD render + BreadcrumbList — brief cho ChatGPT (2026-08-29)

Context: Round 1 (`58302ea`) + Round 2 (`542f957`) đã merge. Đây là **round 3a của P1** — scope hẹp: render Product JSON-LD đã build sẵn ở backend ra HTML thật, cộng thêm BreadcrumbList. **KHÔNG làm CollectionPage/BlogPosting/FAQPage** trong đợt này — để round 3b/4.

## Quy tắc ownership — đọc trước khi code

`docs/SEO-TECHNICAL-CONTRACT-v1.1.md` §7A: **Laravel authoritative cho domain facts** (price, rating, availability, SKU — đã tính đúng ở backend từ P0). **Next.js chỉ compose graph cuối** (ghép Product node + BreadcrumbList + tham chiếu Organization/WebSite), **KHÔNG được tự tính lại** rating/giá/availability ở frontend. Nghĩa là: lấy nguyên object `product.seo` (JSON-LD Product backend đã build) và dùng thẳng, không sửa field nào bên trong, chỉ thêm BreadcrumbList bên cạnh.

## Việc 1: Render Product JSON-LD

- Backend đã có sẵn, không cần sửa: `backend/app/Http/Resources/Api/ProductResource.php::buildJsonLd()` (dòng ~279+) trả object ở key `'seo'` trong response — gồm `@context, @type: Product, name, url, description?, image?, sku?, offers{@type: Offer, price, priceCurrency, availability, url}, aggregateRating?{@type, ratingValue, reviewCount}` (chỉ có khi có review thật, đã đúng từ P0).
- `frontend/types/shop.ts` — `Product` interface (dòng 49-76) **hiện chưa khai báo field `seo`** (đừng nhầm với `seoMeta` đã thêm ở round 2, là 2 field khác nhau hoàn toàn). Thêm 1 type mới, ví dụ `ProductJsonLd`, khớp đúng shape backend trả, gắn vào `Product.seo?: ProductJsonLd | null`.
- `frontend/app/shop/[category]/[slug]/page.tsx` — trong component `Page` (dòng ~123-162), thêm `<script type="application/ld+json">` render `product.seo` **nguyên trạng, không sửa field nào bên trong** (đúng ownership rule ở trên). Tham khảo cách `frontend/app/layout.tsx:131-135` đã render JSON-LD (dùng `dangerouslySetInnerHTML={{ __html: JSON.stringify(...) }}`, có `nonce` cho CSP — copy đúng pattern nonce này, xem `layout.tsx:88,131` cách lấy `nonce` từ `headers()`).
- Nếu `product.seo` là `null`/`undefined` (trường hợp hiếm, kiểm tra khi nào backend không trả field này) thì không render script tag, không throw lỗi.

## Việc 2: BreadcrumbList

- `frontend/components/product/Breadcrumbs.tsx` hiện chỉ render UI (`Home > Shop > {category} > {productName}`), không có structured data. Chỉ dùng ở đúng 1 nơi: `frontend/components/product/ProductDetails.tsx` (đã grep xác nhận).
- Thêm JSON-LD `BreadcrumbList` phản ánh đúng breadcrumb đang hiển thị — 3 hoặc 4 `ListItem` tuỳ có category cụ thể hay không (theo đúng logic `isCategoryGeneric` đã có ở `Breadcrumbs.tsx:14`):
  ```json
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "<SITE_URL>/" },
      { "@type": "ListItem", "position": 2, "name": "Shop", "item": "<SITE_URL>/shop" },
      { "@type": "ListItem", "position": 3, "name": "<category>", "item": "<SITE_URL>/shop/<categorySlug>" },
      { "@type": "ListItem", "position": 4, "name": "<productName>", "item": "<canonical product URL>" }
    ]
  }
  ```
- Vị trí render: cùng trang Product (`shop/[category]/[slug]/page.tsx`), có thể gộp `Product` + `BreadcrumbList` vào 1 script `@graph` (giống cách `layout.tsx:95-116` đã làm cho Organization+WebSite) hoặc 2 script tag riêng — tự quyết định miễn cả 2 đều xuất hiện hợp lệ trong `<head>`/`<body>` và pass Google Rich Results test (không bắt buộc phải test bằng công cụ ngoài, chỉ cần đúng cấu trúc schema.org).
- `<SITE_URL>` dùng đúng `frontend/lib/site.ts`'s `SITE_URL` export (không hardcode domain).

## Test cần có

- Frontend source-contract test (`.test.mjs` như đã dùng các round trước): assert Product page render đúng `<script type="application/ld+json">` chứa `@type: Product` với field khớp `product.seo` (không bị sửa đổi giá trị), và 1 script/node `@type: BreadcrumbList` với đúng số `ListItem` theo 2 trường hợp (có category cụ thể / category generic "categories").
- Assert khi `product.seo` là `null`, không có script tag Product bị render rỗng/lỗi (nhưng BreadcrumbList vẫn render bình thường vì nó không phụ thuộc `product.seo`).
- Assert `nonce` được set đúng trên script tag mới (giống cách `layout.tsx` đã làm), không vi phạm CSP.

## Không cần làm trong round này

- CollectionPage cho `/shop`, `/shop/breeds/[slug]`, `/shop/solutions/[slug]` — round sau.
- BlogPosting/Article cho `/blog/[slug]` — round sau.
- FAQPage cho `/faqs` — round sau.
- P1.8 (verify canonical=OG=JSON-LD=sitemap end-to-end) — làm sau khi tất cả JSON-LD types xong, không phải ngay sau round này.

## Sau khi code xong

Không commit/push — báo lại để Claude (session này) review + verify bằng test thật trước khi commit, theo đúng quy trình các round trước.
