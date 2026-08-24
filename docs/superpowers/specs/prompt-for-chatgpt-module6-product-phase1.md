# Module 6 — Product Phase 1: migrate Product create/edit sang admin React

Role continuity: bạn (ChatGPT) implement/debug/tự test; Claude chỉ thảo luận
kiến trúc/phản biện + verify độc lập bằng cách đọc code thật + final check
trước khi commit — không tự tin vào báo cáo self-test, luôn chạy lại
`tsc --noEmit`, build, và (nếu có) test thật.

## Bối cảnh đã xác nhận

- User xác nhận scope: **migrate toàn bộ Product create/edit sang admin React
  mới** (`admin/`, Vite/React, port 5173), không phải sửa tiếp UI Filament cũ.
  File spec cũ `prompt-for-chatgpt-product-page-ux.md` (viết cho Filament tab
  reorg) **bị supersede hoàn toàn**, bỏ qua không đọc/không làm theo.
- Style: **Shopify-style single-scroll-page với Cards**, layout 2 cột (nội
  dung chính bên trái, sidebar phải — status/type/brand/save). Không làm theo
  kiểu WordPress/WooCommerce nhiều tab ngang như Filament cũ.
- Lý do chọn Shopify-style (evidence từ chính codebase này, không phải ý kiến
  chung chung):
  1. `backend/app/Filament/Resources/ProductResource.php` (Filament cũ) đang
     dùng `getDefaultSubNavigation()` (vendor) với **11 tab** — đúng pattern
     WooCommerce hay bị chê rời rạc, khó nhìn tổng quan 1 sản phẩm.
  2. `admin/src/features/breeds/BreedFormPage.tsx` đã là tiền lệ single-page
     nhiều Card trong chính `admin/` — đã được chấp nhận, dùng lại được
     pattern/component sẵn có (React Hook Form, `MediaPicker`,
     `SearchableMultiSelect`, Tiptap).
  3. Chính vendor Lunar cũng tự thu gọn: khi product chỉ có **1 variant**, 4
     trang con `ManageProductPricing/Identifiers/Inventory/Shipping` chỉ là
     proxy field thẳng vào variant duy nhất đó (`getVariant()` =
     `$record->variants()->withTrashed()->first()`) — ngầm xác nhận nhiều
     field vốn thuộc về 1 "sản phẩm" khi không có option, hợp lý để gộp vào 1
     trang.
- Phase split đã được user xác nhận qua 2 câu trả lời:
  - "Tôi biết hiện catalog thật có sản phẩm multi-variant" → Phase 1 **không
    được giả định single-variant-only**, phải xử lý được cả sản phẩm nhiều
    variant.
  - "Chủ yếu sửa variant có sẵn" → Phase 1 tập trung **sửa field của variant
    đã tồn tại** (sku/giá/tồn kho/kích thước...), **không** làm UI tạo mới
    Option/Value hay sinh ma trận variant mới. Việc đó dồn sang Phase 2.

## Vì sao Product khác hẳn Module 5 (Collection)

Collection (Module 5) map gần 1-1 vào 1 bảng + 1 Filament resource đơn giản.
Product phức tạp hơn nhiều bậc, và **quan trọng nhất: admin React hiện chưa
có bất kỳ API/route/controller/resource nào cho Product** — phải xây từ đầu,
không phải "port" như Collection. Đã grep xác nhận:
`backend/routes/api.php` nhóm `/admin` **không có** route `/products` nào,
`backend/app/Http/Controllers/Admin/` **không có** `ProductController`,
`admin/src/features/` **không có** thư mục `products`.

### Data model thật (đọc trực tiếp từ vendor, không suy đoán)

- `Product` (`vendor/lunarphp/core/src/Models/Product.php`): `id, brand_id,
  product_type_id, status (draft/published), attribute_data (JSON, cast
  AsAttributeData), deleted_at`. Quan hệ quan trọng: `variants()` HasMany,
  `hasVariants` = `variants()->count() > 1` (accessor), `collections()`
  BelongsToMany (pivot `position`), `productType()` BelongsTo,
  `mappedAttributes()` = `$this->productType->mappedAttributes`.
- `ProductVariant` (`.../ProductVariant.php`): `id, product_id, tax_class_id,
  attribute_data (JSON), tax_ref, unit_quantity, min_quantity,
  quantity_increment, sku (unique), gtin, mpn, ean, length_value/unit,
  width_value/unit, height_value/unit, weight_value/unit, volume_value/unit
  (tính từ 3 chiều, không nhập tay), shippable (bool), stock, backorder,
  purchasable (enum: always/in_stock/in_stock_or_on_backorder),
  deleted_at`. `values()` BelongsToMany `ProductOptionValue` (bảng
  `product_option_value_product_variant`). `prices()` qua trait `HasPrices`.
- `ProductOption`/`ProductOptionValue`: định nghĩa Option (vd "Size") và các
  Value (vd "S"/"M"/"L"), multilingual `name` (`AsArrayObject`). Đây là cơ
  chế sinh biến thể — **Phase 1 không đụng vào 2 bảng này**.
- `Price` (`.../Price.php`): `priceable` (morph, ở đây luôn là
  `ProductVariant`), `currency_id`, `customer_group_id` (nullable),
  `min_quantity`, `price` (int, cast `Lunar\Base\Casts\Price` — đơn vị nhỏ
  nhất của tiền tệ, vd cent), `compare_price` (cùng cast).
- `ProductType` (`.../ProductType.php`): `mappedAttributes()` (MorphToMany
  Attribute qua bảng `attributables`), tách ra `productAttributes()` (where
  `attribute_type = Product::morphName()`) và `variantAttributes()` (where
  `attribute_type = ProductVariant::morphName()`) — đây chính là danh sách
  field động (cả field hệ thống như "name" lẫn custom field) cần render cho
  1 Product/Variant theo đúng Product Type của nó.

### Cơ chế tạo Product mặc định (đọc từ `ListProducts.php`, vendor)

Filament cũ tạo Product mới qua 1 form ngắn (name, product_type, sku,
base_price) rồi redirect sang trang Edit đầy đủ — **không có trang Create
riêng biệt** (`ProductResource/Pages/` không có `CreateProduct.php`).
`ListProducts::createRecord()`:

```php
$nameAttribute = Attribute::whereAttributeType($model::morphName())
    ->whereHandle('name')->first()->type;   // gọi thẳng ->type, KHÔNG null-safe

$product = $model::create([
    'status' => 'draft',
    'product_type_id' => $data['product_type_id'],
    'attribute_data' => ['name' => new $nameAttribute($data['name'])],
]);
$variant = $product->variants()->create([
    'tax_class_id' => TaxClass::getDefault()->id,
    'sku' => $data['sku'],
]);
$variant->prices()->create([
    'min_quantity' => 1,
    'currency_id' => Currency::getDefault()->id,
    'price' => (int) bcmul($data['base_price'], $currency->factor),
]);
```

Vì dòng `->whereHandle('name')->first()->type` gọi thẳng không null-safe, và
production đã tạo Product thành công nhiều lần (2 ProductType + nhiều
Product thật, theo xác nhận trước đó của user), **chắc chắn production đã có
sẵn 1 bản ghi `Attribute` với `attribute_type=product, handle=name`** — chỉ
còn chưa biết `type` của nó là `Lunar\FieldTypes\Text` (input thường) hay
`Lunar\FieldTypes\TranslatedText` (bilingual `{en, vi}` giống hệt pattern
`name[en]/name[vi]` đã làm ở Module 5 Collection). DB local (`.env` hiện
trỏ dữ liệu khác, không phải bản sao production — đã tự kiểm chứng bằng
tinker: local có 1 ProductType, 0 Product, `Attribute` name/product trả về
NULL) **không dùng được để verify** cái này.

### ✅ Quyết định thiết kế — giải quyết luôn vấn đề Text-vs-TranslatedText

Thay vì chốt cứng 1 lựa chọn (như Module 5 phải hỏi lại user), Product cần
1 cơ chế **render field động theo đúng `Attribute.type`** — vì đây vốn là hạ
tầng Lunar đã thiết kế sẵn (`mappedAttributes`/`productAttributes`/
`variantAttributes`), và `CustomFieldService.php` (app) cũng chỉ tạo field
kiểu `Text::class`. Cụ thể:

- Backend, khi trả về Product (show endpoint), kèm theo danh sách attribute
  definition của `productType` (cả field hệ thống như `name` lẫn custom
  field): mỗi field có `handle, type (FQCN rút gọn: "text" | "translated_text"),
  section, system, required` + giá trị hiện tại lấy từ `product.attribute_data`
  theo `handle`.
- Frontend dựng 1 component render field động: nếu `type === 'translated_text'`
  → 2 input `field[en]`/`field[vi]` (tái dùng đúng pattern bilingual đã làm ở
  Module 5 Collection); nếu `type === 'text'` → 1 input thường.
- Áp dụng đồng nhất cho **cả field "name" lẫn mọi custom field** product-level
  và variant-level — không hardcode riêng cho "name".
- ChatGPT vẫn cần chạy 1 query thật lên production (qua kênh đang dùng để
  quản trị server) để xác nhận `type` thật của Attribute `name`/`product`
  trước khi coi Phase 1 là "done", nhưng **không cần chờ câu trả lời này mới
  bắt đầu code** — component động đã tự xử lý đúng cả 2 trường hợp.

## Vấn đề quan trọng nhất: Option-matrix bị khoá cứng vào variant editing ở vendor

Đọc `ProductResource/Widgets/ProductOptionsWidget.php` (vendor, 489 dòng) —
đây là cơ chế DUY NHẤT trong vendor để sửa sku/giá/tồn kho của variant hiện
có: nó quản lý `configuredOptions` (Option + Value) trong Livewire state,
dùng `MapVariantsToProductOptions::map()` để tính lại **toàn bộ ma trận
permutation** mỗi lần bấm lưu (`saveVariantsAction()`), rồi:

- Tạo mới `ProductVariant` cho permutation chưa tồn tại.
- Update `sku/stock/price` (chỉ 3 field này) cho variant đã khớp permutation.
- **Xoá (`delete`) bất kỳ `ProductVariant` nào không còn khớp permutation
  hiện tại** — kể cả khi user chỉ định sửa sku của 1 variant, nếu vô tình đổi
  cấu hình Option, các variant khác có thể bị xoá.

Widget này KHÔNG cho sửa gtin/mpn/ean/shipping/tax/backorder/purchasable —
những field đó chỉ sửa được qua `ProductVariantResource.php` (resource riêng
biệt, KHÔNG lồng trong Product, có route `edit` riêng, `shouldRegisterNavigation()
=> false`, chỉ vào được qua link từ Product).

**Ảnh hưởng tới scope Phase 1**: vì "sửa variant có sẵn" trong vendor bị gắn
chặt với cơ chế sinh lại toàn bộ ma trận Option (rủi ro xoá nhầm variant),
Module 6 Phase 1 **không tái sử dụng `ProductOptionsWidget`/
`MapVariantsToProductOptions`**. Thay vào đó:

- Backend viết 1 endpoint PATCH **trực tiếp trên 1 `ProductVariant` theo
  ID**, chỉ update field của đúng variant đó (sku/gtin/mpn/ean/stock/
  backorder/purchasable/tax_class_id/tax_ref/shippable/length·width·height·
  weight value+unit/base price) — **không tạo, không xoá variant, không
  đụng bảng `product_options`/`product_option_values`/bảng pivot của
  chúng**.
- Frontend hiển thị Option/Value hiện có của mỗi variant ở dạng **chỉ đọc**
  (vd badge "Size: M / Color: Red" lấy từ `variant.values` — chỉ để phân
  biệt các dòng trong bảng variant, không cho sửa/thêm/xoá Option ở Phase 1).
- Việc tạo Option mới, sinh ma trận variant mới, xoá variant → dồn hết sang
  Phase 2 (chưa code ở round này).

## ✅ Quyết định UI/scope Phase 1 (đã chốt, không cần hỏi lại)

1. **1 trang** `admin/src/features/products/ProductFormPage.tsx` dùng chung
   cho cả create và edit (giống `BreedFormPage.tsx`), layout 2 cột:
   - Cột trái (nội dung chính, các Card theo thứ tự):
     a. Card "Title & description" — field `name` (render động Text/
        TranslatedText theo Attribute type) + mọi field custom
        product-level khác của `productType.productAttributes()`.
     b. Card "Media" — tái dùng `MediaPicker`, gắn ảnh vào Product
        (`images()`/`media()` quan hệ Spatie).
     c. Card "Pricing" — CHỈ hiện khi sản phẩm **không có variant nào khác
        biệt về Option** (tức single-variant, `hasVariants === false`): base
        price (currency mặc định, `min_quantity=1`, `customer_group_id=
        null`), giống hệt cách vendor tự thu gọn field khi có 1 variant.
     d. Card "Variants" — CHỈ hiện khi `hasVariants === true`: bảng danh sách
        variant, mỗi dòng hiện SKU, tổ hợp Option/Value (chỉ đọc), giá, tồn
        kho, nút "Edit" mở panel/modal sửa đầy đủ field của variant đó (theo
        đúng field list của `ProductVariantResource.php` vendor: sku, gtin,
        mpn, ean, stock, backorder (select), purchasable (select), unit
        quantity, quantity increment, min quantity, tax class (select), tax
        ref, shippable (toggle), length/width/height/weight (value+unit) +
        custom field variant-level của `productType.variantAttributes()`.
     e. Card "Collections" — `SearchableMultiSelect` chọn nhiều Collection,
        map vào `collections()` (pivot `position`, giữ thứ tự chọn).
   - Cột phải (sidebar, sticky theo `feedback_admin_primary_action_header.md`
     — nút Save lặp lại gần đầu trang):
     a. Nút Save/Publish (pinned gần top của sidebar).
     b. Card "Status" — select draft/published.
     c. Card "Product organization" — Product Type (chỉ chọn được lúc TẠO
        MỚI, **disabled/readonly khi edit** — đổi Product Type sau khi tạo
        có thể làm lệch tập custom field đã nhập, không nằm trong scope
        Phase 1), Brand (select, nullable).
2. **Tạo mới Product**: modal/form ngắn giống `ListProducts::
   createActionFormInputs()` (name, product type, sku, base price) → gọi
   endpoint create → redirect sang `ProductFormPage` (edit) của Product vừa
   tạo — giữ đúng flow UX vendor đang dùng (đã chứng minh hoạt động đúng ở
   production).
3. **Danh sách Product** `ProductsListPage.tsx`: cột thumbnail, name, product
   type, brand, tổng stock, giá (từ variant/giá rẻ nhất), status (badge),
   updated_at — port lại đúng logic cột đã có ở
   `backend/app/Filament/Resources/ProductResource.php` (app override, đã
   verify: thumbnail, name+description snippet, category từ collection đầu
   tiên, brand, stock-sum, price từ variant rẻ nhất, status badge,
   created_at). Áp dụng padding chuẩn `px-6 py-4` giống baseline
   `ProductTypesPage.tsx` (không lặp lại lỗi padding không nhất quán đã thấy
   ở Breeds/Solutions/CustomFields).

## Phạm vi đề xuất v1 (Phase 1) — trong scope

**Backend** (`backend/app/Http/Controllers/Api/Admin/ProductController.php`
mới + `ProductVariantController.php` mới hoặc method lồng trong
ProductController, + `Requests/Admin/StoreProductRequest.php`/
`UpdateProductRequest.php`/`UpdateProductVariantRequest.php` +
`Resources/Admin/ProductResource.php`/`ProductVariantResource.php`):

- `GET /admin/products` — list, search theo name/sku, filter status/brand/
  product_type, phân trang.
- `POST /admin/products` — tạo (name, product_type_id, sku, base_price) →
  logic y hệt `ListProducts::createRecord()` (tạo Product + 1 variant mặc
  định + 1 Price).
- `GET /admin/products/{product}` — chi tiết đầy đủ: core fields +
  `productType.productAttributes()`/`variantAttributes()` (kèm giá trị hiện
  tại), variants (đầy đủ field + `values` + giá), collections (ids), media.
- `PUT /admin/products/{product}` — update field product-level
  (attribute_data theo `productAttributes()`, status, brand_id — KHÔNG cho
  đổi `product_type_id`), sync collections, sync media.
- `PUT /admin/products/{product}/variants/{variant}` — update trực tiếp 1
  variant (toàn bộ field liệt kê ở mục "Variants" phía trên + base price của
  chính variant đó) — **không tạo/xoá variant, không đụng ProductOption/
  ProductOptionValue**.
- `DELETE /admin/products/{product}` — soft delete (Product đã có
  `SoftDeletes`).

**Frontend** (`admin/src/features/products/`):

- `api.ts`, `ProductSchema.ts` (Zod), `ProductsListPage.tsx`,
  `ProductFormPage.tsx`, `ProductRowActions.tsx`, route `/products` +
  `/products/:id` trong `App.tsx`, mục nav trong `AppShell.tsx` (nhóm
  CATALOGUE, giữ đúng cơ chế accordion/active-group đã fix ở round 4, không
  đụng lại logic đó).
- Component render field động theo Attribute type (dùng chung cho product-
  level và variant-level custom field).

## Ngoài scope Phase 1 (dồn sang Phase 2/round sau)

- Tạo mới `ProductOption`/`ProductOptionValue`, sinh ma trận variant mới,
  tạo/xoá variant.
- Customer Group pricing / tiered pricing theo `min_quantity` khác 1 — Phase
  1 chỉ 1 mức giá mặc định mỗi variant.
- Channel availability, Customer Group availability
  (`ManageProductAvailability`).
- URL/redirect management (`ManageProductUrls`).
- Product Associations (upsell/cross-sell, `ManageProductAssociations`).
- Bulk actions trên danh sách Product (export, bulk status...).
- SEO fields cho Product — hiện Lunar `Product` không có quan hệ SEO nào
  (khác `Breed`/`Post` đã có `seo()`); không tự thêm field/bảng mới nếu
  không được yêu cầu.
- Đổi `product_type_id` sau khi tạo.

## Việc cần làm sau khi code xong

1. Query thật lên production để xác nhận `type` của Attribute
   `handle=name, attribute_type=product` — ghi rõ kết quả trong báo cáo
   (Text hay TranslatedText), xác nhận component render động chọn đúng nhánh.
2. Test thủ công: tạo Product mới (single-variant) → sửa đầy đủ field → lưu
   → confirm dữ liệu đúng ở DB. Test riêng với 1 Product multi-variant có
   sẵn: sửa sku/giá/stock của 1 variant, xác nhận **các variant khác không
   bị xoá/thay đổi** và bảng `product_options`/`product_option_values` không
   bị đụng tới (so sánh trước/sau bằng SQL).
3. Test danh sách Product: search, filter, phân trang, padding nhất quán.
4. Chạy `tsc --noEmit` và build production (backend PHPUnit nếu có test liên
   quan, + admin frontend build) — báo kết quả thật, không tự suy diễn.
5. Liệt kê chính xác toàn bộ file mới/sửa (backend Controller/Requests/
   Resource/routes, frontend feature folder/route/nav).
