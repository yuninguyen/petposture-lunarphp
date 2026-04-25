# Concerns

## Technical Debt & Risks
- **Database Scalability**: The current use of SQLite (`database.sqlite`) is excellent for local development but will pose concurrency and performance issues for a live e-commerce site. Migration to PostgreSQL or MySQL is recommended for production.
- **Data Fragmentation**: Multiple SQLite files exist in the `database/` directory. Unifying these into a single database schema should be a priority.
- **Frontend Stability**: Lack of automated tests (Unit/Integration/E2E) on the frontend increases the risk of regressions during fast-paced development.
- **API Security**: As LunarPHP and Filament coexist, careful auditing is required to ensure that customer data exposed via APIs is properly protected by Sanctum and Spatie permissions.

## Open Questions
- **Deployment Strategy**: While Docker is present, a clear CI/CD pipeline and production hosting strategy (AWS, DigitalOcean, Vercel) needs to be defined.
- **Customer Auth**: Integration between Laravel Sanctum and the Next.js frontend for customer login/session management needs rigorous testing.

## Future Improvements
- **Search Engine Integration**: Implementing Meilisearch or Algolia for faster product discovery.
- **Cache Strategy**: Implementing Redis for session and cache management in a multi-container environment.
