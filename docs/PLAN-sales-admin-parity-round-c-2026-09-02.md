# Sales admin parity Round C — Order actions/shipment + Return Requests tracking/quick-refund — brief cho Codex (2026-09-02)

Context: tiếp theo Round A/B (đã merge, deploy). Round C là phần còn lại nặng nghiệp vụ hơn — state machine đơn hàng, tạo shipment, và 2 hành động Return Requests còn thiếu.

## Việc 1: Orders — nút hành động theo state machine

API đã có sẵn: `POST /orders/{id}/actions/{action}` (`OrderController::performAction`), và `OrderResource` đã trả sẵn field `available_actions` — mảng `[{action, label}, ...]` từ `OrderOperationsService::availableActions()` (đọc `OrderStateMachine`), đúng những action hợp lệ theo status hiện tại của đơn.

- `admin/src/features/orders/api.ts`: thêm type `available_actions?: { action: string; label: string }[]` vào `Order` interface (nếu chưa có), thêm hook `usePerformOrderAction()` gọi `POST /orders/{id}/actions/{action}`.
- `admin/src/features/orders/OrderDetailPage.tsx`: render nút cho từng item trong `order.available_actions` (loại trừ action `markShipped` — xem việc 2, action đó dùng flow riêng có form). Style: action `cancelOrder` màu danger, còn lại màu primary — giống Filament (`ViewOrder.php:44-48`). Có `requiresConfirmation` — dùng lại `ConfirmModal` đã có sẵn trong file.
- **Không cần** làm route mới — endpoint đã tồn tại, chỉ nối UI.

## Việc 2: Orders — Add Shipment

API đã có sẵn: `POST /orders/{id}/shipments` (`OrderController::createShipment`, dùng `OrderOperationsService::recordShipment()`).

- Chỉ hiện nút "Add Shipment" (hoặc "Mark Shipped" nếu đây là lần ship đầu, theo status `processing`) khi order còn dòng hàng chưa ship hết — Filament tính qua `remainingShippableQuantities()`; kiểm tra API hiện có expose field này chưa (có thể cần thêm `remaining_shippable_quantities` hoặc tương tự vào `OrderResource`/1 field mới trong `available_actions` logic — audit kỹ trước khi code, đừng đoán).
- Form: Tracking Number (required), Carrier (select: UPS/USPS/FedEx/DHL/Manual, default Manual), danh sách item trong đơn kèm ô nhập quantity (default = số lượng còn lại chưa ship của từng dòng).
- Nếu order đang ở `processing` (lần ship đầu), gọi `performAction('markShipped')` trước rồi mới `createShipment` — theo đúng thứ tự Filament làm (`ViewOrder.php:114-123`) — audit kỹ logic 2 bước này trước khi code.

## Việc 3: Orders — Refund modal thêm dropdown lý do

Hiện modal Refund (`OrderDetailPage.tsx`) chỉ có field `amount`. Filament có thêm `Select` "Reason" bắt buộc, dùng `OrderOperationsService::REFUND_REASON_LABELS` (audit giá trị enum thật của const này trước khi code). API `POST /orders/{id}/refund` — kiểm tra đã nhận field `reason` chưa; nếu backend hiện chưa validate/lưu `reason` thì cần thêm (nhỏ, tương tự cách `reason` đã có sẵn ở Return Requests approve).

## Việc 4: Return Requests — Add Return Tracking (MỚI cả API lẫn UI)

Service `ReturnRequestService::addTracking($returnRequest, $trackingNumber, $carrier)` đã tồn tại (dùng bởi Filament `OrderReturnRequestResource.php:268-269`) — chỉ thiếu Controller endpoint.

- Thêm `App\Http\Controllers\Api\ReturnRequestController::addTracking(Request $request, $id)` — validate `tracking_number` (required), `carrier` (nullable, in ups/usps/fedex/dhl/manual, default manual) — chỉ cho phép khi `status === approved` và `return_tracking_number` đang trống (giống điều kiện `visible()` của Filament action).
- Route: `POST /admin/return-requests/{id}/tracking` (đặt trong đúng admin group hiện có của Return Requests, giữ nguyên role gate `canManageOrders` — không phải core-only, vì Return Requests hiện đang mở cho Order Manager/Support theo Round 1).
- Frontend: nút "Add Return Tracking" trên `ReturnRequestDetailPage.tsx`, chỉ hiện khi `status === 'approved'` và chưa có tracking, form Tracking Number + Carrier.

## Việc 5: Return Requests — "Refund, No Return Required" (approveLowValueWaiver)

Service `ReturnRequestService::approveLowValueWaiver($returnRequest, $adminNote)` đã tồn tại. Điều kiện hiện chỉ khi `status === requested` VÀ `meta.low_value_auto_waive_eligible === true` (Filament: `OrderReturnRequestResource.php:145-146`).

- Thêm Controller endpoint `approveLowValueWaiver(Request $request, $id)` — validate `admin_note` (nullable). Kiểm tra `meta.low_value_auto_waive_eligible` server-side trước khi cho phép gọi (đừng chỉ ẩn ở UI, phải chặn ở API).
- API cần expose field `low_value_auto_waive_eligible` trong `OrderReturnRequestResource` để frontend biết có nên hiện nút hay không — audit field này đã có trong API response chưa, thêm nếu thiếu.
- Route: `POST /admin/return-requests/{id}/approve-low-value-waiver`.
- Frontend: nút riêng (icon tia sét ⚡ giống Filament nếu có sẵn icon tương tự trong `@/components/ui/icons`, không thì dùng text button màu success) — chỉ hiện khi field eligible = true.

## Việc 6: Return Requests — Refund estimate preview khi Approve

API đã có sẵn: `POST /orders/return-requests/preview` (`ReturnRequestController::preview`) — nhận `tracking_token`/`email` theo flow guest hiện tại (public). **Audit trước khi code**: endpoint này thiết kế cho luồng khách hàng (guest, cần tracking_token+email) — cần kiểm tra có dùng được cho admin (đã có `$id` sẵn) hay cần thêm 1 bản admin riêng nhận thẳng `id` thay vì tracking_token. Nếu cần bản mới, tạo `previewAdmin(Request $request, $id)` tái dùng `ReturnRequestService::previewRefundEstimate()` (method này không phụ thuộc tracking token, đã thấy dùng trực tiếp `$record` trong Filament).
- Frontend: trong modal Approve (`ReturnRequestDetailPage.tsx`), gọi preview live mỗi khi thay đổi `fee_waived` toggle hoặc mount modal, hiển thị "Item value: $X — Restocking fee: $Y — Estimated refund: $Z" giống Filament.

## Không cần làm ở Round C

- Manual Create Order — vẫn để lại chưa quyết định, không tự ý làm.
- Customer IP/Fraud & Risk — đã xong ở Round B.

## Test & verification

- Backend: test role gating, test `low_value_auto_waive_eligible` chặn đúng ở server không chỉ UI, test addTracking chỉ cho phép đúng status/điều kiện, test markShipped→createShipment đúng thứ tự.
- Frontend: test render đúng action buttons theo `available_actions`, test Add Shipment form, test refund reason dropdown required, test Return Tracking/waiver nút chỉ hiện đúng điều kiện, test preview gọi đúng khi đổi fee_waived.
- `npm run build`, `tsc --noEmit`, PHPUnit liên quan — sạch trước khi báo lại.

## Sau khi code xong

Báo lại để Claude review diff + tự chạy test verify trước khi merge/deploy.
