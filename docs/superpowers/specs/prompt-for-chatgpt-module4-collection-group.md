# Module 4 kickoff — Collection Group

> Copy toàn bộ nội dung dưới đây gửi cho ChatGPT.

## Vai trò

Tiếp tục vai trò code/fix/debug/review cho Catalogue migration (Filament → Vite/React admin ở `admin/`, port 5173). Module này là **Collection Group** — theo đúng thứ tự đã thống nhất ở round 4 (Product Type + Collection Group build trước Brand/Collection/Product vì chúng là dropdown dependency). Brand (Module 3) đã xong, không có logo, đã commit `8874d16`.

## Áp dụng nguyên tắc đã chốt

- **Tên nghiệp vụ chỉ tiếng Anh** (như Custom Field/Brand): `name` là string phẳng, không có cấu trúc `{en, vi}`.
- **Không được cắt/ẩn CRUD** — production đã có 6 Collection Group thật, tổ chức 10 Collection thật (xem file `docs/superpowers/specs/prompt-for-chatgpt-catalogue-review-round4.md` mục "Dữ liệu runtime thật" nếu cần tra lại).

## Facts đã verify từ code (đọc trực tiếp vendor + app, không đoán)

**Model:** `Lunar\Models\CollectionGroup` (`vendor/lunarphp/core/src/Models/CollectionGroup.php`)
- `protected $guarded = [];`
- Cột thật: `id`, `name` (string), `handle` (string), timestamps. Không có cột nào khác.
- Không có trait translatable, không có trait media (HasMedia) — **Collection Group không có ảnh/thumbnail**, khác với Collection (Collection thì có).
- Relation: `collections(): HasMany`.

**Migration:** `lunar_collection_groups`
- `id`, `name`, `handle` (UNIQUE constraint — thêm ở migration `2024_05_25_100000_update_collection_group_handle_unique.php`), timestamps.
- Không có foreign key nào trỏ vào bảng này từ phía khác ngoại trừ `lunar_collections.collection_group_id`.

**Quan hệ với Collection (bảng `lunar_collections`):**
- `collection_group_id` — `foreignId` **constrained, KHÔNG nullable, KHÔNG có cascade/nullOnDelete** → hành vi mặc định là RESTRICT. Y hệt pattern `Product.brand_id` ở Module 3: xoá 1 Collection Group đang có Collection sẽ ném `QueryException` thô nếu không có guard ở tầng app.
- Collection còn có `deleted_at` (soft-delete) — cần kiểm tra cả bản ghi đã soft-delete khi đếm "đang dùng", giống hệt cách `BrandController::destroy()` đã làm với `withTrashed()->count()` cho Product.

**Guard xoá đã có sẵn ở Filament (tham khảo, không copy y nguyên vì khác kiến trúc):**
`app/Filament/Resources/CollectionGroupResource/Pages/EditCollectionGroup.php` — chặn xoá bằng cách check `$record->collections->count() > 0` trước khi xoá, hiện thông báo lỗi. Đây CHỈ đếm collection chưa soft-delete (`$record->collections` dùng relation mặc định, không include trashed) — có thể là một **gap có sẵn** (nếu tất cả Collection trong group đều bị soft-delete thì Filament vẫn cho xoá Group, để lại Collection mồ côi trỏ vào group đã xoá). Đề xuất: Module 4 xử lý chặt hơn — đếm cả `withTrashed()`, theo đúng pattern đã áp dụng cho Brand.

**Không có gì cần dọn dẹp/migrate:** không có bảng `collection_groups` app-level nào orphan (khác với Brand — Brand có 1 bảng legacy `App\Models\Brand`/`brands` phải tránh đụng vào). Collection Group chỉ có đúng 1 hệ thống thật: `Lunar\Models\CollectionGroup`/`lunar_collection_groups`.

**Chưa có gì ở phía REST API:** không có route `/admin/collection-groups*` nào trong `routes/api.php`, không có `CollectionGroupResource` (JsonResource) ở `app/Http/Resources/Admin/`, không có `ErrorCode` nào cho collection — cần thêm mới hoàn toàn, không có gì để migrate/xoá từ code cũ (Filament vẫn còn dùng resource riêng của nó, không đụng tới).

**Không có cache tương tự `brands:index`** cho collection/collection-group ở phía public — nghĩa là Module 4 KHÔNG cần bước `Cache::forget(...)` nào (khác với Brand). Nếu sau này Module 5 (Collection) phát hiện có cache public thì xử lý riêng ở đó.

## Scope Module 4 (Collection Group) — v1 tối thiểu

1. **Backend:**
   - `app/Http/Controllers/Api/Admin/CollectionGroupController.php` — index (list + count Collection, kể cả soft-deleted nếu cần cho logic xoá), store, update, destroy.
   - `StoreCollectionGroupRequest` / `UpdateCollectionGroupRequest` — validate `name` (required, string, max 255) và tự sinh `handle` (slug từ name, unique) — **hỏi lại**: Filament hiện có cho nhập `handle` tay không, hay tự generate? Cần giữ đúng hành vi hiện tại để không phá dữ liệu cũ (6 group thật đã có handle cố định như `mobility-support`, `shop-collections`...).
   - `CollectionGroupResource` (JsonResource) — trả về `id`, `name`, `handle`, `collections_count` (dùng `withCount('collections')`, không cần tính riêng trashed cho hiển thị, chỉ dùng trashed-count cho logic guard xoá).
   - Guard xoá: đếm Collection thuộc group kể cả `withTrashed()`, chặn bằng lock + transaction giống Brand, trả `409` với `ErrorCode::COLLECTION_GROUP_IN_USE` (thêm case mới vào enum).
   - Route: `/admin/collection-groups` (index, store), `/admin/collection-groups/{collectionGroup}` (show, update, destroy) — đăng ký cả `api/admin/*` lẫn `api/v1/admin/*` giống Brand.
   - Test: `CollectionGroupControllerTest` — copy cấu trúc từ `BrandControllerTest` (unauth/customer rejected, index sort + count, create/update validate unique handle, delete blocked khi có collection kể cả soft-deleted, unused group xoá được).

2. **Frontend (`admin/src/features/collection-groups/`):**
   - Y hệt cấu trúc `brands/`: `api.ts`, `collectionGroupSchema.ts` (chỉ `name`, không cần nhập `handle` tay nếu backend tự sinh), `CollectionGroupModal.tsx`, `CollectionGroupsPage.tsx`, `CollectionGroupRowActions.tsx`.
   - Route `/collection-groups` trong `App.tsx` + nav item trong `AppShell.tsx` — copy đúng pattern đã thêm cho `/brands`.
   - i18n: thêm `collection_groups.*` vào `en.json`/`vi.json` — dùng chung `common.actions/edit/delete/view` đã có sẵn từ Module 3, không tạo lại.

## Câu hỏi cần trả lời trước khi code

1. **Handle**: tự động generate từ `name` (giống slug) hay cho admin nhập tay? Nếu tự generate, khi update `name` có nên regenerate `handle` không, hay `handle` cố định sau khi tạo (an toàn hơn vì Collection/Product/URL có thể tham chiếu handle)? Đề xuất: **cố định sau khi tạo**, không cho sửa `handle` ở v1 — giống cách Brand không cho đổi gì ngoài `name`.
2. Có cần hiển thị "Mobility & Support" (group id=1, hiện có 0 collection thật) khác biệt gì trên UI không (vd cảnh báo "orphan/unused")? Hay coi như 1 group bình thường, để admin tự quyết định xoá hay giữ? Đề xuất: coi như bình thường, không thêm logic đặc biệt.
3. Xác nhận lại: Module 4 này **không đụng gì đến Collection** (bảng `lunar_collections`, model, nested-set/tree, media/thumbnail) — đó là Module 5 riêng, sẽ kickoff sau khi Module 4 xong.

Phản biện lại nếu thấy có sai lệch với thực tế code hoặc muốn gộp chung Module 4+5 thành 1 lần code luôn (nếu gộp thì nói rõ lý do, tôi sẽ đánh giá lại).
