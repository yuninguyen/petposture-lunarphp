# Module 5 — Collection: follow-up UX sau khi review bản đầu

Role continuity: bạn (ChatGPT) implement/debug/tự test; Claude chỉ verify từng
claim đối chiếu code thật, rồi làm final check + commit. Không tự ý mở rộng
scope ngoài những gì liệt kê dưới đây.

## Bối cảnh

Bản Module 5 đầu tiên đã được Claude verify độc lập 100% khớp báo cáo (đọc lại
toàn bộ `CollectionController.php`, migration, `CollectionResource.php`,
`treeHelpers.ts`, tự chạy lại test — 13/13 backend, 46/46 regression, 23/23
frontend, `tsc` sạch). Phần logic core (nested-set move/reorder/delete-guard)
**giữ nguyên, không đổi gì ở đây**.

Sau khi xem screenshot form "Add root collection" thật, admin (user) phản hồi
4 điểm UX cần sửa trước khi merge — liệt kê chi tiết bên dưới. Đây là thay đổi
UI/form/nav, **không đụng vào thuật toán nested-set, không đụng
migration/vendor**.

## 1. Bỏ input "Name (Vietnamese)"

Xác nhận kỹ thuật (Claude đã kiểm tra): cờ `required: true` trên `Attribute`
(được set trong migration `2026_08_24_000000_ensure_collection_name_attribute.php`)
chỉ là metadata cho Lunar/Filament — **API của chúng ta không gọi validation
của Lunar**, `StoreCollectionRequest`/`UpdateCollectionRequest` tự định nghĩa
rule riêng. Nên bỏ ô nhập tiếng Việt hoàn toàn an toàn.

Cách làm — giữ API response shape cũ (để không phải sửa `treeHelpers.ts`,
`CollectionNodeRow.tsx` đang đọc `node.name.en`):

- Frontend: đổi form value từ `name: { en, vi }` thành **1 input duy nhất**
  (string). Khi submit, gửi cùng 1 giá trị cho cả `name[en]` và `name[vi]`.
  - `admin/src/features/collections/collectionSchema.ts`: đổi
    `CollectionFormValues.name` thành `string`; bỏ validation `name.vi`; sửa
    `buildCollectionFormData` để append `name[en]` = `name[vi]` = giá trị đó.
  - `admin/src/features/collections/CollectionFormModal.tsx`: bỏ hẳn input
    "Name (Vietnamese)", chỉ còn 1 input "Name".
  - `admin/src/features/collections/collectionSchema.test.ts`: cập nhật test
    theo shape mới.
- Backend: `StoreCollectionRequest`/`UpdateCollectionRequest` đổi rule
  `name` thành 1 string bắt buộc (`required|string|max:255`), bỏ
  `array:en,vi` và rule riêng cho `name.vi`.
  - `CollectionController::store()`/`update()`: lưu
    `new TranslatedText(['en' => $validated['name'], 'vi' => $validated['name']])`
    (mirror cùng giá trị vào cả 2 locale — để không phá field type
    `TranslatedText` đang yêu cầu, và không để trống `vi` phòng khi storefront
    sau này query theo locale vi).
  - `CollectionResource` giữ nguyên, vẫn trả `name: {en, vi}` (giờ luôn bằng
    nhau) — **không đổi** để tree UI không cần sửa gì khác.
- `backend/tests/Feature/Api/Admin/CollectionControllerTest.php`: sửa các
  test case đang gửi `name.en`/`name.vi` khác nhau — đổi payload thành 1
  field `name`, assert response trả về cả `en` và `vi` đều bằng giá trị đó.

## 2. Bỏ hẳn Thumbnail khỏi Module 5

Claude đã grep toàn bộ `frontend/` (storefront Next.js) và `backend/app`:
**không có nơi nào đang tiêu thụ Collection thumbnail** ngoài chính code vừa
viết ở Module 5. Tính năng này chưa có consumer thật — bỏ theo nguyên tắc
không làm việc chưa cần dùng tới. Nếu sau này storefront cần ảnh category,
làm lại lúc đó (Spatie media/`HasMedia` trait ở vendor Model không đổi, vẫn
sẵn sàng dùng lại bất cứ lúc nào).

Cách làm — xoá sạch phần thumbnail khỏi Module 5, không để lại dead code:

- `backend/app/Http/Controllers/Api/Admin/CollectionController.php`: xoá
  `attachPrimaryThumbnail()`, `clearPrimaryMarkers()`, toàn bộ nhánh xử lý
  `$request->hasFile('thumbnail')` / `remove_thumbnail` trong `store()` và
  `update()`, xoá `->with('thumbnail')` / `->load('thumbnail')` ở
  `index()`/`loadNode()` (không cần eager-load nữa).
- `backend/app/Http/Resources/Admin/CollectionResource.php`: xoá key
  `thumbnail` khỏi response.
- `backend/app/Http/Requests/Admin/StoreCollectionRequest.php`,
  `UpdateCollectionRequest.php`: xoá rule `thumbnail`, `remove_thumbnail`.
- Frontend: `collectionSchema.ts` xoá field `thumbnail`/`removeThumbnail` và
  validation liên quan; `CollectionFormModal.tsx` xoá toàn bộ khối UI
  thumbnail (preview, choose/replace, remove); `api.ts` xoá `thumbnail` khỏi
  type `CollectionNode`; `CollectionNodeRow.tsx` xoá phần hiển thị ảnh
  thumbnail compact trong tree row.
- Xoá/cập nhật mọi test đang cover thumbnail ở cả backend
  (`CollectionControllerTest.php`) và frontend (`collectionSchema.test.ts`,
  `api.test.ts`) — không để test tham chiếu tính năng đã xoá.

## 3. Icon "Collections" ở sidebar đang trùng Solutions

Icon hiện tại của Collections (`M5 5h5v5H5V5zm9 0h5v5h-5V5zM5 14h5v5H5v-5zm9 0h5v5h-5v-5z`
— lưới 2x2 ô vuông đặc) và Solutions (`M4 6a2 2 0...` — lưới 2x2 ô vuông bo
góc) nhìn gần như giống hệt nhau ở kích thước sidebar (20px). Đổi icon
Collections sang icon khác biệt rõ ràng — gợi ý: icon dạng cây phân cấp/thư
mục lồng nhau (folder-tree/sitemap) để gợi đúng bản chất "cây nested" của
Collection, khác hẳn 6 icon Catalogue còn lại.

## 4. Nav: "Collections" lồng vào trong "Collection Groups" (nested, có thể
   thu gọn/mở rộng)

Quyết định UX (đã chốt với user): "Collection Groups" là mục cha, "Collections"
là sub-item thụt vào bên trong, style nested `ul/li`, có dropdown/chevron để
show/hide (expand/collapse). Giữ nguyên tên gọi **"Collections"** (đúng thuật
ngữ chuẩn Shopify — Shopify không có khái niệm "Collection Group" tách biệt,
nên tên này không cần đổi khi đã có ngữ cảnh cha-con rõ ràng).

`admin/src/layouts/AppShell.tsx` hiện **hoàn toàn phẳng, chưa có cơ chế
nested/expand-collapse nào** — đây là component dùng chung cho mọi nav group
(Content + Catalogue), nên implement cẩn thận, chỉ áp dụng nested cho đúng 1
cặp Collection Groups/Collections, không đụng các item khác.

Thiết kế đề xuất:

- Thêm field optional `children?: NavItem[]` vào shape của 1 nav item. Chỉ
  item "Collection Groups" có `children: [{ to: '/collections', label:
  'Collections', icon: ... }]`.
- Item cha "Collection Groups" vẫn là `NavLink` bấm vào thì đi tới
  `/collection-groups` như cũ — **cộng thêm** 1 nút chevron riêng ở bên phải
  chỉ để toggle expand/collapse (không điều hướng).
- Khi expand: render `children` thành 1 danh sách con thụt lề (`pl-`), style
  nhỏ hơn item cha 1 chút, mỗi child vẫn là `NavLink` bình thường.
- State expand/collapse: local React state đơn giản trong `AppShell`
  (`useState`), **không cần** persist vào localStorage — giữ đơn giản.
- Default state: **expanded** (Collections là tính năng dùng thường xuyên,
  không nên ẩn mặc định).
- Nếu route hiện tại đang active là 1 trong các `children` (vd đang ở
  `/collections`) mà state đang collapsed, **tự động force-expand** để user
  không bị mất dấu vị trí hiện tại trong nav.

## 5. Sắp xếp lại thứ tự các mục trong nhóm "CATALOGUE"

Thứ tự hiện tại: Breeds, Product Types, Custom Fields, Brands, Collection
Groups, Collections, Solutions.

Đổi thành thứ tự theo đúng luồng phụ thuộc dữ liệu khi setup 1 sản phẩm mới
(cái nào là nền tảng/ít phụ thuộc thì lên trước):

1. **Product Types** — nền tảng, Custom Field và Product đều phụ thuộc vào nó.
2. **Custom Fields** — phụ thuộc Product Types.
3. **Brands** — độc lập, gán vào Product.
4. **Collection Groups** (cha) → **Collections** (con, nested theo mục 4 ở
   trên) — cây phân loại để duyệt/tổ chức sản phẩm.
5. **Breeds** — taxonomy riêng cho sản phẩm thú cưng.
6. **Solutions** — taxonomy theo vấn đề/nhu cầu, gán vào Product.

Chỉ đổi thứ tự trong mảng `items` của group "CATALOGUE" trong
`AppShell.tsx` — không đổi route path, không đổi bất kỳ URL nào.

## Không nằm trong scope follow-up này

- Không đổi thuật toán nested-set (move/reorder/make-root/cross-group move) —
  giữ nguyên 100% như bản đã verify.
- Không đổi delete guard.
- Không đổi cấu trúc bảng `lunar_collections`, không đụng vendor/migration đã
  có.
- Không áp dụng cơ chế nested nav cho bất kỳ cặp mục nào khác ngoài Collection
  Groups/Collections.
- Không thêm persistence (localStorage/cookie) cho trạng thái expand/collapse.

## Việc cần làm sau khi code xong

1. Chạy lại toàn bộ test đã có (backend `CollectionControllerTest` +
   regression Module 1-5, frontend `vitest` cho `features/collections`,
   `tsc --noEmit`) — báo cáo số liệu thật, không làm tròn/đoán.
2. Liệt kê chính xác file đã sửa (không chỉ liệt kê file liên quan
   Module 5 — nếu sửa thêm gì ở `AppShell.tsx` dùng chung, phải khai báo rõ
   để Claude review, vì file này ảnh hưởng toàn bộ sidebar).
3. Không tự ý thêm cơ chế/feature nào ngoài 5 mục trên.
