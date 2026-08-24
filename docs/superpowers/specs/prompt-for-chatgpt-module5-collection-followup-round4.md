# Module 5 follow-up — round 4: bug fix — nút toggle CATALOGUE bị khóa cứng, không collapse được

Role continuity: bạn (ChatGPT) implement/debug/tự test; Claude chỉ verify rồi
làm final check + commit.

## Bug report từ user

User xác nhận: nút chevron toggle ở tiêu đề nhóm **CONTENT** bấm show/hide
bình thường, nhưng nhóm **CATALOGUE** thì **không bấm collapse được** — bấm
vào không có phản ứng (không ẩn được các item bên trong).

## Root cause (đã xác định, không cần điều tra lại)

Trong `admin/src/layouts/AppShell.tsx`, hàm `onClick` của nút toggle group
(trong đoạn `NAV_GROUPS.map`) hiện có logic:

```tsx
onClick={() => setExpandedNavGroups((current) => ({
  ...current,
  [groupKey]: groupKey === activeNavGroupKey ? true : !expanded,
}))}
```

Khi `groupKey === activeNavGroupKey` (tức group đang chứa route hiện tại),
state bị ép cứng về `true` mỗi lần bấm — không bao giờ toggle sang `false`
được, bất kể bấm bao nhiêu lần. Vì user hiện đang đứng ở 1 trang thuộc
CATALOGUE (ví dụ `/collection-groups`, `/breeds`, `/collections`...),
`activeNavGroupKey` luôn là chỉ số của group CATALOGUE trong lúc đó, nên nút
chevron của CATALOGUE bị khóa vĩnh viễn ở trạng thái expanded. CONTENT không
phải group active nên toggle bình thường — đúng như user mô tả (Content
được, Catalogue không được).

Đoạn `groupKey === activeNavGroupKey ? true : ...` là logic **thừa, không có
trong spec round 2/3** — round 2/3 chỉ yêu cầu 1 cơ chế duy nhất để tránh ẩn
mất route đang active: `useEffect` tự động force-expand group chứa route
active **khi mount hoặc khi đổi route** (đoạn code này vẫn đúng, giữ nguyên,
không đụng vào):

```tsx
useEffect(() => {
  if (activeNavGroupKey === '-1') return;
  setExpandedNavGroups((current) => (
    current[activeNavGroupKey] ? current : { ...current, [activeNavGroupKey]: true }
  ));
}, [activeNavGroupKey]);
```

Không có yêu cầu nào trong spec cũ về việc khóa cứng, cấm user tự tay collapse
group đang active bằng cách bấm nút. Đây là bug do code tự thêm guard ngoài
scope.

## Việc cần sửa

Trong `admin/src/layouts/AppShell.tsx`, sửa duy nhất đoạn `onClick` của nút
toggle group, bỏ điều kiện `groupKey === activeNavGroupKey ? true : ...`, cho
toggle bình thường giống hệt cách CONTENT đang hoạt động đúng:

```tsx
onClick={() => setExpandedNavGroups((current) => ({
  ...current,
  [groupKey]: !expanded,
}))}
```

`useEffect` force-expand khi đổi route vẫn giữ nguyên — cơ chế đó đã đủ để
đảm bảo khi user **điều hướng tới** 1 trang trong group đang bị collapsed thì
group đó tự mở ra. Việc user **chủ động bấm collapse** group đang active (kể
cả khi đang đứng ở 1 trang trong group đó) là hành vi hợp lệ, không cần ngăn.

## Không nằm trong scope round 4 này

- Không đổi bất kỳ logic nào khác trong `AppShell.tsx` (nesting Collections
  dưới Collection Groups, `activeNavGroupKey` computation, i18n keys...) —
  toàn bộ phần đó đã đúng từ round 3, giữ nguyên 100%.
- Không thêm persistence (localStorage/cookie) cho state collapse.
- Không đổi thứ tự hay nội dung item trong 2 group.

## Việc cần làm sau khi code xong

1. Test thủ công: đứng ở 1 trang bất kỳ thuộc CATALOGUE (vd `/breeds`), bấm
   chevron CATALOGUE để collapse — xác nhận collapse được, các item (kể cả
   Collection Groups/Collections) ẩn đi. Bấm lại để expand — xác nhận mở lại
   bình thường. Lặp lại test tương tự cho CONTENT để đảm bảo không bị ảnh
   hưởng ngược.
2. Test lại useEffect vẫn hoạt động: collapse CATALOGUE, sau đó điều hướng
   (qua URL trực tiếp hoặc reload) tới 1 route thuộc CATALOGUE — xác nhận
   CATALOGUE tự động mở lại (không bị kẹt ở trạng thái ẩn mất route active).
3. Chạy `tsc --noEmit` và build production — báo kết quả thật.
4. Liệt kê chính xác file đã sửa (dự kiến chỉ `AppShell.tsx`, 1 dòng thay
   đổi trong `onClick`).
