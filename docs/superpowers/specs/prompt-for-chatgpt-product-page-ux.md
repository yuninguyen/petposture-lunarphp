# Product Page (Filament) — Tái tổ chức UI/UX

**Lưu ý quan trọng: KHÔNG liên quan Module 5 (Collection, admin mới React).** Đây
là yêu cầu riêng, trên hệ thống Filament cũ (`localhost:8000/admin`), PHP/
Blade/Livewire — khác hoàn toàn công nghệ với `admin/` (Vite/React). Đừng lẫn
2 việc, đừng động vào `admin/src/` cho việc này.

## Vấn đề

Trang tạo/sửa Product hiện có **11 tab** (sub-navigation của Filament):
Basic Information, Availability, Media, Pricing, Product Identifiers,
Inventory, Shipping, Variants, URLs, Collections, Product Associations.

User (admin thực tế dùng hàng ngày) phản hồi: quá rối, khó hiểu nên điền gì ở
đâu — cụ thể phàn nàn "URLs (Slug đường dẫn)" bị tách tab riêng dù nó nên đi
cùng thông tin cơ bản của sản phẩm.

## Vị trí code (đọc trước khi sửa)

- App override: `backend/app/Filament/Resources/ProductResource.php`
- Vendor gốc (Lunar): `backend/vendor/lunarphp/lunar/src/Filament/Resources/ProductResource.php`
  và `backend/vendor/lunarphp/lunar/src/Filament/Resources/ProductResource/Pages/*.php`
  (`EditProduct`, `ManageProductAvailability`, `ManageProductMedia`,
  `ManageProductPricing`, `ManageProductIdentifiers`, `ManageProductInventory`,
  `ManageProductShipping`, `ManageProductVariants`, `ManageProductUrls`,
  `ManageProductCollections`, `ManageProductAssociations`)
- Một số tab (Pricing/Identifiers/Inventory/Shipping) chỉ hiện khi sản phẩm có
  **đúng 1 variant** — đọc logic `getDefaultSubNavigation()` để hiểu điều kiện
  ẩn/hiện trước khi gộp bất kỳ tab nào.

**Bắt buộc: sửa theo pattern override đã dùng cho Breeds/Solutions trước đây
— tạo class con kế thừa page/resource của vendor, KHÔNG sửa trực tiếp file
trong `vendor/`.** Đọc lại cách các resource app đã override Breeds/Solutions
để làm nhất quán.

## Đề xuất nhóm lại tab (khởi điểm — cần bạn xác nhận khả thi trước khi code)

| Nhóm mới | Gồm nội dung tab nào hiện tại | Lý do |
|---|---|---|
| **Product Info** (đổi tên "Basic Information") | Basic Information (Brand, Product Type, Tags, Technical Specs, Custom Fields) + **URLs** (slug) + **Collections** (category) | Đây đều là thông tin khai báo sản phẩm, điền 1 lần lúc tạo, không cần tách 3 tab riêng |
| **Variants & Pricing** | Variants + (Pricing/Identifiers/Inventory/Shipping nếu 1 variant) | Luồng tự nhiên: chọn variant xong mới tới giá/tồn kho/vận chuyển |
| **Media** | Media | Thao tác khác hẳn (upload ảnh), giữ riêng |
| **Availability** | Availability | Cấu hình nâng cao, ít sửa — để cuối |
| **Associations** | Product Associations | Ít dùng nhất — để cuối |

## Việc cần làm trước khi code (bắt buộc)

1. Đọc kỹ `getDefaultSubNavigation()` và từng Page class liệt kê ở trên để
   xác nhận: gộp nhiều Section/RelationManager vào 1 trang Filament có khả thi
   kỹ thuật không (đặc biệt điều kiện ẩn/hiện theo số lượng variant).
2. **Trình bày lại cấu trúc tab cụ thể (bao nhiêu tab, tên gì, tab nào chứa
   Section/RelationManager nào) để Claude/user duyệt trước khi bắt đầu code**
   — đây là thay đổi UX ảnh hưởng thao tác admin hàng ngày, không tự ý
   triển khai thẳng theo bảng đề xuất ở trên nếu phát hiện vướng kỹ thuật.
3. Giữ nguyên toàn bộ logic nghiệp vụ (validation, save actions, relation
   managers) — chỉ tổ chức lại layout/nhóm hiển thị, không đổi hành vi lưu dữ
   liệu.
4. Không đổi bất kỳ route/URL admin nào đang được dùng (nếu có link/bookmark
   cũ trỏ tới `/products/{id}/urls` chẳng hạn, cần giữ redirect hoặc xác nhận
   không ai phụ thuộc route đó).
