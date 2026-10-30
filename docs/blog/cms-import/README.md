# Bộ nhập CMS — PRIORPET review + Dog Ramps comparison

**Trạng thái (11/10/2026): ĐÃ ÁP DỤNG cả ba bài lên production** qua `PostController::update()` (request nội bộ trong container backend, đăng nhập user id 1; `Sanctum::actingAs` không dùng được vì thiếu Mockery trên prod, nên gán user trực tiếp cho guard `sanctum`). Cloudflare đã purge; frontend Next cache dữ liệu bài 60 giây nên trang thật cập nhật sau lần tải thứ hai. Đã kiểm tra: slug, `published_at`, status, tag/breed/solution giữ nguyên; bài *How to Choose* có nút tải PDF, link và hai ảnh; bài Best Dog Ramps còn 2 thẻ, highlight/giá/rating đều null; không còn "top pick"/"best overall" trên trang. Khôi phục: gửi `backup/<slug>.2026-10-09.restore-payload.json` theo cách trên. Dữ liệu ban đầu lấy từ API công khai ngày 09/10/2026.
**Không gửi:** `slug`, `published_at`, `status`, ảnh đại diện, tác giả, danh mục: `update()` chỉ ghi các trường có mặt trong payload nên các trường này giữ nguyên.
**Bắt buộc gửi:** `breeds`, `solutions`, `tags` (ID hiện tại). Đọc `PostController::update()`: thiếu ba trường này thì `syncTaxonomy()` gọi `sync([])` và **gỡ hết quan hệ**. Cả payload cập nhật lẫn payload khôi phục đều đã mang ID hiện có (breeds [1], solutions [3], tags [4,5,6,11]).
**`seo`:** `updateOrCreate([], seo)` chỉ ghi các khóa có trong object `seo`, nên `is_indexable`, `is_followable`, `og_image` giữ nguyên. Bỏ hẳn khóa `seo` thì không đụng gì.
**`in_stock`:** hai thẻ vẫn mang `in_stock` cũ (true, từ 13/09/2026), chưa xác minh lại tồn kho. Không coi đây là dữ liệu mới kiểm tra.

## Nội dung thư mục

| Đường dẫn | Là gì |
|---|---|
| `priorpet-birchwood-dog-ramp-review/content.html` | HTML sạch của bài PRIORPET (không có ghi chú biên tập) |
| `priorpet-birchwood-dog-ramp-review/payload.json` | `title` + `content` + `seo` |
| `best-dog-ramps-for-dachshunds/content.html` | HTML sạch của bài so sánh |
| `best-dog-ramps-for-dachshunds/payload.json` | `title` + `content` + `seo` + `comparison_items` (2 thẻ) + `disclosure_shown` |
| `best-dog-ramps-for-dachshunds/trixie-card-on-hold.json` | Thẻ TRIXIE gỡ tạm + bản đề xuất nếu xác minh được sau này |
| `backup/*.api-response.json` | Phản hồi API nguyên bản trước khi sửa |
| `backup/*.restore-payload.json` | Payload ở định dạng PUT để khôi phục đúng trạng thái cũ (bài so sánh gồm cả 3 thẻ) |

Ghi chú biên tập và đối chiếu nguồn nằm ở hai file nháp: `../priorpet-birchwood-dog-ramp-review-revised-draft.md` và `../best-dog-ramps-for-dachshunds-revised-draft.md`.

## Đã kiểm tra tự động (script, 09/10/2026)

- `seo.title` 59 và 57 ký tự (giới hạn API: 60); `seo.description` 135 và 128 ký tự (giới hạn: 160).
- Payload không chứa `slug`, `published_at`, `status`.
- Hai thẻ còn lại có `highlight`, `price_display`, `price_cents`, `rating` đều `null`; mỗi dòng pros/cons ≤ 255 ký tự; `checked_at` đúng định dạng `Y-m-d\TH:i:s\Z`; không còn thẻ TRIXIE.
- HTML cân tag; không còn các cụm: sturdy, top pick, best overall, worth the higher, held up, planted, flimsy, sandpaper, premium, furniture-grade, landing platform, 25–30 degrees.
- Quy tắc validate lấy từ `backend/app/Http/Controllers/Api/PostController.php` (`validationRules`).

## Điểm cần biết trước khi áp dụng

1. **Tên trường và `checked_at` của thẻ.** `metadata.source_url` giờ trỏ về trang nhà sản xuất (PRIORPET, PetSafe) thay vì trang bán hàng; `checked_at` là `2026-10-09T00:00:00Z` (chỉ chính xác đến ngày). `affiliate_url` giữ nguyên.
2. **Tên thẻ đổi:** "PRIORPET Birchwood Foldable Dog Ramp with Landing Platform" → "PRIORPET Birchwood Foldable Dog Ramp"; "PetSafe Happy Ride Foldable Dog Car Ramp, 62-in" → "PetSafe Happy Ride Folding Dog Ramp, 62-in" (theo tên chính hãng).
3. **Bài so sánh có link tới bài PRIORPET và ngược lại** (cả hai dùng slug hiện tại). Áp dụng cùng đợt.
4. **Chưa xác minh:**
   - Luồng admin khi sửa bài đang `published`: lưu thẳng hay qua bản nháp/preview.
   - Frontend hiển thị thẻ so sánh thế nào khi giá, rating, badge đều trống (người review nói badge ẩn khi `highlight` null; giá/rating chưa kiểm tra).
   - Link Amazon B0BMGS1QB5 và Chewy dp/53683 trỏ đúng phiên bản; có phải affiliate không.
   - Các bài khác trong site có link tới hai bài này với anchor "top pick"/"best…" (trong bản ghi chú của *How to Choose* có link tới bài PRIORPET).
5. **Cache.** API GET của `api.petposture.com` được Cloudflare cache ở edge và deploy không tự purge: sau khi cập nhật nội dung phải purge cache API (xem memory "Purge Cloudflare API cache after deploy"), rồi kiểm tra lại `GET /api/posts/{slug}` và trang frontend.

## Cách áp dụng (khi bạn duyệt)

1. Mở bản preview nếu admin có (`GET /posts/{post}/preview-url`); nếu không, làm ngoài giờ cao điểm.
2. Bài **PRIORPET** trước, bài **so sánh** sau (hoặc cùng lúc): dán `content.html` + các trường trong `payload.json`, hoặc gọi `PUT` cập nhật bài với payload (id bài so sánh = 4, bài PRIORPET = 7; đường dẫn admin chính xác cần xác nhận lại vì tôi chỉ đọc tên route).
3. Với bài so sánh, bảo đảm danh sách thẻ chỉ còn 2 thẻ theo `payload.json`.
4. Purge cache API, kiểm tra: tiêu đề, SEO title, OG, không còn "Our Top Pick", hai thẻ không còn giá/rating/badge, link nội bộ hoạt động.

## Khôi phục

Gửi lại `backup/<slug>.2026-10-09.restore-payload.json` (cùng cách như trên) và purge cache. Bản `api-response.json` giữ nguyên dữ liệu gốc để đối chiếu, gồm cả các trường tính toán (`redirect_url`, `retailer_label`) không đưa vào payload.

---

## Bài thứ ba: *How to Choose a Dog Ramp* (id 5)

`how-to-choose-a-dog-ramp/payload.json` = `title` + `content` + `breeds/solutions/tags`. **Không gửi `seo`** (không đổi gì ở SEO). Nội dung gốc chỉ thêm đúng một khối, chèn ngay trước `<h2>Compare Ramp Surface, Width, and Stability</h2>`: mục "A Quick Measuring Checklist" (3 số cần đo, 2 sơ đồ, nút "Download the free measuring checklist", dòng nhắc hỏi bác sĩ thú y nếu chó có vấn đề lưng). Script đã kiểm tra rằng bản mới chỉ khác bản gốc ở khối này. Bản khôi phục: `backup/how-to-choose-a-dog-ramp.2026-10-09.restore-payload.json`.

**File phải có trên website TRƯỚC khi cập nhật bài** (đã tạo trong repo, chưa commit, chưa deploy):

| File | Đường dẫn công khai |
|---|---|
| `frontend/public/downloads/dog-ramp-measuring-checklist.pdf` | `/downloads/dog-ramp-measuring-checklist.pdf` |
| `frontend/public/assets/blog/dog-ramp-measuring-diagram.webp` | `/assets/blog/dog-ramp-measuring-diagram.webp` |
| `frontend/public/assets/blog/dog-ramp-walking-room-diagram.webp` | `/assets/blog/dog-ramp-walking-room-diagram.webp` |

Pin 3 và carousel 14/10 dẫn về bài này; chỉ đăng khi nút tải mở được PDF thật (kiểm tra bằng trình duyệt, không chỉ `curl`).

## Kết quả đọc mã frontend (09/10/2026)

- **Thẻ thiếu giá/rating/badge** (`frontend/components/blog/ComparisonTable.tsx`): `highlight` null thì chỉ để một khoảng trống 22px, không có badge; `rating` null thì ẩn sao; `price_display` null thì render một `<div>` rỗng (còn lề dưới 12px, chỉ là khoảng trắng nhỏ, không lỗi). Chưa chạy preview thật để xác nhận bằng mắt.
- **`in_stock` không được frontend hiển thị ở đâu cả** (không có trong `ComparisonTable`; JSON-LD bài viết có test cấm rating/price/availability). Vì vậy website không hiện "còn hàng" từ trường này; chỉ cảnh báo trong admin dùng nó (`Post::hasOutOfStockComparisonItems`). Giữ nguyên giá trị cũ, không đổi sang hết hàng.
- **Bộ lọc HTML của bài** (`frontend/lib/sanitize-rich-html.ts`): giữ `img`, `figure`, `figcaption`, `ol`, nút `pp-cta-primary` và href tương đối; **bỏ `target`, `download`, `height`, `loading`**. Hệ quả: link PDF mở trong cùng tab (không tải ép), ảnh chỉ còn `width` nên có thể xô nhẹ bố cục khi tải ảnh. Không sửa bộ lọc trong đợt này. (Các bản nháp PRIORPET/Best dùng `target="_blank"` cho link nhà sản xuất: sẽ bị bỏ, không ảnh hưởng nội dung.)
- **Proxy** (`frontend/proxy.ts`): matcher chỉ loại `api`, `_next/static`, `_next/image`, `favicon.ico`, `robots.txt`, `sitemap.xml`, nên `/downloads/...` và `/assets/...` cũng đi qua proxy và nhận `Cache-Control` của nó. Chưa kiểm tra header thật của PDF trên production vì site đang lỗi (xem dưới).

## CẢNH BÁO: storefront đang trả HTTP 500 (kiểm tra 09/10/2026, khoảng 04:50–04:52 giờ địa phương)

`petposture.com/`, `/blog`, `/blog/how-to-choose-a-dog-ramp`, `/blog/best-dog-ramps-for-dachshunds` và `/assets/blog/*.webp` đều trả `500 Internal Server Error` (thân phản hồi chỉ là chữ "Internal Server Error", không phải trang lỗi Cloudflare), lặp lại nhiều lần. `api.petposture.com` vẫn 200. `favicon.ico` vẫn 200. Đầu phiên làm việc này, trang `/blog/...` còn tải được. **Cập nhật (SSH chỉ đọc, 21:56 UTC ngày 08/10/2026):** các container `petposture-backend/frontend/admin` vừa được tạo lại lúc 21:54 UTC (frontend: "Ready on port 3001"), ngay sau lần kiểm tra 500 cuối của tôi (21:51 UTC); sau đó `/`, `/blog/how-to-choose-a-dog-ramp` và `/assets/blog/placeholder-post.webp` đều trả 200. Nghĩa là lỗi 500 kết thúc cùng lúc với một lần deploy/recreate. Log trước đó đã mất cùng container cũ nên **không xác định được nguyên nhân**; chưa sửa gì trên server. Vẫn nên kiểm tra bằng trình duyệt thật trước khi áp dụng CMS hoặc đăng bài.

## Thứ tự áp dụng đề xuất (khi site ổn)

1. Deploy các file tĩnh ở bảng trên; mở thử PDF và hai ảnh trên production bằng trình duyệt.
2. Preview/staging nếu có; nếu không, áp dụng bài PRIORPET + bài so sánh cùng đợt, rồi bài *How to Choose*.
3. Purge cache API; kiểm tra bằng trình duyệt thật (không chỉ `curl`): tiêu đề, thẻ so sánh, nút tải PDF, hình, console không lỗi CSP.
4. Chỉ sau đó mới đăng pin 3 và carousel 14/10.
