# Blog list polish + order-tracking-token fix — brief cho ChatGPT (2026-09-03)

Gộp lại các vấn đề còn tồn đọng sau buổi review UI mobile trang Blog hôm nay. Các phần đã được Claude tự sửa trực tiếp trong buổi (không cần làm lại): di chuyển thanh search+tabs lên trên bài Featured, padding Featured đồng đều, bo góc ô "Search articles" đồng bộ site, fix bug sticky-nav để lại khoảng trắng, tránh 2 thanh search chồng nhau trên `/blog`, và redesign toàn bộ ô search trên `Header` (desktop + mobile dropdown) sang kiểu viền mảnh/bo góc 12px/nút mũi tên ẩn-hiện theo focus.

Còn 4 việc dưới đây, độc lập với nhau — có thể làm và commit riêng từng việc theo đúng thứ tự liệt kê.

---

## Việc 1 — Nút "Share" trên card bài viết (Blog list) chưa hoạt động

**File:** `frontend/components/BlogPage.tsx`

Nút Share tại dòng 375-377 hiện không có `onClick`, chỉ là placeholder:

```tsx
<button className="flex items-center gap-1.5 text-sm font-medium text-zinc-400 transition-colors hover:text-rust">
    <Share2 size={14} /> Share
</button>
```

Trang chi tiết bài viết (`frontend/components/BlogPostPage.tsx`, dòng 71 và 92-97) đã có sẵn cơ chế share dùng được:

```tsx
const shareUrl = `${SITE_URL}/blog/${post.slug}`;
...
const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
    });
};
```
(`SITE_URL` import từ `@/lib/site`, xem `BlogPostPage.tsx` dòng 30.)

**Yêu cầu:** thêm state + handler riêng cho `BlogPage.tsx` (không sửa `BlogPostPage.tsx`), gắn vào nút Share ở dòng 375-377:

1. Thêm `import { SITE_URL } from '@/lib/site';` vào đầu file.
2. Thêm state `const [copiedSlug, setCopiedSlug] = useState<string | null>(null);` cạnh các state khác (~dòng 72-74).
3. Thêm hàm trong component:
   ```tsx
   const handleShare = async (post: BlogPost) => {
       const shareUrl = `${SITE_URL}/blog/${post.slug || post.id}`;
       if (navigator.share) {
           try {
               await navigator.share({ title: post.title, url: shareUrl });
           } catch {
               // Người dùng bấm huỷ share sheet — không cần xử lý gì thêm.
           }
           return;
       }
       await navigator.clipboard.writeText(shareUrl);
       setCopiedSlug(post.slug || post.id);
       setTimeout(() => setCopiedSlug(null), 2000);
   };
   ```
   `navigator.share` (Web Share API) có sẵn trên hầu hết trình duyệt mobile (đúng ngữ cảnh audit lần này) — ưu tiên dùng share sheet gốc của máy, fallback sang copy link trên desktop.
4. Sửa nút Share (dòng 375-377) thành:
   ```tsx
   <button
       type="button"
       onClick={() => handleShare(post)}
       className="flex items-center gap-1.5 text-sm font-medium text-zinc-400 transition-colors hover:text-rust"
   >
       <Share2 size={14} /> {copiedSlug === (post.slug || post.id) ? "Copied!" : "Share"}
   </button>
   ```

**Ngoài phạm vi:** không đụng `BlogPostPage.tsx`, không thêm dropdown mạng xã hội (Facebook/Pinterest...) như trang chi tiết — chỉ Web Share API + copy-link fallback.

---

## Việc 2 — Nút "Discuss" trên card bài viết (Blog list) chưa dẫn tới đâu

**File:** `frontend/components/BlogPage.tsx` (dòng 378-380) và `frontend/components/BlogPostPage.tsx` (dòng 275-276)

Trang chi tiết bài viết đã có khu vực bình luận thật (`Discussion`, dòng 275-306 của `BlogPostPage.tsx`, gọi API `GET /api/posts/{slug}/comments`) nhưng chưa có anchor để nhảy thẳng tới từ nơi khác.

**Yêu cầu:**

1. Trong `BlogPostPage.tsx`, thêm `id="comments"` vào div bọc khu vực bình luận ở dòng 276:
   ```tsx
   {/* Comments Section */}
   <div id="comments" className="mt-24 space-y-16">
   ```
2. Trong `BlogPage.tsx`, đổi nút Discuss (dòng 378-380) từ `<button>` thành `<Link>` trỏ tới bài viết kèm anchor:
   ```tsx
   <Link
       href={`/blog/${post.slug || post.id}#comments`}
       className="flex items-center gap-1.5 text-sm font-medium text-zinc-400 transition-colors hover:text-rust"
   >
       <MessageSquare size={14} /> Discuss
   </Link>
   ```
   `Link` đã được import sẵn ở đầu `BlogPage.tsx` (dòng 4).

**Ngoài phạm vi:** không xây thêm tính năng preview số lượng comment trên card list — chỉ điều hướng tới khu vực Discussion có sẵn.

---

## Việc 3 — Nút "Load More Content" quá sát viền trên màn hình 320px

**File:** `frontend/components/BlogPage.tsx`, dòng 397

Hiện tại:
```tsx
<button className="rounded-[3px] bg-secondary px-14 py-4 text-sm font-bold uppercase tracking-[0.08em] text-ink shadow-xl shadow-orange-100/50 transition-all hover:bg-secondary-dark">
```
`px-14` (56px mỗi bên) áp dụng ở mọi breakpoint — trên viewport 320px, cộng với `px-4` của section cha, phần chữ "Load More Content" gần sát viền màn hình.

**Yêu cầu:** đổi `px-14` thành `px-8 md:px-14` (giữ nguyên desktop, chỉ nới ra trên mobile). Không đổi bất kỳ class nào khác trên nút này.

**Ngoài phạm vi:** không đụng logic nút (hiện chưa có `onClick`/phân trang thật — đó là việc khác, không nằm trong phạm vi buổi audit UI này).

---

## Việc 4 — [BACKEND, ưu tiên cao] Link tracking/return trong email cũ bị vô hiệu ngay khi có email mới

**Mức độ:** cao hơn hẳn 3 việc trên — đây là lỗi backend ảnh hưởng đến MỌI đơn hàng thanh toán qua cổng redirect (Airwallex/Payoneer/PingPong/PayPal), không phải lỗi UI vặt. Nên tách commit/PR riêng.

### Hiện tượng

Khách bấm link "track order" hoặc "request return" từ một email cũ (order-confirmation, order-shipped...) → trang `/checkout/success?token=...&email=...` báo **"Order confirmation unavailable — Unable to access this order."**

### Nguyên nhân gốc

`backend/app/Services/OrderTrackingAccessService.php` (dòng 11-29) lưu **đúng 1 token còn hiệu lực cho mỗi đơn hàng**, ghi đè cột `lunar_orders.tracking_access_token_hash` mỗi lần `issue()` được gọi:

```php
public function issue(Order $order): string
{
    $token = Str::random(64);
    $expiresAt = now()->addDays(90);

    DB::table('lunar_orders')
        ->where('id', $order->id)
        ->update([
            'tracking_access_token_hash' => hash('sha256', $token),
            'tracking_access_token_expires_at' => $expiresAt,
            'updated_at' => now(),
        ]);
    ...
}
```

`issue()` được gọi ở 4 nơi, và **3 trong số đó xảy ra tự động, không phải do khách chủ động "resend"**:

1. `backend/app/Services/CheckoutService.php:247` — lúc đặt hàng, token này được nhúng vào email order-confirmation.
2. `backend/app/Http/Controllers/Api/OrderController.php:131` (`byPaymentSession`) — **mỗi lần khách được redirect quay lại `/checkout/success` từ cổng thanh toán redirect (Airwallex/Payoneer/PingPong/PayPal)**, hàm này gọi `issue()` lại để có token mới hiển thị ngay trên trình duyệt. Việc này ROTATE token, âm thầm vô hiệu hoá token vừa gửi trong email order-confirmation ở bước 1 — **xảy ra trên gần như mọi đơn hàng redirect-gateway, trước cả khi khách kịp đọc email**.
3. `backend/app/Http/Controllers/Api/OrderController.php:187` (`trackingAccess`, admin-only) — mỗi lần admin bấm sinh lại link tracking cho 1 đơn, cũng rotate.
4. `backend/app/Http/Controllers/Api/OrderController.php:86` (`resendTrackingLink`) — khách chủ động xin gửi lại link, cũng rotate.

Vì thiết kế chỉ lưu **hash** (không lưu plaintext), hệ thống không có cách nào "dùng lại" token đã phát hành trước đó để nhúng vào link mới — mỗi lần cần đưa 1 link cho khách, code buộc phải mint token mới, và việc mint đó xoá luôn token cũ. Đây không phải bug có thể vá bằng 1 dòng "chỉ rotate khi cần" — bản chất là **thiếu chỗ lưu nhiều token cùng lúc**.

### Hướng sửa: cho phép nhiều token cùng hiệu lực trên 1 đơn hàng

**Bước 1 — Migration mới:** `backend/database/migrations/2026_09_03_000001_create_order_tracking_tokens_table.php`
```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_tracking_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('lunar_orders')->cascadeOnDelete();
            $table->string('token_hash')->unique();
            $table->timestamp('expires_at');
            $table->timestamp('created_at')->nullable();

            $table->index(['order_id', 'expires_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_tracking_tokens');
    }
};
```
Không xoá cột `tracking_access_token_hash`/`tracking_access_token_expires_at` trên `lunar_orders` trong migration này (tránh phá dữ liệu/rollback phức tạp) — chỉ ngừng dùng chúng trong code. Có thể dọn cột thừa ở 1 migration riêng sau khi đã chạy ổn định.

**Bước 1.5 — Backfill token legacy còn hạn (BẮT BUỘC, không phải tuỳ chọn).** Nếu bỏ qua bước này, mọi link email đã gửi trước lúc deploy (tối đa 90 ngày) sẽ hỏng ngay khi migration chạy, thay vì hỏng dần khi có token mới như bug hiện tại — biến 1 bug thỉnh thoảng xảy ra thành 1 sự cố chắc chắn 100% tại thời điểm release. Thêm vào cuối method `up()` của migration ở Bước 1, sau khi `Schema::create` chạy xong:

```php
DB::table('lunar_orders')
    ->whereNotNull('tracking_access_token_hash')
    ->where('tracking_access_token_expires_at', '>', now())
    ->select('id', 'tracking_access_token_hash', 'tracking_access_token_expires_at')
    ->orderBy('id')
    ->chunkById(500, function ($orders) {
        $rows = $orders->map(fn ($order) => [
            'order_id' => $order->id,
            'token_hash' => $order->tracking_access_token_hash,
            'expires_at' => $order->tracking_access_token_expires_at,
            'created_at' => now(),
        ])->all();

        DB::table('order_tracking_tokens')->insert($rows);
    });
```
(Thêm `use Illuminate\Support\Facades\DB;` ở đầu file migration.) Chỉ copy token **còn hạn** — token đã hết hạn không cần chuyển vì `find()` sẽ tự loại chúng bằng điều kiện `expires_at`.

**Bước 2 — Viết lại `backend/app/Services/OrderTrackingAccessService.php`:**
```php
<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Lunar\Models\Order;

class OrderTrackingAccessService
{
    public function issue(Order $order): string
    {
        $token = Str::random(64);
        $expiresAt = now()->addDays(90);

        DB::table('order_tracking_tokens')->insert([
            'order_id' => $order->id,
            'token_hash' => hash('sha256', $token),
            'expires_at' => $expiresAt,
            'created_at' => now(),
        ]);

        $order->setAttribute('tracking_access_token', $token);
        $order->setAttribute('tracking_access_token_expires_at', $expiresAt);

        return $token;
    }

    public function find(string $token, string $email): ?Order
    {
        if ($token === '' || $email === '') {
            return null;
        }

        $orderId = DB::table('order_tracking_tokens')
            ->where('token_hash', hash('sha256', $token))
            ->where('expires_at', '>', now())
            ->value('order_id');

        if (! $orderId) {
            return null;
        }

        return Order::query()
            ->where('id', $orderId)
            ->whereRaw('LOWER(customer_reference) = ?', [Str::lower(trim($email))])
            ->with(['shippingAddress', 'billingAddress', 'lines'])
            ->first();
    }
}
```
Giữ nguyên `$order->setAttribute(...)` — đây là cơ chế truyền plaintext token qua bộ nhớ để `OrderTrackingResource`/`OrderCreatedResource` đọc lại bằng `getAttribute()` (xem 2 file đó), không đổi 2 resource này.

**Bước 3 — Sửa `backend/app/Http/Controllers/Api/OrderController.php:191`** (trong `trackingAccess()`), đổi:
```php
'tracking_access_expires_at' => $order->tracking_access_token_expires_at?->toIso8601String(),
```
thành (khớp cách đọc an toàn mà 2 resource kia đang dùng):
```php
'tracking_access_expires_at' => optional($order->getAttribute('tracking_access_token_expires_at'))->toIso8601String(),
```

**Bước 4 — Chạy test suite hiện có và sửa theo lỗi phát sinh** (schema đổi nên chắc chắn có test cần cập nhật):
```bash
php artisan test --filter=OrderPublicResourceTest
php artisan test --filter=CheckoutApiTest
php artisan test --filter=ReturnRequestApiTest
```
Các file test này (`backend/tests/Feature/OrderPublicResourceTest.php`, `CheckoutApiTest.php`, `ReturnRequestApiTest.php`) hiện assert trực tiếp vào `tracking_access_token_hash`/`tracking_access_token_expires_at` trên `lunar_orders` — cập nhật sang assert trên bảng `order_tracking_tokens` mới.

### Xác nhận cách sửa

Sau khi sửa: 1 đơn hàng có thể có nhiều token cùng hiệu lực (mỗi lần `issue()` là 1 dòng mới trong `order_tracking_tokens`, không xoá dòng cũ) — token trong email order-confirmation, link admin resend, và token hiển thị ngay sau khi redirect từ cổng thanh toán đều sống độc lập, tự hết hạn sau 90 ngày, không còn tự vô hiệu hoá lẫn nhau.

**Regression test bắt buộc thêm** (không chỉ chạy lại test cũ): tạo 1 order, lấy token ban đầu (giả lập token "email cũ"), gọi `byPaymentSession()` để nó `issue()` token thứ 2 (giả lập token "vừa phát sinh") — sau đó assert **cả 2 token đều tra được qua `find()`**. Đây chính là kịch bản Việc 4 tồn tại để sửa; test cũ (chỉ check 1 token còn sống) sẽ pass ngay cả khi bug tái diễn, nên không đủ.

**Ngoài phạm vi:** không cần cron dọn token hết hạn/token cũ (bảng sẽ tích luỹ theo thời gian nhưng ở quy mô site hiện tại không đáng lo — có thể để 1 việc riêng sau nếu cần); không đổi UI frontend (frontend đã gửi đúng `token`+`email`, không cần sửa gì).

### Lưu ý khi deploy — cửa sổ race giữa lúc migrate và lúc code mới chạy

Đã cân nhắc và **quyết định không thêm fallback đọc cột legacy tạm thời trong `find()`** — site deploy qua SSH lên 1 VPS duy nhất (không phải rolling deploy nhiều instance), đang ở giai đoạn dev/chưa live nên lưu lượng thật tại đúng lúc deploy gần như bằng 0; thêm code tạm + nghĩa vụ nhớ dọn sau 90 ngày tốn công hơn rủi ro nó phòng.

Thay vào đó, **khi deploy phải đúng thứ tự**: `php artisan migrate` (chạy backfill) xong là **restart ngay** queue worker + reload php-fpm, không để cách quãng. Nếu để trễ, code cũ (đã bị `git pull` ghi đè trên đĩa nhưng worker/php-fpm chưa reload) vẫn có thể gọi `issue()` bản cũ, ghi token mới vào cột legacy sau khi backfill đã chạy xong — token đó sẽ không bao giờ vào được bảng `order_tracking_tokens` và bị mất. Không cần khoá traffic/maintenance page — chỉ cần không để khoảng trống giữa "migrate xong" và "restart xong".

---

## Xác minh chung sau khi code xong cả 4 việc

- Việc 1-3 (frontend): chạy `npm run dev` trong `frontend/`, mở `/blog` ở viewport mobile (375px), kiểm tra Share mở share-sheet (hoặc copy link + đổi text "Copied!" 2 giây) và Discuss nhảy đúng tới khu vực Discussion của bài viết, nút Load More không còn sát viền ở 320px.
- Việc 4 (backend): tạo 1 đơn test, xác nhận link trong email order-confirmation vẫn mở được `/checkout/success` sau khi giả lập redirect quay lại từ 1 cổng thanh toán redirect (gọi `byPaymentSession` cho cùng đơn đó) — trước đây bước này sẽ làm hỏng link email, giờ phải vẫn còn dùng được.

Không commit/push; báo lại kết quả để Claude review trước khi commit.
