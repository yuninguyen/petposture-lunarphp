# Prompt round 4 — Đảo ngược quyết định cắt ProductType/Collection Group sau khi có runtime data thật

> Copy toàn bộ nội dung từ phần "Vai trò" trở xuống và dán cho ChatGPT (tiếp nối thread đã có round 1, 2, 3).

---

## Vai trò

Tiếp tục vai trò kiến trúc sư/reviewer, đồng thời từ giờ là bên trực tiếp code/fix/debug/review cho Catalogue. Round này **sửa lại 2 quyết định đã chốt sai ở round 2/3** dựa trên dữ liệu runtime thật vừa lấy được từ production (Docker container `petposture-backend`, không phải local dev DB, không phải seed script cũ).

## Dữ liệu runtime thật (query trực tiếp qua `php artisan tinker` trong container production)

```json
{
  "product_types": [
    { "id": 1, "name": "General" },
    { "id": 2, "name": "Harnesses" }
  ],
  "collection_groups": [
    { "id": 1, "name": "Mobility & Support", "handle": "mobility-support" },
    { "id": 3, "name": "Shop Collections", "handle": "shop-collections" },
    { "id": 4, "name": "Feeding", "handle": "feeding" },
    { "id": 5, "name": "Comfort", "handle": "comfort" },
    { "id": 6, "name": "Mobility", "handle": "mobility" },
    { "id": 7, "name": "Walking", "handle": "walking" }
  ],
  "tax_classes": [{ "id": 1, "name": "Default", "default": true }],
  "currencies": [{ "id": 1, "code": "USD", "default": true }],
  "channels": [{ "id": 1, "name": "PetPosture", "default": true }],
  "customer_groups": [{ "id": 1, "name": "Retail", "default": true }],

  "total_products": 1,
  "products_per_type": [{ "product_type_id": 2, "c": 1 }],

  "total_collections": 10,
  "collections_per_group": [
    { "collection_group_id": 3, "c": 1 },
    { "collection_group_id": 4, "c": 3 },
    { "collection_group_id": 5, "c": 2 },
    { "collection_group_id": 6, "c": 3 },
    { "collection_group_id": 7, "c": 1 }
  ]
}
```

Diễn giải:

- **ProductType**: đã có 2 record thật (`General` id=1 chưa có product nào; `Harnesses` id=2 đang được dùng cho sản phẩm thật duy nhất trong hệ thống). Đây không phải giả thuyết tương lai — admin đã chủ động tạo type thứ hai qua Filament.
- **Collection Group**: đã có 6 record thật (không tính group id=2 bị thiếu — có thể đã xoá), 5 trong số đó đang thực sự chứa Collection: Shop Collections (1), Feeding (3), Comfort (2), Mobility (3), Walking (1) — tổng 10 Collection thật, tổ chức theo chủ đề merchandising rõ ràng. Group "Mobility & Support" (id=1) hiện có 0 collection — có thể là group cũ/orphan, cần hỏi lại chủ site có còn dùng không trước khi động vào.
- `total_products = 1`: catalogue Product thật cực kỳ nhỏ, xác nhận site đúng là giai đoạn tiền-launch cho phần Product, nhưng Collection/ProductType đã được đầu tư cấu trúc thật.
- Currency/Channel/CustomerGroup/TaxClass: vẫn đúng như giả định trước (mỗi loại đúng 1 record, `default` đã set đúng). Không cần sửa gì ở nhóm này.
- **Không tìm thấy ProductType "Stock" hay CollectionGroup "Main"** mà bạn cảnh báo có thể còn sót lại từ `lunar:install` — vậy nhánh rủi ro đó không xảy ra ở môi trường này, có thể bỏ qua guard "phát hiện nhiều canonical không rõ nguồn gốc" cho trường hợp cụ thể này (nhưng vẫn giữ nguyên tắc chung: resolver không được tự ý chọn `first()` khi có nhiều hơn 1 record).

## Quyết định bị đảo ngược so với round 2/3

### 1. ProductType — KHÔNG cắt CRUD/UI nữa

Lý do: đã có 2 type thật đang dùng cho business logic thật (Harnesses cần attribute khác General, ví dụ số đo vòng ngực/cổ). Ẩn hoàn toàn khỏi UI nghĩa là admin mất khả năng tạo type thứ 3 trong tương lai và mất khả năng thấy attribute nào thuộc type nào — không chấp nhận được.

Yêu cầu mới:

- Product create/edit **phải có ProductType picker** (dropdown chọn 1 trong các type hiện có).
- Cần **1 màn hình quản lý ProductType tối thiểu**: list (tên, số Product đang dùng), tạo mới (chỉ cần tên), không cần đổi tên/xoá ở v1 nếu type đang có Product tham chiếu.
- Attribute System ("Custom Fields") phải cho phép chọn field đó thuộc ProductType nào khi tạo — không còn giả định "chỉ có 1 type nên khỏi hỏi".
- Không cần permission/role riêng cho ProductType, không cần versioning — giữ nguyên các cắt giảm khác.

### 2. Collection Group — KHÔNG cắt CRUD nữa

Lý do: 6 group thật đang tổ chức 10 Collection thật, không phải cấu trúc rác từ seed script cũ như giả định trước.

Yêu cầu mới:

- Collection create/edit **phải có Collection Group picker**.
- Cần **1 màn hình quản lý Collection Group tối thiểu**: list (tên, handle, số Collection), tạo mới, sửa tên. Không cần nested/tree phức tạp cho Group (chỉ Collection mới cần cây cha-con như plan cũ).
- Không tự động gán default group nữa ở backend — phải để admin chọn tường minh vì đã có nhiều group thật.

## Giữ nguyên các quyết định khác (không đổi)

- Cắt concurrency/version token, permission matrix nhiều role, risk register per-phase, enterprise cutover — vẫn đúng, không liên quan tới phát hiện này.
- 4 invariant data-safety bắt buộc (price identity 5-khóa, variant stable-ID, locale merge, legacy cleanup tách release) — giữ nguyên.
- Attribute v1 chỉ hỗ trợ FieldType Text (đã verify qua code, không liên quan tới phát hiện ProductType/CollectionGroup) — giữ nguyên.
- Tái sử dụng `MediaPicker.tsx` + bridge CuratorMedia → Spatie media — giữ nguyên.
- ProductType/Collection Group resolver vẫn không được dùng `first()` khi có nhiều record mơ hồ — nguyên tắc này giờ áp dụng thực tế ngay từ đầu vì đã có nhiều record thật.

## Câu hỏi cho round này

1. Cập nhật lại danh sách module UI: giờ là **6 module** thay vì 4 — Custom Fields (Attribute), Product Type, Brand, Collection Group, Collection, Product. Ước lượng lại số màn hình tối thiểu cho Product Type và Collection Group (khả năng chỉ cần 1 màn hình/module vì đơn giản: list + inline create, không cần trang riêng).
2. Product Type/Collection Group picker nên là dropdown đơn giản trong form Product/Collection, hay cần màn hình riêng để "quản lý" ngoài ra? Đề xuất phương án tối thiểu nhất vẫn đủ dùng.
3. Cập nhật lại thứ tự build: Product Type và Collection Group có nên build trước Brand vì Product/Collection sẽ cần chúng làm dropdown option ngay từ đầu?
4. Viết lại phần "Module 1 code-ready spec" (mục 5 ở round 3) có cần đổi gì không khi Attribute/Custom Field giờ phải gắn với ProductType cụ thể thay vì tự động gán "General" — cụ thể là field `attribute_type`/mapping logic trong `CustomFieldController@store` cần nhận thêm `product_type_id` từ request thay vì tự resolve qua `DefaultCatalogueContext::productType()`.
5. `DefaultCatalogueContext` ở round 3 giả định "đúng 1 ProductType/Collection Group" — giờ không còn đúng nữa. Class này có còn cần thiết cho phần Currency/Channel/CustomerGroup/TaxClass (vẫn đúng 1 mỗi loại) không, hay nên bỏ hẳn khái niệm "canonical default" cho riêng ProductType/CollectionGroup và thay bằng picker tường minh?

Phản biện thẳng nếu thấy tôi đang phản ứng thái quá với 1 con số nhỏ (2 ProductType, 6 Collection Group) — có thể đây vẫn là quy mô đủ nhỏ để làm đơn giản, chỉ là không được ẩn hoàn toàn như round 3 đề xuất.
