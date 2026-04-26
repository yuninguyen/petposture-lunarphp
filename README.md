# PetPosture

Nền tảng thương mại điện tử chuyên bán sản phẩm cho thú cưng, xây dựng trên kiến trúc full-stack với Next.js (frontend) và Laravel + Lunar PHP (backend).

**Live:** https://petposture-lunarphp.vercel.app

---

## Tech Stack

| Layer | Công nghệ |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Backend | Laravel 11, PHP 8.3, Lunar PHP (e-commerce) |
| Admin Panel | Filament 3 + Filament Shield |
| Auth | Laravel Sanctum |
| Roles & Permissions | Spatie Laravel Permission |
| Containerization | Docker + Nginx |

---

## Cấu trúc Project

```
petposture-lunarphp/
├── frontend/          # Next.js app (TypeScript)
│   ├── app/           # App Router pages
│   └── ...
├── backend/           # Laravel API
│   ├── app/
│   │   ├── Http/Controllers/Api/   # REST API controllers
│   │   ├── Models/                 # Eloquent models
│   │   └── Services/               # Business logic
│   ├── routes/        # API route definitions
│   └── database/      # Migrations & seeders
├── nginx/             # Nginx config
└── docker-compose.yml
```

---

## Tính năng

- Danh mục & sản phẩm (variants, attributes, brands)
- Giỏ hàng & checkout
- Quản lý đơn hàng
- Blog & bình luận
- Mã giảm giá / discount
- SEO metadata
- Trang tĩnh: FAQ, chính sách, liên hệ
- Admin panel đầy đủ qua Filament
- Sitemap tự động

---

## Yêu cầu

- PHP 8.3+, Composer
- Node.js 18+, npm
- MySQL hoặc PostgreSQL
- (Tùy chọn) Docker & Docker Compose

---

## Cài đặt & Chạy Local

### Backend

```bash
cd backend
cp .env.example .env
composer install
php artisan key:generate
php artisan migrate --seed
php artisan serve
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend chạy tại `http://localhost:3000`, backend tại `http://localhost:8000`.

### Chạy bằng Docker

```bash
docker-compose up -d
```

- Frontend: `http://localhost:3001`
- Backend/Nginx: `http://localhost:8080`

---

## API Endpoints (tóm tắt)

| Nhóm | Prefix |
|------|--------|
| Auth | `/api/auth/...` |
| Products | `/api/products/...` |
| Categories | `/api/categories/...` |
| Cart & Checkout | `/api/cart/...`, `/api/checkout/...` |
| Orders | `/api/orders/...` |
| Blog / Posts | `/api/posts/...` |
| Settings / Content | `/api/settings/...`, `/api/content/...` |

---

## Kiến trúc

Xem [ARCHITECTURE.md](./ARCHITECTURE.md) để biết sơ đồ chi tiết và luồng xử lý request.

---

## License

MIT
