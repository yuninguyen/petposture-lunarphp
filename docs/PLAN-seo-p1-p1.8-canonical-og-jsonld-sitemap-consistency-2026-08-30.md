# SEO P1.8 — canonical = OG = JSON-LD = sitemap consistency — brief cho ChatGPT (2026-08-30)

Context: Round 1 (`58302ea`), Round 2 (`542f957`), Round 3a (`31e4ce8`), Round 3b/4 (`32aa24e`) đã merge. Đây là **P1.8 — round cuối của backlog P1**: verify và (nếu cần) sửa để 4 nguồn URL của cùng 1 trang (canonical, Open Graph `url`, JSON-LD `url`, sitemap entry) luôn trỏ về **đúng 1 địa chỉ tuyệt đối giống hệt nhau**, cho cả Product và Blog post.

## Phát hiện đã xác nhận trước khi giao việc

Đã đọc source, xác nhận: `openGraph` object trong `generateMetadata` của **Product** (`frontend/app/shop/[category]/[slug]/page.tsx:128-133`) và **Blog** (`frontend/app/blog/[slug]/page.tsx:150-155`) đều **không có field `url`**. Root layout (`frontend/app/layout.tsx:65-68`) có set `openGraph.url: SITE_URL` nhưng đây là default cho toàn site (trỏ về trang chủ), và theo cách Next.js resolve metadata, `openGraph` object của page con sẽ **thay thế toàn bộ** object của layout cha (không merge field-by-field) khi page con tự khai báo `openGraph` — nghĩa là `og:url` render ra cho trang Product/Blog hiện đang **rỗng/không có**, không phải sai lệch sang trang chủ, nhưng vẫn là một khoảng trống cần lấp cho mục tiêu "canonical = OG" của P1.8.

## Việc cần làm

### 1. Thêm `openGraph.url` cho Product

`frontend/app/shop/[category]/[slug]/page.tsx`, trong `generateMetadata` (dòng 120-140): thêm `url: `${SITE_URL}/shop/${product.categorySlug}/${product.slug}`` vào object `openGraph` (dòng 128-133) — dùng đúng `SITE_URL` (đã import sẵn ở dòng 14) + `product.categorySlug`/`product.slug`, là đúng nguồn field mà `alternates.canonical` (dòng 123) và JSON-LD `product.seo.url` (build ở backend qua `ProductRouteService`) đều dùng.

### 2. Thêm `openGraph.url` cho Blog

`frontend/app/blog/[slug]/page.tsx`, trong `generateMetadata` (dòng 140-161): thêm `url: `${SITE_URL}/blog/${slug}`` vào object `openGraph` (dòng 148-153) — cần import `SITE_URL` từ `@/lib/site` (kiểm tra trước xem file đã import chưa, tránh duplicate import).

### 3. Viết test cross-check 4 nguồn URL (trọng tâm của round này)

Đây là phần quan trọng nhất — không chỉ sửa 2 dòng trên mà phải có **test tự động khẳng định 4 nguồn luôn khớp nhau** cho cùng 1 sản phẩm/bài viết giả lập, để tránh lệch lại trong tương lai mà không ai biết:

- **Product**: với 1 object sản phẩm giả lập có `categorySlug`, `slug`, `seo.url` (giả lập giống backend build), viết test (`.test.mjs` theo pattern đã dùng các round trước) assert:
  - `alternates.canonical` (từ `generateMetadata`) === `/shop/{categorySlug}/{slug}` (relative, đúng field).
  - `openGraph.url` (sau khi thêm ở việc 1) === `${SITE_URL}/shop/{categorySlug}/{slug}` (absolute).
  - `product.seo.url` (giả lập input, đại diện JSON-LD) === cùng absolute URL.
  - Sitemap (`frontend/app/sitemap.ts` dòng 91-98, dùng `p.categorySlug`/`p.slug`) với cùng input categorySlug/slug === cùng absolute URL.
  - Tức là cả 4 công thức đều rút gọn về `${SITE_URL}/shop/{categorySlug}/{slug}` từ đúng 2 field `categorySlug`+`slug` — không có nguồn nào tự tính khác đi.
- **Blog**: tương tự, assert `alternates.canonical`, `openGraph.url` (sau việc 2), và sitemap entry (`frontend/app/sitemap.ts` dòng 100-107, dùng `p.slug`) đều rút gọn về `${SITE_URL}/blog/{slug}`.
- Vì JSON-LD Product `url` được build ở backend (`ProductResource::buildJsonLd()`), test chỉ giả lập input `product.seo.url` (không gọi backend thật) — không cần thêm test backend mới, không đụng PHP.

## Không cần làm trong round này

- Không sửa `ProductRouteService`, `ProductResource::buildJsonLd()`, hay bất kỳ code backend nào — P1.8 chỉ verify/sửa phía Next.js.
- Không đổi `BreadcrumbList`/`CollectionPage`/`FAQPage`/`BlogPosting` JSON-LD đã làm ở Round 3a/3b — chỉ thêm `openGraph.url` cho Product/Blog.
- Không đổi cấu trúc sitemap, không thêm trang mới vào sitemap.
- Không đổi `canonical` hiện tại (đã đúng từ P0, dùng `ProductRouteService`-derived fields) — chỉ đảm bảo OG khớp theo, không phải ngược lại.

## Sau khi code xong

Đây là round cuối của backlog SEO P1 — sau round này, báo cáo đầy đủ để Claude (session này) review + verify bằng test/build thật, rồi tổng kết toàn bộ P1 trước khi commit/push. Không commit/push trước khi Claude xác nhận.
