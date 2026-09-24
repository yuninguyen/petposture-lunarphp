# Storefront button system — design

## Decision

Introduce one dependency-free button primitive for the storefront and migrate only the conversion flow in the first release: Hero, product detail/card, cart, cart drawer, checkout, and checkout success.

The primitive owns visual hierarchy, button semantics, focus treatment, disabled state, and mobile target sizes. Existing request handlers, routes, cart state, and checkout payment logic remain unchanged.

## Problem

The storefront has 95 native buttons and CTA-styled links but no shared runtime primitive. The resulting conversion flow mixes square, 4px, 8px, 12px, 14px, pill, and unrounded controls. It also allows white text on the orange brand background in several CTA links, despite the palette defining dark `ink` text for accessible contrast.

## Goals

- Make all conversion CTAs read as one PetPosture system.
- Use `bg-secondary text-ink` for the orange primary action.
- Give primary and secondary CTAs a 48px standard height, with a 56px checkout size.
- Make compact mobile action targets at least 44px without enlarging their visible icon.
- Ensure native action buttons have an explicit `type`, focus-visible treatment, and disabled treatment.
- Preserve current copy, destinations, state updates, payment behavior, and responsive layout intent.

## Non-goals

- Migrating Account, Auth, Blog, Cookie, FAQ, Legal, Footer, and other non-conversion controls.
- Reworking cards, inputs, typography outside controls, routes, APIs, or backend data.
- Introducing a third-party class-variant dependency.
- Changing the dark `primary` color for controls rendered on dark surfaces.

## Component contract

Create `frontend/components/ui/Button.tsx` with a shared class builder and two renderers:

- `buttonClasses({ variant, size, className })` is a pure exported helper for visual parity.
- `Button` renders a native `<button>`, defaults `type` to `button`, and accepts the standard button attributes.
- `ButtonLink` renders Next `Link` with the same variants for navigation CTAs.

The component has no client state and introduces no new dependency.

### Variants

| Variant | Use | Visual contract |
|---|---|---|
| `primary` | Checkout, Add to Cart, primary form submission | `secondary` orange background, `ink` text, darkened orange hover |
| `secondary` | Alternate navigation action | White background, primary border/text, primary hover fill |
| `quiet` | Low-emphasis supporting action | Transparent, primary text, light neutral hover |
| `dark` | Only when a filled dark action is required outside the main primary hierarchy | Primary background, white text |

### Sizes

| Size | Intended controls | Contract |
|---|---|---|
| `md` | Standard CTA | `h-12`, horizontal padding, `rounded-md` |
| `lg` | Checkout confirmation | `h-14`, horizontal padding, `rounded-md` |
| `icon` | Quantity, wishlist, compact action | `h-11 w-11`; icon itself stays visually compact |

All text CTAs use `font-bold`, uppercase, and `tracking-[0.08em]`. Controls may use `rounded-full` only when they are chips/tabs, not primary CTAs.

## Conversion-flow migration

1. **Hero** — replace the two navigation CTA class strings with `ButtonLink` primary and secondary variants.
2. **Product detail and product card** — migrate Add to Cart and product navigation CTA; preserve option selectors as their own control type.
3. **Cart page and cart drawer** — make Checkout the sole orange primary CTA, convert View Cart/Continue Shopping to secondary, and make quantity controls 44px targets.
4. **Checkout and order summary** — migrate the purchase CTA to `lg primary`, declare `type="submit"`, and retain existing disabled/loading behavior.
5. **Checkout success** — migrate navigation CTAs and remove orange-plus-white text combinations.

Existing icons, labels, and ordering stay unchanged. A conversion page is never migrated by changing unrelated page layout or card styling.

## Accessibility and interaction rules

- Orange primary uses `text-ink`, never white.
- All rendered buttons provide `focus-visible` ring using the existing secondary focus token.
- Icon-only controls require an `aria-label`.
- Non-submit controls declare `type="button"`; checkout confirmation declares `type="submit"`.
- Loading/disabled controls stay visible, are non-interactive, and expose the existing disabled state.

## Verification

- Add focused tests for each variant's color, size, and default type, including the absence of `text-white` on `primary`.
- Add conversion-flow coverage for the checkout submit button and preserve the existing cart/product event paths.
- Inspect Hero, product, cart, cart drawer, checkout, and checkout success at 320px, 375px, and 390px.
- Run ESLint for touched files, the frontend test suite, production build, `git diff --check`, and staged GitNexus change detection before commit.

## Rollout

This is Phase 1 only. The remaining storefront controls are audited but not changed. A follow-up phase can migrate Account, Auth, Blog, Cookie, filters, and content controls after the conversion system is live and visually accepted.
