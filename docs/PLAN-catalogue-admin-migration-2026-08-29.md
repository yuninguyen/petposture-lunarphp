# Catalogue admin migration — brief cho ChatGPT (2026-08-29)

Context: đang migrate dần các resource Catalogue từ Filament admin cũ (port 8000, dựa trên package LunarPHP) sang admin mới Vite/React (`admin/`, port 5173). Brief này chỉ gồm 2 việc đã được duyệt để làm ngay. Không mở rộng scope ngoài 2 mục này (các mục khác — pricing theo tier, availability schedule, media riêng cho variant, banner collection, custom fields mở rộng, attribute groups, product options shared library — đã cố ý gác lại, không cần đụng tới).

## Việc 1: Product Types — thêm Edit + Delete

**Hiện trạng:**
- Backend: `backend/routes/api.php` (admin group) chỉ có `GET /admin/product-types` và `POST /admin/product-types`. Không có `show`, `update`, `destroy`.
- Controller liên quan: `ProductTypeController` (namespace `App\Http\Controllers\Api\Admin`) — chỉ có `index` và `store`.
- Frontend: `admin/src/features/product-types/ProductTypesPage.tsx` và `api.ts` — chỉ có list + create modal. Không có trang/route edit, không có action xoá.

**Cần làm:**
1. Backend: thêm route `GET|PUT /admin/product-types/{id}` và `DELETE /admin/product-types/{id}` vào `backend/routes/api.php`, thêm method `show`, `update`, `destroy` vào `ProductTypeController` (theo pattern các resource admin khác đã có, ví dụ `CollectionGroupController` hoặc `BrandController` để tham khảo validate/response shape).
2. Cân nhắc ràng buộc khi xoá: nếu Product Type đang được gán cho sản phẩm nào đó thì có nên chặn xoá không (theo pattern `CollectionController` đã chặn xoá collection có con/sản phẩm — xem cách xử lý ở đó).
3. Frontend: thêm trang edit (hoặc modal edit tái dùng form create) trong `admin/src/features/product-types/`, thêm nút Edit/Delete trên `ProductTypesPage.tsx`, cập nhật `api.ts` thêm `updateProductType`/`deleteProductType`.
4. Không cần làm tab mapping attribute phức tạp như Filament — chỉ cần đổi tên/label và xoá.

**Không cần làm:** UI quản lý attribute-mapping đầy đủ như Filament's `AttributeSelector` — việc mapping attribute cho product type hiện đã đi qua chiều ngược (Custom Fields feature), giữ nguyên.

## Việc 2: Collections — gán/sắp xếp sản phẩm từ phía trang Collection

**Hiện trạng:**
- Hiện chỉ gán được Collection cho Product từ phía form Product (`admin/src/features/products/`, field `collections`). Không có UI nào ở phía Collection để xem/gán/sắp xếp danh sách sản phẩm thuộc về nó.
- Filament tương ứng: `ManageCollectionProducts` (vendor Lunar, `backend/vendor/lunarphp/lunar/src/Filament/Resources/CollectionResource/Pages/`) — cho phép chọn sản phẩm, kéo-thả sắp xếp thứ tự trong collection.
- Model quan hệ: Lunar collections có pivot `lunar_collection_product` lưu `position` để sắp xếp.

**Cần làm:**
1. Backend: thêm endpoint cho phép:
   - Lấy danh sách sản phẩm đang thuộc 1 collection (kèm thứ tự hiện tại).
   - Gán thêm / gỡ sản phẩm khỏi collection.
   - Reorder (đổi `position`) sản phẩm trong collection — tham khảo cách `CollectionController` đã làm reorder cho collection tree (`/admin/collections/{id}/reorder`) để giữ pattern nhất quán.
   - Đặt route dạng `/admin/collections/{id}/products` (GET để list, POST/PUT để gán+reorder) — action cụ thể do ChatGPT quyết định miễn giữ REST convention đã dùng trong file này.
2. Frontend: thêm 1 view/tab trong trang chi tiết Collection (`admin/src/features/collections/`) để xem danh sách sản phẩm, thêm/gỡ sản phẩm (search-select), kéo-thả hoặc nút up/down để sắp xếp.

**Không cần làm:** banner/media image cho collection, availability/scheduling, URL/redirect management — các mục này đã gác lại ở round sau, không đụng trong lần này.

## Sau khi code xong

Báo lại để Claude (session này) làm final review trước khi commit/deploy, theo role split đã chốt trước đó (ChatGPT code, Claude chỉ review final-mile).

## Kết quả review 2026-08-29 (Claude)

Code Việc 1 + Việc 2 đúng scope, đã verify bằng test thật:
- Frontend: 23/23 test pass.
- Backend PHPUnit toàn bộ: 356 passed, 3 failed — cả 3 fail thuộc code không liên quan (blog category slug, Laravel `ExampleTest` mặc định, `oldPrice` field trong `ProductCatalogApiTest` chưa từng implement) — pre-existing, không phải regression.

Claude đã tự sửa 2 lỗi nhỏ trong lúc review (đã confirm với user, đã re-test pass):
1. Resolve conflict `git stash pop` chưa xử lý trong `backend/database/migrations/2026_04_18_084546_create_cart_items_table.php` (chọn bản `constrained('carts')`/`constrained('products')` tường minh — 2 bản tương đương chức năng).
2. `CollectionController::syncProducts` thiếu `use Illuminate\Http\Request;` — gây crash 500 thay vì trả 422 khi validate `product_ids` fail. Đã thêm import.

**Còn 1 việc cần ChatGPT làm trước khi commit:**
- `admin/src/features/collections/CollectionProductsPanel.tsx` và nút "Products" mới thêm trong `CollectionNodeRow.tsx` đang **hardcode toàn bộ text tiếng Anh**, không dùng `t()`/react-i18next như phần còn lại của admin (xem cách `CollectionNodeRow.tsx` dùng `t('collections.drag_handle', ...)` để tham khảo pattern). Cần thêm key vào `admin/src/locales/en.json` và `vi.json` (theo pattern `product_types.*` đã làm đúng ở Việc 1) cho toàn bộ text trong panel: "Manage products", "Add products", "Search products…", "Assigned products (N)", "No products assigned.", "Move product up/down", "Remove", "Cancel", "Save products", toast "Collection products updated." / "Could not update collection products.", và nút "Products" trên row.

Sau khi thêm i18n xong, báo lại để commit.
