# Commerce admin migration round 3 — brief cho ChatGPT (2026-08-31)

Context: tiếp theo sau Round 1 (Orders + Return Requests) và Round 2 (Shipping + Reviews) — đã merge vào `main`. Round này mở **Customers**. **Discounts để lại round sau** — vendor resource của Lunar dài 436 dòng (`vendor/lunarphp/lunar/src/Filament/Resources/DiscountResource.php`), có hệ thống discount type/condition riêng, cần 1 buổi audit riêng trước khi brief, không gộp chung đợt này.

## Audit hiện trạng (2026-08-31)

- `App\Filament\Resources\CustomerResource` extends `Lunar\Admin\Filament\Resources\CustomerResource` — **chỉ List + View, KHÔNG có Create/Edit/Delete cho bản thân record Customer** (chỉ có `Tables\Actions\ViewAction::make()`, không có EditAction). Nghĩa là scope thật sự nhỏ hơn tưởng tượng ban đầu.
- Trang View có 3 tab (relation manager):
  1. **Orders** — danh sách order của customer đó, đọc `lunar_orders.customer_id`. Chỉ list + link "View" sang trang order detail — không có action gì khác.
  2. **Address Book** (tên hiển thị đã chốt theo chuẩn Shopify — xem `feedback_admin_label_naming`) — danh sách địa chỉ, bảng `lunar_addresses` (`title, first_name, last_name, line_one/two/three, city, state, postcode, contact_phone, contact_email, shipping_default, billing_default`). Chỉ đọc, không có form sửa trong tab này ở bản Filament hiện tại.
  3. **Login Accounts** (tên đã chốt tương tự) — danh sách `User` liên kết với customer (`users` relation), có **EditAction cho phép admin đổi email và reset password trực tiếp**. Đây là hành động nhạy cảm (account takeover risk nếu lộ quyền) — xem kỹ phần role gating bên dưới.
- List table (`getDefaultTable` override trong `CustomerResource.php`) hiển thị: Name, Email (từ user đầu tiên liên kết, "Guest" nếu không có), Total Orders (`withCount('orders')`), Total Spent (`withSum('orders', 'total')`), Joined (`created_at`), Status (Active/Inactive — suy ra từ `users.first()->is_active`, guest luôn coi là Active). Có filter Status.
- Bảng chính: `lunar_customers` (`id, title, first_name, last_name, company_name, tax_identifier, account_ref, attribute_data, meta, created_at, updated_at`).
- **Admin API hiện có**: chỉ `Api\Admin\UserController::index` — trả `id, name` thôi (dùng cho dropdown gán staff ở chỗ khác), KHÔNG phải customer management. Cần viết Admin API mới hoàn toàn cho Customers.
- **Permission matrix**: `App\Security\AdminPermissionMatrix` KHÔNG có domain `CUSTOMER` nào cả (giống tình huống Shipping ở Round 2) — hiện tại 0 role nào (kể cả Order Manager/Support) có quyền xem Customers.

## Quyết định role gating (theo đúng nguyên tắc least-privilege đã áp dụng ở Round 2)

**Chỉ core admin (`super_admin|admin|staff`) được truy cập toàn bộ Customers trong round này** — không thêm permission mới vào matrix, không mở cho Order Manager/Support dù họ có thể muốn tra cứu khách hàng khi xử lý đơn. Lý do: tab "Login Accounts" cho phép đổi email/mật khẩu đăng nhập của khách — rủi ro bảo mật cao nếu cấp nhầm quyền. Nếu sau này cần Order Manager/Support tra cứu (không sửa), đó là quyết định riêng cần bàn kỹ, không tự ý mở trong round này.

## Việc: Customers — list (read-only) + detail 3 tab

**Cần làm:**

1. Backend: tạo `App\Http\Controllers\Api\Admin\CustomerController` với:
   - `index`: list customer kèm `orders_count`, `orders_sum_total`, email (từ user đầu), status — giữ đúng logic tính đang có trong Filament (`withCount`/`withSum`, guest luôn Active). Hỗ trợ filter `status` (active/inactive) và search theo tên/email.
   - `show`: detail 1 customer, kèm eager-load đủ để trả cả 3 tab trong 1 response (hoặc 3 endpoint riêng `orders`/`addresses`/`users` dưới `/admin/customers/{id}/...` nếu response quá nặng — do ChatGPT quyết định cấu trúc, miễn giữ đủ dữ liệu).
   - Route toàn bộ dưới `role:super_admin|admin|staff` middleware riêng (giống cách Shipping đã làm ở Round 2 — không dựa vào `EnforceAdminApiPermission` ability, vì không có permission nào cho domain này).
   - **KHÔNG cần** endpoint sửa email/reset password trong round này — để nguyên hành động đó chỉ có ở Filament (`/admin` port 8000) cho tới khi có quyết định riêng về UI đổi mật khẩu ở admin mới (out of scope, đừng tự ý thêm).
2. Frontend: `admin/src/features/customers/` — trang list (Name, Email, Total Orders, Total Spent, Joined, Status badge, filter Status) + trang detail có 3 tab: Orders (link sang `/orders/{id}` đã có từ Round 1), Address Book (bảng đọc), Login Accounts (chỉ hiển thị danh sách email — **không có nút Edit/Reset Password** trong round này, đúng như giới hạn backend ở trên).
3. Route/sidebar: thêm mục "Customers" vào nhóm "Sales" đã có, gate `isCoreAdministrator` only — không dùng `canManageCommerce`/`canManageReviews` (2 helper đó có Order Manager/Support/Product Manager, không phù hợp ở đây).
4. i18n: thêm key `customers.*`, dùng đúng tên "Address Book" / "Login Accounts" (không dịch cứng "Sổ địa chỉ"/"Tài khoản đăng nhập" nếu bản tiếng Việt cần khác — tham khảo cách các feature trước xử lý bilingual).

**Không cần làm:** Create/Edit/Delete Customer record (Filament cũng không có); đổi email/reset password (để lại Filament); Customer Groups quản lý riêng (đã cắt scope từ round Catalogue, giữ nguyên quyết định cũ).

## Sau khi code xong

Báo lại để Claude (session này) làm final review — tự chạy lại test, đọc diff, verify role gating đúng core-admin-only — trước khi merge.

## Chưa mở scope (đợt sau)

**Discounts** (`Lunar\Admin\Filament\Resources\DiscountResource`, 436 dòng, hệ thống discount type/condition riêng của Lunar) — cần 1 audit riêng đọc kỹ vendor source trước khi viết brief, không mở trong round này.
