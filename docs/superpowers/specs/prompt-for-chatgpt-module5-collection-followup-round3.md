# Module 5 follow-up — round 3: Collections là sub-category của Collection Groups (không toggle riêng)

Role continuity: bạn (ChatGPT) implement/debug/tự test; Claude chỉ verify rồi
làm final check + commit.

## Claude lại hiểu sai ở round 2 — xin lỗi lần nữa

Round 2 đã làm đúng 1 việc quan trọng: thêm accordion collapse/expand cho
tiêu đề nhóm **CONTENT** và **CATALOGUE** — phần này **giữ nguyên 100%,
không đổi gì**, đã đúng ý user.

Nhưng round 2 cũng revert Collections về thành item ngang hàng hoàn toàn với
Collection Groups — đây là **hiểu sai**. User xác nhận lại: Collections
**phải là sub-category (con) của Collection Groups**, hiển thị thụt lề bên
dưới, giống round 1. Điểm user chê "xấu" ở round 1 **không phải** là việc
thụt lề/nesting, mà cụ thể là **cái nút chevron riêng nằm cạnh Collection
Groups** để ẩn/hiện chỉ mỗi Collections — cái nút đó thừa và xấu.

Tóm lại, giải pháp đúng lần này là **kết hợp cả 2 round trước**:

- Giữ y nguyên accordion cấp group (CONTENT/CATALOGUE) từ round 2 — không
  đổi.
- Đưa Collections trở lại làm sub-item thụt lề dưới Collection Groups như
  round 1 — **nhưng bỏ hẳn nút chevron/toggle riêng cho cặp này**. Collections
  luôn hiển thị (không có trạng thái ẩn/hiện riêng) mỗi khi nhóm CATALOGUE
  đang expanded và Collection Groups item được render.

## Việc cần sửa trong `admin/src/layouts/AppShell.tsx`

File hiện tại (đã đọc lại, post-round-2) có cấu trúc phẳng:

```tsx
interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}
```

và `NAV_GROUPS[1].items` (CATALOGUE) là 1 mảng phẳng 7 item, "Collection
Groups" và "Collections" đứng ngang hàng kế nhau (vị trí 4 và 5).

Cần sửa:

1. Thêm lại field optional vào `NavItem`:
   ```tsx
   interface NavItem {
     to: string;
     label: string;
     icon: ReactNode;
     children?: NavItem[];
   }
   ```
2. Gộp "Collections" vào làm `children` của "Collection Groups" trong mảng
   `items` của group CATALOGUE — xoá "Collections" khỏi vị trí đứng riêng,
   đặt nó vào `children: [{ to: '/collections', label: ..., icon: ... }]`
   của item "Collection Groups". **Giữ nguyên icon sitemap** hiện có của
   Collections, giữ nguyên label "Collections", giữ nguyên `to: '/collections'`.
3. Trong phần render (`nav.map` / `group.items.map`), khi 1 item có
   `children`:
   - Render item cha ("Collection Groups") như 1 `NavLink` bình thường,
     bấm vào đi tới `/collection-groups` — **không thêm bất kỳ nút
     chevron/toggle nào cạnh nó**.
   - Ngay sau đó, render danh sách `children` — mỗi child là 1 `NavLink`
     bình thường, thụt lề nhẹ (vd `ml-4` hoặc tương đương, tuỳ ý làm cho
     đẹp mắt hơn round 1 — round 1 dùng `ml-5 border-l pl-2`, có thể giữ
     nguyên hoặc tinh chỉnh nhẹ cho gọn, miễn là rõ ràng là "con" của mục
     phía trên nhưng không rối mắt).
   - **Không có state, không có `useState`/`useEffect` riêng cho việc
     ẩn/hiện children** — children luôn render cùng lúc với parent, không
     có logic collapse ở cấp độ này. Đây là điểm khác biệt quan trọng với
     round 1 (round 1 có thêm 1 nút chevron + state `expandedNavItems` để
     ẩn/hiện riêng Collections — **không làm lại phần đó**).
4. Accordion cấp group (CONTENT/CATALOGUE, dùng `expandedNavGroups`,
   `activeNavGroupKey`, nút chevron ở tiêu đề group) **giữ nguyên toàn bộ,
   không sửa gì** — khi 1 group bị collapse, toàn bộ items (kể cả Collection
   Groups và children Collections của nó) đều ẩn theo, đó là hành vi đúng
   và mong muốn.
5. Route active detection (`activeNavGroupKey`, tự động force-expand group
   khi đang ở route con): logic hiện tại là
   `group.items.some((item) => location.pathname === item.to || location.pathname.startsWith(\`${item.to}/\`))`.
   Nếu user đang ở `/collections`, `location.pathname` sẽ không khớp `to`
   của bất kỳ item cấp 1 nào trong CATALOGUE nữa (vì `/collections` giờ chỉ
   nằm trong `children` của "Collection Groups", không phải `to` ở cấp 1)
   — **phải sửa để check cả `item.children` khi tính active group**, nếu
   không nhóm CATALOGUE sẽ không tự mở khi đang ở trang Collections.

## Không nằm trong scope round 3 này

- Không đổi accordion cấp group (CONTENT/CATALOGUE) — giữ nguyên logic,
  giữ nguyên style, giữ nguyên default-expanded, giữ nguyên aria-label.
- Không thêm lại bất kỳ nút chevron/toggle riêng nào cho cặp Collection
  Groups/Collections.
- Không đổi Collection backend/migration/routes/nested-set/delete-guard.
- Không đổi thứ tự các item khác trong CATALOGUE.
- Không thêm persistence (localStorage/cookie) cho bất kỳ trạng thái nào.

## Việc cần làm sau khi code xong

1. Grep `expandedNavItems`, `hasChildren` cũ (nếu còn sót từ round 1) để
   chắc chắn không có state/toggle riêng nào bị thêm nhầm lại cho cặp
   Collection Groups/Collections.
2. Test thủ công (hoặc mô tả rõ trong báo cáo): vào thẳng `/collections`,
   xác nhận nhóm CATALOGUE tự động expanded và cả "Collection Groups" lẫn
   "Collections" đều hiển thị đúng, không bị ẩn.
3. Chạy `tsc --noEmit` và build production — báo kết quả thật.
4. Liệt kê chính xác file đã sửa (dự kiến chỉ `AppShell.tsx`).
