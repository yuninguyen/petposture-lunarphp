# PageSpeed accessibility follow-up — brief cho Codex (2026-09-01)

Context: Performance đã được cải thiện phiên trước (fetchpriority hero image, legacy JS polyfill giảm, ảnh sản phẩm oversized đã fix, contrast của 1 token `gray-600` đã fix). Chạy lại PageSpeed Insights mobile sau các fix đó: **Accessibility vẫn 96/100**, còn đúng 1 nhóm lỗi contrast khác — không phải cùng nguyên nhân với `gray-600` đã fix.

## Đã audit & xác định root cause

`frontend/components/HomePage.tsx`, function `BreedBanners()` (khoảng dòng 718-725):

```tsx
<span style={{
  display: 'inline-flex', alignItems: 'center', gap: 6,
  fontFamily: F.nav, fontSize: 12, fontWeight: 800,
  color: C.secondary, letterSpacing: '0.08em',
  textTransform: 'uppercase',
}}>
  Explore →
</span>
```

`C.secondary` (`frontend/lib/uiTheme.ts`) = `#df8448` (cam) dùng làm **màu chữ**, đặt trên nền `C.grayLight` = `#f4f5f6`. Tỷ lệ tương phản ước tính ~2.45:1 — không đạt ngưỡng WCAG AA (4.5:1 cho text thường, 3:1 cho text lớn ≥18px/bold ≥14px — text này 12px nên vẫn cần 4.5:1).

**Quan trọng — codebase đã có sẵn token đúng cho đúng tình huống này:**

```ts
// uiTheme.ts
// Text-only accessible orange (WCAG AA, 6.63:1) — for eyebrow labels/prices
// on light backgrounds. Not for hover backgrounds (use secondaryTextHover).
rust: '#8f4a1f',
```

Đây chính xác là use-case "eyebrow label trên nền sáng" mà comment mô tả — chỉ là chỗ này (và có thể vài chỗ khác) đang dùng nhầm `C.secondary` thay vì `C.rust`.

## Việc cần làm

1. Đổi `color: C.secondary` → `color: C.rust` cho `<span>Explore →</span>` trong `BreedBanners()` (`HomePage.tsx`).
2. **Audit toàn site** các chỗ khác dùng `color: C.secondary` (hoặc `text-[#df8448]` / class Tailwind tương đương nếu có) làm màu **chữ** (không phải background/border) trên nền sáng — dùng công cụ tương phản (WebAIM contrast checker hoặc tính tay theo công thức WCAG) để xác nhận từng chỗ có thực sự fail không trước khi đổi, đừng đổi hàng loạt không kiểm tra (một số chỗ `C.secondary` có thể đang dùng làm background hoặc trên nền tối — không cần đổi, đổi nhầm sẽ làm sai màu brand ở chỗ đúng).
3. Không đổi `C.secondary` chính nó (giữ nguyên cho background/CTA button/hover) — chỉ đổi các usage làm **text color trên nền sáng** sang `C.rust`.
4. Sau khi sửa, build (`npm run build` / `tsc --noEmit`) sạch, rồi báo lại kết quả để deploy — không tự deploy production (deploy do Claude/user làm sau khi review, theo quy trình đã dùng suốt dự án này).

## Không cần làm

- Không đụng `C.secondary` giá trị gốc, không đổi màu brand tổng thể.
- Không cần chạy lại PageSpeed thật (không có quyền truy cập) — chỉ cần đảm bảo tương phản đạt ngưỡng AA bằng tính toán/tool kiểm tra offline.
- Không sửa Performance/LCP thêm (đã ổn định phiên trước, không phải phạm vi brief này).
