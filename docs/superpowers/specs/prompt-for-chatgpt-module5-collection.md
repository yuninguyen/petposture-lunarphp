# Module 5 — Collection (Catalogue migration, Filament → React admin)

Role continuity: bạn (ChatGPT) implement/debug/tự test; Claude chỉ verify từng
claim đối chiếu code/vendor/production thật, rồi làm final check + commit.
Không tự ý mở rộng scope ngoài những gì liệt kê dưới đây.

## Bối cảnh đã xác nhận (Module 1-4 đã xong, đã commit)

Product Type, Custom Field, Brand, Collection Group đã migrate xong sang
`admin/` (Vite/React) theo pattern CRUD phẳng (feature folder: `api.ts`,
`<Entity>Schema.ts`, `<Entity>Modal.tsx`, `<Entity>sPage.tsx`,
`<Entity>RowActions.tsx` + backend Controller/Requests/Resource/routes/tests).

Đã xác nhận qua screenshot Filament thật: `CollectionGroup` "Feeding" chứa 3
root `Collection`: "Tilted Bowl", "Slow Feeder", "Water Fountain" — mỗi cái có
thumbnail, drag handle để reorder, menu 3 chấm. Đây là dữ liệu **production
thật đang dùng**, không phải demo — bất kỳ thay đổi nào cũng không được làm
gãy dữ liệu/luồng hiện có.

## Vì sao Module 5 khác hẳn Module 1-4 (không phải CRUD phẳng)

`Lunar\Models\Collection` (`vendor/lunarphp/core/src/Models/Collection.php`):

```php
class Collection extends BaseModel implements Contracts\Collection, HasThumbnailImage, SpatieHasMedia
{
    use HasChannels, HasCustomerGroups, HasFactory, HasMacros, HasMedia,
        HasTranslations, HasUrls, NodeTrait, Searchable {
            NodeTrait::usesSoftDelete insteadof Searchable;
        }

    protected $casts = ['attribute_data' => AsAttributeData::class];
    protected $guarded = [];
    // group(): BelongsTo, products(): BelongsToMany, customerGroups(),
    // discounts(), brands(), getThumbnailImage()
}
```

Khác biệt cốt lõi so với Brand/CollectionGroup:

1. **Nested-set tree** (`kalnoy/nestedset` `NodeTrait`) — có `parent_id`,
   `_lft`, `_rgt` (KHÔNG có cột `depth` vật lý — xem xác nhận bên dưới). Mỗi
   `Collection` thuộc 1 `CollectionGroup`
   (`collection_group_id`, FK RESTRICT — cùng rủi ro pattern như
   `Product.brand_id`/`Collection.collection_group_id` đã gặp ở Module 3/4),
   và có thể lồng cây con vô hạn cấp trong group đó.
2. **`name` KHÔNG phải cột thường** — nó nằm trong `attribute_data` (JSON,
   cast `AsAttributeData::class`), đọc qua `$collection->attr('name')`, do hệ
   Attribute/EAV của Lunar quản lý (bảng `lunar_attributes`, xác định bằng
   `attribute_type = 'collection'`, `handle = 'name'`). FieldType class của
   attribute đó (`Lunar\FieldTypes\Text` hay `Lunar\FieldTypes\TranslatedText`)
   quyết định `name` là string phẳng hay bilingual `{en, vi}`.
3. **Spatie Media** (`HasThumbnailImage`, `SpatieHasMedia`) — cần upload/hiển
   thị thumbnail thật (khác Brand — Module 3 đã bỏ hẳn logo, nên **chưa có
   pattern upload ảnh nào trong `admin/` để tái dùng**).
4. `HasChannels`, `HasCustomerGroups`, `discounts()`, `brands()` (pivot) —
   không có gì tương đương ở Module 1-4.
5. Xác nhận lại (từ Module 4): KHÔNG dùng Laravel `SoftDeletes` trait dù có
   cột `deleted_at` — `NodeTrait::usesSoftDelete insteadof Searchable` chỉ là
   PHP trait-conflict resolution giữa 2 trait cùng tên method, KHÔNG bật
   `SoftDeletingScope`. Guard xoá phải tự count thủ công như đã làm ở
   CollectionGroupController, không dựa vào `withTrashed()`/global scope.

Vendor Filament actions liên quan (`vendor/lunarphp/lunar/src/Support/Actions/Collections/`):
`CreateRootCollection`, `CreateChildCollection`, `DeleteCollection`,
`MoveCollection`, cộng `makeRoot()`/`sort()` (kéo-thả reorder) trong
`CollectionTreeView` widget.

## ✅ Câu hỏi blocking #1 — ĐÃ XÁC NHẬN (user chụp màn hình Filament production thật)

`Attribute Group: Collection > Details > Name` → `handle: name`, `type:
Lunar\FieldTypes\TranslatedText`. Xác nhận thêm qua code:

- `vendor/lunarphp/core/src/FieldTypes/TranslatedText.php` — value là 1
  `Collection` keyed theo locale code, mỗi phần tử là 1 `Text` instance.
- `Lunar\Models\Language::all()` trên DB thật (đọc trực tiếp) trả về đúng 2
  locale: `en` (default) và `vi`.
- `Text::jsonSerialize()` trả string thô → khi `attribute_data` serialize ra
  JSON, `name` có dạng chính xác `{"en": "...", "vi": "..."}`.

**Kết luận: `Collection.name` là bilingual thật (`{en, vi}`), khác nguyên tắc
"English-only" đã áp dụng cho Brand/CollectionGroup/CustomField (những cái đó
là cột string phẳng, không qua hệ Attribute).** API Module 5 cho `name` phải
trả về/nhận vào dạng `{en: string, vi: string}`, và form tạo/sửa Collection ở
`admin/` cần 2 ô input tương ứng 2 locale (không phải auto-slug 1 input như
Brand/CollectionGroup).

Đối chiếu thêm: `Product.name` lại là `Lunar\FieldTypes\Text` (phẳng, không
dịch) — xác nhận qua screenshot Attribute Group "Details" (type=Product).
Đây cũng chính là group tạo ra section **"Technical Specs"** trên trang sản
phẩm (`material`, `weight`, `dimensions`, `care_instructions`, `warranty` —
đọc qua `ProductResource::resolveSpecs()`, render ở
`frontend/components/product/ProductDetails.tsx`) — không liên quan trực
tiếp Module 5 nhưng ghi lại vì user đã hỏi xác nhận riêng.

## ✅ Câu hỏi blocking #2 & #3 — ĐÃ XÁC NHẬN (Claude đọc trực tiếp vendor source)

**Nested-set columns** — `vendor/lunarphp/core/database/migrations/2021_08_10_103000_create_collections_table.php`
gọi `$table->nestedSet()`, macro đăng ký bởi `Kalnoy\Nestedset\NestedSet::columns()`
(`vendor/kalnoy/nestedset/src/NestedSet.php`), tạo đúng 3 cột vật lý:

```php
$table->unsignedInteger('_lft')->default(0);
$table->unsignedInteger('_rgt')->default(0);
$table->unsignedInteger('parent_id')->nullable();
$table->index(['_lft', '_rgt', 'parent_id']);
```

**KHÔNG có cột `depth` vật lý.** `depth` chỉ là giá trị computed/select alias
khi query bằng `Collection::query()->withDepth()` — API tree KHÔNG được đọc
`$collection->depth` trừ khi query đã gọi `withDepth()`.

**Spatie Media** — `Lunar\Models\Collection` dùng `Lunar\Base\Traits\HasMedia`,
map tới `Lunar\Base\StandardMediaDefinitions` (`config/media.php`:
`'collection' => StandardMediaDefinitions::class`). Đã đọc trực tiếp
`StandardMediaDefinitions.php`, xác nhận:

- Media collection duy nhất: `config('lunar.media.collection')` = `'images'`.
- Conversion `small` (300×300, `Fit::Fill`, border/background trắng, sharpen
  10, giữ nguyên format gốc) — đây chính là conversion Lunar Admin dùng cho
  thumbnail.
- Conversion khác trên collection `images`: `zoom` (500×500), `large`
  (800×800), `medium` (500×500) — cùng `Fit::Fill`, border/background trắng,
  giữ nguyên format gốc (không sharpen).
- Thumbnail KHÔNG phải "media đầu tiên" — là quan hệ riêng
  (`vendor/lunarphp/core/src/Base/Traits/HasMedia.php`):
  ```php
  public function thumbnail(): MorphOne
  {
      return $this->morphOne(config('media-library.media_model'), 'model')
          ->where('custom_properties->primary', true);
  }
  ```
  `Collection::getThumbnailImage()` (`vendor/lunarphp/core/src/Models/Collection.php`)
  trả `$this->thumbnail?->getUrl('small') ?? ''` — Filament `CollectionTreeView`
  dùng đúng contract này kèm eager-load `->with(['thumbnail'])`.

**Kết luận cho API Module 5**: `CollectionResource` trả
`'thumbnail' => $collection->thumbnail?->getUrl('small') ?: null` (hoặc gọi
`getThumbnailImage()`), eager-load `thumbnail` để tránh N+1. Upload/replace
thumbnail: attach vào collection `images`, đánh dấu media mới
`custom_properties: ['primary' => true]`, gỡ/xoá marker cũ theo semantics đã
chọn, không đụng các media `images` khác (gallery), không tạo conversion mới.

## Việc còn lại cần xác nhận TRƯỚC khi code

1. **Local dev DB hiện KHÔNG có attribute nào cho `attribute_type =
   'collection'`** (đã kiểm tra: cả bảng `lunar_attributes` chỉ có 1 record,
   thuộc `product_variant`). Cần thêm migration/seeder tạo đúng attribute
   `collection.name` kiểu `TranslatedText` (group "Details") khớp production,
   nếu không API/test Module 5 sẽ không chạy được ở local.

## ✅ Quyết định UI scope — Option A (user đã chọn)

**Tree UI đầy đủ ngay v1** — parity Filament: expand/collapse, drag-drop
reorder trong cùng cấp, tạo root/child collection, move node (đổi parent
hoặc đổi hẳn sang group khác), make-root. Đây là component frontend phức tạp
nhất trong toàn bộ đợt migration (chưa có gì tương đương trong `admin/`).

**Yêu cầu UX/UI rõ ràng từ user — không phải clone thô 1:1 giao diện Filament
cũ:**
- Giao diện phải **đẹp, gọn, không rối mắt** — tránh việc hiện toàn bộ cây
  auto-expand gây rối khi nhiều node; nên mặc định collapse, chỉ expand theo
  thao tác người dùng hoặc node đang có nội dung liên quan.
- Thao tác kéo-thả (reorder/move) phải **mượt, phản hồi nhanh** — optimistic
  UI update trước khi API xác nhận, không để user chờ loading giữa mỗi lần
  kéo-thả; rollback nếu API lỗi.
- Actions (add child, delete, move, make-root) gọn trong menu ngữ cảnh từng
  node (giống pattern `CollectionGroupRowActions`/`BrandRowActions` đã có —
  dropdown 3 chấm), không làm UI node bị chật vì quá nhiều nút hiện sẵn.
- Vẫn phải giữ được các pattern đã thống nhất từ Module 1-4: toast thông báo
  thành công/lỗi, modal xác nhận xoá (`DeleteConfirmModal`), loading state
  nhất quán, bilingual admin chrome (`en.json`/`vi.json`).
- Vì `name` là `{en, vi}` thật (khác Module 1-4), form tạo/sửa Collection
  cần 2 input rõ ràng cho từng locale, không được chỉ hiện 1 ngôn ngữ.

Nếu việc kéo-thả cây nhiều cấp + đổi group trong 1 lần khiến v1 quá nặng,
được phép báo lại cho Claude để cân nhắc tách nhỏ (ví dụ: reorder cùng cấp +
add/delete/edit trước, "move sang group khác" để sau) — nhưng phải hỏi lại,
không tự ý cắt giảm.

## Phạm vi đề xuất v1

- Backend: `CollectionController` (index theo group, dùng `whereIsRoot` +
  `children` để dựng cây; store root/child; show; update — tên `{en, vi}` +
  parent/group move; destroy — guard chặn nếu còn children hoặc còn products
  gắn (`products()->count()`), tự count thủ công vì không có SoftDeletes
  global scope; reorder/move endpoint dùng `NodeTrait`
  (`afterNode`/`beforeNode`/`makeRoot`)), `Store/UpdateCollectionRequest`,
  `CollectionResource` (trả `name` dạng `{en, vi}`), routes dưới `/admin`,
  feature tests bao gồm cả case cây lồng nhiều cấp.
- Frontend: feature folder `admin/src/features/collections/` — cấu trúc
  tương tự Module 1-4 nhưng thêm component tree-view riêng (không cố nhồi
  vào `<table>` phẳng như các module trước).
- KHÔNG động vào Filament `CollectionResource`/vendor.
- KHÔNG làm ở Module 5 này: `HasChannels`/`HasCustomerGroups` visibility
  rules, `discounts()`/`brands()` pivot management — để lại cho phase sau
  (giữ nguyên nguyên tắc "chỉ làm đúng scope đã xác nhận").

## Việc trả lời trước khi bắt đầu code

Tất cả blocking confirmations đã xong. Chỉ còn việc thêm migration/seeder cho
attribute `collection.name` ở local dev DB (mục #1 ở trên) — làm việc này
trước, rồi bắt đầu implement theo Option A với các yêu cầu UX/UI đã nêu.
