# Integrations

## Payment Gateways
- **Default**: Cash in hand (Offline)
- **Status**: Local development setup. No live gateways (Stripe, PayPal, etc.) configured yet.

## Communication
- **Email**: 
  - Postmark (Configured in `services.php`)
  - Resend (Configured in `services.php`)
  - AWS SES (Configured in `services.php`)
- **Notifications**:
  - Slack (Bot OAuth configured in `services.php`)

## Search & Analytics
- **Status**: No external search (Algolia, Meilisearch) or analytics (Google Analytics, Mixpanel) integrations detected in the core config files.

## Infrastructure
- **Docker Compose**: Orchestrates backend, database, and potentially frontend/nginx services.
- **SQLite**: Local file-based database for development.
