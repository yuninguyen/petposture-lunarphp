# Module 5 follow-up — round 2: sửa lại đúng ý "dropdown group" ở sidebar

Role continuity: bạn (ChatGPT) implement/debug/tự test; Claude chỉ verify rồi
làm final check + commit.

## Xin lỗi vì spec trước hiểu sai ý user

Ở file `prompt-for-chatgpt-module5-collection-followup.md`, mục 4 ("Nested
Collections vào trong Collection Groups") là **Claude hiểu sai** yêu cầu gốc
của user. User xác nhận lại: ý họ **không phải** nesting Collections vào
Collection Groups (user nói UI đó "nhìn rất xấu"), mà là **thêm nút
dropdown/chevron ở chính tiêu đề nhóm "CONTENT" và "CATALOGUE"** — bấm vào để
show/hide toàn bộ item bên trong nhóm đó, giống kiểu accordion section.

**Chỉ mục 4 (nested nav) là sai — mục 1, 2, 3, 5 giữ nguyên, đã làm đúng, giữ
y nguyên không đổi:**

- Mục 1 (bỏ input Vietnamese name) — giữ nguyên, đúng.
- Mục 2 (bỏ thumbnail) — giữ nguyên, đúng.
- Mục 3 (icon Collections mới, dạng sitemap) — giữ nguyên, đúng, **giữ y
  nguyên icon sitemap đã làm**, chỉ đổi vị trí hiển thị (xem bên dưới).
- Mục 5 (thứ tự Catalogue: Product Types → Custom Fields → Brands →
  Collection Groups → Collections → Breeds → Solutions) — **giữ nguyên thứ
  tự này**, chỉ đổi Collections từ "child lồng trong Collection Groups" trở
  lại thành **item ngang hàng bình thường** (không lồng), đứng đúng vị trí
  thứ 5 trong danh sách phẳng (ngay sau Collection Groups, trước Breeds).

## Việc cần sửa (revert phần nested + thêm đúng tính năng)

### 1. Revert: Collections không còn là child của Collection Groups

Trong `admin/src/layouts/AppShell.tsx`:

- Xoá field `children?: NavItem[]` khỏi interface `NavItem` (không dùng nữa).
- Xoá `children: [...]` khỏi item "Collection Groups".
- Đưa "Collections" trở lại thành 1 `NavItem` bình thường, đứng ngang hàng
  ngay sau "Collection Groups" trong mảng `items` của group CATALOGUE — style
  giống hệt các item khác (không thụt lề, không border-left, không icon nhỏ
  hơn). **Giữ nguyên icon sitemap** đã đổi ở mục 3 bản trước.
- Xoá toàn bộ state/logic riêng cho việc expand/collapse theo từng item
  (`expandedNavItems` keyed theo `item.to`, cái `useEffect` force-expand khi
  ở `/collections`, nút chevron cạnh "Collection Groups") — không cần nữa vì
  không còn nesting cấp item.

### 2. Thêm đúng tính năng: collapsible group header (CONTENT / CATALOGUE)

Đây là tính năng mới, đúng ý user:

- Mỗi `NavGroup` (hiện có 2 group: "CONTENT", "CATALOGUE") có thêm khả năng
  collapse/expand **toàn bộ nhóm** khi bấm vào chính dòng tiêu đề group (chữ
  "CONTENT"/"CATALOGUE" uppercase nhỏ hiện tại).
- Thêm 1 chevron/icon mũi tên cạnh tiêu đề group, xoay hướng theo trạng thái
  expand/collapse (giống affordance thường thấy ở accordion section, không
  cần đúng y hệt UI cũ đã revert ở mục 1 — làm mới cho phù hợp ở cấp group).
- Bấm vào cả dòng tiêu đề (không chỉ riêng icon) để toggle — vùng bấm nên đủ
  lớn, dễ bấm.
- Khi collapsed: ẩn toàn bộ `items` của group đó, chỉ còn dòng tiêu đề hiển
  thị.
- State: local React state trong `AppShell`, key theo group title/index
  (không phải theo item nữa) — `useState<Record<string, boolean>>`, mặc định
  **cả 2 group đều expanded**. Không dùng localStorage/cookie (giữ đơn giản
  như quyết định trước).
- Nếu route hiện tại (`location.pathname`) khớp với 1 item bất kỳ nằm trong
  1 group đang bị collapsed, tự động force-expand group đó khi mount/khi đổi
  route — để không bao giờ ẩn mất trang đang active khỏi sidebar.

### 3. i18n

Nếu cần label cho `aria-label` của nút toggle group, thêm key mới generic
(vd `sidebar.expand_group`/`sidebar.collapse_group`) vào cả
`admin/src/locales/en.json` và `vi.json` — không tái dùng key
`collections.expand`/`collections.collapse` cũ (key đó gắn với tính năng
nested vừa bị revert, nên xoá luôn nếu không còn chỗ nào dùng).

## Không nằm trong scope round 2 này

- Không đổi gì ở phần Collection backend (Controller/Requests/Resource) —
  round 1 đã đúng, giữ nguyên 100%.
- Không đổi thứ tự các item bên trong từng group (thứ tự đã đúng từ round 1).
- Không thêm nesting cấp item cho bất kỳ cặp menu nào.
- Không thêm persistence cho trạng thái collapse (cả cấp group lẫn cấp item).

## Việc cần làm sau khi code xong

1. Grep lại toàn bộ `expandedNavItems`, `hasChildren`, `NavItem.children` để
   xác nhận không còn sót logic nesting cũ trong `AppShell.tsx`.
2. Chạy `tsc --noEmit` và build production — báo kết quả thật.
3. Liệt kê chính xác file đã sửa (dự kiến chỉ `AppShell.tsx` +
   `en.json`/`vi.json` nếu có thêm key mới).
