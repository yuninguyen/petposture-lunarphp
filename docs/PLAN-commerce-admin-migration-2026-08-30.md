# Commerce admin migration — brief cho ChatGPT (2026-08-30)

Context: sau khi Catalogue migrate xong (`docs/PLAN-catalogue-admin-migration-2026-08-29.md`), nhóm tiếp theo là **Commerce**: Orders, Return Requests, Customers, Shipping, Discounts, Customer Reviews — đang ở Filament admin cũ (port 8000) hoặc package Lunar, cần chuyển sang admin mới Vite/React (`admin/`, port 5173).

**Khác với Catalogue**: Catalogue hầu hết đã có sẵn Admin API đầy đủ (chỉ thiếu vài route/UI lẻ). Commerce thì ngược lại — phần lớn **chưa có Admin API controller nào cả**, Filament trước giờ thao tác thẳng qua Eloquent. Vì vậy brief này chỉ mở 2 việc đã có backend nền tảng sẵn, sau đó dừng lại — không mở rộng sang Customers/Shipping/Discounts/Reviews trong đợt này vì cần audit backend riêng (xem phần "Chưa mở scope" cuối file).

## Hiện trạng audit (2026-08-30)

| Nhóm | Admin API hiện có | Ghi chú |
|---|---|---|
| Orders | `App\Http\Controllers\Api\OrderController::index/show/update/refund/return` — đã tồn tại ở `backend/routes/api.php:281-286` (dưới middleware `auth:sanctum` customer) và `:235-236` (dưới `/admin` group cho refund/return) | `baseOrderQuery()` (`OrderController.php:283`) đã tự động trả **toàn bộ orders** nếu `canManageOrders($request)` true (staff/admin), không lọc theo `user_id`. Nghĩa là route `/orders` hiện tại **đã dùng được cho admin list**, chỉ thiếu route alias rõ ràng dưới `/admin` và UI. |
| Return Requests | `App\Http\Controllers\Api\ReturnRequestController::index/show/approve/reject/complete` — đã wire đủ dưới `/admin` group (`api.php:237-241`) | Backend sẵn sàng, chỉ cần frontend. |
| Customers | Chỉ có `Api\Admin\UserController::index` — trả `id, name` thôi (dùng cho dropdown gán staff), KHÔNG phải customer management đầy đủ | Cần audit riêng: `CustomerResource`, `UserAddressResource` ở Filament làm gì (xem đơn hàng, địa chỉ, group...) trước khi thiết kế API mới. |
| Shipping | Không có Admin API nào | `ShippingMethodResource` (Filament) thao tác thẳng Eloquent. Cần thiết kế Admin API từ đầu. |
| Discounts | Không có Admin API nào | `DiscountResource` là resource của **package Lunar** (`Lunar\Admin\Filament\Resources\DiscountResource`), không phải app tự viết — cần đọc source Lunar (`backend/vendor/lunarphp/lunar/...`) trước khi build lại, theo nguyên tắc verify vendor API trước khi dùng. |
| Reviews | Không có Admin API nào | Có `ProductController::storeReview`/`reviews` (public, khách viết review) nhưng không có endpoint approve/reject/xoá review cho admin. `ReviewResource` (Filament) thao tác thẳng Eloquent. |

## Việc 1: Orders — list + detail + refund/return actions

**Hiện trạng:**
- Backend: route đã có (`GET /orders`, `GET /orders/{id}`, `PATCH /orders/{id}`, `POST /orders/{id}/actions/{action}`, `POST /orders/{id}/refund`, `POST /orders/{id}/return` — xem `backend/routes/api.php:235-236,281-286`). `OrderController::baseOrderQuery()` đã cho phép admin/staff xem toàn bộ đơn, không cần sửa backend logic phân quyền.
- Frontend: `admin/src/features/` chưa có thư mục `orders/` nào cả.

**Cần làm:**
1. Backend: thêm route alias rõ ràng dưới `/admin` group trong `backend/routes/api.php` — ví dụ `GET /admin/orders` → `OrderController::index`, `GET /admin/orders/{id}` → `OrderController::show` — để tách bạch namespace "my orders" (customer) khỏi "admin orders" dù dùng chung controller/logic. Không cần viết controller mới, chỉ thêm route trỏ vào method đã có.
2. Frontend: tạo `admin/src/features/orders/` theo pattern các feature khác (`admin/src/features/products/` làm mẫu về cấu trúc `api.ts`, list page, detail page). Cần: danh sách đơn (pagination, filter theo status), trang chi tiết đơn (line items, địa chỉ, order events/timeline), action Refund/Return (map vào `OrderResource::refund`/`return` đã có).
3. Tham khảo `Filament\Resources\OrderResource.php` để biết field/tab nào Filament đang hiển thị (Fraud & Risk section đã chốt giữ nguyên layout — xem `decision_order_summary_fraud_risk_layout` — không cần bê nguyên UI Filament, chỉ cần đủ chức năng tương đương).

**Không cần làm:** Discounts hiển thị trong Order detail — nếu order có áp coupon, hiển thị readonly là đủ, không cần link sang trang Discounts (trang đó chưa tồn tại ở đợt này).

## Việc 2: Return Requests — list + detail + approve/reject/complete

**Hiện trạng:**
- Backend: đầy đủ — `ReturnRequestController::index/show/approve/reject/complete`, đã wire dưới `/admin` (`api.php:237-241`).
- Frontend: chưa có `admin/src/features/return-requests/` (hoặc gộp vào `orders/` như 1 tab — do ChatGPT quyết định cấu trúc, miễn giữ đúng REST endpoint đã có).

**Cần làm:**
1. Frontend only — không cần đụng backend. Tạo trang list return requests (filter theo status: pending/approved/rejected/completed), trang chi tiết, 3 action button gọi đúng 3 endpoint approve/reject/complete đã có.
2. Tham khảo `Filament\Resources\OrderReturnRequestResource.php` để biết field cần hiển thị (lý do trả hàng, item nào, refund amount...).

**Không cần làm:** Prepaid return label — đã chốt gác lại (xem `decision_defer_return_phase3`), đừng đề xuất lại.

## Sau khi code xong

Báo lại để Claude (session này) làm final review trước khi commit/deploy, theo role split đã chốt (`project_catalogue_role_split_2026-08-24`).

## Chưa mở scope (đợt sau)

**Customers, Shipping, Discounts, Reviews** — không có Admin API sẵn, cần 1 vòng audit riêng (đọc kỹ Filament Resource + với Discounts là đọc cả Lunar vendor source) trước khi viết brief scope-cụ-thể như Việc 1/2 ở trên. Không tự ý mở rộng sang các mục này khi code Việc 1/2 — giữ đúng nguyên tắc "verify scope before coding" đã lưu ý trước đây.
