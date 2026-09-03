# Sales admin parity Round E — Manual Create Order — brief cho Codex (2026-09-03)

Context: Round C từng để lại "Manual Create Order — vẫn để lại chưa quyết định, không tự ý làm". Nay đã quyết định làm. Đây là mục cuối cùng còn thiếu trong phạm vi Commerce của kế hoạch migration gốc (`docs/commerce-react-admin-migration-plan.md`) — các phần Content/Catalogue/Commerce khác (Orders list/detail, Return Requests, Customers, Reviews, Shipping, Discounts, Products...) đã xong. Các mục Filament khác ngoài phạm vi gốc (User/Role/Permissions/Settings/Dashboard/Profile/Goals/Payment page/AffiliateReports/CustomerGroup/AffiliateNetwork/Media library/AttributeGroup) **không nằm trong scope migration này** — không tự ý động vào.

## Nguồn logic thật (Filament) — copy hành vi, không tự sáng tác

`backend/app/Filament/Resources/OrderResource/Pages/CreateOrder.php` là adapter mỏng — toàn bộ logic tạo đơn nằm ở `CheckoutService::placeOrder(array $payload, ?int $userId = null, ?string $customerIp = null): Order` (`backend/app/Services/CheckoutService.php:39`). Form Filament build `$payload` gồm:
- `items[]`: `variant_id`, `quantity`
- customer email
- shipping address: first_name, last_name, phone, line_one, line_two, city, state, postcode, country
- `billing_same_as_shipping` (bool) — nếu false thì có block billing address riêng
- `payment_method` (default `cod`)
- `shipping_method` (default `standard`)
- `coupon_code` (optional)
- `customer_note`, `internal_note` (optional)
- `shipping_fee_override` (Filament nhận USD, convert sang cents trước khi đưa vào payload)
- `created_by_admin => true` (cờ cố định, đánh dấu đơn tạo tay bởi admin)

**Audit trước khi code**: đọc kỹ `OrderResource.php` (form schema đầy đủ) và `CheckoutService::placeOrder` (validate field nào bắt buộc, field nào optional, format tiền/địa chỉ chính xác ra sao) trước khi build payload phía React — đừng đoán field name hay đơn vị tiền.

## Việc 1: Backend — API tạo đơn cho admin (MỚI)

Hiện **chưa có** endpoint admin tạo đơn — `OrderController.php` không có method `store`. Route public `/checkout/place-order` (`CheckoutController::placeOrder`) là cho khách, không dùng cho admin (khác role gate, khác context).

- Thêm `OrderController::store(Request $request)` — validate đúng shape payload ở trên, gọi thẳng `app(CheckoutService::class)->placeOrder($payload, auth()->id(), $request->ip())`, ép `created_by_admin = true` server-side (không tin field này từ client).
- Route: `POST /admin/orders` — đặt trong đúng admin group hiện có của Orders.
- **Quyết định phân quyền (đã chốt)**: Manual Create Order dùng chung quyền `update_order` hiện tại — tức là **Order Manager cũng tạo đơn tay được**, không chỉ core role (super_admin/admin/staff). Nếu `AdminPermissionMatrix::ORDER` hiện chưa có key `create_order`, thêm key này và gán cho đúng những role đang có `update_order` (đối chiếu chính xác danh sách role trong `AdminPermissionMatrix::ORDER['update_order']` trước khi gán, đừng đoán). Đây là thay đổi có chủ đích vào permission matrix — được duyệt, không phải giữ nguyên matrix như đề xuất ban đầu.
- Trả về `OrderResource` (hoặc format tương đương `show()` đang dùng) của đơn vừa tạo để frontend redirect sang trang detail.

## Việc 2: Backend — endpoint tìm sản phẩm/variant cho picker (MỚI, hoặc mở rộng)

`GET /admin/products` (`AdminProductController::index`) đã hỗ trợ `search` nhưng response ở mức **product**, không có danh sách variant phẳng (id, sku, options, price, stock) — không đủ cho picker chọn đúng variant khi tạo đơn tay.

- **Audit trước khi code**: kiểm tra kỹ response hiện tại của `/admin/products?search=...` (có eager-load `variants.prices` không, thiếu field gì) trước khi quyết định sửa response cũ hay thêm endpoint mới.
- Khuyến nghị: thêm 1 trong 2 — (a) mở rộng response của `/admin/products` để trả kèm `variants: [{id, sku, options, price, stock}]` khi có `search`, hoặc (b) thêm endpoint riêng `GET /admin/products/{id}/variants`. Chọn (a) nếu không phá vỡ chỗ khác đang dùng `/admin/products`, audit trước khi chọn.
- **Phân quyền cho endpoint search product + variant picker (đã chốt)**: Order Manager/Support hiện KHÔNG có quyền quản lý sản phẩm nói chung, nhưng đã được duyệt tạo đơn tay ở Việc 1 — nghĩa là họ cần đọc được product/variant để dùng picker mà không được cấp quyền quản lý sản phẩm rộng hơn. Thêm 1 authorization path riêng, hẹp, chỉ cho phép **đọc** (`GET /admin/products?search=...` khi dùng trong context picker + `GET /admin/products/{id}/variants`) cho core roles + Order Manager + Support — **không** cấp quyền product management/mutation (create/update/delete product) cho 2 role này, và **không** mở toàn bộ `GET /admin/products/*` một cách chung chung nếu route đó có thêm hành vi khác ngoài picker. Đây là scope hẹp nhất đáp ứng đúng nhu cầu, tránh cấp thừa quyền.

## Việc 3: Frontend — trang Create Order

- File mới `admin/src/features/orders/OrderFormPage.tsx`, theo đúng pattern của `admin/src/features/discounts/DiscountFormPage.tsx` (form page tạo mới, có sẵn trong codebase — dùng làm mẫu về cấu trúc, không copy máy móc).
- Route mới `/orders/new` trong `admin/src/App.tsx` — đặt **trước** route `/orders/:id` (tránh Router match nhầm `new` thành `:id`), cùng permission gate với route `/orders` hiện tại (audit lại nếu Việc 1 quyết định permission hẹp hơn).
- Nút "Create order" trên `OrdersListPage.tsx` (góc trên, giống pattern nút tạo mới ở Discounts/Products list) dẫn tới `/orders/new`.
- Form fields — đúng 1-1 với payload Việc 1: customer email, item picker (dùng `SearchableMultiSelect` — component có sẵn ở `admin/src/components/ui/SearchableMultiSelect.tsx` — cho tìm + chọn variant, kèm ô nhập quantity từng dòng), shipping address (đủ field), toggle "Billing same as shipping" + block billing address riêng khi tắt, select Payment method (default COD), select Shipping method (default Standard), input Coupon code (optional), textarea Customer note + Internal note (optional), input Shipping fee override (optional, USD — nhớ convert đúng đơn vị khi gửi payload, khớp với Việc 1).
- Data layer: theo đúng pattern `api.ts` hiện có (`fetchJson`, `useMutation` từ `@tanstack/react-query`, invalidate `['orders']` khi thành công) — thêm hook `useCreateOrder()`.
- Submit thành công → `navigate` sang `/orders/:id` của đơn vừa tạo. Lỗi validate từ backend → hiện lỗi theo field, giống cách các form khác trong admin đang xử lý lỗi (audit `DiscountFormPage.tsx` hoặc `ProductFormPage.tsx` xem pattern hiện có).
- Toàn bộ text UI qua `react-i18next` (`t('orders.xxx')`), đúng convention hiện tại — không hardcode string.

## Không cần làm ở Round E

- Không động tới bất kỳ Filament Resource/Page nào ngoài phạm vi Commerce gốc (User/Role/Settings/Dashboard/Profile/Goals/Payment/AffiliateReports/CustomerGroup/AffiliateNetwork/Media/AttributeGroup) — các mục này ở ngoài scope migration, giữ nguyên Filament.
- Không sửa route `/checkout/place-order` public hiện có (dùng cho khách, không liên quan Round này).

## Việc 3 (bổ sung, đã duyệt Part 2 của Codex) — chi tiết form

- Payment method chỉ 2 giá trị: `cod`, `card` (default COD). Shipping method chỉ 2 giá trị: `standard`, `express` (default Standard) — khớp đúng Filament, không thêm giá trị khác.
- Required: email, shipping first name, shipping line one, city. Còn lại optional, country default `US`.
- Variant picker: two-step — debounce search product qua `GET /admin/products?search=...` có sẵn → chọn 1 product → load `GET /admin/products/{id}/variants` (Việc 2) → chọn variant trong product đó qua `SearchableMultiSelect`. Dòng item đã chọn giữ nguyên khi tìm/thêm variant từ product khác.
- `SearchableMultiSelect` mở rộng tối thiểu bằng optional translated text props (`noResults`, `selectedCount`, `clearAll`, `placeholder`) thay vì hardcode text mới — không đổi hành vi mặc định của component ở những chỗ đang dùng khác.
- **Audit bắt buộc trước khi code, không giả định**: `shipping_fee_override` — xác nhận trong `CheckoutService::placeOrder` xem field *vắng mặt* trong payload và field *= 0* có thực sự tạo 2 hành vi khác nhau (auto-tính rate vs free ship) hay không, trước khi viết helper text "blank = calculated rate, 0 = free shipping" trên form. Nếu hiểu sai, đơn tạo tay có thể sai tiền ship thật.
- Toàn bộ string mới qua `orders.*` locale key (Anh + Việt).

## Test & verification

- Backend: test role gating của `POST /admin/orders`, test payload thiếu field bắt buộc bị reject đúng, test `created_by_admin` luôn `true` bất kể client gửi gì, test đơn tạo ra có đúng field/state như khi Filament tạo (so sánh hành vi, không chỉ status code), test endpoint variant-search trả đúng field cần cho picker.
- Frontend: test render form đầy đủ field, test toggle billing address ẩn/hiện đúng, test submit thành công redirect đúng trang detail, test lỗi validate hiển thị đúng theo field, test route `/orders/new` không bị `/orders/:id` nuốt mất.
- `npm run build`, `tsc --noEmit` (frontend admin), PHPUnit liên quan (`OrderController` test) — sạch trước khi báo lại.

## Sau khi code xong

Báo lại để Claude review diff + tự chạy test verify trước khi merge/deploy.
