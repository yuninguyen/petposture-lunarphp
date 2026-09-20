/**
 * Mirrors the real Spatie permission grants from the Phase 6b backend
 * RoleSeeder (commits 9441618..2b5b602). Only abilities actually checked by
 * frontend navigation/route guards are listed — this is not a full mirror of
 * every backend permission per role. Used as the single source of truth for
 * frontend parity tests proving the ability-based nav/route logic produces
 * identical results to the old role-based logic (Phase 6d).
 */

const DASHBOARD = ['view_dashboard_sales', 'view_dashboard_conversion'];
const ORDERS_WITH_REFUND = ['view_any_order', 'refund_order'];
const ORDERS_NO_REFUND = ['view_any_order'];
const RETURN_REQUESTS = ['view_any_return_request'];
const REVIEWS = ['view_any_review', 'delete_review'];
const CATALOGUE = [
  'view_any_product',
  'view_any_product_type',
  'view_any_custom_field',
  'view_any_brand',
  'view_any_collection_group',
  'view_any_collection',
  'view_any_breed',
  'view_any_solution',
];
const CUSTOMERS = ['view_any_customer'];
const SHIPPING = ['view_any_shipping_method'];
const DISCOUNTS = ['view_any_discount'];
const FINANCE = ['view_any_goal', 'view_any_payment_method'];
const CONTENT = [
  'view_any_blog_category',
  'view_any_post',
  'view_any_comment',
  'view_any_blog_tag',
  'view_seo_social',
  'view_any_page',
];
const AFFILIATE = ['view_any_affiliate_report', 'view_any_affiliate_network'];
const SYSTEM = [
  'view_any_system_user',
  'view_any_role',
  'view_any_system_media',
  'view_any_activity_log',
  'view_general_settings',
];

const CORE = [
  ...DASHBOARD,
  ...ORDERS_WITH_REFUND,
  ...RETURN_REQUESTS,
  ...REVIEWS,
  ...CATALOGUE,
  ...CUSTOMERS,
  ...SHIPPING,
  ...DISCOUNTS,
  ...FINANCE,
  ...CONTENT,
  ...AFFILIATE,
  ...SYSTEM,
];

export const ROLE_ABILITIES: Record<string, string[]> = {
  super_admin: CORE,
  admin: CORE,
  staff: CORE,
  'Product Manager': [...CATALOGUE, ...REVIEWS],
  'Order Manager': [...DASHBOARD, ...ORDERS_WITH_REFUND, ...RETURN_REQUESTS],
  Support: [...DASHBOARD, ...ORDERS_NO_REFUND, ...RETURN_REQUESTS, ...REVIEWS],
  customer: [],
};

export function abilitiesFor(roles: string[]): string[] {
  const set = new Set<string>();
  for (const role of roles) {
    for (const ability of ROLE_ABILITIES[role] ?? []) set.add(ability);
  }
  return Array.from(set);
}
