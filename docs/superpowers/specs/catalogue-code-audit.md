# Catalogue Code Audit — PetPosture

Audit date: 2026-08-23

## Phạm vi

Đối chiếu các nhận định trong prompt Catalogue với source code hiện tại. Đây là static code audit; chưa xác minh được record count trong database runtime vì lệnh Tinker bị chặn khi PsySH cố ghi history ngoài workspace.

GitNexus index đã được refresh thành công: 12,434 symbols, 25,565 relationships, 300 execution flows.

---

## Bảng kết quả

| Nhận định | Kết quả | Bằng chứng / điều chỉnh |
|---|---|---|
| Storefront Product đọc Lunar models/tables | **Đúng** | `ProductController` dùng `Lunar\Models\Product`, `ProductVariant`, `Price`, `Brand`; eager-load variant price/value/media, URL, collection và brand. |
| Public Brand API đọc Brand Lunar | **Đúng** | `Api\BrandController` dùng `Lunar\Models\Brand` và Product Lunar. |
| Cart/Checkout dùng ProductVariant Lunar | **Đúng** | `CartService`, `CheckoutService`, inventory/order observers đều import `Lunar\Models\ProductVariant`. |
| Có bộ App Brand/Category/Legacy Product song song | **Đúng** | Các model và migration/table vẫn tồn tại. |
| `syncFromLegacy()` không còn caller production | **Đúng trong phạm vi static search** | Caller trực tiếp chỉ có trong `ProductCatalogApiTest`; không thấy controller/job/command production gọi method này. |
| Toàn bộ `ProductSyncService` đã chết | **Sai** | `normalizePublicImageUrl()` còn dùng trong Product/Order resources và nhiều email; `archiveSyncedProduct()` còn được `LegacyProductObserver` gọi. |
| Legacy Product observer không còn hoạt động | **Sai** | `AppServiceProvider::boot()` vẫn đăng ký `LegacyProductObserver`; deleting event gọi `archiveSyncedProduct()`. |
| App Brand Filament đang trỏ model legacy | **Đúng** | `App\Filament\Resources\BrandResource::$model = App\Models\Brand`. |
| Trang `/admin/brands` hiện trỏ App Brand legacy | **Sai với route hiện tại** | `php artisan route:list --path=admin/brands` resolve toàn bộ route sang `Lunar\Admin` Brand resource. `AdminPanelProvider` đăng ký explicit Lunar `Resources\BrandResource`. Custom App resource vẫn tồn tại và gây ambiguity, nhưng không phải handler của route hiện tại. |
| Lunar Brand thật không có UI | **Sai** | Vendor Lunar có full Brand resource; routes list/create/edit/media/urls/products/collections đều đang đăng ký tại `/admin/brands`. |
| Product Type chưa có UI Filament | **Sai** | Vendor Lunar có `ProductTypeResource`, được `AdminPanelProvider` đăng ký explicit; routes `/admin/product-types`, create và edit đang hoạt động. UI map product và variant attributes. |
| Migration bảo đảm một Product Type mặc định | **Đúng** | Migration tạo `General` nếu `ProductType::count() === 0`. |
| Runtime chỉ có đúng một Product Type | **Chưa xác minh** | Code chỉ bảo đảm ít nhất một record khi trống; không ngăn tạo thêm. Cần query DB môi trường đích. |
| ProductType quyết định product/variant attributes | **Đúng** | `ProductType::productAttributes()` và `variantAttributes()` lọc mapped polymorphic attributes theo Product/ProductVariant morph name. |
| Attribute Group/Attribute dùng model Lunar | **Đúng** | App override kế thừa Lunar AttributeGroup resource; migrations kỹ thuật tạo `Lunar\Models\Attribute`/`AttributeGroup`. |
| `attribute_data` query MySQL phải dùng `AS CHAR` | **Đúng với code/database hiện tại** | ProductController dùng `LOWER(CAST(attribute_data AS CHAR)) LIKE ?`. |
| Collection UI đang hoạt động | **Đúng** | Route `/admin/collections` cùng edit/media/urls/products/availability/children resolve sang Lunar Admin. App có override CollectionGroup resource. |
| Admin REST routes đăng ký tường minh | **Đúng** | `routes/api.php` dùng `Route::get/post/put/patch/delete`. |
| API file được mount hai lần `/api` + `/api/v1` | **Đúng** | `bootstrap/app.php` dùng normal `api:` registration và đăng ký lại file với prefix `api/v1`. |
| React dùng fetch client chung | **Đúng** | `admin/src/lib/api.ts` export `fetchApi` và `fetchJson`; các feature API dùng hai helper này. |
| Legacy seed path đã chết | **Sai** | `DatabaseSeeder` vẫn tạo App Category và Legacy Product. |

---

## Phát hiện quan trọng

### 1. “Brand/ProductType không có UI” là lỗi audit ban đầu

`AdminPanelProvider` explicit đăng ký:

- Lunar Brand resource;
- Lunar Product Type resource;
- Lunar Collection resource.

Các route thực tế đã được kiểm tra bằng Artisan và đang tồn tại. Vì vậy lý do migration sang React nên là UX/ownership/consistency, không phải thiếu hoàn toàn UI.

### 2. Custom App Brand resource là code gây nhầm lẫn, nhưng chưa chứng minh là UI đang được dùng

App discovery quét `App\Filament\Resources`, đồng thời resource Lunar Brand được đăng ký explicit. Route cuối cùng hiện resolve sang Lunar Admin. Custom App Brand resource vẫn nên được đánh dấu cleanup candidate vì:

- dùng cùng slug/resource concept;
- trỏ model legacy;
- làm audit và navigation khó hiểu;
- có nguy cơ đổi registration order ở lần nâng cấp sau.

Không nên xoá trước khi chạy impact/dependency audit và kiểm tra permission/navigation trong môi trường thật.

### 3. ProductSyncService phải được tách trách nhiệm trước khi xoá

Class hiện trộn:

- migration/sync legacy sang Lunar;
- archive Lunar khi legacy bị xoá;
- image URL normalization dùng ở runtime public/email.

Cleanup an toàn cần extract helper URL ảnh sang service/support class trung lập trước, sửa caller, thêm regression tests rồi mới xoá phần sync.

### 4. Legacy source vẫn được tạo bởi default seeder

`DatabaseSeeder` import và tạo `App\Models\Category` cùng `App\Models\Legacy\Product`. Điều này có thể tái tạo dữ liệu legacy ở dev/test/staging ngay cả khi production admin đã chuyển sang Lunar.

### 5. `attribute_data` đang bị dùng như taxonomy/search index

Breed tags, solution tags, badge và free-text search đều dùng `LIKE` trên serialized JSON. Ngoài ra project đã có quan hệ Product–Breed và Product–Solution riêng. Cần quyết định source of truth dài hạn cho taxonomy để tránh hai representation lệch nhau.

### 6. Giá storefront hiện lấy “price đầu tiên” trong resource

`ProductResource` lấy price từ default variant rồi `sortBy('min_quantity')->first()`. Catalogue admin mới không được giả định chỉ có một currency/customer group; cần contract explicit để chọn đúng price context.

---

## Các điểm chưa xác minh

1. Số Product Type trong database production/staging.
2. Record count và mức độ đồng bộ giữa legacy/Lunar tables.
3. Có scheduler/job ngoài repository gọi sync qua reflection/container hay không.
4. Permission thực tế khiến Lunar Brand/ProductType navigation có hiển thị với role admin/staff hay không.
5. App Brand resource có bị duplicate navigation trong một số cache/build môi trường không.
6. Dữ liệu `attribute_data` thực tế có đầy đủ locale `en`/`vi` hay chỉ default locale.
7. Có order/cart/reference nào phụ thuộc variant ID sẽ bị sửa trong Product editor mới.

---

## Query kiểm chứng runtime đề xuất

Chạy trong môi trường có quyền DB:

```php
[
    'product_types' => Lunar\Models\ProductType::count(),
    'lunar_brands' => Lunar\Models\Brand::count(),
    'legacy_brands' => App\Models\Brand::count(),
    'lunar_products' => Lunar\Models\Product::count(),
    'legacy_products' => App\Models\Legacy\Product::count(),
    'sync_mappings' => App\Models\ProductSyncMapping::count(),
    'collection_groups' => Lunar\Models\CollectionGroup::count(),
    'attribute_groups' => Lunar\Models\AttributeGroup::count(),
];
```

Sau đó cần report:

- legacy product không có mapping;
- mapping trỏ Lunar product không tồn tại;
- Lunar product mang `legacy_product_id` nhưng mapping thiếu;
- trùng slug trong Lunar URLs;
- Product không có variant/price/channel/customer group availability;
- variant price thiếu default currency/customer group context.

---

## Kết luận audit

Kiến trúc mục tiêu “React admin ghi trực tiếp Lunar” là đúng. Tuy nhiên cleanup không thể dựa trên nhãn “dead model/service” hiện tại. Cần chuyển mô tả thành:

> Legacy catalogue là hệ deprecated, một phần không còn caller ghi chính, nhưng vẫn còn observer, seeder, mapping và helper runtime. Lunar là source of truth; cleanup chỉ thực hiện sau cutover và dependency proof.
