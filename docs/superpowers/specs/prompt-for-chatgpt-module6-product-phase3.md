# Module 6 — Product Phase 3: Variant CRUD, Bulk Actions, SEO, Associations, URL/Redirect, Preview

Role continuity: bạn (ChatGPT) implement/debug/tự test; Claude chỉ thảo luận
kiến trúc/phản biện + verify độc lập bằng cách đọc code thật + final check
trước khi commit — không tự tin vào báo cáo self-test, luôn chạy lại
`php artisan test`, `tsc -b`, `vitest` thật trước khi báo xong.

Bối cảnh: Phase 1 (CRUD cơ bản, attributes, pricing, media, collections,
brand) và Phase 2 (Description rich-text, slug, media folder/layout) đã xong
và được Claude verify/approve. Đây là Phase 3, phủ các mục đã cố tình để
ngoài scope ở Phase 1.

**Scope Phase 3 (đã user chốt qua AskUserQuestion):**
1. Tạo/xoá variant mới (ProductOption + variant matrix)
2. Bulk actions (delete + đổi status hàng loạt)
3. SEO fields
4. Product Associations (cross-sell/up-sell/alternate)
5. URL/redirect management (giữ lịch sử slug cũ, không mất SEO)
6. Product Preview (xem trước như đã có ở Blog)

**Đã loại khỏi scope (user tự quyết, không cần làm lại):**
- Channel availability — chỉ bán 1 kênh online store duy nhất, không cần.
- Customer Group availability (tiered pricing theo nhóm khách) — để dành cho
  module "Group Commerce" tương lai riêng, không đụng ở đây.

**Khuyến nghị cách làm**: implement/test/report từng mục trong 6 mục trên
ĐỘC LẬP theo thứ tự bên dưới, gửi Claude review từng mục một thay vì làm hết
một lượt rồi mới báo cáo. Rủi ro mỗi mục rất khác nhau (mục 1 rủi ro cao nhất
vì đụng order-line integrity, mục 2/3/6 rủi ro thấp).

## Ràng buộc kiến trúc quan trọng — đọc trước khi code

`Lunar\Models\Product`, `ProductVariant`, `ProductOption`, `ProductOptionValue`,
`ProductAssociation`, `Url` đều là **vendor model** (`backend/vendor/lunarphp/`).
Project này **không có app-level override/subclass** cho bất kỳ model nào ở
trên (đã confirm qua grep `backend/config/lunar/*.php` và `backend/app/Models/`),
và **không đăng ký Eloquent morph map** (đã confirm qua grep
`backend/app/Providers/*.php`) — nghĩa là cột `*_type` polymorphic lưu full
class name (vd `Lunar\Models\Product`), không phải alias ngắn.

**Tuyệt đối không sửa code trong `backend/vendor/`.** Mọi extension phải làm
ở tầng `app/` (Controller/Service/Resource mới), dùng trực tiếp vendor model
qua Eloquent, không cần override class.

---

## 1. Tạo/xoá variant mới — RỦI RO CAO NHẤT

Building blocks có sẵn trong Lunar core, tái dùng thay vì viết lại từ đầu:
- `ProductOption` (`backend/vendor/lunarphp/core/src/Models/ProductOption.php`):
  `values()` (HasMany → `ProductOptionValue`), `products()` (BelongsToMany qua
  pivot `product_product_option`, có cột `position`).
- `ProductOptionValue`: `option()` (BelongsTo), `variants()` (BelongsToMany
  qua pivot `product_option_value_product_variant`, cột `value_id`/`variant_id`,
  cascade delete cả 2 chiều ở DB).
- `Lunar\Admin\Actions\Products\MapVariantsToProductOptions::map(array $options,
  array $variants, bool $fillMissing = true): array` — sinh ra cartesian
  product các permutation variant từ option sets (vd
  `['Color' => ['Red','Blue'], 'Size' => ['S','M']]` → 4 variant), dùng
  `Lunar\Utils\Arr::permutate()`.
- Flow tham khảo:
  `Lunar\Admin\Filament\Resources\ProductResource\Widgets\ProductOptionsWidget::saveVariantsAction()`
  (dòng ~356-456) — tạo variant mới, `$variant->values()->sync($optionsValues)`,
  soft-delete variant không còn trong matrix mới bằng
  `whereNotIn('id', $variantIds)->get()->each(fn ($v) => $v->delete())`.

**Endpoint cần thêm:**
- `POST /admin/products/{product}/options` — tạo/update ProductOption + values.
- `POST /admin/products/{product}/variants/generate` — generate variant matrix
  từ option values hiện có (dùng `MapVariantsToProductOptions::map()`).
- `DELETE /admin/products/{product}/variants/{variant}` — xoá 1 variant.

**Ràng buộc bắt buộc:**
- `ProductVariant` dùng `SoftDeletes` (`use SoftDeletes;` + migration có
  `$table->softDeletes()`). **Chỉ soft-delete, không bao giờ force-delete.**
  Lý do: bảng `cart_lines`/`order_lines` reference `product_variant_id` qua
  polymorphic `purchasable` **không có cascade delete** — force-delete variant
  đã từng nằm trong đơn hàng cũ sẽ phá vỡ lịch sử đơn hàng.
- Không cho xoá variant cuối cùng còn lại của 1 Product (Product luôn phải có
  ít nhất 1 variant).
- Trước khi xác nhận xoá, hiển thị cảnh báo (non-blocking, không chặn) nếu
  variant đã từng xuất hiện trong `order_lines` — cho biết variant này có
  lịch sử đơn hàng.
- Khi generate lại variant matrix (đổi option values), variant ID của các
  permutation KHÔNG đổi phải giữ nguyên (không xoá-tạo-lại toàn bộ), chỉ tạo
  mới cho permutation mới xuất hiện và soft-delete permutation không còn nữa
  — đúng như flow `saveVariantsAction()` đã làm.

## 2. Bulk actions — RỦI RO THẤP

Copy pattern `bulkDestroy()` đã có ở `PostController`/`BreedController`:
validate `ids: required|array, ids.*: integer|exists:lunar_products,id`, rồi
`Product::whereIn('id', $ids)->delete()`.

**Endpoint cần thêm:**
- `POST /admin/products/bulk-delete`
- `POST /admin/products/bulk-status` (đổi status hàng loạt: draft/published)

**Lưu ý frontend**: `ProductsListPage.tsx` hiện **chưa dùng**
`@tanstack/react-table` (đang là `<table>` map tay, không có selection state)
— khác với Post/Breed/Solution đã có sẵn `RowSelectionState` + checkbox
column. Cần refactor sang `useReactTable`, hoặc dùng `Set<number>` state thủ
công đơn giản hơn nếu không muốn refactor toàn bộ table — tự quyết định theo
mức độ phức tạp thực tế của file, báo lại Claude hướng đã chọn.

## 3. SEO fields — RỦI RO THẤP

Bảng `seo_metadata` (app-level, đã dùng cho Breed/Post/Solution) là
polymorphic: `seoable_id`, `seoable_type`, `title`, `description`,
`keyphrase`, `og_title`, `og_description`, `og_image`, `canonical_url`,
`is_indexable`, `is_followable`.

**Không được thêm trait `HasSeo` vào `Lunar\Models\Product`** (vendor class,
không override được). Thay vào đó, trong `Admin\ProductController`/
`ProductResource`, query/ghi trực tiếp:
```php
SeoMetadata::where('seoable_type', \Lunar\Models\Product::class)
    ->where('seoable_id', $product->id)->first();

SeoMetadata::updateOrCreate(
    ['seoable_type' => \Lunar\Models\Product::class, 'seoable_id' => $product->id],
    $seoData
);
```

Tái dùng nguyên `SeoSettingsSection.tsx` (`admin/src/features/posts/`) —
component đã generic sẵn (`control`, `register`, `setValue`, `getValues`,
`titleKey`, `contentKey` props), không cần sửa gì.

**Cần kiểm tra**: nếu có tính năng AI-generate SEO (đã dùng cho Post), xác
nhận input nó nhận là plain text hay HTML — Description của Product giờ là
rich-text HTML (sau Phase 2), có thể cần strip tag trước khi đưa vào prompt.

## 4. Product Associations — RỦI RO TRUNG BÌNH

`Lunar\Models\Product::associate()`/`dissociate()`
(`backend/vendor/lunarphp/core/src/Models/Product.php` dòng 148-159) dispatch
`Lunar\Jobs\Products\Associations\Associate`/`Dissociate`.

**QUAN TRỌNG**: các job này implement `ShouldQueue` — tức là **queued**, không
chạy đồng bộ mặc định. Nếu `config('queue.default')` khác `sync`, gọi
`->dispatch()` (mặc định của `associate()`/`dissociate()`) có thể khiến API
trả response THÀNH CÔNG trước khi DB thực sự ghi association. Phải tự dispatch
đồng bộ thay vì gọi qua wrapper method:
```php
Associate::dispatchSync($product, $targetProduct, $type);
Dissociate::dispatchSync($product, $targetProduct, $type);
```
(Kiểm tra đúng signature constructor thật của 2 job class này trước khi gọi.)

Enum type: `Lunar\Base\Enums\ProductAssociation` — `CROSS_SELL = 'cross-sell'`,
`UP_SELL = 'up-sell'`, `ALTERNATE = 'alternate'`. Có static helper
`ProductAssociation::getTypes()`.

**Endpoint cần thêm:**
- `GET /admin/products/{product}/associations`
- `POST /admin/products/{product}/associations`
- `DELETE /admin/products/{product}/associations/{association}`

Danh sách association types hiển thị ở UI có thể hardcode 3 giá trị trên
hoặc thêm 1 endpoint nhỏ trả về từ enum — tự quyết định, báo lại hướng đã
chọn.

## 5. URL/redirect management — RỦI RO TRUNG BÌNH, ẢNH HƯỞNG SEO

**Bug hiện tại cần fix**: `ProductController::update()`
(`backend/app/Http/Controllers/Api/Admin/ProductController.php`, ~dòng
154-206) khi đổi slug đang **ghi đè trực tiếp** lên row `lunar_urls` cũ
(`$defaultUrl->update(['slug' => $validated['slug']])`) — slug cũ bị mất
vĩnh viễn, không có redirect nào được tạo. Test hiện tại
(`test_product_slug_is_returned_validated_unique_and_updates_the_existing_default_url`)
đang assert đúng hành vi sai này — sẽ cần update lại test.

**Bảng mới cần thêm** (migration mới, không sửa `lunar_urls`):
```
product_redirects
  id              bigint PK
  product_id      bigint FK -> lunar_products.id, cascade on delete
  old_slug        string, indexed
  created_at      timestamp (không cần updated_at)
```

**Logic bắt buộc:**
- Ngay trước dòng ghi đè slug hiện tại trong `ProductController::update()`,
  nếu slug thực sự đổi (so với `$defaultUrl->slug` cũ), insert 1 row vào
  `product_redirects` với `old_slug` = slug cũ.
- Giữ lại TOÀN BỘ lịch sử redirect (không xoá redirect cũ khi có redirect
  mới) — để hỗ trợ chuỗi nhiều lần đổi slug (A→B→C): cả A và B phải redirect
  được tới C hiện tại.
- `lunar_urls` **không có unique constraint ở DB** cho `slug` (chỉ có index
  thường) — uniqueness hiện chỉ được enforce ở validation layer
  (`Rule::unique('lunar_urls', 'slug')->ignore($defaultUrlId)` trong
  `UpdateProductRequest`). Giữ nguyên cơ chế này, không cần đổi.
- Ở API public (`ProductController::show()`/`resolvePublishedProduct()`,
  `backend/app/Http/Controllers/Api/ProductController.php`, ~dòng 153-358):
  khi slug trong URL không khớp `lunar_urls` hiện tại nhưng khớp 1 row trong
  `product_redirects`, phải trả về tín hiệu redirect THẬT (301 hoặc JSON flag
  rõ ràng), **không được** âm thầm serve nội dung mới dưới URL cũ (tránh
  duplicate-content SEO). Cơ chế cụ thể (redirect ở API layer hay để frontend
  tự xử lý) tự quyết định sau khi đọc code Next.js route thật
  (`frontend/app/shop/[category]/[slug]/page.tsx` hoặc tương đương — kiểm
  tra path chính xác trước khi code), nhưng bắt buộc dùng Next.js `redirect()`
  (giống pattern đã có ở `frontend/app/product/[id]/page.tsx`), không dùng
  `notFound()`.

## 6. Product Preview — copy pattern từ Blog

Blog đã có sẵn:
- `PostController::previewUrl()`
  (`backend/app/Http/Controllers/Api/PostController.php`, ~dòng 205-214):
  sinh HMAC-SHA256 token
  (`hash_hmac('sha256', $post->slug.'|'.$expires, config('app.key'))`), hết
  hạn sau 24h, build URL dạng
  `{frontend_url}/blog/{slug}?expires={expires}&preview_token={token}`.
- `ContentController::hasValidPreviewToken()`
  (`backend/app/Http/Controllers/Api/ContentController.php`, ~dòng 55-67):
  validate bằng `hash_equals()`, bypass filter `status='published'` khi token
  hợp lệ.
- Frontend `frontend/app/blog/[slug]/page.tsx` (~dòng 76-109): đọc query
  param `expires`/`preview_token`, tắt cache khi có token.
- `PostFormPage.tsx` (~dòng 339-362): nút "Preview" dùng `useMutation` rồi mở
  URL qua thẻ `<a>` tạm (tránh popup blocker).

**Khác biệt bắt buộc xử lý cho Product**: route storefront là
`/shop/[category]/[slug]` (không flat như `/blog/[slug]`) — generator URL
preview PHẢI tính `categorySlug` bằng đúng công thức đã có sẵn trong
`backend/app/Http/Resources/Api/ProductResource.php` (dòng 47-49):
```php
'categorySlug' => $firstCollection?->defaultUrl?->slug
    ?? ($firstCollection ? Str::slug($firstCollection->translateAttribute('name')) : 'categories')
```
Nên tái dùng công thức này (extract ra helper dùng chung nếu hợp lý) thay vì
viết lại logic tương tự riêng cho preview.

**Cần kiểm tra trước khi code**: đọc code Next.js route `/shop/[category]/[slug]`
thật để xác nhận giá trị fallback `'categories'` (khi Product chưa gán
Collection nào) có thực sự làm route 404/lỗi hay không, hay chỉ là cosmetic
(hiển thị breadcrumb sai nhưng vẫn load được sản phẩm). Nếu phát hiện vấn đề
thật, báo lại Claude thay vì tự chế ra 1 route preview riêng biệt khác với
route thật.

---

## Test bắt buộc — chạy SAU MỖI mục, không phải chỉ 1 lần ở cuối

Sau mỗi mục trong 6 mục trên:
- `php artisan test --filter=Product`
- `npx tsc -b` (admin)
- `npx vitest run src/features/products` (admin)

Test tay thêm cho từng mục rủi ro cao:
- **Mục 1**: tạo variant matrix, generate lại matrix sau khi đổi option
  values, xác nhận ID các variant permutation không đổi giữ nguyên qua nhiều
  lần generate (quan trọng cho order-line integrity — nếu ID đổi, order cũ
  sẽ trỏ sai variant).
- **Mục 5**: đổi slug 1 sản phẩm 3 lần liên tiếp (A→B→C), xác nhận cả URL A
  và B đều redirect đúng tới sản phẩm hiện tại (slug C).

## Sau khi xong mỗi mảng

Báo cáo TÁCH RIÊNG từng mục (không gộp 1 báo cáo cho cả 6 mục) — Claude sẽ
verify độc lập từng mục (đọc diff thật, chạy lại test thật) trước khi bạn
chuyển sang mục tiếp theo, giữ đúng kỷ luật đã áp dụng ở Phase 1/2.
