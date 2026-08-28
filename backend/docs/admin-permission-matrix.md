# Admin role and permission matrix

The backend is authoritative. React navigation is only a convenience; `EnforceAdminApiPermission`, policies, and `Gate::authorize` enforce the same boundaries server-side.

| Role | Products/catalogue | Orders | Reviews | Posts/content | Refund | Publish products | Publish posts |
|---|---|---|---|---|---|---|---|
| `super_admin` | Full | Full | Full | Full | Yes | Yes | Yes |
| `admin` | Full | Full | Full | Full | Yes | Yes | Yes |
| `staff` | Full | Full | Full | Full | Yes | Yes | Yes |
| `Product Manager` | View/create/update/delete | None | View/moderate | None | No | Yes | No |
| `Order Manager` | None | View/update | None | None | Yes | No | No |
| `Support` | None | View/update | View/moderate | None | No | No | No |

## Permission names

- Products: `view_any_product`, `view_product`, `create_product`, `update_product`, `delete_product`, `delete_any_product`, `publish_product`.
- Orders: `view_any_order`, `view_order`, `update_order`, `refund_order`.
- Reviews: `view_any_review`, `view_review`, `update_review`, `delete_review`, `delete_any_review`.
- Posts: `view_any_post`, `view_post`, `create_post`, `update_post`, `delete_post`, `delete_any_post`, `publish_post`.

`publish_post` and `refund_order` are intentionally separate from generic update permissions. Supporting React catalogue routes (brands, collections, product types, custom fields, breeds, and solutions) are treated as product-domain operations by the API scope middleware.

## Interface behavior

- Core roles retain all React-admin navigation and routes.
- Product Manager sees only catalogue navigation and routes.
- Order Manager and Support use Filament for their order/support workflows; the React shell does not display unsupported content/catalogue actions.
- All six roles can authenticate consistently in Filament, React admin, and the storefront proxy.
- Any admin API path not explicitly mapped for a business role fails closed with HTTP 403.
