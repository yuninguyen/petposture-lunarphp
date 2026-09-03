# PLAN: Di chuyển chức năng Breeds

## 1. Bối cảnh
Người dùng yêu cầu di chuyển toàn bộ chức năng quản lý "Breeds" từ hệ thống cũ (localhost:8000) sang hệ thống admin mới (localhost:5173). Giao diện mới cần tuân thủ nghiêm ngặt chuẩn UI/UX mới (`/ui-ux-pro-max`). Ngoài ra, cần tạo một nhóm "Catalogue" trên sidebar và đưa "Breeds" vào đó.

## 2. Phân tích Yêu cầu
- **Sidebar**: Tạo group `Catalogue`.
- **Chức năng**:
  - Danh sách Breeds (Table/Grid) với phân trang, tìm kiếm.
  - Tạo mới Breed.
  - Chỉnh sửa Breed.
  - Xóa Breed (và xác nhận xóa).
- **UI/UX**: Đồng bộ hoàn toàn với style của admin mới (sử dụng TailwindCSS, chuẩn màu sắc, các component đã có như Button, Input, Table, Modal).
- **Đa ngôn ngữ (i18n)**: Cập nhật `en.json` và `vi.json` cho phần Breeds và Catalogue.

## 3. Các bước triển khai (Task Breakdown)

### Phase 1: Khởi tạo và Cấu hình (Setup)
- [ ] Cập nhật file ngôn ngữ (`en.json` và `vi.json`) bổ sung key cho nhóm "Catalogue" và "Breeds" (tiêu đề, label, thông báo lỗi).
- [ ] Chỉnh sửa component Sidebar: thêm nhóm "Catalogue" và link tới trang Breeds.

### Phase 2: Xây dựng giao diện (UI Implementation)
- [ ] Tạo thư mục `admin/src/features/breeds`.
- [ ] Xây dựng trang `BreedsListPage`:
  - Lưới hiển thị danh sách (Table).
  - Thanh công cụ: Nút "Thêm mới", ô Tìm kiếm.
  - Tích hợp chuẩn UI mới (padding, border, màu sắc).
- [ ] Xây dựng trang `BreedFormPage` (cho Create/Edit):
  - Form nhập liệu: Tên, Slug, Mô tả, Hình ảnh (nếu có).
  - Sử dụng chung style form với các form hiện tại (PageFormPage).

### Phase 3: Tích hợp API và Logic
- [ ] Viết các API services cho Breeds (lấy danh sách, lấy chi tiết, tạo, cập nhật, xóa).
- [ ] Tích hợp React Query để quản lý state và fetching data.
- [ ] Gắn các handle (onSubmit, onDelete) vào UI.

### Phase 4: Kiểm thử và Hoàn thiện (QA & Polish)
- [ ] Kiểm tra responsive trên các thiết bị.
- [ ] Đảm bảo Dark mode/Light mode hiển thị tốt.
- [ ] Xác nhận các hiệu ứng hover, loading đúng chuẩn `/ui-ux-pro-max`.

## 4. Phân công (Agent Assignments)
- **frontend-specialist**: Chịu trách nhiệm thực hiện các Phase 1, 2, 3 và 4. Đảm bảo tuân thủ thiết kế UI/UX mới.

## 5. Câu hỏi mở (Open Questions)
- Breeds có những thuộc tính nào cụ thể (Name, Slug, Image, Description, Attributes...)? Trả lời: Thuộc tính hiển thị ở Breeds Lists bao gồm: 
- Các cột dữ liệu: Name |Slug | Body Type | Products | Posts | icon View hiển thị modal hay là box chi tiết Breed | dấu ba chấm action bọc edit và delete bên trong như những page khác.
- Có cần chức năng Bulk Delete cho Breeds không? Trả lời: Có xây Bulk Delete
- Khi vào chi tiết breed cần hiển thị gì? Trả lời:
    - Name
    - Slug
    - Body Type
    - Description
    - Thumbnail là ảnh đại diện nhỉ (Khi upload ảnh đại diện thì ngoài frontend store cũng sẽ hiển thị ảnh đó, cần thêm API)
    - Alt Text (nếu có)
    - SEO Title
    - SEO Description
    - SEO Keywords
