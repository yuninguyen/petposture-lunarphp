# Sales admin parity Round D — Order line tracking + Manual Create Order — brief cho Codex (2026-09-02)

Context: tiếp theo Round A/B/C (đã merge, deploy). Round D gồm 2 việc: (1) một gap nhỏ còn sót ở Order Detail (per-line shipment tracking), (2) tính năng lớn còn thiếu hẳn — Manual Create Order (tạo đơn tay từ admin, hiện chỉ có ở Filament 8000).

## Việc 1: Order Detail — hiển thị tracking theo từng dòng sản phẩm

Filament (`ViewOrder.php:446-452`, `formatLineTracking()` dòng 238-260) hiển thị dưới mỗi dòng sản phẩm đã ship: số tracking + carrier + link tracking_url (nếu có), lấy từ bảng `order_shipment_items` join `order_shipments` theo `order_line_id`. Admin mới (`OrderDetailPage.tsx` Items table) hiện chưa có field này ở API lẫn UI.

- **Backend**: `OrderResource.php` — trong phần serialize `lines`, thêm field `shipments` (mảng) cho mỗi line: `[{ tracking_number, carrier, tracking_url, quantity }]`, lấy qua quan hệ `OrderShipmentItem::where('order_line_id', $line->id)->with('shipment')`. Audit kỹ tên cột thật (`carrier`, `tracking_number`, `tracking_url` trên bảng `order_shipments`) trước khi code — đọc migration/model `App\Models\OrderShipment` và `App\Models\OrderShipmentItem`, đừng đoán tên cột.
- **Frontend**: `admin/src/features/orders/api.ts` — thêm `shipments?: { tracking_number: string; carrier: string | null; tracking_url: string | null; quantity: number }[]` vào `OrderLine`. `OrderDetailPage.tsx` — dưới mỗi row sản phẩm trong bảng Items, nếu `line.shipments?.length`, hiện 1 dòng nhỏ text-xs màu xám: "Tracking: {tracking_number} × {quantity}" (link ra `tracking_url` nếu có), giống Filament.
- **Không cần** thêm carrier label mapping riêng — dùng lại field `carrier` thô hoặc field label đã tính sẵn nếu có trong resource, không cần bảng carrier tiếng Anh đẹp như Filament (`self::$carrierLabels`) nếu tốn công, hiển thị `carrier` viết hoa chữ đầu là đủ.

## Việc 2: Manual Create Order (tạo đơn tay)

Filament tái dùng **chính `App\Services\CheckoutService::placeOrder()`** — service thật dùng khi khách checkout — chỉ truyền thêm `created_by_admin: true` trong payload (khi đó nếu `payment_method === 'card'`, `CheckoutService.php:214-220` tự tạo `Transaction` đánh dấu paid ngay, không cần thẻ thật). **Không viết lại logic đặt hàng — chỉ bọc 1 endpoint quanh service có sẵn.**

### Backend

- Thêm `App\Http\Controllers\Api\Admin\OrderController::store(Request $request)` (hoặc thêm `store()` vào `OrderController` hiện có nếu tiện hơn — tự quyết định theo pattern đang dùng cho các admin-only endpoint khác).
- Validate theo đúng field Filament form đang có (đọc lại `OrderResource.php:47-238` — Customer email/first_name/last_name/phone, Items (`variant_id` + `quantity`, tối thiểu 1 dòng), Shipping Address (first/last/phone/line_one/line_two/city/state/postcode/country), Billing Address (toggle "same as shipping" + full address nếu khác), Order Settings (`payment_method`: cod|card, `shipping_method`: standard|express, `shipping_fee_override` nullable, `coupon_code` nullable), Notes (customer_note/internal_note nullable).
- Build payload đúng shape Filament đang build (`CreateOrder.php:20-63`) rồi gọi `app(CheckoutService::class)->placeOrder($payload, $request->user()->id)` — audit lại chữ ký `placeOrder()` thật trước khi code (đã xác nhận: `placeOrder(array $payload, ?int $userId = null, ?string $customerIp = null): Order`).
- **Quyền**: Filament "New Manual Order" hiện chỉ khả dụng cho core admin (super_admin/admin/staff) — `AdminPermissionMatrix::ORDER` không có `create_order`, Order Manager/Support không có quyền tạo đơn tay. Route mới đặt **core-admin-only** giống pattern Customers (route middleware `role:super_admin,admin,staff`, không qua `EnforceAdminApiPermission`) — audit lại middleware group thật trước khi code, đừng tự thêm ability mới vào matrix nếu không có quyết định mở rộng cho Order Manager.
- Route: `POST /admin/orders` (đặt trong group core-admin-only hiện có, cạnh Customers).
- Response: `new OrderResource($order)`.

### Frontend

- Trang mới `admin/src/features/orders/OrderCreatePage.tsx`, route `/orders/create`, nút "New Manual Order" trên `OrdersListPage.tsx` (chỉ hiện với core admin — dùng lại pattern kiểm tra role đang có ở chỗ khác trong admin, ví dụ cách `CustomerDetailPage` ẩn nút Login Account edit).
- Form 5 khối theo đúng Filament: Customer (email/first/last/phone), Items (repeater: chọn variant qua `SearchableMultiSelect` hoặc select đơn giản đã có sẵn trong `@/components/ui/`, quantity, unit price tự điền read-only khi chọn variant — audit API sản phẩm/variant có sẵn để lấy option list và giá, ví dụ `useProducts`/`useProductLookups` đã có ở feature `products`), Shipping Address, Billing Address (toggle "Same as shipping" ẩn/hiện field), Order Settings (payment_method select COD/Card, shipping_method select Standard/Express, shipping_fee_override, coupon_code), Notes (customer_note/internal_note).
- Submit → `POST /admin/orders` → thành công thì `navigate('/orders/${order.id}')` (vào thẳng trang detail vừa tạo), lỗi thì hiện toast.
- i18n: thêm đầy đủ key `orders.create_*` cho cả `en.json`/`vi.json` (bilingual, đúng feedback đã ghi nhận từ trước — không chỉ tiếng Việt).

## Không cần làm ở Round D

- Không mở quyền tạo đơn tay cho Order Manager/Support — giữ core-admin-only đúng như Filament hiện tại, không tự ý mở rộng.
- Không cần validate tồn kho phức tạp hơn Filament đang có — Filament không kiểm tra stock khi tạo đơn tay, giữ nguyên hành vi đó, không thêm ràng buộc mới.
- Không cần trang riêng cho "chọn khách hàng có sẵn" — Filament cũng nhập tay email/tên mỗi lần (không link `user_id`), giữ nguyên hành vi.

## Test & verification

- Backend: test core-admin tạo đơn thành công (COD và card — card phải tạo `Transaction` paid ngay); test Order Manager/Support bị 403; test validation items rỗng bị chặn; test billing_same_as_shipping copy đúng địa chỉ.
- Frontend: test render đủ 5 khối form; test toggle billing ẩn/hiện đúng; test submit thành công điều hướng sang order detail; test lỗi validate hiện đúng thông báo.
- Backend: test `lines[].shipments` trả đúng dữ liệu khi order đã có shipment, rỗng khi chưa ship.
- `npm run build`, `tsc --noEmit`, PHPUnit liên quan — sạch trước khi báo lại.

## Sau khi code xong

Báo lại để Claude review diff + tự chạy test verify trước khi merge/deploy.
