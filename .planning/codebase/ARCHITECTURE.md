# Architecture

## Overall System Design
The project is a decoupled Full-stack application consisting of a Laravel-based backend and a Next.js-based frontend.

- **Backend**: Serves as the headless e-commerce engine and administrative dashboard.
- **Frontend**: Serves as the customer-facing storefront.
- **API Strategy**: Laravel Sanctum handles authentication, and LunarPHP provides the e-commerce core.

## Backend Architecture (Laravel/Filament/LunarPHP)
- **Framework**: Laravel 11.
- **Logic Layers**:
  - **Models**: standard Eloquent models located in `app/Models`.
  - **Lunar Models**: E-commerce specific models provided by LunarPHP (Product, Order, Customer).
  - **Filament Resources**: Located in `app/Filament/Resources`, these define the admin UI and CRUD logic.
  - **Services/Repositories**: Some business logic is extracted into `app/Services` and `app/Repositories`.
- **Database**: Currently using SQLite (`database.sqlite`) for development ease.

## Frontend Architecture (Next.js App Router)
- **Framework**: Next.js 15+ with App Router.
- **Routing**: File-based routing in the `app/` directory.
- **Components**: UI components are organized in the `components/` directory.
- **State Management**: React 19 primitives (Server Components, Actions) and potentially local component state.
- **Styling**: Tailwind CSS v4 using a modern token-based approach (`app/tokens.css`).

## Key Architectural Patterns
- **Resource-Oriented**: The admin panel is strictly organized around Filament Resources.
- **Component-Driven UI**: Frontend is built using highly modular React components.
- **Dockerized Services**: The entire environment is managed via Docker Compose for consistency across development environments.
