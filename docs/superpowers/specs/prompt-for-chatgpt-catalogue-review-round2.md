# Prompt round 2 — Phản biện độ phức tạp của plan Catalogue

> Copy toàn bộ nội dung từ phần "Vai trò" trở xuống và dán cho ChatGPT (tiếp nối thread trước, sau khi đã có `catalogue-architecture-review.md`, `catalogue-code-audit.md`, `catalogue-implementation-plan.md`).

---

## Vai trò

Tiếp tục vai trò kiến trúc sư/reviewer ở round trước. Lần này nhiệm vụ là **phản biện chính plan bạn vừa đề xuất** dưới góc độ: liệu nó có đang over-engineer so với quy mô thực tế của dự án hay không. Đừng mặc định plan trước là đúng — hãy đánh giá lại nghiêm túc, và nếu đồng ý cắt giảm, hãy đề xuất bản rút gọn cụ thể (không chỉ nói "có thể đơn giản hơn" chung chung).

## Bối cảnh quy mô thực tế (mới xác minh từ migration seed)

Dự án hiện tại, xác nhận từ code (`2026_05_22_000001_ensure_lunar_default_records.php`):

- Đúng **1 Currency** (USD).
- Đúng **1 Channel** (Webstore).
- Đúng **1 Customer Group** (Retail).
- Đúng **1 Tax Class** (Default).
- Site **chưa live**, admin chỉ có **một người dùng duy nhất** (chủ dự án, không có team).
- Không có kế hoạch multi-currency/multi-channel/multi-customer-group trong tương lai gần.

## Plan gốc (tóm tắt) mà tôi đang nghi ngờ là quá cỡ

Plan 12 phase, mỗi phase có API contract, backend actions, React scope, test scope, exit criteria, risk register riêng. Trong đó có các phần tôi nghi ngờ không cần thiết ở quy mô 1-người/chưa-live:

1. **Phase 8 Pricing**: thiết kế UI "price grid theo variant/currency/customer group/tier" + "bulk apply có preview" — cho hệ thống chỉ có 1 currency/1 customer group.
2. **Optimistic concurrency / version token / `409 Conflict` cho concurrent edit** — xuất hiện lặp lại ở Phase 0, 2, 5, 6 — cho hệ thống chỉ có 1 admin dùng cùng lúc.
3. **Phase 10 Catalogue cutover**: "dual-read comparison giữa React và Filament", "feature flag cho super admin nội bộ", "metrics/alerts", "chu kỳ ổn định quan sát trước khi tắt Filament" — quy trình cutover cấp doanh nghiệp cho site chưa có traffic thật.
4. **Phase 0**: "route/permission snapshot", "permission matrix cho admin roles" — trong khi chỉ có một role admin thực tế đang vận hành.
5. Risk register + rollback steps + exit criteria lặp lại ở toàn bộ 12 phase — tổng khối lượng tài liệu/quy trình có nguy cơ lớn hơn cả code thực tế cần viết.

## Nguyên tắc làm việc của tôi (từ CLAUDE.md dự án, cần bạn tôn trọng khi đề xuất lại)

- Không thêm tính năng/flexibility ngoài yêu cầu thực tế ("no speculative abstractions").
- Không xử lý lỗi/edge case cho tình huống không thể xảy ra với quy mô hiện tại.
- Đơn giản hóa tối đa: nếu 200 dòng có thể viết thành 50, hãy viết 50.
- Nhưng: **không được đánh đổi lấy rủi ro hỏng dữ liệu thật** — các invariant sau đây tôi coi là bắt buộc dù dự án nhỏ, không được cắt:
  - Price vẫn phải lưu đủ 5 khóa identity (`priceable_type`, `priceable_id`, `currency_id`, `customer_group_id`, `min_quantity`) ở tầng backend/DB, kể cả khi UI chỉ hiển thị 1 ô giá đơn giản (ẩn phức tạp, không xóa invariant).
  - Variant phải diff theo stable-ID, không xóa-tạo-lại, vì ID có thể đã nằm trong order/cart tham chiếu.
  - Locale update phải merge, không được ghi đè làm mất bản dịch locale khác.
  - Legacy cleanup vẫn phải tách release riêng và có dependency proof trước khi xóa (theo audit đã có).

## Câu hỏi cho round này

1. Bạn có đồng ý rằng plan gốc đang over-engineer cho quy mô 1-admin/chưa-live không? Nếu không đồng ý ở điểm nào, hãy nêu rõ và giải thích tại sao vẫn cần giữ dù quy mô nhỏ.
2. Với mỗi mục bị nghi ngờ (Pricing UI, concurrency control, cutover process, permission matrix, risk register per-phase), hãy phân loại: **cắt hẳn / hoãn đến khi cần / giữ nguyên nhưng làm gọn**, kèm lý do.
3. Đề xuất một **bản plan rút gọn** theo cùng 5 module (Attribute System → Product Type → Brand → Collection → Product), nhưng:
   - loại bỏ toàn bộ phần chỉ có giá trị khi có nhiều admin/nhiều currency/nhiều channel/đã live có traffic thật;
   - giữ nguyên các invariant data-safety bắt buộc đã liệt kê ở trên;
   - ước lượng mỗi module chỉ cần bao nhiêu endpoint tối thiểu và bao nhiêu màn hình React tối thiểu để dùng được thật (không phải "đạt parity hoàn toàn" với Filament, mà là "đủ dùng cho một người vận hành site nhỏ").
4. Trong bản rút gọn, phần nào bạn nghĩ vẫn nên giữ lại một phần quy trình cutover (vd: tắt Filament sau khi xong module) thay vì bỏ hẳn, để tránh vừa dùng Filament vừa dùng React cùng lúc gây nhầm dữ liệu?
5. Nếu sau này dự án lớn lên (nhiều currency/nhiều admin/site live có traffic), phần nào trong bản rút gọn sẽ cần bổ sung lại — để tôi biết mình đang đánh đổi gì khi chọn bản gọn, không phải bỏ đi vĩnh viễn mà không biết cái giá phải trả sau này.

Hãy phản biện thẳng, đừng chiều theo ý tôi nếu bạn thấy tôi đang cắt nhầm chỗ quan trọng.
