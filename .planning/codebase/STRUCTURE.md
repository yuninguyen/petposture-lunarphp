# Directory Structure

## Root Directory
- `backend/`: Core Laravel application (API & Admin).
- `frontend/`: Next.js storefront application.
- `nginx/`: Nginx configuration files.
- `docker-compose.yml`: Infrastructure orchestration.
- `library/`: Shared libraries and tools (e.g., everything-claude).

## Backend (`./backend`)
- `app/Filament/`:
  - `Clusters/`: Logical grouping of Filament resources.
  - `Pages/`: Custom Filament pages.
  - `Resources/`: Resource definitions (Products, Orders, Customers, etc.) with their relative Pages.
  - `Widgets/`: Dashboard and resource widgets.
- `app/Helpers/`: Global helper functions (e.g., `settings.php`).
- `app/Models/`: Eloquent models (User, Brand, Category, Post, etc.).
- `app/Providers/`:
  - `AdminPanelProvider.php`: Filament admin panel configuration.
  - `AppServiceProvider.php`: Global service registrations.
- `database/`:
  - `migrations/`: Database schema definitions.
  - `seeders/`: Initial data population.
- `lang/`: JSON translation files (`en.json`, `vi.json`) and Laravel translation folders.

## Frontend (`./frontend`)
- `app/`: Next.js App Router folders.
  - `admin/`, `blog/`, `shop/`, etc.: Page routes.
  - `layout.tsx`: Root layout.
  - `page.tsx`: Homepage.
- `components/`:
  - `Header.tsx`, `Footer.tsx`: Universal components.
  - `Hero.tsx`, `HomePage.tsx`: Page-specific sections.
- `public/`: Static assets (images, icons).
