# Coding Conventions

## Backend (PHP/Laravel)
- **Standard**: PSR-12 followed via Laravel standards.
- **Linting**: Laravel Pint is used for code style.
- **Naming**:
  - Controllers/Services: StudlyCase.
  - Variables/Methods: camelCase.
  - DB Tables/Columns: snake_case.
- **Localization**:
  - Always use `__()` for translatable strings.
  - Use English source keys (e.g., `__('Name')`) and map them in `vi.json`.
- **Filament Patterns**:
  - Use `getNavigationGroup()` and `getLabel()` methods for resource metadata.
  - Organize fields in `Forms` using `Section` and `Group` for clarity.
  - Use standard LunarPHP models for e-commerce logic.

## Frontend (React/Next.js)
- **Standard**: Modern React best practices.
- **Styling**: Tailwind CSS v4 (CSS-first configuration).
- **Naming**:
  - Components: PascalCase.
  - Hooks/Utilities: camelCase.
  - Assets: kebab-case.
- **Structure**:
  - Modular components in `components/`.
  - Next.js App Router for all page routing.
- **TypeScript**: Full typing for props and responses.
- **Animations**: Prefer Framer Motion for interactive micro-animations.

## General
- **Version Control**: Conventional commits (feat, fix, refactor).
- **Environment**: All local development hosted in Docker.
- **Documentation**: Use high-level `CLAUDE.md` and `AGENTS.md` for project instructions.
