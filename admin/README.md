# PetPosture Admin

A React-based admin dashboard for managing PetPosture blog content, built with Vite, TypeScript, TanStack Query, React Hook Form, and TipTap editor.

## About

This is a frontend-only Vite/React application that provides an admin interface for:
- Creating and editing blog posts (draft/published)
- Managing blog categories
- Uploading and selecting featured images
- User authentication and role-based access control

## Getting Started

### Prerequisites

- Node.js (v22 or later — this worktree uses Laragon's bundled Node v22 to avoid localStorage conflicts)
- npm

### Installation

```bash
npm install
```

### Development

Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173` by default.

### Build

Create an optimized production build:

```bash
npm run build
```

The compiled files will be in the `dist/` directory.

### Testing

Run the test suite:

```bash
npm run test
```

## Architecture

### Project Structure

```
src/
  features/
    auth/        - Login page and authentication
    posts/       - Blog post CRUD operations
    media/       - Image upload and library picker
  components/
    ui/          - Reusable UI components (Button, Input, Card, Textarea)
  layouts/
    AppShell.tsx - Main layout with header and navigation
  lib/
    api.ts       - Fetch wrapper with auth token injection
    auth.ts      - Auth state and token management
    queryClient.ts - TanStack Query configuration
  main.tsx       - Application entry point
```

### Key Technologies

- **Vite**: Fast build tool and dev server
- **React 18**: UI library
- **React Router 6**: Client-side routing
- **TanStack Query 5**: Server state management and caching
- **React Hook Form 7**: Form state and validation
- **Zod**: Schema validation
- **TipTap 2**: Rich text editor for post content
- **Tailwind CSS 3**: Utility-first styling
- **Vitest**: Unit testing with jsdom DOM environment

### API Integration

The app communicates with a Laravel backend via REST endpoints at `/admin/*`. Authentication is token-based (JWT), stored in localStorage and injected into all requests via the `fetchJson` helper.

## Internationalization (i18n)

The admin interface supports Vietnamese and English with full i18n implementation using i18next and react-i18next.

### Translation Files

- `src/locales/vi.json` - Vietnamese translations
- `src/locales/en.json` - English translations

### Language Switcher

A language selector is available in the AppShell header. Language preference is persisted to localStorage and restored on app reload.

### Adding New Translations

1. Add the new key and translations to both `src/locales/vi.json` and `src/locales/en.json`
2. Use the `useTranslation()` hook in components:
   ```tsx
   const { t } = useTranslation();
   return <p>{t('some.key')}</p>;
   ```

### Notes

- Node v25+ has native `--webstorage` support that shadows jsdom's `localStorage`, breaking DOM-dependent tests. Always use Node v22 for this project (Laragon's bundled version).
