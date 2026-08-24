# Module 6 — Product Phase 2 Followup Round 2: Media card layout (ảnh đầu full-width, ảnh sau nhỏ dạng lưới)

Role continuity: bạn (ChatGPT) implement/debug/tự test; Claude chỉ thảo luận
kiến trúc/phản biện + verify độc lập bằng cách đọc code thật + final check
trước khi commit — không tự tin vào báo cáo self-test, luôn chạy lại
`tsc -b`, `vitest`, `php artisan test` thật trước khi báo xong.

Bối cảnh: Followup round 1 (Media Library portal, Media card full-width
`grid-cols-1`, Pricing accordion inline) đã được Claude verify và approve.
Đây là 1 yêu cầu layout bổ sung riêng cho Product Media card, phát sinh sau
khi test `grid-cols-1` trên browser thật.

Chỉ đụng `admin/src/features/products/ProductFormPage.tsx` (component
`MediaTile` và container cha render list `media`). Không đụng
`media-library-modal.tsx`, không đụng Media card của Post/Breed/Solution
(các trang đó không có yêu cầu này).

---

## Vấn đề

Round 1 đã đổi Media card từ `grid-cols-2` sang `grid-cols-1` (mỗi ảnh full
width). User xem thử và muốn layout khác: **ảnh đầu tiên** (ảnh chính/featured
trong danh sách `media`, tức `media[0]`) giữ full-width như hiện tại, nhưng
**từ ảnh thứ 2 trở đi** hiển thị nhỏ lại theo dạng lưới 2-3 ảnh/hàng (dạng
gallery thumbnail bên dưới ảnh chính).

## Yêu cầu

- Trong `ProductFormPage.tsx`, Card "Media": tách phần render `media` array
  thành 2 nhóm:
  - `media[0]` (nếu tồn tại): render full-width như hiện tại (ảnh to + input
    Alt text + nút reorder/xóa).
  - `media.slice(1)` (nếu có): render trong 1 grid riêng bên dưới, `grid-cols-2
    sm:grid-cols-3` (2 ảnh/hàng ở màn hẹp, 3 ảnh/hàng ở màn rộng hơn — dùng
    đúng Tailwind breakpoint sẵn có trong file, không cần đổi breakpoint
    khác nếu team đã có convention riêng, kiểm tra file trước khi code).
  - Giữ nguyên `MediaTile` component (props, logic reorder/xóa/alt-change)
    cho cả 2 nhóm — không tạo component tile mới, chỉ đổi container/grid bao
    ngoài. `index`/`total` truyền vào `onMove` vẫn phải đúng theo vị trí thật
    trong mảng `media` gốc (không lệch index khi tách nhóm).
  - Nút "Browse" (thêm ảnh mới qua `MediaPicker`) giữ nguyên vị trí — luôn ở
    cuối, sau toàn bộ ảnh đã có (dù ảnh đó đang ở nhóm full-width hay nhóm
    lưới nhỏ).
- Khi `media.length === 1` (chỉ có ảnh đầu): không hiển thị grid rỗng bên
  dưới, chỉ có ảnh full-width + nút Browse.
- Khi `media.length === 0`: giữ nguyên hành vi hiện tại (không có tile nào,
  chỉ có nút Browse).
- Kéo/thả hoặc nút mũi tên reorder (←/→) hiện tại vẫn hoạt động bình thường
  qua ranh giới 2 nhóm (vd bấm → ở ảnh cuối nhóm full-width phải chuyển đúng
  sang vị trí đầu nhóm lưới nhỏ, và ngược lại) — vì cả 2 nhóm cùng thao tác
  trên 1 mảng `media` gốc qua `moveMedia(index, offset)` đã có sẵn, chỉ cần
  đảm bảo `index` truyền đúng, không cần đổi logic `moveMedia`.

## Test

- Thêm/update test cho `ProductFormPage` nếu có test file liên quan tới
  render Media card (kiểm tra ảnh đầu tiên nằm ngoài grid nhỏ, ảnh thứ 2 trở
  đi nằm trong grid nhỏ).
- Test bằng mắt trên dev server: thêm 3-4 ảnh vào 1 Product, xác nhận ảnh đầu
  to, các ảnh sau xếp lưới nhỏ, reorder (←/→) hoạt động đúng qua ranh giới 2
  nhóm, xóa ảnh không làm lệch layout.

## Sau khi xong

- Chạy `npx tsc -b` (admin), `npx vitest run src/features/products`.
- Gửi lại Claude review + tự verify bằng cách đọc code thật (không tin báo
  cáo self-test) trước khi commit/deploy.
