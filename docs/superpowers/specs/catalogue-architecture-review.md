# Catalogue Architecture Review — PetPosture

## Kết luận ngắn

Hướng di dời Catalogue từ Filament sang React là hợp lý, nhưng bản mô tả ban đầu có hai giả định quan trọng không còn đúng với code hiện tại:

1. Lunar Brand thật **đã có UI Filament** và route đang hoạt động tại `/admin/brands`.
2. Lunar Product Type **đã có UI Filament** và route đang hoạt động tại `/admin/product-types`.

Vì vậy đây không phải là bài toán “khôi phục phần quản trị còn thiếu”, mà là **thay thế dần một UI đang hoạt động bằng API + React mà không phá vỡ các invariant của Lunar**.

---

## 1. Thứ tự build được đề xuất

### Thứ tự khuyến nghị

1. **Nền tảng dùng chung và contract Catalogue**
2. **Attribute System: Attribute Group + Attribute**
3. **Product Type**
4. **Brand**
5. **Collection Group + Collection**
6. **Product + Variant + Option + Price + Media + Availability**
7. **Đối chiếu dữ liệu, chuyển quyền quản trị, rồi mới dọn legacy**

Nếu buộc phải giữ đúng năm nhóm ban đầu, thứ tự là:

1. Attribute Group
2. Product Type
3. Brand
4. Collection Group
5. Product

### Lý do

Product là aggregate có nhiều phụ thuộc nhất. Form Product cần có sẵn:

- Product Type để xác định schema thuộc tính;
- Attribute/Attribute Group để render dynamic fields;
- Brand để chọn quan hệ;
- Collection để phân loại;
- Currency, Customer Group, Channel và Tax Class để cấu hình giá/availability;
- Product Option/Option Value để tạo ma trận variant;
- Media để chọn ảnh.

Build Product trước các lookup/resource trên sẽ khiến API và UI liên tục thay đổi, tăng nguy cơ viết logic tạm rồi phải sửa lại.

### Vì sao Brand nên đi trước Collection

Brand là vertical slice CRUD nhỏ hơn, giúp kiểm chứng sớm các convention mới: request validation, resource DTO, media, cache invalidation, delete guard, React list/form và quyền truy cập. Collection phức tạp hơn vì có tree, URL, availability và quan hệ sản phẩm.

### Phản biện mức ưu tiên ban đầu

Đặt Product ở vị trí số 3 là quá sớm nếu mục tiêu là hoàn thiện từng module đủ dùng trong production. Product nên là module cuối cùng trong Catalogue vì nó là nơi hội tụ toàn bộ dependency và rủi ro thương mại.

---

## 2. Gộp hay tách API Attribute System

### Quyết định

- **Gộp về bounded context/UI:** `Attribute System`.
- **Tách endpoint/resource:** Attribute Group, Attribute và Product Type vẫn có route/controller riêng.
- **Cho phép endpoint tổng hợp dành cho editor:** thêm một endpoint đọc schema đã ghép sẵn cho Product form.

### API đề xuất

```text
GET    /api/admin/attribute-groups
POST   /api/admin/attribute-groups
GET    /api/admin/attribute-groups/{id}
PUT    /api/admin/attribute-groups/{id}
DELETE /api/admin/attribute-groups/{id}

POST   /api/admin/attribute-groups/{id}/attributes
PUT    /api/admin/attributes/{id}
DELETE /api/admin/attributes/{id}
POST   /api/admin/attributes/reorder

GET    /api/admin/product-types
POST   /api/admin/product-types
GET    /api/admin/product-types/{id}
PUT    /api/admin/product-types/{id}
DELETE /api/admin/product-types/{id}
PUT    /api/admin/product-types/{id}/attribute-mapping

GET    /api/admin/product-types/{id}/editor-schema
```

`editor-schema` có thể trả về các group/attribute đã được lọc theo product/variant và sắp xếp đúng position. React không cần tự join nhiều response để dựng Product editor.

### Không nên làm

Không nên tạo một endpoint ghi kiểu `PUT /attribute-system` nhận toàn bộ cây Attribute Group + Attribute + Product Type. Payload này khó validate, khó authorization, dễ ghi đè ngoài ý muốn và khó xử lý concurrent edits.

### Transaction boundary

Các thao tác sau nên chạy trong transaction:

- cập nhật Product Type và toàn bộ mapping attribute;
- reorder nhiều attribute;
- tạo/sửa Product cùng variants, options, prices và availability;
- thay đổi cấu trúc variant có thể làm mất tổ hợp hiện tại.

---

## 3. Cách expose `attribute_data`

### Quyết định

Không expose trực tiếp serialization nội bộ của Lunar cho React. Cũng không flatten vĩnh viễn thành chuỗi đơn locale.

Dùng một **DTO ổn định, locale-aware**, rồi map hai chiều tại boundary API.

### DTO khuyến nghị

```json
{
  "attributes": {
    "name": {
      "type": "text",
      "localized": true,
      "values": {
        "en": "Orthopedic Bed",
        "vi": "Giường chỉnh hình"
      }
    },
    "material": {
      "type": "text",
      "localized": true,
      "values": {
        "en": "Memory foam",
        "vi": "Mút hoạt tính"
      }
    }
  }
}
```

Đối với màn hình chỉ dùng một locale, có thể hỗ trợ projection đọc đơn giản:

```json
{
  "locale": "en",
  "attributes": {
    "name": "Orthopedic Bed",
    "material": "Memory foam"
  }
}
```

Nhưng payload ghi canonical vẫn nên giữ `values` theo locale để không vô tình xoá bản dịch khác.

### Quy tắc quan trọng

- Backend là nơi biết Lunar FieldType và thực hiện hydrate/dehydrate.
- React chỉ biết schema field của admin, không biết PHP class serialization của Lunar.
- Thiếu locale trong request không đồng nghĩa với xoá locale đó.
- Validate required/type/configuration dựa trên Attribute definition của Product Type.
- Không cho client gửi arbitrary handle chưa có trong schema, trừ khi có chủ đích hỗ trợ extension attributes.
- Giữ API public storefront riêng biệt với API admin; không tái sử dụng DTO admin cho storefront.

### Search/filter

`CAST(attribute_data AS CHAR) LIKE` đang đúng cú pháp MySQL nhưng chỉ nên xem là giải pháp tương thích hiện tại. Với field cần filter/search thường xuyên:

- ưu tiên quan hệ chuẩn (Brand, Collection, Breed, Solution);
- dùng Lunar searchable/filterable infrastructure nếu phù hợp;
- hoặc tạo projection/index riêng;
- tránh biến toàn bộ JSON thành công cụ taxonomy dài hạn.

---

## 4. Dọn legacy cùng đợt hay tách riêng

### Quyết định

**Tách thành đợt riêng, nhưng audit và cô lập ngay trong đợt migration Catalogue.**

Không nên xoá ngay vì legacy hiện chưa hoàn toàn “chết”:

- `ProductSyncService::normalizePublicImageUrl()` còn được Product/Order resource và email production sử dụng;
- `LegacyProductObserver` còn được đăng ký trong `AppServiceProvider`;
- `archiveSyncedProduct()` vẫn được observer gọi khi xoá legacy product;
- `DatabaseSeeder` vẫn tạo `App\Models\Category` và `App\Models\Legacy\Product`;
- `ProductSyncMapping` vẫn liên kết hai hệ;
- `syncFromLegacy()` đúng là chỉ được gọi trực tiếp trong test theo kết quả tìm kiếm hiện tại, nhưng class service vẫn có trách nhiệm production khác.

### Cách chia an toàn

#### Đợt Catalogue migration

- đánh dấu legacy UI là deprecated hoặc ẩn navigation;
- chặn tạo/sửa dữ liệu từ entry point legacy nếu không còn được phép;
- ghi rõ Lunar là source of truth;
- thêm report so sánh mapping/orphan;
- tách helper URL ảnh khỏi `ProductSyncService` để giảm coupling, nhưng chỉ thực hiện khi có test bảo vệ.

#### Đợt cleanup riêng

- chứng minh không còn read/write production;
- bỏ observer và service sync;
- chuyển helper ảnh sang service trung lập;
- sửa seeders/tests;
- archive hoặc drop mapping/table bằng migration có backup/rollback;
- xoá Filament resource/model/policy/controller legacy;
- chạy regression test public product, cart, checkout, order email và admin.

### Tiêu chí cho phép xoá

Chỉ xoá khi đồng thời thỏa:

1. không còn route/controller/job/command/observer/seeder production truy cập legacy;
2. mọi legacy product cần giữ đã có Lunar mapping hợp lệ;
3. storefront, cart và checkout không đọc bảng legacy;
4. email/order resource không còn phụ thuộc service legacy;
5. có backup và rollback migration;
6. đã chạy ít nhất một chu kỳ production ổn định sau khi chuyển admin sang Lunar-only.

---

## 5. Pattern và cạm bẫy Lunar cần tránh

### 5.1 Dùng application service, không ghi aggregate rải rác trong controller

Nên có các action/service như:

```text
CreateProductAction
UpdateProductAction
SyncProductVariantsAction
SyncVariantPricesAction
SyncProductAvailabilityAction
MapProductTypeAttributesAction
```

Controller chịu validation/orchestration; transaction và invariant nằm trong action/service.

### 5.2 Không coi Product là một CRUD row đơn giản

Một lần lưu Product có thể liên quan:

- Product base record;
- localized attributes;
- brand;
- URLs/slugs;
- collections;
- channels/customer groups availability;
- product options và option values;
- variants;
- prices;
- inventory;
- media và primary image.

Phải xác định rõ aggregate boundary và partial-update semantics trước khi code UI.

### 5.3 Giá phải được định danh đầy đủ

Không update “price đầu tiên”. Khóa logic phải xét ít nhất:

- `priceable_type` theo morph class hiện tại;
- `priceable_id`;
- `currency_id`;
- `customer_group_id`;
- `min_quantity`.

Giá dùng minor units integer. Không để React gửi float rồi ghi thẳng DB. API nên nhận decimal string hoặc minor unit có contract rõ ràng và backend thực hiện conversion.

### 5.4 Variant matrix cần diff, không delete-and-recreate mù quáng

Delete/recreate variants có thể phá:

- ID variant đang nằm trong cart/order/reference;
- SKU;
- stock;
- media;
- prices;
- associations.

Hãy dùng stable variant ID và diff tổ hợp option values. Khi xoá variant đã từng được dùng, cân nhắc archive/soft-delete hoặc guard thay vì hard delete.

### 5.5 Availability là dữ liệu độc lập

`published` không tự động có nghĩa là bán được. Product còn phụ thuộc Channel và Customer Group pivots, thời gian bắt đầu/kết thúc và trạng thái enabled. Product editor cần một section Availability rõ ràng hoặc backend áp dụng default có chủ đích.

### 5.6 URL và slug

Slug nằm trong `lunar_urls`, có language/default semantics. Không nên thêm cột slug tuỳ tiện vào `lunar_products`. Khi đổi slug phải có quyết định về redirect/SEO và uniqueness theo element/language.

### 5.7 Media

Giữ quy ước primary image, collection name và conversions thống nhất với Lunar/Spatie Media Library. API update Product không nên vô tình xoá media chỉ vì payload form không gửi lại toàn bộ gallery.

### 5.8 Delete guard

- Không xoá Product Type đang có Product nếu chưa có reassign strategy.
- Không xoá Attribute system/required đang có dữ liệu mà không có migration plan.
- Không xoá Brand/Collection đang được tham chiếu mà không xác định null/detach/reassign.
- Prefer conflict response `409` kèm dependency counts.

### 5.9 N+1 và payload

Tạo query profile riêng cho list và detail. List không cần load toàn bộ graph; detail editor cần eager-load có chủ đích. Thêm test query-count cho Product index và editor detail.

### 5.10 Concurrency và lost updates

Product editor lớn dễ bị hai admin ghi đè. Có thể dùng `updated_at`/version trong request và trả `409 Conflict` nếu stale. Ít nhất phải tránh PUT khiến field/locale không xuất hiện bị xoá ngầm.

### 5.11 Cache invalidation

Code hiện có observer cho Lunar Product và Brand. Mọi mutation qua API phải đi qua Eloquent/action phù hợp hoặc chủ động phát event để storefront cache được invalidation. Bulk SQL update có thể bỏ qua observer.

### 5.12 Test theo contract và invariant

Mỗi module cần:

- feature tests cho route/permission/validation;
- tests cho localized DTO round-trip;
- tests delete guard;
- tests transaction rollback;
- tests price identity và minor units;
- tests variant diff bảo toàn ID/SKU/stock;
- regression tests public product, cart và checkout.

---

## Kiến trúc đề xuất

```text
React feature
  -> typed API client
  -> Admin REST Controller
  -> Form Request / authorization
  -> Catalogue Application Action (transaction)
  -> Lunar models/relations/field types
  -> Admin API Resource / DTO mapper
```

Không để React phụ thuộc trực tiếp vào cấu trúc serialized PHP FieldType. Không tạo model Catalogue song song mới. Lunar tiếp tục là source of truth.

---

## Definition of Done toàn chương trình

- React admin quản trị được toàn bộ năm khu vực cần thiết.
- Mọi mutation ghi trực tiếp và đúng invariant vào Lunar tables.
- Filament Catalogue có thể chuyển sang read-only/ẩn mà storefront không thay đổi.
- Product/Variant/Price/Availability round-trip đúng qua API.
- Không làm mất locale không được chỉnh sửa.
- Public Product API, cart và checkout regression tests pass.
- Có report chứng minh legacy không còn dependency trước cleanup.
