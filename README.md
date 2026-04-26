# PetPosture Healess Ecommerce

An e-commerce platform for pet products, built on a full-stack architecture with Next.js (frontend) and Laravel + Lunar PHP (backend).

**Live:** https://petposture-lunarphp.vercel.app

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Backend | Laravel 11, PHP 8.3, Lunar PHP (e-commerce) |
| Admin Panel | Filament 3 + Filament Shield |
| Auth | Laravel Sanctum |
| Roles & Permissions | Spatie Laravel Permission |
| Containerization | Docker + Nginx |

---

## Project Structure

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

## Features

- Product catalog with categories, variants, attributes, and brands
- Shopping cart & checkout
- Order management
- Blog with comments
- Discount / coupon codes
- SEO metadata
- Static pages: FAQ, policies, contact
- Full admin panel via Filament
- Automatic sitemap

---

## Requirements

- PHP 8.3+, Composer
- Node.js 18+, npm
- MySQL or PostgreSQL
- (Optional) Docker & Docker Compose

---

## Local Setup

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

Frontend runs at `http://localhost:3000`, backend at `http://localhost:8000`.

### Docker

```bash
docker-compose up -d
```

- Frontend: `http://localhost:3001`
- Backend/Nginx: `http://localhost:8080`

---

## API Endpoints

| Group | Prefix |
|-------|--------|
| Auth | `/api/auth/...` |
| Products | `/api/products/...` |
| Categories | `/api/categories/...` |
| Cart & Checkout | `/api/cart/...`, `/api/checkout/...` |
| Orders | `/api/orders/...` |
| Blog / Posts | `/api/posts/...` |
| Settings / Content | `/api/settings/...`, `/api/content/...` |

---

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for a detailed system diagram and request flow.

---

## License

MIT
