# PetPosture

An e-commerce platform for pet posture products, built as a monorepo with Next.js (frontend) and Laravel + Lunar PHP (backend).

**Live site:** https://petposture.com  
**Admin panel:** https://api.petposture.com/admin

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Backend | Laravel 11, PHP 8.3, Lunar PHP (e-commerce engine) |
| Admin Panel | Filament 3 + Filament Shield (RBAC) |
| Auth | Laravel Sanctum |
| Roles & Permissions | Spatie Laravel Permission |
| Database | MySQL |
| Hosting | Hostinger Business (Node.js via Passenger + PHP) |

---

## Project Structure

```
petposture/
├── frontend/                   # Next.js app (App Router, TypeScript)
│   ├── app/
│   │   ├── page.tsx            # Homepage
│   │   ├── shop/               # Product catalog & product detail
│   │   ├── cart/               # Shopping cart
│   │   ├── checkout/           # Checkout + success page
│   │   ├── blog/               # Blog listing + post detail
│   │   ├── auth/               # Login + Register + password reset
│   │   ├── track-order/        # Order tracking
│   │   ├── admin/              # Frontend admin (orders, blog)
│   │   └── [policy pages]/     # FAQ, privacy, terms, shipping, etc.
│   ├── server.js               # Custom Next.js server (Passenger entry point)
│   └── next.config.ts
├── backend/                    # Laravel API + Filament admin
│   ├── app/
│   │   ├── Http/Controllers/Api/   # REST API controllers
│   │   ├── Models/                 # Eloquent models
│   │   ├── Filament/               # Filament resources, pages, widgets
│   │   └── Providers/Filament/     # AdminPanelProvider (theme, layout)
│   ├── database/
│   │   ├── migrations/
│   │   └── seeders/
│   └── routes/api.php
├── nginx/                      # Nginx config (Docker only)
├── docker-compose.yml
└── .htaccess                   # Root Apache config (Passenger + HTTPS redirect)
```

---

## Features

- Product catalog with categories, variants, attributes, and brands
- Shopping cart & checkout flow
- Order management & tracking
- Blog with slug-based routing
- Discount / coupon codes
- Multi-language support
- SEO metadata & automatic sitemap
- Static policy pages (FAQ, privacy, shipping, returns, etc.)
- Full Filament admin panel with custom dark sidebar theme
- Role-based access control via Filament Shield

---

## Deployment (Hostinger)

The monorepo is deployed to Hostinger Business via GitHub Git deploy.

| Service | URL | Tech |
|---------|-----|------|
| Frontend (Next.js) | `petposture.com` | Node.js via Passenger |
| Backend (Laravel) | `api.petposture.com` | PHP 8.3 |

### How it works

- Hostinger pulls from `main` branch on push
- Build command: `npm run build` (builds Next.js inside `frontend/`)
- Entry file: `frontend/server.js` (custom Next.js HTTP server)
- Laravel is served from `public_html/api/` pointing to `backend/public/`
- `.env` is managed via Hostinger hPanel Environment Variables (not committed to Git)

### Required Environment Variables (hPanel)

```
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.petposture.com
APP_KEY=base64:...
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=u816338311_petposture
DB_USERNAME=u816338311_petposture
DB_PASSWORD=...
NEXT_PUBLIC_API_URL=https://api.petposture.com
```

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
