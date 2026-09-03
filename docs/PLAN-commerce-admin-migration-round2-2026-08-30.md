# Commerce admin migration round 2 — brief cho ChatGPT (2026-08-30)

Context: tiếp theo sau Orders + Return Requests (đã merge, commit `f03a5ba` — xem `docs/PLAN-commerce-admin-migration-2026-08-30.md`). Round này mở 2 mục còn lại đơn giản nhất trong Commerce: **Shipping** và **Customer Reviews**. Cả 2 đều là Eloquent model tự viết (`App\Models\ShippingMethod`, `App\Models\Review`), KHÔNG phải Lunar package resource, nên không có rủi ro "vendor API" như Discounts. Customers và Discounts vẫn để lại — chưa mở scope trong round này.

## Việc 1: Shipping — CRUD shipping methods

**Hiện trạng:**
- Backend: KHÔNG có Admin API nào. `App\Models\ShippingMethod` — bảng `shipping_methods` (`id, code, name, eta, price, free_over, created_at, updated_at`). Filament: `App\Filament\Resources\ShippingMethodResource` — form Code/Name/Delivery Estimate/Price/Free Shipping Over.
- **Quan trọng:** bảng này được đọc trực tiếp bởi checkout thật (`CheckoutController::shippingRates`, `backend/app/Http/Controllers/Api/CheckoutController.php:679`) để hiển thị phí ship cho khách ở `frontend/`. Sửa/xoá method ở đây ảnh hưởng ngay lập tức tới trải nghiệm mua hàng thật — cẩn thận khi test trên môi trường có traffic thật.

**Cần làm:**
1. Backend: tạo `App\Http\Controllers\Api\Admin\ShippingMethodController` với `index/store/show/update/destroy`, wire route `/admin/shipping-methods` (dùng số nhiều, giữ style REST đã dùng ở các resource admin khác — xem `BrandController` làm mẫu về response shape/validate).
   - Validate: `code` required, alpha-dash, unique (trừ chính nó khi update), **không cho sửa `code` sau khi tạo** (giữ đúng hành vi Filament: `->disabled(fn ($operation) => $operation === 'edit')` — lý do: checkout so khớp theo `code`, đổi code giữa chừng sẽ làm vỡ order đang link tới method cũ, xem `meta['shipping_method']` trong `OrderResource.php`).
   - `name` required. `price` required, numeric, min 0. `free_over` nullable, numeric, min 0.
   - Cân nhắc chặn xoá method đang được order active nào đó tham chiếu (query `meta->shipping_method` trong `lunar_orders` — tương tự cách `CollectionController` chặn xoá khi có ràng buộc). Nếu thấy phức tạp/rủi ro thời gian, có thể bỏ qua ràng buộc này và chỉ cảnh báo trong response — do ChatGPT quyết định, không bắt buộc.
2. Frontend: `admin/src/features/shipping/` — 1 trang list (bảng đơn giản: Code, Name, ETA, Price, Free Over) + modal create/edit (theo pattern `admin/src/features/brands/BrandModal.tsx` làm mẫu) + xoá. Không cần trang detail riêng, chỉ cần list + modal là đủ (bảng nhỏ, ít field).
3. Thêm route/sidebar: gắn vào nhóm "Sales" đã có sẵn từ round 1 (`admin/src/layouts/AppShell.tsx`), không tạo nhóm mới. Role gate: dùng lại `canManageCommerce` đã export ở `admin/src/App.tsx` (Order Manager/Support/core admin) — Shipping là cấu hình vận hành, không phải riêng cho Order Manager.
4. i18n: thêm key `shipping.*` vào `en.json`/`vi.json` theo pattern `orders.*` đã làm ở round 1.

**Không cần làm:** shipping zones theo khu vực địa lý, multi-carrier rate calculation — hiện tại chỉ là bảng giá cố định đơn giản, giữ nguyên đúng như Filament đang làm.

## Việc 2: Customer Reviews — moderate (approve/reject/edit/delete)

**Hiện trạng:**
- Backend: KHÔNG có Admin API. `App\Models\Review` — bảng `reviews` (`id, lunar_product_id, user_id, customer_name, customer_email, lunar_order_id, lunar_order_line_id, rating, comment, is_verified, status, created_at, updated_at`). Review khách viết vào đã có sẵn qua `ProductController::storeReview` (public, status mặc định `'pending'`).
- Filament: `App\Filament\Resources\ReviewResource` — list (Product, Customer, Rating, Verified badge, Status badge, Created At) + filter theo product + edit (đổi status pending/approved/rejected, sửa rating/comment/tên) + delete. Không cho tạo mới từ admin (`canCreate() => false`) — giữ nguyên, review chỉ tạo được từ storefront.

**Cần làm:**
1. Backend: tạo `App\Http\Controllers\Api\Admin\ReviewController` với `index` (kèm filter `product_id`, `status`), `show`, `update` (status/rating/comment/customer_name), `destroy`. KHÔNG cần `store` — giữ đúng hành vi Filament (`canCreate() => false`).
   - Validate `status` in `pending,approved,rejected`. `rating` integer 1-5. `comment` required string max 2000.
   - `index` nên trả kèm `product.name` (join/eager-load `product` relation, giống Filament `->with('product')`) để list hiển thị tên sản phẩm mà không cần N+1 query riêng ở frontend.
2. Frontend: `admin/src/features/reviews/` — trang list (Product, Customer, Rating sao, Verified icon, Status badge, ngày tạo) + filter theo status + theo product (search-select), trang edit hoặc modal edit (đổi status, sửa rating/comment), nút xoá.
3. Route/sidebar: gắn vào nhóm "Sales", role gate dùng `canManageCommerce`.
4. i18n: thêm key `reviews.*`.

**Không cần làm:** reply công khai từ admin xuống dưới review (chưa tồn tại ở Filament, không phải quy hồi), review analytics/aggregation riêng.

## Sau khi code xong

Báo lại để Claude (session này) làm final review — tự chạy lại test, kiểm diff, verify UI có data thật — trước khi merge, theo đúng flow round 1.

## Chưa mở scope (đợt sau)

**Customers** (Lunar `Customer` model, có relation Orders/Addresses/Users phức tạp hơn) và **Discounts** (`Lunar\Admin\Filament\Resources\DiscountResource`, package Lunar — cần đọc kỹ vendor source trước, theo `feedback_verify_vendor_api_before_use`) — để lại audit riêng ở round sau, không mở trong round này.
