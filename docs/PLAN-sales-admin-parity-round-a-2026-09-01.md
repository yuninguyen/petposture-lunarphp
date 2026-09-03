# Sales admin parity Round A — UI polish + Login Accounts edit — brief cho Codex (2026-09-01)

Context: audit so sánh `admin.petposture.com` (React, `admin/`) với `api.petposture.com/admin` (Filament) cho 3 mục Sales: Orders, Customers, Return Requests. Round A gồm các việc **an toàn, thuần UI + vài tính năng mới nhỏ có role gating rõ ràng** — không đụng logic nghiệp vụ tiền bạc/state machine (đó là Round C/D sau).

## Việc 1: Thêm cột Actions với icon View cho 3 list

`admin/src/features/orders/OrdersListPage.tsx`, `admin/src/features/customers/CustomersListPage.tsx`, `admin/src/features/return-requests/ReturnRequestsListPage.tsx` — hiện chỉ click vào tên/mã (text) mới vào được detail, không có cột Actions/icon 👁 View rõ ràng như Filament (`Tables\Actions\ViewAction::make()`).

- Thêm cột "Actions" cuối bảng, mỗi row có 1 icon button (dùng `EyeIcon` nếu đã có trong `@/components/ui/icons`, nếu chưa có thì thêm icon SVG đơn giản theo đúng style `PencilIcon`/`TrashIcon`/`DotsVerticalIcon` đã có) — click thì `navigate()` y hệt hành vi click-vào-tên hiện tại (giữ nguyên click-vào-tên luôn hoạt động, không bỏ, chỉ thêm icon làm rõ hơn).
- Cả 3 list dùng chung 1 pattern, không cần kebab-menu (chỉ có duy nhất hành động View, không phải Edit/Delete — khác Shipping/Reviews/Product Types).

## Việc 2: Currency formatting

- `admin/src/features/return-requests/ReturnRequestsListPage.tsx` và `ReturnRequestDetailPage.tsx`: field `refund_amount`, `restocking_fee` đang hiển thị số thô (`displayValue`), cần format `$X.XX` giống cách đã sửa cho Shipping (`displayMoney` helper — copy pattern y hệt).
- `admin/src/features/orders/OrdersListPage.tsx` và `OrderDetailPage.tsx`: field Total đang hiển thị `$X.XX USD` (dư chữ "USD"). Sửa ở **backend** `OrderResource.php` — field `total.formatted` hiện nối `'$'.number_format($total, 2).' '.$this->currency_code`, bỏ phần `.' '.$this->currency_code` để mọi nơi dùng field này (kể cả customer account page thật) đều nhất quán, không patch riêng ở FE.

## Việc 3: Customer Detail — visual overhaul (so khớp Filament, không cần y hệt pixel)

`admin/src/features/customers/CustomerDetailPage.tsx` hiện quá đơn giản so với Filament. Cần:

1. **3 stat card** ở đầu trang: Total Orders, Avg. Spend (= `orders_sum_total / orders_count`, hiển thị `—` nếu `orders_count = 0`), Total Spend — style card giống pattern Card component sẵn có trong `admin/src/components/ui/`.
2. **Nút "Edit"** ở góc trên bên phải header — mở modal/form sửa **Customer Details**: Full Name (tách First/Last), Company Name, Tax ID, **Email, Phone** (đủ 6 field như Filament hiển thị trong screenshot). Đây là sửa **thông tin khách hàng** (Customer record), KHÁC với Login Accounts edit ở việc 4 (đừng nhầm 2 cái — 1 cái sửa hồ sơ khách, 1 cái sửa tài khoản đăng nhập).
   - Audit trước: field `email`/`phone` hiển thị ở Filament Customer Details lấy từ đâu — Lunar `Customer` model có field riêng hay đang lấy từ user/address liên kết? Xác nhận đúng nguồn trước khi thiết kế API update, đừng đoán.
   - Cần thêm `PUT/PATCH /admin/customers/{id}` — hiện `CustomerController` hoàn toàn GET-only (audit Round 3), đây là mutation route MỚI, core-admin-only, cùng role gate `role:super_admin|admin|staff` như route Customers hiện có.
3. Tab pill style (Orders | Address Book | Login Accounts) — đổi từ text phẳng sang pill có nền + border như Filament, không cần đổi logic tab switch.
4. Sub-tab **Orders**: thêm icon View trên mỗi dòng order → `navigate('/orders/:id')` (route đã có sẵn từ Round 1).
5. Sub-tab **Address Book**: thêm icon Edit/Delete trên mỗi địa chỉ. Mutation MỚI — thêm `PUT/PATCH /admin/customers/{id}/addresses/{addressId}` và `DELETE /admin/customers/{id}/addresses/{addressId}`, core-admin-only. Field theo đúng field đã trả về ở `addresses()` endpoint hiện có (`title, first_name, last_name, line_one, line_two, line_three, city, state, postcode, contact_phone, contact_email, shipping_default, billing_default`).

## Việc 4: Login Accounts — Edit (đổi email + reset password)

**Quyết định đã chốt: chỉ core admin (`super_admin|admin|staff`) được dùng, không mở cho Order Manager/Support** — hành động nhạy cảm (account takeover risk), giữ đúng nguyên tắc least-privilege đã áp dụng xuyên suốt dự án (Shipping/Customers/Discounts đều core-only).

- Filament tương ứng: `Lunar\Admin\...\BaseRelationManager` (vendor) — `EditAction` với form `email` (required, unique per user) + `password` (optional, chỉ set khi nhập, `Hash::make`) + `password_confirmation`. Dispatch event `Lunar\Admin\Events\CustomerUserEdited` sau khi sửa — audit xem app có listener nào cho event đó không (`EventServiceProvider`) trước khi quyết định có cần dispatch tương tự hay bỏ qua.
- Thêm `PUT/PATCH /admin/customers/{customerId}/login-accounts/{userId}` — validate `email` (required, email, unique trong bảng `users` trừ chính user đó), `password` (nullable, min 8, confirmed) — core-admin-only.
- Frontend: nút Edit trên mỗi login account trong tab Login Accounts, mở modal có 2 field Email + New Password + Confirm New Password (giống Filament modal trong screenshot user gửi) — password để trống thì giữ nguyên mật khẩu cũ.
- **Không đổi** cơ chế hiện tại của Login Accounts list (`GET /admin/customers/{id}/login-accounts` chỉ trả `id, email`) — chỉ thêm mutation route mới.

## Không cần làm ở Round A

- Không đụng Orders state machine actions (Mark Processing/Shipped/Cancel), Add Shipment, Return Tracking, refund reason dropdown, Fraud & Risk, Customer IP, Manual Create Order — đó là Round B/C/D, để sau.
- Không đổi permission matrix cho Order Manager/Support — mọi mutation mới ở round này đều core-admin-only.

## Test & verification

- Backend: test route core-only (3 role core pass, Order Manager/Support/Product Manager 403) cho từng route mutation mới; test validate email unique loại trừ chính record; test password chỉ đổi khi có nhập; test Customer/Address update giữ đúng field không cho sửa ngoài phạm vi.
- Frontend: test icon View điều hướng đúng; test modal Edit Customer/Address/Login Account submit đúng payload; test hiển thị `$` đúng cho Return Requests; test Orders Total không còn "USD" thừa.
- `npm run build`, `tsc --noEmit`, backend PHPUnit liên quan — sạch trước khi báo lại.

## Sau khi code xong

Báo lại để Claude review diff + tự chạy test verify trước khi merge/deploy, theo đúng quy trình đã dùng xuyên suốt dự án này.
