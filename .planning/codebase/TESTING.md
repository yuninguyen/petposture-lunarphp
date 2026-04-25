# Testing

## Backend (Laravel)
- **Framework**: PHPUnit.
- **Organization**:
  - `tests/Unit/`: Isolated logic tests.
  - `tests/Feature/`: HTTP and integration tests.
- **Running Tests**: `php artisan test` or `./vendor/bin/phpunit`.
- **Database**: Standard Laravel testing database setup (typically uses `:memory:` or a dedicated `testing.sqlite`).

## Frontend (Next.js)
- **Status**: No automated testing framework (Jest, Vitest, Cypress, Playwright) is currently configured in `package.json`.
- **Linting**: ESLint is configured for basic code quality checks.

## Strategies
- **Development**: Manual verification through the Filament Admin UI and local frontend preview.
- **Production Verification**: Recommended addition of E2E tests (Playwright) given the complex e-commerce flows (Cart, Checkout).
