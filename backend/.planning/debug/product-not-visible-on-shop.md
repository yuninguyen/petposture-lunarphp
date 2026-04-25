---
status: investigating
trigger: "Uploaded products but they don't appear on shop page"
created: 2026-04-22
updated: 2026-04-22
---

# Symptoms
- **Expected behavior**: Products created in Admin should appear on `localhost:3000/shop`.
- **Actual behavior**: Frontend shows 0 results. API calls return 404 for products.
- **Error messages**: 404 Not Found for `/api/products/{slug}` and empty data from `/api/products`.
- **Timeline**: Started after manual product creation in Admin.
- **Reproduction**: Access `localhost:3000/shop`.

# Current Focus
- **hypothesis**: Products are missing associations (Channels, Customer Groups) or have incorrect status in the database.
- **test**: Fetch products directly from SQL or a scripts/check_products.php script to verify attribute_data, status, and relationship links.
- **expecting**: Products to have `status != 'published'` or missing `channel_id` / `customer_group_id` links in pivot tables.
- **next_action**: Run diagnostics script to check database consistency.

# Evidence
- timestamp: 2026-04-21T18:00:00Z
  observation: Browser subagent confirmed 4 products in admin but 0 in shop.

# Eliminated Hypotheses
- None yet.

# Resolution
- root_cause: 
- fix: 
- verification: 
- files_changed: 
