# Sales admin parity Round B — Order Detail enrichment + Customer Details box — brief cho Codex (2026-09-02)

Context: tiếp theo Round A (đã merge). User dùng thật `admin.petposture.com` và báo thêm gap ở Order Detail + Customer Detail so với Filament (`api.petposture.com/admin`).

## Việc 1: Order Detail — sửa nhanh

`admin/src/features/orders/OrderDetailPage.tsx:27`:
- `refund_status` hiển thị nguyên chuỗi backend (`refunded`) — cần Title Case (`Refunded`). Dùng cách format tương tự `status_label`/`payment_status_label` đã có, hoặc 1 helper `titleCase()` đơn giản nếu BE chưa trả sẵn label.
- `refund_amount` đang `String(order.refund_amount)` — thiếu `$`. Format tiền giống các chỗ khác đã sửa (`displayMoney` pattern).

## Việc 2: Order Detail — Items section đầy đủ hơn

Hiện `Items` section chỉ hiển thị mô tả + tổng dòng (`orders/OrderDetailPage.tsx`, phần render `order.lines`). Filament (`ViewOrder.php` infolist, đã audit) hiển thị mỗi dòng gồm: Product, Qty, Unit Price, Subtotal, và tracking number/carrier nếu dòng đó đã có shipment gắn vào. Sau bảng Items, có khối Totals riêng: Items Subtotal, Discount (kèm coupon code nếu có), Shipping (kèm tên phương thức ship), Tax, **Order Total** (in đậm).

- API `OrderResource.php` (Api version) đã có sẵn đủ field cho việc này: `lines[].unit_price`, `lines[].sub_total`, `sub_total`, `discount_total`, `tax_total`, `shipping_total`, `shipping_label`, `coupon_code`, `shipments[]` — audit kỹ field nào đã có/thiếu trước khi code, đa số đã có sẵn không cần thêm BE.
- Riêng "tracking theo từng dòng" (Filament dùng `OrderShipmentItem` join với `shipment`) — kiểm tra `shipments[]` ở API hiện tại đã đủ để map ngược về từng order line chưa; nếu API hiện chỉ trả list shipment rời rạc không gắn theo line, cần thêm mapping (BE nhỏ) hoặc bỏ qua phần "tracking theo dòng" ở Round B này (không bắt buộc, chỉ nice-to-have) — quyết định tuỳ độ phức tạp thực tế, ưu tiên Unit Price/Subtotal/Totals block trước.

## Việc 3: Order Detail — thêm Order Attribution + Fraud & Risk

**BE:** `backend/app/Http/Resources/Api/OrderResource.php` hiện KHÔNG expose các field này (đã audit, chỉ có ở Filament đọc thẳng `$record->meta`). Cần thêm vào response:
- `attribution_origin`, `attribution_device_type`, `attribution_session_page_views` (từ `meta.attribution_*`)
- `fraud_risk_level`, `fraud_risk_score`, `fraud_seller_message` (từ `meta.fraud_*`)

Trả `null` nếu không có data (đa số order COD/PayPal sẽ không có fraud data — chỉ card payment qua Stripe Radar mới có, đúng như Filament đã làm điều kiện `hasFraudRiskData()`).

**FE:** thêm 2 section mới trong `OrderDetailPage.tsx`:
- "Order Attribution": Origin, Device Type, Session Page Views — luôn hiển thị (dùng `—` nếu null).
- "Fraud & Risk": Risk Level (badge màu: `highest` → đỏ, `elevated` → vàng, còn lại → xanh), Risk Score, Note — **chỉ hiển thị section này khi có ít nhất 1 field không null** (giống điều kiện Filament `hasFraudRiskData()`), để không hiện box trống cho đơn COD/PayPal.

**Lưu ý quan trọng:** có 1 quyết định đã pin trước đây (`decision_order_summary_fraud_risk_layout`) về 1 lỗi CSS cosmetic rất hẹp ở layout Filament khi Fraud & Risk tồn tại (chiều cao 2 cột lệch nhau) — quyết định đó CHỈ áp dụng cho Filament, KHÔNG cấm việc đưa Fraud & Risk sang React. Đừng vin vào đó để bỏ qua việc này; chỉ cần layout mới ở React tự thiết kế lại từ đầu, không phải copy y hệt lỗi cosmetic đó.

## Việc 4: Customer Detail — thêm box "Customer Details" hiển thị thường trực

Hiện `admin/src/features/customers/CustomerDetailPage.tsx` chỉ có data này bên trong modal Edit (`CustomerDetailsModal`) — không có gì hiển thị ngoài trang khi chưa bấm Edit. Cần thêm 1 `<section>` "Customer Details" (giống các Section card khác trong app) hiển thị **read-only** ngay dưới stat cards, trước phần tabs:
- Full Name (ghép first+last), Company Name, Tax ID, Email, Phone — dùng `—` khi field trống.
- (Tuỳ chọn) Account Reference, Customer Groups nếu API đã có field tương ứng — audit trước, nếu chưa có thì bỏ qua, không cần thêm BE mới chỉ vì 2 field ít quan trọng này.

## Việc 5: Customer Detail — polish tab visual

Tab hiện tại (`TabButton` trong `CustomerDetailPage.tsx:66`) đã là pill-style (`rounded-full`) nhưng đang nằm trần, không có khối bao quanh — khác Filament (pill nằm trong 1 khối nền xám bo tròn, canh giữa). Bọc nhóm tab trong 1 container `inline-flex gap-1 rounded-full bg-slate-100 p-1` (hoặc tương tự), giữ nguyên logic active/inactive hiện có, chỉ chỉnh CSS bao ngoài.

## Không cần làm ở Round B

- Không đụng state machine actions (Mark Processing/Shipped/Cancel), Add Shipment, refund reason dropdown — để round sau (Round C) nếu user còn muốn.
- Không đụng Customer IP block (không có trong feedback lần này, giữ nguyên chưa làm).

## Test & verification

- Backend: test field mới trong `OrderResource` trả đúng khi có/không có meta data.
- Frontend: test Items/Totals render đúng số liệu; test Fraud & Risk section ẩn khi không có data; test refund_status Title Case; test Customer Details box hiển thị đúng field.
- `npm run build`, `tsc --noEmit`, PHPUnit liên quan — sạch trước khi báo lại.

## Sau khi code xong

Báo lại để Claude review diff + tự chạy test verify trước khi merge/deploy.
