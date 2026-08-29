# SEO P1 round 1 — sitemap consolidation — brief cho ChatGPT (2026-08-29)

Context: P0 đã xong (`commit e3196a9`). Đây là **round 1 của P1** — chỉ scope hẹp: fix bug sitemap đang chạy production + hợp nhất sitemap về 1 nguồn theo `docs/SEO-TECHNICAL-CONTRACT-v1.1.md` §10 (Next.js là sole public sitemap owner). **KHÔNG làm P1.2/P1.3/P1.5/P1.7 (Public SEO DTO, SSR metadata override, robots, JSON-LD đầy đủ)** trong đợt này — để round sau.

## Bug production đang chạy — ưu tiên cao nhất

`frontend/app/sitemap.ts:8-17` (`fetchProducts()`) gọi `GET /api/products` **không có `per_page`**. Backend (`backend/app/Http/Controllers/Api/ProductController.php:147`) mặc định `per_page=12` (max 100 nếu truyền). Kết quả: **sitemap hiện tại chỉ chứa 12 sản phẩm đầu tiên**, phần còn lại của catalog không được liệt kê — Google không biết các sản phẩm đó tồn tại qua sitemap.

Fix: `fetchProducts()` phải lặp qua toàn bộ trang (loop theo `meta.last_page` hoặc tương đương mà `ProductController::index()` trả về — kiểm tra response shape thật, đọc `backend/app/Http/Controllers/Api/ProductController.php` phần pagination) cho tới khi lấy hết sản phẩm published, dùng `per_page=100` mỗi lần gọi để giảm số round-trip.

## Hợp nhất sitemap (P1.6 + phần còn lại của P1.4)

Hiện có **2 sitemap sống song song**:
1. `frontend/app/sitemap.ts` — Next.js convention route, `robots.ts:20` đang trỏ vào đây.
2. `backend/app/Http/Controllers/Api/SitemapController.php`, route `GET /sitemap.xml` đăng ký ở `backend/routes/web.php:13` — vẫn public, vẫn sống, **chứa slug Solution đã bị cấm** (`SitemapController.php:32`: `eating-digestion`, `mobility-support`, `comfort-safety`) và tự tính lại category/slug thay vì dùng `ProductRouteService` (vi phạm "no duplicate route-building logic" — Contract §5).

Theo Contract §10 ("Any legacy public backend sitemap must be retired or permanently redirected after migration validation"): **xóa route `GET /sitemap.xml` khỏi `backend/routes/web.php:13`** và xóa `SitemapController.php` (không dùng ở đâu khác — kiểm tra lại trước khi xóa). Nếu lo ngại cache/link cũ trỏ vào `api.petposture.com/sitemap.xml`, có thể thay bằng redirect 301 sang `SITE_URL/sitemap.xml` thay vì xóa hẳn route — tự quyết định phương án nào an toàn hơn, miễn kết quả cuối là chỉ còn 1 sitemap thật (Next.js).

## lastModified thật

`frontend/app/sitemap.ts` hiện không set `lastModified` cho bất kỳ URL nào (Contract §10 yêu cầu "use real lastModified"). Cần:
- Backend: thêm `updated_at` vào public `backend/app/Http/Resources/Api/ProductResource.php` (Post đã có sẵn ở `backend/app/Http/Resources/Api/PostResource.php:34` — dùng làm mẫu) và `backend/app/Http/Resources/Api/PostResource.php` (đã có, không cần đổi).
- Frontend: `sitemap.ts` set `lastModified: new Date(p.updated_at)` cho product/post entries. Với static pages (breed/solution hubs, policy pages...) có thể dùng thời điểm build hoặc bỏ qua `lastModified` — không bắt buộc phải có real timestamp cho trang tĩnh không có nguồn dữ liệu updated_at rõ ràng.

## Dọn route chết (P1.1)

`backend/app/Http/Controllers/Api/SeoController.php` (route `GET /api/seo` ở `backend/routes/web.php:14`) query `SeoMetadata::where('path', $path)` nhưng bảng `seo_metadata` dùng schema polymorphic (`seoable_type`/`seoable_id`), **không có cột `path`** — route này sẽ lỗi SQL nếu ai gọi tới, và không có nơi nào trong `frontend/` gọi route này (đã grep, không thấy). Xóa `SeoController.php` + route đăng ký, hoặc xác nhận lại có chỗ nào dùng trước khi xóa.

## Không cần làm trong round này

- Không cần chuyển 4 Solution hub / breed hub trong `sitemap.ts` (dòng 42-54, hiện đang hardcode) sang lấy động từ API/CMS — để round P1 sau nếu cần, không phải bug khẩn cấp.
- Không cần filter `is_indexable`/loại bỏ redirect URL khỏi sitemap trong round này — phụ thuộc P1.2/P1.5 (Public SEO DTO + robots), chưa làm ở round 1.
- Không đụng `ProductRouteService.php` — service này đã đúng, không cần sửa gì (chỉ cần `SitemapController.php` chỗ đang lệch được xóa/nghỉ hưu, không phải sửa nó để dùng resolver).

## Test cần có

- Regression test cho `sitemap.ts`: mock API trả >12 sản phẩm (ví dụ 25), assert sitemap chứa đủ cả 25 (không bị cắt ở 12).
- Assert route Laravel `GET /sitemap.xml` không còn trả sitemap product data nữa (410/301/404 tuỳ phương án đã chọn), hoặc test cho redirect nếu chọn hướng redirect.
- Assert `GET /api/seo` không còn tồn tại (404) hoặc test xác nhận đã xóa an toàn.
- Assert `lastModified` xuất hiện đúng cho product/post URL trong sitemap.

## Sau khi code xong

Không commit/push — báo lại để Claude (session này) review + verify bằng test thật trước khi commit, theo đúng quy trình đã dùng cho P0.
