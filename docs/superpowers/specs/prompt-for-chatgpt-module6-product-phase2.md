# Module 6 — Product Phase 2: Description rich-text, Slug, Media Library folder

Role continuity: bạn (ChatGPT) implement/debug/tự test; Claude chỉ thảo luận
kiến trúc/phản biện + verify độc lập bằng cách đọc code thật + final check
trước khi commit — không tự tin vào báo cáo self-test, luôn chạy lại
`tsc -b`, `vitest`, `php artisan test` thật trước khi báo xong.

Đây là 3 việc **độc lập** với nhau, có thể làm theo bất kỳ thứ tự nào, không
cần làm chung 1 PR nếu không tiện. Tất cả đều nằm trong phạm vi Product Phase 1
đã ship (`admin/src/features/products/`), không đụng module khác trừ khi ghi
rõ bên dưới.

---

## 1. Description field → rich-text editor (TipTap)

### Vấn đề

`admin/src/features/products/DynamicAttributeFields.tsx` hiện render **mọi**
attribute kiểu `text`/`translated_text` bằng `<Input>` (single-line/textarea
thường) — kể cả field `description`, đang không có toolbar định dạng gì
(không bold/italic/list/link/ảnh).

Trong khi đó Posts (`admin/src/features/posts/PostFormPage.tsx`) đã có sẵn
TipTap đầy đủ toolbar qua component dùng chung
`admin/src/features/posts/TipTapToolbar.tsx` (heading, bold/italic/underline/
strikethrough, align, list, blockquote, hr, link, image qua Media Library,
table, text color/highlight, undo/redo, source mode). Extensions dùng ở
`PostFormPage.tsx` dòng ~224-239 (StarterKit, Underline, TextStyle, Color,
Highlight, TextAlign, LinkWithStyle — custom extension giữ class/style của
link, Image inline:false, Table resizable, TaskList/TaskItem).

### Yêu cầu

- Sửa `DynamicAttributeFields.tsx` để field có `handle === 'description'`
  (hoặc field nào đó khác, kiểm tra bằng `handle`, **không** đổi hành vi cho
  field khác như `name`) render bằng TipTap thay vì `<Input>`.
- Tái dùng `TipTapToolbar.tsx` — **không viết toolbar mới**. Nếu component
  hiện tại gắn cứng logic riêng cho Post (vd upload ảnh gắn với Post ID), tách
  phần dùng chung ra, giữ nguyên hành vi cho Post.
- Data vẫn lưu dạng chuỗi HTML vào attribute `description` (kiểu Lunar
  `FieldTypes\Text` hiện tại lưu string bình thường) — **không cần đổi gì
  backend** (`ProductAttributeService`, migration, validation) vì field type
  vẫn là string, chỉ nội dung giờ là HTML thay vì plain text.
- Cân nhắc: nếu `description` là `translated_text` (2 ô EN/VI) thì mỗi ô cần 1
  editor TipTap riêng — kiểm tra lại thực tế field `description` hiện tại là
  loại nào trước khi code (đọc `ProductAttributeService`/DB thật, đừng giả
  định).
- Test: thêm/update test cho `DynamicAttributeFields` nếu có, đảm bảo
  `ProductFormPage.test.tsx` (nếu có) không vỡ.

---

## 2. Slug field (dưới Name, trong card "Title & description")

### Bối cảnh kỹ thuật (đã research kỹ, dùng thẳng không cần đọc lại từ đầu)

Lunar **không** lưu slug là cột trong bảng `products`. Slug nằm ở bảng riêng
`lunar_urls` qua trait `HasUrls`
(`backend/vendor/lunarphp/core/src/Base/Traits/HasUrls.php`):

- `urls(): MorphMany` — tất cả URL của model
- `defaultUrl(): MorphOne` — URL mặc định (`where('default', true)`)
- `localeUrl(?string $locale = null): MorphOne` — URL theo ngôn ngữ

Cột trên `lunar_urls` (`Url` model): `id, language_id, element_type,
element_id, slug, default`.

**Quan trọng**: `HasUrls::bootHasUrls()` chỉ tự sinh slug lúc **tạo mới**
(`static::created(...)`, gọi `config('lunar.urls.generator')` →
`UrlGenerator::class`). **Không tự cập nhật khi update** — nếu đổi Name mà
không có logic riêng, slug cũ vẫn giữ nguyên (đây là hành vi Lunar mặc định,
không phải bug).

Storefront (`backend/app/Http/Controllers/Api/ProductController.php`,
`resolvePublishedProduct()`) tra cứu sản phẩm qua
`whereHas('urls', fn ($q) => $q->where('slug', $slug))`, có fallback tra theo
ID số nếu `$slug` numeric. **Đổi slug ở admin sẽ ảnh hưởng trực tiếp URL công
khai** — cân nhắc kỹ việc có cho phép sửa tự do hay không (xem mục "Cần
quyết định" bên dưới).

File hiện KHÔNG có slug ở đâu cả — xác nhận qua đọc trực tiếp:
- `backend/app/Http/Resources/Admin/ProductResource.php::toArray()` — không
  có field slug.
- `backend/app/Http/Requests/Admin/UpdateProductRequest.php` — không validate
  slug.
- `backend/app/Http/Controllers/Api/Admin/ProductController.php::update()` —
  không đụng gì tới `Url`/`lunar_urls`.

### Yêu cầu

1. **Backend**
   - `ProductResource::toArray()`: thêm `'slug' => $this->defaultUrl?->slug`.
   - `UpdateProductRequest`: thêm rule cho `slug` — `sometimes|string|max:255|
     regex` slug hợp lệ (chữ thường, số, dấu gạch ngang), và **unique** trong
     `lunar_urls` (loại trừ chính bản ghi hiện tại) để tránh trùng URL 2 sản
     phẩm.
   - `ProductController::update()`: nếu request có `slug` và khác slug hiện
     tại của `defaultUrl` → update (hoặc tạo mới nếu chưa có `defaultUrl`,
     hiếm khi xảy ra vì tạo mới đã tự sinh). Nhớ **giữ nguyên `language_id`**
     và `default = true` của bản ghi đang sửa, không tạo thêm bản ghi trùng.
2. **Frontend**
   - `ProductSchema.ts`: thêm `slug` vào `productFormSchema` (string,
     transform lowercase/trim nếu muốn UX dễ chịu hơn — nhưng validate cuối
     cùng vẫn ở backend) và `productDefaults()`/`productPayload()`.
   - `api.ts`: thêm `slug` vào type response (`ProductDetail`) và
     `UpdateProductPayload`.
   - `ProductFormPage.tsx`: thêm input Slug ngay dưới Name, trong card
     `products.title_description`. Hiển thị lỗi validate (trùng slug) trả về
     từ backend qua `setError`.
   - Thêm key i18n `products.slug` (EN + VI) vào `en.json`/`vi.json`.
3. **Cần quyết định trước khi code** (hỏi lại Claude/user nếu chưa rõ, đừng
   tự chọn): sản phẩm **đã published** có nên cho sửa slug tự do không, hay
   cần cảnh báo "đổi slug sẽ đổi URL công khai, link cũ sẽ 404"? Gợi ý tối
   thiểu: hiển thị 1 dòng cảnh báo nhỏ dưới input Slug khi `status ===
   'published'`, không cần redirect 301 tự động (ngoài phạm vi Phase 2 nếu
   không được yêu cầu thêm).

---

## 3. Media Library — tổ chức theo folder

### Bối cảnh kỹ thuật (đã research, dùng thẳng)

Media Library dùng package `awcodes/curator`, model
`backend/app/Models/CuratorMedia.php`, bảng `curator_media`. Migration hiện
tại (`2026_08_21_100000_create_curator_media_table.php`) có các cột: `disk,
directory, visibility, name, path, width, height, size, type, ext, alt,
title, description, caption, exif, curations`. **Không có cột folder/nhóm
logic nào** — `directory` chỉ là đường dẫn lưu file vật lý (mặc định
`"media"`), không phải khái niệm phân loại.

API hiện tại:
- `GET /admin/media` → `MediaController::index()` → `CuratorMedia::latest()
  ->limit(100)->get()`, không filter, không phân trang.
- `POST /admin/media` → `MediaController::store()`, validate
  `file: required|image|max:10240`, tạo `CuratorMedia` (name, path, width,
  height, size, ext, type='image' cứng), optimize ảnh sang WebP.
- Response qua `CuratorMediaResource`: `{id, url, thumbnail_url, name, alt,
  width, height}`.

Frontend: `admin/src/features/media/MediaPicker.tsx` (wrapper) +
`media-library-modal.tsx` (modal thật, `max-w-2xl`, grid 4 cột, không search/
filter/folder, fetch `['media']` toàn bộ 1 lần khi mở modal).

Model `MediaFolder` (`backend/app/Models/MediaFolder.php`, fields `name,
slug, starred`) **đã tồn tại nhưng chỉ dùng cho Filament cũ + `SiteMedia`**
(Spatie Media Library, collection `banner`/`general`) — **đây là hệ thống
media khác hoàn toàn với Curator, không dùng chung**. Đã quyết định: **không
gộp 2 hệ thống**, thêm cột folder riêng thẳng trên `curator_media` cho gọn.

Nơi hiện đang dùng `MediaPicker` (cần cập nhật context):
- `admin/src/features/products/ProductFormPage.tsx` (multi-image + reorder)
- `admin/src/features/posts/PostFormPage.tsx` (featured image, OG image, ảnh
  trong `ComparisonItemRepeater.tsx`)
- `admin/src/features/breeds/BreedFormPage.tsx` (featured image)
- `admin/src/features/solutions/SolutionFormPage.tsx` (featured image)

### Yêu cầu

1. **Migration**: thêm cột `folder` (string, nullable, indexed) vào
   `curator_media`. Danh sách folder cố định định nghĩa 1 chỗ trong code (PHP
   const/enum), gợi ý: `banner, blog, product, breed, solution, general`
   (thêm folder mới sau này = sửa 1 mảng, không cần migration mới).
2. **`MediaController@store`**: nhận thêm param `folder` (optional,
   `Rule::in([...danh sách...])`, default `general` nếu thiếu), lưu vào cột
   mới.
3. **`MediaController@index`**: nhận query param `folder` (optional). Có →
   filter theo folder; không có hoặc `folder=all` → trả về tất cả như hiện
   tại (giữ giới hạn 100, có thể tăng/thêm phân trang nếu thấy cần nhưng
   không bắt buộc trong scope này).
4. **`CuratorMediaResource`**: thêm field `folder` vào response.
5. **Thêm endpoint nhỏ đổi folder thủ công 1 ảnh**: `PATCH /admin/media/{id}`
   body `{folder}` — dùng cho nút "chuyển folder" trên mỗi thumbnail ở
   frontend (phòng trường hợp tự động gán sai).
6. **Backfill ảnh cũ (1 lần, Artisan command, không cần schedule)** — bắt
   buộc, không được bỏ qua bước này vì ảnh cũ đã tồn tại rất nhiều, nếu không
   backfill thì tính năng mất tác dụng ngay với data hiện có:
   - Ảnh gắn `posts.featured_media_id` (và ảnh trong nội dung Post nếu track
     được) → `blog`
   - Ảnh gắn `breeds.featured_media_id` → `breed`
   - Ảnh gắn `solutions.featured_media_id` → `solution`
   - Ảnh nằm trong pivot media của Product (`source = 'curator'`) → `product`
   - Còn lại không match gì → `general`
7. **Frontend modal** (`media-library-modal.tsx`):
   - Mở rộng modal (vd `max-w-6xl`), thêm sidebar trái liệt kê folder (All /
     Banner / Blog / Product / Breed / Solution / General), click đổi folder
     đang xem → refetch theo `?folder=`.
   - Thêm ô search lọc theo `name`/`alt` trong folder đang xem (client-side
     filter đủ dùng, không cần API riêng).
   - Thêm nút nhỏ trên mỗi thumbnail để đổi folder thủ công (gọi API PATCH ở
     mục 5).
8. **`MediaPicker`**: thêm prop `context` (vd `context="product"`), truyền
   xuống modal — dùng làm folder mặc định khi upload ảnh mới từ đây, và folder
   được chọn sẵn khi mở modal. Cập nhật 4 nơi gọi ở trên (Product/Post/Breed/
   Solution) truyền đúng `context` tương ứng.

### Việc cần làm trước khi code (bắt buộc)

- Đọc kỹ `MediaController.php`, `media-library-modal.tsx`,
  `CuratorMedia.php` thật (đừng giả định thêm field gì khác ngoài spec này).
- Xác nhận lại với Claude cách backfill xử lý ảnh **không** gắn với bất kỳ FK
  nào ở trên (vd ảnh mồ côi do xóa content nhưng chưa dọn) — mặc định
  `general` là đủ, không cần xử lý đặc biệt.
- Giữ nguyên toàn bộ hành vi upload/optimize ảnh hiện tại (WebP conversion,
  animated GIF exception) — chỉ thêm field `folder`, không đổi logic ảnh.

---

## Sau khi xong (cả 3 việc)

- Chạy `npx tsc -b` (admin), `npx vitest run src/features/products
  src/features/media` (và posts/breeds/solutions nếu có sửa), `php artisan
  test --filter=ProductControllerTest` + test liên quan `MediaController`.
- Gửi lại Claude review + tự verify bằng cách đọc code thật (không tin báo
  cáo self-test) trước khi commit/deploy.
