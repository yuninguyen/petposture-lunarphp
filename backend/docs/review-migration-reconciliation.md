# Review → Lunar product migration reconciliation

Migration: `2026_07_17_000002_migrate_reviews_to_lunar_products.php`

## Forward migration

1. Take a database backup.
2. Keep `products`, `product_sync_mappings`, and `lunar_products` intact.
3. Ensure every distinct `reviews.product_id` has exactly one valid `product_sync_mappings.legacy_product_id → lunar_product_id` row whose Lunar product still exists.
4. Run the normal Laravel migration command.

The migration prints its counts in any thrown exception:

- `reviews`: existing review rows;
- `mappable`: rows with a valid legacy → Lunar mapping;
- `unmapped`: rows that would become orphaned.

If `unmapped` is non-zero, the migration fails before changing the review schema. Add or repair the missing product mappings, then retry. The legacy `product_id` column is dropped only after every review has a populated `lunar_product_id`.

## Rollback

1. Take another backup before rollback.
2. Do **not** remove legacy products or `product_sync_mappings`; rollback needs the reverse Lunar → legacy mapping.
3. Run Laravel rollback for the batch containing this migration.

Rollback performs the same preflight in reverse. If any Lunar product ID cannot map to an existing legacy product, rollback fails and preserves the Lunar review schema. Repair the mapping, then retry.

## Recovery after an interrupted migration

If infrastructure interruption occurs after `lunar_product_id` was added but before `product_id` was dropped:

1. Keep both columns.
2. Compare review rows against `product_sync_mappings` and repair any missing mapping.
3. Re-run the migration after restoring the migration record/state appropriate to the deployment tool.
4. Do not manually drop either product column until every row has both a valid legacy and Lunar ID.
