# Catalogue Migration Implementation Plan — PetPosture

## Mục tiêu

Chuyển quyền quản trị Catalogue từ Filament sang React/Vite qua Admin REST API, giữ LunarPHP làm source of truth, không thay đổi contract storefront ngoài những sửa lỗi có chủ đích, và tách cleanup legacy thành giai đoạn riêng.

## Nguyên tắc thực hiện

1. Làm theo vertical slice có thể demo và rollback.
2. API contract/test trước UI phức tạp.
3. Mọi aggregate write nhiều bảng chạy trong transaction.
4. Filament tiếp tục là fallback cho tới khi module React đạt parity.
5. Không xoá legacy trong các phase build Catalogue.
6. Product là module cuối cùng.
7. Không expose serialization FieldType nội bộ của Lunar ra React.

---

## Phase 0 — Baseline, inventory và contract

### Backend

- Lập runtime data report cho Product Type, Product, Variant, Price, Brand, Collection, Attribute và legacy mapping.
- Ghi snapshot route và permission Catalogue hiện tại.
- Xác định default Language, Currency, Channel, Customer Group và Tax Class.
- Xác định canonical morph names đang dùng trong price/attributable pivots.
- Chốt DTO localized attributes.
- Chốt error envelope, pagination, filtering, sort và conflict response `409`.
- Chốt optimistic concurrency bằng `updated_at` hoặc version token.

### Frontend

- Tạo `features/catalogue` conventions dùng chung:
  - query keys;
  - API types;
  - form error mapper;
  - localized input/tabs;
  - resource picker;
  - dirty-form guard.

### Tests

- Regression baseline cho public products/brands.
- Cart add/update/remove.
- Checkout pricing và order line snapshot.
- Route/permission matrix cho admin roles.

### Exit criteria

- Có data audit report của môi trường đích.
- Có API/DTO decision record.
- Baseline regression suite xanh.
- Không có code production bị thay đổi hành vi.

---

## Phase 1 — Attribute System

### 1A. Read model và editor schema

#### Endpoints

```text
GET /api/admin/attribute-groups
GET /api/admin/attribute-groups/{group}
GET /api/admin/attributes/{attribute}
GET /api/admin/product-types/{type}/editor-schema
```

#### Response phải gồm

- group type: product/variant/brand/collection nếu được hỗ trợ;
- translated group name;
- handle và position;
- attribute type/FieldType mapping;
- required/system/filterable/searchable;
- configuration và validation rules được normalize;
- product/variant mapping cho Product Type.

### 1B. Attribute Group CRUD

```text
POST   /api/admin/attribute-groups
PUT    /api/admin/attribute-groups/{group}
DELETE /api/admin/attribute-groups/{group}
POST   /api/admin/attribute-groups/reorder
```

Delete guard nếu group còn attributes hoặc dữ liệu sử dụng; không cascade âm thầm.

### 1C. Attribute CRUD/reorder

```text
POST   /api/admin/attribute-groups/{group}/attributes
PUT    /api/admin/attributes/{attribute}
DELETE /api/admin/attributes/{attribute}
POST   /api/admin/attributes/reorder
```

### React

- Attribute Groups list theo attributable type.
- Group create/edit drawer/page.
- Attribute list trong group.
- Attribute form render configuration theo supported FieldType.
- Reorder có explicit Save, không ghi từng drag event.
- Badge cho system/required/searchable/filterable.

### Scope FieldType ban đầu

Chỉ implement những type đang có trong dữ liệu thật. Không xây generic builder cho mọi FieldType Lunar nếu chưa dùng.

### Tests

- Handle unique đúng scope.
- Localized name round-trip.
- Không xoá system attribute.
- Không xoá attribute đang mapped/đang có data nếu chưa có migration strategy.
- Reorder transaction rollback.
- Editor schema đúng product/variant partition.

### Exit criteria

- React quản trị được mọi attribute type đang dùng thực tế.
- Product Type editor có thể dùng editor schema ổn định.
- Không thay đổi/đánh mất `attribute_data` hiện có.

---

## Phase 2 — Product Type

### Endpoints

```text
GET    /api/admin/product-types
POST   /api/admin/product-types
GET    /api/admin/product-types/{type}
PUT    /api/admin/product-types/{type}
DELETE /api/admin/product-types/{type}
PUT    /api/admin/product-types/{type}/attribute-mapping
```

### Backend rules

- Mapping product attributes và variant attributes được validate riêng.
- Attribute type phải khớp morph type.
- Update mapping trong transaction.
- Delete Product Type có Product phải trả `409` với product count và reassign requirement.
- Không cho xoá Product Type cuối cùng nếu hệ thống cần default fallback.

### React

- List: name, product count, product attribute count, variant attribute count.
- Form: basic info + hai tab Product Attributes/Variant Attributes.
- Group attribute theo Attribute Group.
- Hiển thị cảnh báo khi unmap required/system/attribute đang có dữ liệu.

### Tests

- Mapping round-trip.
- Reject cross-type attribute mapping.
- Delete guard.
- Concurrent update conflict.
- Product editor schema đổi đúng sau mapping.

### Exit criteria

- React đạt parity với Lunar Product Type Filament.
- Có ít nhất một Product Type test fixture với cả product và variant attributes.

---

## Phase 3 — Brand vertical slice

### Endpoints

```text
GET    /api/admin/brands
POST   /api/admin/brands
GET    /api/admin/brands/{brand}
PUT    /api/admin/brands/{brand}
DELETE /api/admin/brands/{brand}
PUT    /api/admin/brands/{brand}/products
```

Nếu Brand URLs/attributes/media đang được dùng thực tế, bổ sung endpoint rõ ràng thay vì nhét toàn bộ vào một PUT không có semantics.

### Backend

- Dùng `Lunar\Models\Brand`, không dùng `App\Models\Brand`.
- Eager-load count/media cần cho list.
- Cache invalidation phải giữ observer behavior.
- Delete guard nếu có products; lựa chọn rõ reassign/null/detach.

### React

- Brand list/search/pagination.
- Brand form.
- Logo/media.
- Product count và product assignment nếu scope cần parity.

### Tests

- Khẳng định table/model Lunar được ghi.
- Public `/api/brands` phản ánh thay đổi sau cache invalidation.
- Không ghi App Brand table.
- Delete guard và media behavior.

### Cutover

- Sau khi đạt parity, ẩn Lunar Brand navigation với role thử nghiệm hoặc feature flag.
- Giữ route Filament fallback cho super admin trong một chu kỳ ổn định.

### Exit criteria

- CRUD Brand trên React thay đổi storefront đúng.
- Không có thao tác React nào chạm legacy Brand.

---

## Phase 4 — Collection Group + Collection

### Endpoints

```text
GET    /api/admin/collection-groups
POST   /api/admin/collection-groups
GET    /api/admin/collection-groups/{group}
PUT    /api/admin/collection-groups/{group}
DELETE /api/admin/collection-groups/{group}

GET    /api/admin/collections
POST   /api/admin/collections
GET    /api/admin/collections/{collection}
PUT    /api/admin/collections/{collection}
DELETE /api/admin/collections/{collection}
PUT    /api/admin/collections/{collection}/parent
POST   /api/admin/collections/reorder
PUT    /api/admin/collections/{collection}/products
PUT    /api/admin/collections/{collection}/availability
```

### Backend

- URL/slug là Lunar URL relation theo language/default semantics.
- Kiểm tra cycle khi move collection.
- Tree reorder/move chạy transaction.
- Delete guard cho children/products/URLs hoặc có explicit reparent strategy.
- Availability theo Channel/Customer Group nếu model hỗ trợ trong flow hiện tại.

### React

- Collection Group list/form.
- Tree view cho Collections.
- Create child, move, reorder.
- Edit localized fields, slug/URL, media, products và availability.
- Không load toàn bộ product graph cho tree list.

### Tests

- Không tạo cycle.
- Move/reorder rollback.
- Slug uniqueness/language behavior.
- Storefront category filter vẫn hoạt động.
- Delete guard children/products.

### Exit criteria

- React đạt parity với collection operations đang được sử dụng trong Filament.
- Public product category/filter regression xanh.

---

## Phase 5 — Product read API và React list

Tách Product thành nhiều sub-phase; không build một lần toàn bộ form.

### 5A. Product list endpoint

```text
GET /api/admin/products
```

List DTO tối thiểu:

- id, translated name;
- status;
- Product Type;
- Brand;
- primary Collection;
- primary image;
- variant count;
- aggregate stock;
- display price theo explicit default context;
- updated_at/version.

### Filters

- status;
- product type;
- brand;
- collection;
- stock state;
- missing price/media/availability;
- search.

### Rules

- Query profile riêng cho list.
- Không serialize toàn bộ `attribute_data`, variants và gallery vào list.
- Có query-count/performance test.

### React

- Product list, pagination/filter/sort.
- Health badges: missing price, missing image, unavailable channel, no variant.
- Link edit nhưng chưa bật mutation cho đến Phase 6.

### Exit criteria

- List phản ánh cùng tập Product với Filament.
- Query count ổn định theo page size.

---

## Phase 6 — Product core editor

### 6A. Create Product shell

```text
POST /api/admin/products
GET  /api/admin/products/{product}
PUT  /api/admin/products/{product}/core
```

Core gồm:

- Product Type;
- status;
- Brand;
- localized Product attributes;
- Collections;
- URLs/slugs;
- version token.

### Backend actions

```text
CreateProductAction
UpdateProductCoreAction
SyncProductAttributesAction
SyncProductCollectionsAction
SyncProductUrlsAction
```

### Attribute update semantics

- Validate handle theo Product Type schema.
- Merge locale, không replace toàn bộ locale map.
- Không nhận raw PHP FieldType payload.
- Reject/ignore unknown handles theo contract đã chọn.

### React

- Product Type picker trước khi render dynamic attributes.
- Locale tabs.
- Core information, Brand, Collections và SEO URL sections.
- Cảnh báo khi đổi Product Type làm attributes hiện tại không còn mapped.

### Tests

- Localized round-trip.
- Partial locale update không mất locale khác.
- Product Type change conflict/migration rule.
- Transaction rollback.
- Public API đọc tên/description đúng sau update.

### Exit criteria

- Tạo draft Product shell hợp lệ với ít nhất một variant placeholder strategy đã định nghĩa.
- Sửa core không ảnh hưởng prices/media/variants ngoài ý muốn.

---

## Phase 7 — Variant, option và inventory editor

### Endpoints

```text
PUT    /api/admin/products/{product}/options
POST   /api/admin/products/{product}/variants/preview
PUT    /api/admin/products/{product}/variants
PUT    /api/admin/variants/{variant}/inventory
PUT    /api/admin/variants/{variant}/attributes
DELETE /api/admin/variants/{variant}
```

### Thiết kế bắt buộc

- Preview matrix trước khi apply.
- Diff bằng stable ID + option-value combination.
- Preserve variant hiện hữu nếu combination không đổi.
- Explicit list: create/update/archive/delete.
- Không hard-delete variant đã được order/cart/reference nếu policy không cho phép.
- SKU uniqueness và conflict report.

### Inventory

- Stock/backorder/shippable.
- Weight/dimensions/unit.
- Không gộp price vào inventory payload.

### React

- Option builder.
- Matrix preview.
- Bulk edit SKU/stock/physical fields.
- Per-variant attributes dựa trên Product Type variant schema.
- Warning cho destructive matrix changes.

### Tests

- Preserve ID/SKU/stock cho unchanged combination.
- Add/remove option values.
- Duplicate SKU rejection.
- Referenced variant delete guard.
- Variant attribute locale/type validation.

### Exit criteria

- Có thể quản trị single-variant và multi-variant Product.
- Cart add line vẫn resolve đúng variant sau mọi non-destructive edit.

---

## Phase 8 — Pricing

### Endpoints

```text
GET /api/admin/variants/{variant}/prices
PUT /api/admin/variants/{variant}/prices
```

### Price DTO

```json
{
  "currency_id": 1,
  "customer_group_id": null,
  "min_quantity": 1,
  "price": "129.99",
  "compare_price": "159.99"
}
```

Backend convert decimal string sang minor integer theo `decimal_places` của Currency.

### Rules

Identity:

```text
priceable_type + priceable_id + currency_id + customer_group_id + min_quantity
```

- Không lấy/update “first price”.
- Validate tier quantity uniqueness/order.
- Compare price semantics rõ ràng.
- Morph class lấy từ model runtime.
- Transaction cho replace/diff price matrix.

### React

- Price grid theo variant/currency/customer group/tier.
- Default context nổi bật.
- Bulk apply có preview.

### Tests

- Minor-unit conversion.
- Multi-currency/customer-group/tier identity.
- Morph type đúng.
- Checkout dùng đúng default/customer context.
- Rollback khi một row invalid.

### Exit criteria

- Product mới có thể bán với price context mặc định.
- Existing multi-context prices không bị mất khi sửa một context.

---

## Phase 9 — Availability và media

### Availability endpoints

```text
GET /api/admin/products/{product}/availability
PUT /api/admin/products/{product}/availability
```

### Media endpoints

Tái sử dụng media API hiện có nếu đáp ứng được Lunar/Spatie media attachment. Nếu không, thêm endpoint product-scoped:

```text
POST   /api/admin/products/{product}/media
PUT    /api/admin/products/{product}/media/reorder
PUT    /api/admin/products/{product}/media/{media}/primary
DELETE /api/admin/products/{product}/media/{media}
```

Variant media phải có scope riêng nếu đang dùng.

### Rules

- `published` và `available` là hai khái niệm riêng.
- Availability pivot update trong transaction.
- Media update không xoá item không xuất hiện nếu endpoint là partial update.
- Chỉ một primary image theo convention.

### Tests

- Published nhưng unavailable được report đúng.
- Channel/customer group date window.
- Primary image uniqueness.
- Gallery reorder.
- Public image fallback/conversion.

### Exit criteria

- Product React editor có thể tạo Product bán được end-to-end.
- Storefront hiển thị đúng ảnh, availability và variant.

---

## Phase 10 — Catalogue cutover

### Rollout

1. Bật React Catalogue cho super admin nội bộ.
2. Chạy dual-read comparison giữa React detail DTO và Lunar/Filament record.
3. Cho phép write React với audit logging.
4. Monitor cache, public Product API, cart và checkout.
5. Ẩn từng navigation Filament sau khi module đạt parity.
6. Giữ emergency fallback route trong thời gian ổn định đã định trước.

### Metrics/alerts

- Product không variant.
- Variant không default price.
- Product published nhưng không availability.
- Product không URL/default URL.
- Duplicate SKU/slug.
- API 422/409/500 rates.
- Checkout price mismatch.

### Exit criteria

- Tất cả năm module dùng React trong vận hành thường ngày.
- Filament Catalogue không còn cần cho routine operations.
- Không có regression thương mại trong thời gian quan sát.

---

## Phase 11 — Legacy cleanup, release riêng

### 11A. Extract shared runtime responsibilities

- Chuyển `normalizePublicImageUrl()` sang support/service trung lập.
- Sửa ProductResource, OrderResource và email callers.
- Test URL normalization và image fallbacks.

### 11B. Disable legacy writes

- Bỏ/ẩn custom App Brand/Category/Product resources.
- Bỏ legacy Product observer nếu đã đóng write path.
- Sửa default seeder không tạo legacy catalogue.
- Archive legacy sync tests hoặc đổi thành migration verification tests.

### 11C. Data proof

- Report mapping coverage.
- Backup tables.
- Export orphan rows.
- Xác nhận không còn runtime query/caller.

### 11D. Remove code

Candidates sau khi đạt proof:

- `App\Models\Brand`;
- `App\Models\Category` nếu không còn dùng cho content khác;
- `App\Models\Legacy\Product`;
- `ProductSyncService` sync/archive logic;
- `LegacyProductObserver`;
- `ProductSyncMapping`;
- legacy resources/policies/controllers/seeders/tests.

### 11E. Database cleanup

- Migration archive/drop table riêng.
- Không sửa migration lịch sử đã chạy; tạo migration mới.
- Rollback/restore procedure được thử trước production.

### Exit criteria

- Static search và runtime telemetry không còn legacy dependency.
- Full regression suite xanh.
- Backup và rollback thử thành công.
- Sau cleanup, storefront/cart/checkout/admin chỉ dùng Lunar Catalogue.

---

## Work package template cho mỗi module

Mỗi module phải có:

1. API contract document.
2. Form Requests và policy/authorization.
3. Application action/service và transaction.
4. API Resource/DTO mapper.
5. Explicit routes cho `/api` và alias `/api/v1` không có route-name collision.
6. React API hooks/types.
7. List và form UI.
8. Feature tests backend.
9. React unit/component/API tests.
10. Public regression test nếu module ảnh hưởng storefront.
11. Cutover flag/navigation change.
12. Rollback steps.

---

## Risk register

| Risk | Impact | Mitigation | Verification |
|---|---|---|---|
| Mất locale khi update | Cao | Locale merge DTO, không full replace | Round-trip tests `en`/`vi` |
| Sai price context | Critical | Full price identity + minor units | Checkout/pricing integration tests |
| Variant ID bị thay | Critical | Stable-ID diff, delete guard | Cart/order reference tests |
| Product published nhưng không bán được | Cao | Availability section + health checks | Public availability tests |
| N+1 Product list/detail | Trung bình/Cao | Query profiles + eager loading | Query-count tests |
| JSON LIKE chậm/sai taxonomy | Trung bình | Quan hệ/projection/index | Explain/query performance + filter tests |
| Cache storefront stale | Cao | Eloquent actions/events/observer audit | Mutation-to-public API tests |
| Duplicate Filament resources gây nhầm | Trung bình | Explicit cutover/registration audit | Route/navigation snapshot |
| Cleanup legacy xoá nhầm runtime helper | Cao | Extract first, dependency proof | Static search + email/resource tests |
| Hai admin ghi đè | Trung bình/Cao | Version token + `409` | Concurrent update test |

---

## Definition of Done tổng thể

- Lunar là Catalogue source of truth duy nhất cho write path mới.
- Attribute System, Product Type, Brand, Collection và Product có React UI production-ready.
- Product editor xử lý đúng locale, variant, price, availability, URL và media.
- Public storefront contract ổn định.
- Cart/checkout/order regression xanh.
- Filament có thể tắt khỏi routine Catalogue operations.
- Legacy cleanup được thực hiện ở release riêng với data proof và rollback.
