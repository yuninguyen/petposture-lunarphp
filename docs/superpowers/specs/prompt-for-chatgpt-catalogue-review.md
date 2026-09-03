# Prompt để hỏi ChatGPT — Catalogue Architecture Review

> Copy toàn bộ nội dung từ phần “Vai trò” trở xuống và dán cho ChatGPT.

---

## Vai trò

Bạn là một kiến trúc sư Laravel/LunarPHP có kinh nghiệm xây admin headless cho catalogue thương mại điện tử. Hãy review như một technical design reviewer: phản biện thẳng, chỉ ra giả định sai, ưu tiên bảo toàn dữ liệu và invariant của Lunar hơn tốc độ làm UI.

Không trả lời chung chung. Với mỗi khuyến nghị, hãy nêu:

- quyết định đề xuất;
- lý do và trade-off;
- rủi ro chính;
- cách kiểm chứng;
- tiêu chí hoàn thành.

## Bối cảnh dự án

Tôi có dự án Laravel backend + React/Vite admin app mới + Next.js storefront cho site thương mại điện tử PetPosture. Backend dùng **LunarPHP v1.3.0** (`lunarphp/lunar`, `lunarphp/core`) cho Catalogue, Cart, Checkout và Pricing.

Admin panel đang được **di dời dần từ Filament sang React/Vite**, giao tiếp qua REST API riêng dưới `/api/admin/*`. Các khu vực đã di dời gồm Pages, Breeds, Solutions, Posts, Blog Categories/Tags và Comments. Catalogue vẫn chủ yếu được quản trị bằng Lunar/Filament.

Mục tiêu là chuyển quyền quản trị Catalogue sang React theo từng giai đoạn, nhưng **Lunar tiếp tục là source of truth**. Tôi không muốn tạo thêm một bộ model Catalogue song song.

## Hiện trạng kỹ thuật đã audit từ code

### Source of truth đang hoạt động

Storefront, cart và checkout sử dụng các model/bảng Lunar, gồm:

- `Lunar\Models\Product`;
- `Lunar\Models\ProductVariant`;
- `Lunar\Models\Brand`;
- `Lunar\Models\Collection`;
- `Lunar\Models\CollectionGroup`;
- `Lunar\Models\Attribute`;
- `Lunar\Models\AttributeGroup`;
- `Lunar\Models\ProductType`;
- cùng Price, Product Option/Option Value, Channel, Customer Group, Currency, Tax Class, URL và media liên quan.

Public Product API eager-load variants/prices/options/images/URLs/collections/brand và đọc trực tiếp Lunar Product. Public Brand API đọc trực tiếp `Lunar\Models\Brand`.

### UI Filament hiện tại

Lunar Brand thật **đã có UI Filament đang đăng ký**, gồm list/create/edit/media/URLs/products/collections tại `/admin/brands`.

Lunar Product Type thật **đã có UI Filament đang đăng ký** tại `/admin/product-types`; UI này map riêng product attributes và variant attributes.

Lunar Collection cũng có UI Filament hoạt động tại `/admin/collections`.

Trong `App\Filament\Resources` vẫn có custom `BrandResource` trỏ vào `App\Models\Brand`, nhưng route list hiện tại của `/admin/brands` resolve tới resource Lunar. Đây vẫn là nguồn gây nhầm lẫn và cần được audit/loại bỏ về sau, nhưng không nên mô tả là Lunar Brand hoàn toàn không có UI.

Product Type mặc định `General` được tạo nếu chưa có Product Type. Cần kiểm tra dữ liệu runtime trước khi kết luận production chỉ có đúng một Product Type.

### Legacy catalogue còn tồn tại

Code vẫn còn:

- `App\Models\Brand`;
- `App\Models\Category`;
- `App\Models\Legacy\Product`;
- `App\Models\ProductSyncMapping`;
- `ProductSyncService`;
- `LegacyProductObserver`;
- custom Filament resources/policies/seeders liên quan.

`syncFromLegacy()` hiện chỉ thấy được gọi trực tiếp trong test, nhưng không thể gọi toàn bộ service là “dead” vì:

- `ProductSyncService::normalizePublicImageUrl()` còn được Product/Order API resources và email templates sử dụng;
- `LegacyProductObserver` vẫn được đăng ký và gọi `archiveSyncedProduct()` khi xoá legacy product;
- `DatabaseSeeder` vẫn tạo Category và Legacy Product;
- mapping model/table vẫn còn.

Vì vậy legacy hiện là **partially orphaned/deprecated**, chưa đủ bằng chứng để xoá thẳng.

### `attribute_data`

Product/Variant lưu attribute values trong `attribute_data` theo cơ chế FieldType/translation của Lunar. Query MySQL hiện tại dùng:

```sql
CAST(attribute_data AS CHAR)
```

Không dùng `AS TEXT`, vì đó không phải cú pháp tương đương trên MySQL.

Tuy nhiên raw `LIKE` trên toàn JSON chỉ nên xem là giải pháp hiện tại, không mặc định là kiến trúc search/filter dài hạn.

### Convention API/admin hiện tại

- Mỗi admin resource thường có Laravel Controller riêng dưới `App\Http\Controllers\Api\Admin\*`.
- Routes được đăng ký tường minh bằng `Route::get/post/put/patch/delete`.
- Không dùng route name hoặc `Route::apiResource()` một cách thiếu kiểm soát vì `routes/api.php` được mount ở cả `/api` và `/api/v1`.
- React dùng fetch client chung `fetchApi`/`fetchJson`.
- Admin routes được bảo vệ bằng Sanctum và role middleware.

## Phạm vi cần build

Tôi cần chuyển năm khu vực sau sang API + React:

1. Attribute Group + Attribute;
2. Product Type;
3. Product + Product Variant + Option/Option Value + Price + Media + Availability;
4. Brand;
5. Collection Group + Collection.

Ngoài CRUD, Product editor phải xử lý đúng:

- localized attributes;
- product/variant attribute mapping theo Product Type;
- variants và option combinations;
- SKU, stock, shippable/backorder, dimensions/weight;
- prices theo currency/customer group/min quantity;
- channel/customer-group availability;
- URL/slug theo language;
- media gallery và primary image;
- Brand và Collection relationships.

## Constraints

- Lunar vẫn là source of truth; không tạo model Catalogue song song.
- Migration phải theo từng vertical slice, có thể rollback và chạy song song với Filament trong giai đoạn chuyển tiếp.
- Không làm thay đổi contract public storefront nếu không thật sự cần.
- Không làm mất bản dịch của locale không xuất hiện trong payload update.
- Không delete/recreate variants mù quáng nếu có nguy cơ phá ID/SKU/stock/price/order reference.
- Giá phải giữ minor-unit semantics và identity theo priceable morph, currency, customer group và minimum quantity.
- Mọi thay đổi aggregate nhiều bảng phải có transaction boundary rõ ràng.
- Cần delete guard/reassign strategy cho resource đang được tham chiếu.

## Các câu hỏi cần review

### 1. Sequencing

Hãy đề xuất thứ tự build hợp lý cho năm khu vực dựa trên data dependency, độ phức tạp và rủi ro production.

- Có nên để Product cuối cùng không?
- Brand hay Collection nên là vertical slice CRUD đầu tiên sau Attribute/Product Type?
- Có cần một phase nền tảng chung trước năm module không?

Hãy trả về bảng:

| Phase | Module | Dependency | Rủi ro | Deliverable | Exit criteria |
|---|---|---|---|---|---|

### 2. API boundary cho Attribute System

Attribute Group, Attribute và Product Type nên:

- gộp chung ở mức bounded context/UI;
- tách thành REST resource/controller riêng;
- hay có một aggregate write API duy nhất?

Hãy đề xuất route cụ thể, transaction boundary và một endpoint editor schema nếu cần. Phân biệt rõ **UI grouping** với **REST resource boundary**.

### 3. DTO cho localized `attribute_data`

Có nên expose raw serialization của Lunar, flatten theo locale hiện tại, hay dùng DTO locale-aware độc lập với FieldType nội bộ?

Hãy cung cấp:

- JSON response mẫu;
- JSON update request mẫu;
- quy tắc merge locale;
- validation dựa trên Attribute definition;
- cách hydrate/dehydrate FieldType ở backend;
- chiến lược search/filter không phụ thuộc lâu dài vào `CAST(... AS CHAR) LIKE`.

### 4. Legacy cleanup

Nên cleanup legacy trong cùng release hay một release riêng?

Hãy phân loại các phần sau thành `remove now`, `deprecate/disable`, `extract first`, `keep temporarily`:

- App Brand/Category/Legacy Product models;
- custom Filament resources và policies;
- `ProductSyncService::syncFromLegacy()`;
- `normalizePublicImageUrl()`;
- `LegacyProductObserver`;
- `ProductSyncMapping`;
- legacy migrations/tables;
- seeders/tests.

Hãy đưa ra checklist chứng minh an toàn trước khi xoá và rollback plan.

### 5. Pattern/cạm bẫy Lunar

Hãy nêu pattern cụ thể để tránh:

- controller ghi rải rác nhiều Lunar model;
- N+1 ở Product list/detail;
- ghi sai price/customer group/currency/min quantity;
- mất availability dù Product là `published`;
- phá variant identity khi thay option matrix;
- mất locale khi partial update;
- xoá Attribute/Product Type/Brand/Collection đang được tham chiếu;
- media primary/gallery không đồng bộ;
- slug/URL/language sai semantics;
- cache không invalidated vì bulk SQL bỏ qua observer;
- lost update khi hai admin cùng sửa Product.

## Đầu ra mong muốn

Hãy trả lời theo cấu trúc:

1. **Executive decision** — các quyết định chính và điểm bạn phản đối.
2. **Sequencing table**.
3. **API proposal** — routes, DTO và transaction boundaries.
4. **Product aggregate design**.
5. **Legacy cleanup decision matrix**.
6. **Risk register** — likelihood, impact, mitigation và test.
7. **Rollout plan** — chạy song song Filament/React, cutover và rollback.
8. **Test strategy** — unit, feature, integration, contract và regression.
9. **Definition of Done** cho từng phase.
10. **Các câu hỏi còn thiếu dữ liệu** cần xác minh trước khi code.

Hãy phản biện thẳng nếu phạm vi, thứ tự hoặc giả định của tôi chưa hợp lý. Đừng mặc định mọi nhận định trong prompt đều đúng nếu chúng mâu thuẫn nhau.
