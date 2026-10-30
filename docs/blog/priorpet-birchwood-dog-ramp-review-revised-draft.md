# PRIORPET — bản nháp sửa để duyệt (CHƯA áp dụng lên bài public)

**Ngày đối chiếu:** 09/10/2026. Bài đích: `/blog/priorpet-birchwood-dog-ramp-review` (giữ nguyên slug để không gãy link; đổi tiêu đề và nội dung).

## A. Kết quả đối chiếu nguồn (ghi chú biên tập, KHÔNG đăng)

Nguồn chính: trang nhà sản xuất [priorpet.com/products/dogramp-for-couch](https://www.priorpet.com/products/dogramp-for-couch) (bản USA).

| Câu trong bài hiện tại | Đối chiếu | Kết luận |
|---|---|---|
| "incline is adjustable from about 14 to 20.5 inches" | Nhà sản xuất: "7 Adjustable Heights (14" – 20.5")". Đây là **chiều cao**, không phải góc nghiêng | Sửa từ "incline" thành "height". Con số đúng |
| "built for couches and beds" / "match couch and bed heights" | Trang USA: "ideal … for couch or chair use … **not intended for beds or cars**" | **Mâu thuẫn.** Bài phải sửa. PRIORPET có sản phẩm riêng cho giường ("Dog ramp for Bed") |
| "just under 12 lb" | Chỉ thấy ở một nhà bán lẻ châu Âu (5.3 kg ≈ 11.7 lb, bản 7–20"/18–53 cm). Trang USA không nêu trọng lượng | **Chưa xác minh cho bản USA.** Bỏ khỏi bài |
| "folds flat with a built-in handle" | Gập phẳng: có (USA: 39.6" × 14" × 3"). Tay cầm: chỉ thấy ở nhà bán lẻ châu Âu | Giữ "folds flat"; bỏ "handle" cho tới khi xác minh |
| "no assembly" | USA: "Fully assembled foldable dog ramp … No assembly needed" | Xác minh |
| "non-slip rubber surface" | USA: "High-traction rubber provides superior grip" | Xác minh (là lời nhà sản xuất) |
| "furniture-grade birchwood" | USA chỉ ghi "durable birchwood"; "furniture-grade" thấy ở nhà bán lẻ | Dùng "birchwood" |
| "flush landing platform" | Tên sản phẩm trên Amazon: "Landing Platform Seamlessly Connects" (lời quảng cáo) | Bỏ chi tiết này cho tới khi xác nhận nguồn đúng phiên bản (tiêu đề Amazon chưa chắc cùng phiên bản với trang USA) |
| "The rubber surface held up well underfoot in daily use" | **Không có trải nghiệm thực tế** | Xóa |
| "sturdy", "our top overall pick", "worth the higher price", "premium-priced" | Không có căn cứ đánh giá; chưa so giá | Xóa |

**Điểm chênh giữa các nguồn:** Amazon và nhiều nhà bán lẻ ghi "7" to 20"" (hoặc 18–53 cm), sức chứa 200 lb (một nguồn 170 lb), và có nơi ghi dùng cho "couches, beds, or cars". Trang USA ghi 14"–20.5" và không dành cho giường/xe. PRIORPET bán nhiều phiên bản; bài phải nói rõ đang trích bản USA trên trang chính hãng và nhắc người đọc kiểm tra đúng listing mình mua. Trang Amazon.com không tải được đầy đủ nên chưa đối chiếu được.

**Chưa xác minh được:** góc nghiêng ở từng mức chiều cao (trong nội dung trang đã đọc không thấy), giá hiện tại, bảo hành.

## B. Việc liên quan cần xử lý (chưa làm)

1. **SEO title / meta description / OG / social** đang dùng "Our Top Pick": đổi theo bảng trường ở phần C.
2. **Bài *Best Dog Ramps for Dachshunds*:** cần sửa cùng đợt để hai bài không mâu thuẫn. Theo kiểm tra của người review (tôi chưa tự xác nhận), bản public có "Best Overall", "sturdy, planted feel underfoot", giá, rating, thông tin tay cầm, khuyến nghị góc 25–30 độ chưa nêu nguồn, và công dụng PRIORPET không nhất quán. Các thẻ so sánh còn lưu dữ liệu riêng trong CMS (nguồn và ngày kiểm tra cũ, chưa xác minh lại), nên chỉ sửa nội dung bài là chưa đủ. Bản nháp trong repo `docs/blog/petposture-comparison-prompt.md` cũng xếp PRIORPET "#1 Best Overall".
3. **Schema Product** (`docs/blog/Product … keep separate.md`): nếu đã gắn vào bài public thì kiểm tra không có rating, giá hay review không có nguồn.
4. **Bài *How to Choose*** (`how-to-choose-a-dog-ramp-editor-notes-current.md`) có link tùy chọn tới bài PRIORPET, ghi chú sẵn "verify the review": chỉ giữ link khi bài đã sửa xong.
5. **Quan hệ thương mại:** nếu link tới PRIORPET là affiliate thì thêm câu sau vào cuối khung "Not tested by PetPosture": *"If you buy through our links, we may earn a commission."* Nếu không có link affiliate thì bỏ qua.

---

## C. Nội dung bài đề xuất (tiếng Anh, để đăng sau khi duyệt)

**Slug:** giữ nguyên `priorpet-birchwood-dog-ramp-review`.

| Trường | Giá trị đề xuất |
|---|---|
| H1 / SEO title | PRIORPET Birchwood Dog Ramp: Specs & Fit Guide |
| Focus keyphrase | PRIORPET birchwood dog ramp |
| Meta description | Explore manufacturer-listed specs for the PRIORPET Birchwood couch ramp and what to check for your Dachshund. Not tested by PetPosture. |
| OG title | PRIORPET Birchwood Dog Ramp: What to Check Before Buying |
| OG description | Dùng cùng meta description |

Thay các giá trị hiện có "Our Top Pick" trong SEO title, OG và mô tả (theo kiểm tra qua API của người review; tôi chưa tự đọc các trường này).

> **Not tested by PetPosture.** We haven't used this ramp ourselves. This page summarizes the manufacturer's published specifications and points out what to check against your own furniture.

### What the manufacturer lists

Source: [PRIORPET product page (USA)](https://www.priorpet.com/products/dogramp-for-couch), checked October 9, 2026.

| | Listed spec |
|---|---|
| Height settings | 7 adjustable heights, 14" to 20.5" |
| Weight capacity | 200 pounds |
| Folded size | 39.6" L × 14" W × 3" H |
| Materials | Birchwood with a high-traction rubber surface |
| Setup | Arrives fully assembled; no assembly needed |
| Intended use | Couch or chair, indoors. The manufacturer says it is not intended for beds or cars |
| Dog size | Described as designed for small and medium dogs, including dachshunds |

The 14"–20.5" range is the **height** of the ramp's top edge, not its angle. We didn't find a stated incline angle for each setting in the sources we reviewed.

### Check which version you're buying

Check the exact model and seller listing before buying. Specifications and intended uses may differ between versions.

### What to check for a Dachshund household

- **Seat height.** Measure from the floor to the top of your seat cushion and see whether it falls inside the listed height range. Our guide: [How to Choose a Dog Ramp for a Dachshund](/blog/how-to-choose-a-dog-ramp).
- **Floor space.** The ramp folds to 3" thick, but in use it needs open floor in front of the furniture. Measure it and leave room to walk around it.
- **Furniture type.** The manufacturer lists couch or chair use and says it is not intended for beds. If you need a bed ramp, look at ramps made for that use.
- **Your dog.** Start with your dog's comfort. If your Dachshund has back problems or seems to be in pain, ask your vet before choosing a ramp.

### What we can't tell you

Because we haven't tested it, we can't say how the surface grips in daily use, how stable it feels, how it holds up over time, or how dogs take to it. We also haven't compared prices in this article.

### Quick summary (from published specs only)

**What the specs offer:** adjustable height, no assembly, folds flat, 200 lb listed capacity, rubber walking surface.

**What to check or what's unknown:** the manufacturer says it is not for beds or cars, the incline angle isn't stated in the sources we reviewed, versions differ between sellers, and it hasn't been tested by PetPosture.

### Related guides

- [How to Choose a Dog Ramp for a Dachshund](/blog/how-to-choose-a-dog-ramp)
- [Ramp vs Stairs for Dachshunds](/blog/ramp-vs-stairs-for-dachshunds)
