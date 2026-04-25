# Technology Stack

## Backend
- **Core**: PHP 8.3, Laravel 11.x
- **Admin Panel**: Filament v3.2
- **E-commerce**: LunarPHP v1.0
- **Database**: SQLite (used in local development: `database.sqlite`, `lunar_new.sqlite`)
- **Authentication/Authorization**: 
  - Laravel Sanctum (API auth)
  - Spatie Laravel Permission
  - Filament Shield (RBAC UI)
- **Deployment**: Docker (Dockerfile, docker-compose.yml)

## Frontend
- **Framework**: Next.js 15+ (Next 16.2.3 candidate, React 19)
- **UI Library**: React 19.x
- **Styling**: Tailwind CSS v4
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Language**: TypeScript

## Infrastructure & Tools
- **Environment**: Docker Compose
- **Web Server**: Nginx (configured via `./nginx`)
- **Package Managers**: 
  - Backend: Composer
  - Frontend: NPM
- **CI/CD / Linting**:
  - Laravel Pint (PHP linting)
  - PHPUnit (Testing)
  - ESLint (Frontend linting)
