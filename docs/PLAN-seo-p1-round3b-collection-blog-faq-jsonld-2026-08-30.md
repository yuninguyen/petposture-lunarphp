# SEO P1 round 3b/4 — CollectionPage + BlogPosting + FAQPage JSON-LD — brief cho ChatGPT (2026-08-30)

Context: Round 1 (`58302ea`), Round 2 (`542f957`), Round 3a (`31e4ce8`) đã merge. Round 3a đã render Product JSON-LD + BreadcrumbList trên trang sản phẩm. **Round này (3b/4) làm nốt 3 schema type còn lại trong backlog P1.7**: CollectionPage cho `/shop` + `/shop/breeds/[slug]` + `/shop/solutions/[slug]`, BlogPosting cho `/blog/[slug]`, FAQPage cho `/faqs`.

## Quy tắc ownership — giữ nguyên như Round 3a

`docs/SEO-TECHNICAL-CONTRACT-v1.1.md` §7A: domain facts (giá, rating, tồn kho...) do Laravel tính; Next.js chỉ compose JSON-LD từ dữ liệu đã có sẵn ở response, **không tự tính lại** gì mới. Tất cả JSON-LD trong round này đều tự build ở frontend (khác Round 3a — Product JSON-LD build sẵn ở backend), nhưng chỉ được lấy field có sẵn từ API response hiện tại (tên, mô tả, ngày tạo, danh sách item...), không thêm field mới cần backend tính toán.

Copy đúng pattern render đã dùng ở Round 3a: `<script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(...) }} />`, nonce lấy từ `(await headers()).get('x-nonce') ?? undefined` (xem `frontend/app/shop/[category]/[slug]/page.tsx`).

## Việc 1: CollectionPage cho 3 trang shop

- `frontend/app/shop/page.tsx` — trang shop tổng, `metadata` tĩnh đã có (dòng 7-11). Thêm CollectionPage JSON-LD với `name: "Shop"`, `description` lấy từ `metadata.description` hiện có, `url: `${SITE_URL}/shop``.
- `frontend/app/shop/breeds/[slug]/page.tsx` — đã có `getBreed(slug)` trả `{name, slug, description}` (dòng 10-30). Dùng chính object này build CollectionPage: `name: breed.name`, `description: breed.description` (fallback nếu null), `url: `${SITE_URL}/shop/breeds/${slug}``.
- `frontend/app/shop/solutions/[slug]/page.tsx` — tương tự, dùng `getSolution(slug)` (dòng 10-30).
- Cả 3 trang: nếu có danh sách sản phẩm đã fetch sẵn cho trang đó, có thể thêm `mainEntity` hoặc `hasPart` là danh sách rút gọn (tối đa vài chục item, chỉ `name`+`url`) — **không bắt buộc**, ưu tiên đơn giản (chỉ `@context/@type/name/description/url`) nếu list phức tạp hoặc trang dùng client-side fetch/pagination không có sẵn full list ở server component.
- Nếu breed/solution không tồn tại (`getBreed`/`getSolution` trả `null`, trang gọi `notFound()`), không render JSON-LD (đã `notFound()` nên không tới đoạn render).

## Việc 2: BlogPosting cho blog post

- `frontend/app/blog/[slug]/page.tsx` — có sẵn `ApiPost`/`BlogPostViewModel` (dòng 11-56), `generateMetadata` đã đọc `post.seo` (dòng 125-161).
- Thêm BlogPosting JSON-LD trong `Page` component (dòng 163+): `headline: post.title`, `description: seo?.description || excerpt`, `image: post.featured_image` (nếu có), `datePublished: post.created_at` (ISO), `author: {@type: "Organization", name: "PetPosture"}` (không có author cá nhân thật, dùng field `post.author` hiện có làm `name` nếu muốn nhưng ghi rõ nguồn là `post.author` string field, không bịa Person), `mainEntityOfPage: `${SITE_URL}/blog/${slug}``.
- `robots`/`is_indexable` đã wire ở Round 2 — round này KHÔNG cần đụng lại, JSON-LD luôn render kèm trang (kể cả khi `is_indexable=false`, đây là hành vi bình thường của schema.org, không phải điều khiển index).

## Việc 3: FAQPage cho `/faqs`

- `frontend/components/FaqsPage.tsx` là `"use client"` component, hardcode `FAQ_ITEMS` trực tiếp trong file (dòng 20-66) — không fetch API.
- `frontend/app/faqs/page.tsx` hiện chỉ là server wrapper render `<FaqsPage />`, không có logic riêng.
- Vì JSON-LD phải render từ server component (script tag không cần 'use client' nhưng cần đọc được `FAQ_ITEMS`), cách làm: tách `FAQ_ITEMS` và `CATEGORIES` từ `FaqsPage.tsx` sang 1 file dữ liệu mới dùng chung được cả client và server, ví dụ `frontend/lib/faq-data.ts` (export `FAQ_ITEMS`, `CATEGORIES`), rồi:
  - `FaqsPage.tsx` import từ file mới thay vì khai báo local (giữ nguyên toàn bộ UI/behavior, chỉ đổi nguồn import).
  - `app/faqs/page.tsx` import cùng `FAQ_ITEMS`, build FAQPage JSON-LD: mỗi item là `{@type: "Question", name: item.question, acceptedAnswer: {@type: "Answer", text: item.answer}}`.
- Đây là thay đổi duy nhất động vào `FaqsPage.tsx` trong round này — chỉ đổi vị trí khai báo data, không đổi UI/style/behavior gì khác.

## Không cần làm trong round này

- P1.8 (verify canonical=OG=JSON-LD=sitemap end-to-end) — làm ngay sau round này, không gộp chung để giữ review gọn.
- Không thêm schema type nào khác ngoài 3 loại trên (không WebPage, không Organization lặp lại — Organization/WebSite đã có ở `layout.tsx`).
- Không đổi `generateMetadata`/canonical/robots của bất kỳ trang nào trong 5 trang trên — chỉ thêm JSON-LD script.

## Test cần có

- Source-contract test (`.test.mjs`) cho từng nhóm, theo đúng cách Round 3a đã làm (đọc source file bằng TS compiler API + `vm`, hoặc assert bằng regex trên source nếu đơn giản hơn):
  - CollectionPage: assert cả 3 trang có script `@type: CollectionPage` với `name`/`url` đúng.
  - BlogPosting: assert có script `@type: BlogPosting` với `headline`/`mainEntityOfPage` đúng slug.
  - FAQPage: assert `FAQ_ITEMS` được import từ module chung (không duplicate định nghĩa), và JSON-LD có đúng số `Question` bằng `FAQ_ITEMS.length`.
  - Tất cả script mới đều có `nonce` (không vi phạm CSP).

## Sau khi code xong

Không commit/push — báo lại để Claude (session này) review + verify bằng test/build thật trước khi commit, theo đúng quy trình các round trước.
