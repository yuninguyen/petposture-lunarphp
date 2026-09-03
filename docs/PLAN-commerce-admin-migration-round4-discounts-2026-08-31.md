# Commerce admin migration round 4 — Discounts — brief cho ChatGPT (2026-08-31)

Context: mục cuối cùng của Commerce migration (sau Orders/Return Requests/Shipping/Reviews/Customers — đã xong, merge `main`). User đã chọn **full parity với Filament** cho Discounts thay vì bản thu gọn — đây là feature lớn nhất trong toàn bộ đợt Commerce, nên brief này **chỉ mở Round 4a (core discount CRUD)**. 3 round tiếp theo (limitations, conditions/reward, BuyXGetY) sẽ có brief riêng sau khi Round 4a xong và review — không code hết 1 lần.

## Audit hiện trạng (2026-08-31)

- Vendor gốc: `vendor/lunarphp/lunar/src/Filament/Resources/DiscountResource.php` (436 dòng). Bảng chính `lunar_discounts` (`id, name, handle, coupon, type, starts_at, ends_at, uses, max_uses, max_uses_per_user, priority, stop, restriction, data, created_at, updated_at`) — `type` là class name PHP của discount type (`Lunar\DiscountTypes\AmountOff`, `Lunar\DiscountTypes\BuyXGetY`, `App\Lunar\DiscountTypes\FixedAmountOffPerUnit`), `data` là JSON chứa field riêng theo từng type.
- **0 discount nào tồn tại** trong DB hiện tại (production lẫn local) — không có data cần migrate/bảo toàn.
- **Chỉ 1 currency (USD)** trong hệ thống — các vòng lặp "theo currency" trong form vendor (`getMinimumCartAmountsFormComponents`, `getAmountOffFormComponents`) thực chất chỉ còn đúng 1 field mỗi loại, không phức tạp như code vendor gợi ý (code vendor viết tổng quát cho multi-currency nhưng ở đây không cần).
- 3 discount type đang thực sự active trong app: `Lunar\DiscountTypes\AmountOff` (percentage HOẶC fixed value per cart), `Lunar\DiscountTypes\BuyXGetY` (mua X tặng Y), `App\Lunar\DiscountTypes\FixedAmountOffPerUnit` (custom của dự án, `backend/app/Lunar/DiscountTypes/FixedAmountOffPerUnit.php` — extends AmountOff, giảm cố định theo TỪNG ĐƠN VỊ sản phẩm chứ không phải theo cart, dùng chung field `data.fixed_values.{currency}`).
- Đăng ký discount type: `AppServiceProvider.php:124-125` — `app(DiscountManagerInterface::class)->addType(FixedAmountOffPerUnit::class)`.
- Không có domain `DISCOUNT` nào trong `App\Security\AdminPermissionMatrix` — giữ đúng nguyên tắc least-privilege đã áp dụng cho Shipping/Customers: **core-admin-only** (`super_admin|admin|staff`), không thêm permission mới.
- Coupon áp dụng thật ở checkout qua `App\Services\ApplyCouponService` (route `POST /api/apply-coupon`) — brief này KHÔNG đụng vào, chỉ là nơi tham khảo nếu cần hiểu field nào ảnh hưởng runtime.

## Việc Round 4a: Discount — core CRUD (chưa làm limitations/conditions/reward/BuyXGetY)

**Cần làm:**

1. Backend: tạo `App\Http\Controllers\Api\Admin\DiscountController` với `index/store/show/update/destroy`, route dưới `role:super_admin|admin|staff` (giống Shipping/Customers, không dùng `EnforceAdminApiPermission`).
   - Field core: `name` (required), `handle` (required, unique, auto-slug từ `name` khi tạo — giữ đúng hành vi Filament `afterStateUpdated` chỉ auto-set lúc create, không ghi đè khi edit), `type` (required, chỉ nhận 1 trong 3 class string đã liệt kê ở trên — validate bằng `in:` list cứng, KHÔNG cho nhập tuỳ ý class), `starts_at` (required, datetime), `ends_at` (nullable, datetime, phải sau `starts_at` nếu có), `priority` (nullable, integer — Filament chỉ cho 3 mức 1/5/10 nhưng lưu là số nguyên tuỳ ý, không cần validate `in:` nếu không muốn — giữ đơn giản), `stop` (boolean).
   - Field điều kiện: `coupon` (nullable, string, unique trừ chính nó), `max_uses` (nullable, integer, min 0), `max_uses_per_user` (nullable, integer, min 0), `data.min_prices.USD` (nullable, numeric, min 0 — chỉ 1 currency).
   - Field theo type (`data` JSON, chỉ áp dụng field tương ứng với `type` đã chọn — validate có điều kiện theo `type`):
     - `AmountOff` / `FixedAmountOffPerUnit`: `data.fixed_value` (boolean), `data.percentage` (nullable numeric, chỉ dùng khi `fixed_value=false`), `data.fixed_values.USD` (nullable numeric, chỉ dùng khi `fixed_value=true`).
     - `BuyXGetY`: `data.min_qty`, `data.reward_qty`, `data.max_reward_qty` (integer), `data.automatically_add_rewards` (boolean). **Chỉ validate/lưu field này ở Round 4a — KHÔNG cần UI/logic reward product thật (đó là relation manager `ProductRewardRelationManager`, để Round 4c).**
   - `index`: list + search theo `name`/`coupon`, hiển thị đủ cột Filament có (status tính từ `starts_at`/`ends_at`/hiện tại — active/expired/pending/scheduled, giữ đúng 4 trạng thái Lunar dùng: `Lunar\Models\Discount::ACTIVE/EXPIRED/PENDING/SCHEDULED`), pagination.
   - `destroy`: xoá thẳng, không cần ràng buộc đặc biệt (khác Shipping — discount không bị order tham chiếu cứng theo cách cần chặn xoá, coupon đã dùng vẫn lưu trong `order.meta.coupon_code` dạng string, không phải FK).
2. Frontend: `admin/src/features/discounts/` — trang list (Name, Type, Status badge theo 4 trạng thái trên, Coupon, Starts/Ends, filter search) + trang tạo/sửa (form theo field Round 4a, ẩn/hiện field theo `type` đã chọn — tương tự cách Filament dùng `visible(fn (Get $get) => ...)`) + xoá.
3. Route/sidebar: thêm "Discounts" vào nhóm "Sales", gate `isCoreAdministrator` only (pattern giống Shipping/Customers — export `canManageDiscounts` riêng trong `App.tsx`, đừng tái dùng `canManageCommerce`).
4. i18n: `discounts.*`.

**KHÔNG làm ở Round 4a (để round sau):**
- Limitations (giới hạn discount áp dụng cho Collection/Brand/Product/ProductVariant/Customer cụ thể nào) — 5 relation manager, dùng bảng `lunar_collection_discount`, `lunar_brand_discount`, `lunar_discountables` (polymorphic, cột `discountable_type`/`discountable_id`/`type`), `lunar_customer_discount`.
- Conditions theo Product/Collection cụ thể (ProductConditionRelationManager, CollectionConditionRelationManager) — cũng dùng `lunar_discountables`/`lunar_collection_discount` nhưng khác `type` giá trị so với limitation.
- Reward Product cho BuyXGetY (ProductRewardRelationManager) — cũng `lunar_discountables`.
- Trang "Availability" riêng (`Pages\ManageDiscountAvailability`) — chưa rõ khác gì so với `starts_at`/`ends_at` đã có ở form chính, cần audit thêm khi vào round đó.

**Không migrate data cũ** — 0 discount tồn tại, không cần script migrate.

## Sau khi code xong

Báo lại để Claude (session này) làm final review — tự chạy lại test, đọc diff, verify role gating core-only — trước khi merge. Sau khi Round 4a merge xong, quay lại để Claude viết brief Round 4b (Limitations) dựa trên đúng schema `lunar_discountables`/`lunar_collection_discount`/`lunar_brand_discount`/`lunar_customer_discount` đã audit ở trên.
