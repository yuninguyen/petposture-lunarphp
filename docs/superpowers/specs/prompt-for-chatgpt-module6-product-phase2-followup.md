# Module 6 — Product Phase 2 Followup: 3 fix sau khi review live

Role continuity: bạn (ChatGPT) implement/debug/tự test; Claude chỉ thảo luận
kiến trúc/phản biện + verify độc lập bằng cách đọc code thật + final check
trước khi commit — không tự tin vào báo cáo self-test, luôn chạy lại
`tsc -b`, `vitest`, `php artisan test` thật trước khi báo xong.

Bối cảnh: Phase 2 (Description TipTap, Slug, Media Library folder) đã được
Claude verify code-level xong, khớp báo cáo, test số liệu khớp — **được
approve merge**. 3 việc dưới đây là bug/feedback phát sinh khi test thật trên
browser sau khi merge, đều nằm trong phạm vi Product Phase 1+2
(`admin/src/features/products/`, `admin/src/components/ui/media-library-modal.tsx`,
`admin/src/layouts/AppShell.tsx`). Độc lập với nhau, làm thứ tự nào cũng được.

---

## 1. Media Library modal bị clip/cắt hình (bug thật, không phải thiếu data)

### Nguyên nhân đã xác định qua đọc code

`admin/src/layouts/AppShell.tsx` dòng ~188 có root container:

```tsx
<div className="min-h-screen flex bg-slate-50 overflow-hidden">
```

`MediaLibraryModal` (`admin/src/components/ui/media-library-modal.tsx`) render
`position: fixed` (`fixed inset-0 z-50 ...`) nhưng **không dùng React portal**
— nó nằm trực tiếp trong cây component, bị `overflow-hidden` của ancestor cắt
hình dù `fixed` về lý thuyết định vị theo viewport. Đây là quirk CSS đã biết
(`overflow: hidden` trên ancestor clip cả con `position: fixed` ở paint time).
Bug này có từ trước (dòng `overflow-hidden` không phải do Phase 2 đổi), chỉ
giờ mới lộ rõ vì modal Phase 2 rộng hơn hẳn (`max-w-6xl` ≈1152px so với bản cũ
`max-w-2xl` ≈672px), dễ đụng biên bị clip hơn ở màn hình thường.

Triệu chứng khớp: sidebar tối bên trái không bị dim/che, backdrop chỉ phủ
phần bên phải, tiêu đề modal bị cắt còn "...ct Image".

### Yêu cầu

- Sửa `MediaLibraryModal` để render qua `createPortal(..., document.body)`
  (dùng `react-dom`), thoát khỏi ancestor `overflow-hidden` của `AppShell`.
- **Không sửa `AppShell.tsx`** (không đổi `overflow-hidden` ở đó — có thể có
  lý do khác đang dựa vào nó, ví dụ sticky sidebar/scroll container).
- Test lại bằng mắt (dev server) ở ít nhất 1 màn hình laptop thường (~1366px)
  và 1 màn hình lớn hơn để chắc modal hiện đúng giữa màn hình, không bị lệch/
  clip.
- Nếu có test hiện tại cho `media-library-modal.test.ts` liên quan tới DOM
  structure (vd `container.querySelector`), kiểm tra không vỡ sau khi đổi
  sang portal (RTL vẫn query được qua `screen`/`document.body` bình thường).

---

## 2. Media card trong Product form: đổi layout ảnh từ 2 cột sang full-width

### Hiện tại

`admin/src/features/products/ProductFormPage.tsx`, trong `Card` "Media":

```tsx
<div className="mb-5 grid grid-cols-2 gap-4">
```

Mỗi tile ảnh (ảnh + input Alt text + nút reorder/xóa) đang chiếm nửa hàng
(tỉ lệ 6:6 nếu tính theo grid 12 cột).

### Yêu cầu

- Đổi `grid-cols-2` → `grid-cols-1` để mỗi tile chiếm full-width (12:12), ảnh
  + ô Alt text hiển thị to hơn, dễ đọc/sửa hơn.
- Không đổi gì khác trong `MediaTile` (component, props, logic reorder/xóa/
  alt-change giữ nguyên) — chỉ đổi class grid của container cha.

---

## 3. Pricing card: thay popup edit bằng accordion inline (không chevron)

### Hiện tại

`admin/src/features/products/ProductFormPage.tsx`, component `SinglePricing`:
bấm nút "Edit" → `setEditingVariant(variant)` → mở `VariantEditModal`
(popup riêng, import từ `./VariantEditModal`) để sửa giá/SKU/thuộc tính biến
thể.

### Yêu cầu

- Bỏ hành vi mở `VariantEditModal` dạng popup cho luồng sửa giá ở
  `SinglePricing` (sản phẩm không có variants, `!product.has_variants`).
- Thay bằng **accordion inline**: bấm "Edit" (hoặc cả header card) toggle một
  state `expanded` cục bộ, hiện/ẩn ngay form sửa giá (nội dung hiện đang nằm
  trong `VariantEditModal`) trực tiếp bên dưới dòng tóm tắt giá, trong cùng
  `Card`, không bật modal/dialog riêng.
- **Không hiện icon chevron/mũi tên** báo hiệu trạng thái đóng/mở — chỉ dựa
  vào text nút (vd đổi label "Edit" ↔ "Done"/"Close" khi toggle, tuỳ bạn chọn
  cho tự nhiên) hoặc để nguyên "Edit" cũng được, miễn không thêm icon mũi tên.
- Cân nhắc: `Variants` (nhiều biến thể, `product.has_variants === true`) có
  đang dùng chung `VariantEditModal` không — nếu có, **giữ nguyên** popup cho
  case nhiều variants (không nằm trong yêu cầu này), chỉ đổi riêng
  `SinglePricing`. Xác nhận lại thực tế trước khi code, đừng giả định.
- Nếu tách phần form sửa giá ra component riêng để dùng chung giữa
  accordion-inline và `VariantEditModal` (tránh trùng code), được khuyến
  khích nhưng không bắt buộc — tuỳ bạn đánh giá độ phức tạp.

---

## Sau khi xong (cả 3 việc)

- Chạy `npx tsc -b` (admin), `npx vitest run src/features/products
  src/components/ui` (và bất kỳ test nào chạm `AppShell`/`VariantEditModal`).
- Test bằng mắt trên dev server: mở Media Library (xem không còn bị clip),
  xem Media card layout mới, xem Pricing accordion mở/đóng đúng, không có
  chevron.
- Gửi lại Claude review + tự verify bằng cách đọc code thật (không tin báo
  cáo self-test) trước khi commit/deploy.
