# Storefront Button System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Standardize the Phase 1 storefront conversion-flow controls on one accessible, dependency-free button primitive without changing cart, checkout, or routing behavior.

**Architecture:** Add a presentational \`Button\` module with one pure class builder and separate native-button/link renderers. Migrate only the approved conversion controls to that contract; all existing callbacks, \`Link\` destinations, cart context calls, loading flags, and checkout submission stay intact. Tests verify the primitive at runtime and lock the approved migration surface through focused source contracts.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS utilities, Vitest, Node source-contract assertions, GitNexus.

**Spec:** \`docs/superpowers/specs/2026-09-25-storefront-button-system-design.md\`

## Global Constraints

- Scope is Phase 1 only: Hero, product detail/card, cart page/drawer, checkout completion, and checkout-success navigation. Do not migrate Account, Auth, Blog, Cookie, FAQ, Legal, Footer, filters, or unrelated controls.
- Create no third-party dependency and do not change \`frontend/app/globals.css\` legacy \`.btn\` rules in this release.
- Preserve all copy, hrefs, cart context calls, router pushes, selected variants, coupon behavior, payment method behavior, disabled conditions, and loading copy.
- \`primary\` always uses \`bg-secondary text-ink\`; no orange primary CTA may use \`text-white\`.
- Text CTAs use bold, uppercase text with \`tracking-[0.08em]\`; standard CTA size is 48px, checkout submit is 56px, and icon targets are 44 by 44px.
- Non-submit native actions default to \`type="button"\`; the checkout confirmation explicitly sets \`type="submit"\`. Every icon-only control has an \`aria-label\`.
- Before editing each existing component symbol, run \`gitnexus_impact({ target, direction: "upstream", repo: "petposture" })\`, report its direct-caller/process/risk result to the user, and stop for direction if its risk is HIGH or CRITICAL.
- Before every commit, run \`git diff --check\` and \`gitnexus_detect_changes({ repo: "petposture", scope: "staged" })\`; stage only files named in that task. The worktree already contains unrelated user changes and untracked files that must remain untouched.

---

## File Structure

| File | Responsibility |
|---|---|
| \`frontend/components/ui/Button.tsx\` | New reusable visual/semantic contract: variants, sizes, default native type, and Next Link renderer. |
| \`frontend/components/ui/Button.test.tsx\` | Runtime unit tests for the primitive plus narrowly scoped source contracts for each Phase 1 migration. |
| \`frontend/package.json\` | Adds the new Vitest file to the existing explicit frontend test command. |
| \`frontend/components/Hero.tsx\` | Converts the two hero navigation CTAs to \`ButtonLink\`. |
| \`frontend/components/product/ProductDetails.tsx\` | Converts product quantity actions and primary Add to Cart action without changing selected-variant/cart behavior. |
| \`frontend/components/shop/ProductCard.tsx\` | Converts wishlist, View, and Add to Cart controls while preserving the card links and wishlist/cart callbacks. |
| \`frontend/app/cart/page.tsx\` | Converts cart page navigation/checkout/coupon/quantity/remove controls and retains coupon/shipping math. |
| \`frontend/components/shop/CartDrawer.tsx\` | Converts drawer compact actions and CTA hierarchy without changing close, quantity, remove, or routing behavior. |
| \`frontend/components/CheckoutPage.tsx\` | Converts only the form completion control to an explicit \`lg primary\` submit button. |
| \`frontend/components/CheckoutSuccessPage.tsx\` | Converts duplicated desktop/mobile success navigation CTAs and removes orange-plus-white text. |

\`frontend/components/checkout/OrderSummary.tsx\` is intentionally reviewed but not changed: its Apply, expand, shipping-details, and modal-close actions already declare \`type="button"\` and are auxiliary checkout controls, not the approved purchase CTA. Its data, totals, and coupon behavior remain out of scope.

### Task 1: Add the button primitive and its executable contract

**Files:**

- Create: \`frontend/components/ui/Button.tsx\`
- Create: \`frontend/components/ui/Button.test.tsx\`
- Modify: \`frontend/package.json\`

**Interfaces:**

- Produces: \`ButtonVariant = "primary" | "secondary" | "quiet" | "dark"\`, \`ButtonSize = "md" | "lg" | "icon"\`, \`buttonClasses(options)\`, \`Button(props)\`, and \`ButtonLink(props)\`.
- Consumes: React native button/anchor attributes and \`next/link\` only; it has no client state and no dependency beyond the existing app.

- [ ] **Step 1: Write the primitive’s failing test file and register it in the existing test command.**

  Create \`frontend/components/ui/Button.test.tsx\` with runtime assertions such as:

  \`\`\`tsx
  import { renderToStaticMarkup } from "react-dom/server";
  import { describe, expect, it } from "vitest";
  import { Button, buttonClasses } from "./Button";

  describe("buttonClasses", () => {
    it.each([
      ["primary", "bg-secondary", "text-ink"],
      ["secondary", "border-primary", "text-primary"],
      ["quiet", "bg-transparent", "text-primary"],
      ["dark", "bg-primary", "text-white"],
    ] as const)("%s exposes its visual contract", (variant, requiredBackground, requiredText) => {
      const classes = buttonClasses({ variant });
      expect(classes).toContain(requiredBackground);
      expect(classes).toContain(requiredText);
    });

    it("keeps orange primary text accessible and exposes all three sizes", () => {
      expect(buttonClasses({ variant: "primary" })).not.toContain("text-white");
      expect(buttonClasses({ size: "md" })).toContain("h-12");
      expect(buttonClasses({ size: "lg" })).toContain("h-14");
      expect(buttonClasses({ size: "icon" })).toContain("h-11");
      expect(buttonClasses({ size: "icon" })).toContain("w-11");
    });
  });

  it("defaults a native action to type button and preserves disabled semantics", () => {
    const markup = renderToStaticMarkup(<Button disabled>Save</Button>);
    expect(markup).toContain('type="button"');
    expect(markup).toContain("disabled");
  });
  \`\`\`

  Amend the \`test\` script in \`frontend/package.json\` by appending \`components/ui/Button.test.tsx\` to its existing explicit Vitest file list. Do not replace the existing list or alter any other script.

- [ ] **Step 2: Run the focused test to verify it fails because the module does not exist.**

  Run: \`rtk npm --prefix frontend exec vitest -- run components/ui/Button.test.tsx\`

  Expected: FAIL with module resolution error for \`./Button\`.

- [ ] **Step 3: Implement the dependency-free component contract.**

  Create \`frontend/components/ui/Button.tsx\` with the following public shape and class policy:

  \`\`\`tsx
  import Link, { type LinkProps } from "next/link";
  import type {
    AnchorHTMLAttributes,
    ButtonHTMLAttributes,
    ReactNode,
  } from "react";

  export type ButtonVariant = "primary" | "secondary" | "quiet" | "dark";
  export type ButtonSize = "md" | "lg" | "icon";

  type ButtonClassOptions = {
    variant?: ButtonVariant;
    size?: ButtonSize;
    className?: string;
  };

  const variantClasses: Record<ButtonVariant, string> = {
    primary: "bg-secondary text-ink hover:bg-secondary-dark",
    secondary: "border border-primary bg-white text-primary hover:bg-primary hover:text-white",
    quiet: "bg-transparent text-primary hover:bg-zinc-100",
    dark: "bg-primary text-white hover:bg-[#2c363e]",
  };

  const sizeClasses: Record<ButtonSize, string> = {
    md: "h-12 rounded-md px-6 text-sm",
    lg: "h-14 rounded-md px-6 text-[15px]",
    icon: "h-11 w-11 rounded-md p-0",
  };

  export function buttonClasses({
    variant = "primary",
    size = "md",
    className,
  }: ButtonClassOptions = {}) {
    return [
      "inline-flex items-center justify-center whitespace-nowrap font-bold uppercase tracking-[0.08em] transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2",
      "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
      variantClasses[variant],
      sizeClasses[size],
      className,
    ].filter(Boolean).join(" ");
  }

  export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & ButtonClassOptions;

  export function Button({
    type = "button",
    variant,
    size,
    className,
    ...props
  }: ButtonProps) {
    return <button type={type} className={buttonClasses({ variant, size, className })} {...props} />;
  }

  export type ButtonLinkProps = LinkProps
    & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps | "className">
    & ButtonClassOptions
    & { children: ReactNode };

  export function ButtonLink({ variant, size, className, ...props }: ButtonLinkProps) {
    return <Link {...props} className={buttonClasses({ variant, size, className })} />;
  }
  \`\`\`

  Keep the focus ring and disabled styles in the base classes. Do not add \`"use client"\`, state, a loading prop, a class-merging package, or global CSS.

- [ ] **Step 4: Run the focused test and lint after implementation.**

  Run:

  \`\`\`powershell
  rtk npm --prefix frontend exec vitest -- run components/ui/Button.test.tsx
  rtk npm --prefix frontend run lint -- components/ui/Button.tsx components/ui/Button.test.tsx
  \`\`\`

  Expected: all primitive assertions pass and ESLint reports no errors.

- [ ] **Step 5: Inspect the staged scope and commit the primitive.**

  Stage only \`frontend/components/ui/Button.tsx\`, \`frontend/components/ui/Button.test.tsx\`, and \`frontend/package.json\`. Run \`rtk git diff --check\`, then call \`gitnexus_detect_changes({ repo: "petposture", scope: "staged" })\`. Confirm only the new UI module/test and test-script change are present, then commit:

  \`\`\`powershell
  rtk git commit -m "feat(frontend): add storefront button primitive"
  \`\`\`

### Task 2: Migrate Hero and product conversion controls

**Files:**

- Modify: \`frontend/components/Hero.tsx:3-62\`
- Modify: \`frontend/components/product/ProductDetails.tsx:1-247\`
- Modify: \`frontend/components/shop/ProductCard.tsx:1-117\`
- Modify: \`frontend/components/ui/Button.test.tsx\`

**Interfaces:**

- Consumes: \`Button\` and \`ButtonLink\` from \`@/components/ui/Button\`; existing \`useCart().addItem\`, \`useWishlist()\`, and product route strings.
- Produces: hero/product CTAs that share the primitive classes without changing the event callbacks or Link destinations.

- [ ] **Step 1: Run required impact analysis before touching the existing symbols.**

  Call:

  \`\`\`text
  gitnexus_impact({ target: "Hero", direction: "upstream", repo: "petposture" })
  gitnexus_impact({ target: "ProductDetails", direction: "upstream", repo: "petposture" })
  gitnexus_impact({ target: "ProductCard", direction: "upstream", repo: "petposture" })
  \`\`\`

  Record direct callers, affected processes, and risk in the implementation update. If any response is HIGH or CRITICAL, stop before editing and request approval; otherwise continue.

- [ ] **Step 2: Extend the test with migration contracts, then run it to verify it fails.**

  Append source assertions that read the three files with \`readFileSync(new URL(..., import.meta.url), "utf8")\`. Assert all of the following:

  \`\`\`tsx
  expect(heroSource).toMatch(/import\s+\{\s*ButtonLink\s*\}\s+from\s+["']@\/components\/ui\/Button["']/);
  expect(heroSource).toMatch(/href="\/dogs"[\s\S]*variant="primary"/);
  expect(heroSource).toMatch(/href="\/shop\/solutions"[\s\S]*variant="secondary"/);

  expect(detailsSource).toMatch(/<Button\s+type="button"\s+variant="primary"/);
  expect(detailsSource).toMatch(/aria-label="Decrease quantity"/);
  expect(detailsSource).toMatch(/aria-label="Increase quantity"/);

  expect(cardSource).toMatch(/<ButtonLink[\s\S]*variant="quiet"/);
  expect(cardSource).toMatch(/<Button\s+type="button"\s+variant="primary"/);
  expect(cardSource).toMatch(/<Button[\s\S]*size="icon"[\s\S]*aria-label=\{wishlisted/);
  \`\`\`

  Run: \`rtk npm --prefix frontend exec vitest -- run components/ui/Button.test.tsx\`

  Expected: FAIL because none of the three sources imports/uses the new primitive yet.

- [ ] **Step 3: Replace only approved Hero and product controls.**

  In \`Hero.tsx\`, replace the \`next/link\` import and both CTA nodes with \`ButtonLink\`:

  \`\`\`tsx
  <ButtonLink
    href="/dogs"
    variant="primary"
    className="w-full px-3 shadow-md min-[400px]:flex-1 lg:px-7"
    style={{ fontFamily: "var(--font-lato)", whiteSpace: "nowrap" }}
  >
    Find Your Breed
  </ButtonLink>
  \`\`\`

  Use the same preserved layout/style props for \`/shop/solutions\`, but set \`variant="secondary"\`. Remove duplicate font, text-transform, color, hover, and unrounded CTA classes because the primitive supplies them.

  In \`ProductDetails.tsx\`, import \`Button\`. Keep the selected-variant object construction and the \`for\` loop invoking \`addItem(itemToAdd)\` byte-for-byte in behavior. Render its Add to Cart control as:

  \`\`\`tsx
  <Button
    type="button"
    variant="primary"
    disabled={!isAvailable}
    className="w-full shadow-xl shadow-orange-500/20"
    onClick={() => {
      const itemToAdd = selectedVariant
        ? {
            ...product,
            variantId: selectedVariant.id,
            price: selectedVariant.price,
            oldPrice: selectedVariant.comparePrice ?? product.oldPrice,
            image: selectedVariant.image || product.image,
          }
        : product;
      for (let i = 0; i < quantity; i++) addItem(itemToAdd);
    }}
  >
    {isAvailable ? "Add to cart" : "Out of stock"}
  </Button>
  \`\`\`

  Keep the 54px quantity container but turn its plus/minus actions into \`Button size="icon" variant="quiet"\` instances with \`aria-label="Decrease quantity"\` / \`"Increase quantity"\`; retain the same \`setQuantity\` arithmetic and use a local class override only where the 54px container needs visual alignment. Do not migrate accordion or option-selector controls.

  In \`ProductCard.tsx\`, import \`Button\` and \`ButtonLink\`. Preserve the image and title \`Link\` elements as plain semantic product links. Convert the wishlist toggle to \`Button size="icon" variant="quiet"\` while retaining its current \`onClick\`, \`aria-pressed\`, and circular visual override; convert the existing \`View\` route CTA to \`ButtonLink variant="quiet"\`; and convert Add to Cart to:

  \`\`\`tsx
  <Button
    type="button"
    variant="primary"
    className="mt-4 w-full"
    onClick={() => addItem(product)}
  >
    Add to Cart
  </Button>
  \`\`\`

  Preserve badge styles, card radius, price formatting, wishlist state, and product URL construction.

- [ ] **Step 4: Run focused regression checks and inspect product layouts.**

  Run:

  \`\`\`powershell
  rtk npm --prefix frontend exec vitest -- run components/ui/Button.test.tsx
  rtk npm --prefix frontend run lint -- components/Hero.tsx components/product/ProductDetails.tsx components/shop/ProductCard.tsx components/ui/Button.test.tsx
  \`\`\`

  In a local browser at 320px, 375px, and 390px widths, verify Hero CTAs stay stacked below 400px; product-card buttons fit without clipping; wishlist has a 44px target; and Add to Cart still updates the cart exactly once per intended quantity.

- [ ] **Step 5: Detect staged changes and commit the Hero/product migration.**

  Stage only the three migrated components and \`Button.test.tsx\`. Run \`rtk git diff --check\`, then \`gitnexus_detect_changes({ repo: "petposture", scope: "staged" })\`; verify that all changed symbols are Hero/product presentation paths and no cart/context handler changed. Commit:

  \`\`\`powershell
  rtk git commit -m "refactor(frontend): standardize hero and product ctas"
  \`\`\`

### Task 3: Migrate cart page and cart drawer actions

**Files:**

- Modify: \`frontend/app/cart/page.tsx:1-356\`
- Modify: \`frontend/components/shop/CartDrawer.tsx:1-148\`
- Modify: \`frontend/components/ui/Button.test.tsx\`

**Interfaces:**

- Consumes: \`Button\` / \`ButtonLink\`, unchanged \`useCart\` methods, and existing \`router.push\` calls.
- Produces: one orange checkout CTA, secondary navigation actions, and 44px compact targets without altering totals, coupons, quantities, or routing.

- [ ] **Step 1: Run required impact analysis before editing the cart components.**

  Call:

  \`\`\`text
  gitnexus_impact({ target: "CartPage", direction: "upstream", repo: "petposture" })
  gitnexus_impact({ target: "CartDrawer", direction: "upstream", repo: "petposture" })
  \`\`\`

  If \`CartPage\` needs file-based disambiguation, use \`file_path: "frontend/app/cart/page.tsx"\`. Report the risk result before proceeding and stop on HIGH/CRITICAL.

- [ ] **Step 2: Add cart source contracts and run the focused test to verify they fail.**

  Add assertions proving:

  \`\`\`tsx
  expect(cartPageSource).toMatch(/href="\/shop"[\s\S]*variant="secondary"/);
  expect(cartPageSource).toMatch(/variant="primary"[\s\S]*router\.push\(["']\/checkout["']\)/);
  expect(cartPageSource).toMatch(/size="icon"[\s\S]*aria-label="Decrease quantity"/);
  expect(drawerSource).toMatch(/variant="secondary"[\s\S]*Continue Shopping/);
  expect(drawerSource).toMatch(/variant="primary"[\s\S]*Checkout/);
  expect(drawerSource).toMatch(/size="icon"[\s\S]*aria-label="Remove item"/);
  \`\`\`

  These contracts check the approved semantics rather than arbitrary class ordering. Run: \`rtk npm --prefix frontend exec vitest -- run components/ui/Button.test.tsx\`. Expected: FAIL before migration.

- [ ] **Step 3: Apply the cart hierarchy without touching cart state.**

  In \`app/cart/page.tsx\`, import both primitive exports and:

  - replace Continue Shopping with \`ButtonLink href="/shop" variant="secondary"\`, preserving the ArrowLeft child and group animation;
  - replace Proceed to Checkout with \`Button type="button" variant="primary"\` and retain \`onClick={() => router.push("/checkout")}\`;
  - replace Apply Coupon with \`Button type="button" variant="secondary"\`, retaining \`disabled={isApplying}\`, \`onClick={handleApplyCoupon}\`, and the existing loading copy;
  - replace the four cart-page increment/decrement buttons with \`Button type="button" size="icon" variant="quiet"\` and retain their exact \`updateQuantity\` arguments;
  - replace each remove control with a labelled \`Button type="button" size="icon" variant="quiet"\`, retaining \`removeItem(item.variantId)\`.

  In \`CartDrawer.tsx\`, import \`Button\` and convert close/remove/quantity controls to labelled \`size="icon" variant="quiet"\` buttons; use \`variant="secondary"\` for Continue Shopping and View Cart; use \`variant="primary"\` for Checkout. Keep every current \`setCartOpen(false)\`, \`router.push\`, \`updateQuantity\`, and \`removeItem\` callback unchanged.

  For every converted CTA, append only layout/shadow classes that are not owned by the primitive. Do not retain old \`rounded-[4px]\`, \`bg-primary\`, \`text-white\`, \`py-4\`, or \`h-7 w-7\` CTA sizing classes.

- [ ] **Step 4: Run regression checks and exercise mobile cart behavior.**

  Run:

  \`\`\`powershell
  rtk npm --prefix frontend exec vitest -- run components/ui/Button.test.tsx
  rtk npm --prefix frontend run lint -- app/cart/page.tsx components/shop/CartDrawer.tsx components/ui/Button.test.tsx
  \`\`\`

  At 320px, 375px, and 390px, confirm each plus/minus/remove hit target is at least 44px, quantities and prices do not overlap, empty-cart Continue Shopping still closes the drawer, View Cart still navigates to \`/cart\`, Checkout still navigates to \`/checkout\`, and coupon submission preserves its pending/disabled state.

- [ ] **Step 5: Inspect scope and commit the cart migration.**

  Stage only \`frontend/app/cart/page.tsx\`, \`frontend/components/shop/CartDrawer.tsx\`, and \`frontend/components/ui/Button.test.tsx\`. Run \`rtk git diff --check\` and \`gitnexus_detect_changes({ repo: "petposture", scope: "staged" })\`; confirm the report excludes CartContext and pricing/API logic. Commit:

  \`\`\`powershell
  rtk git commit -m "refactor(frontend): unify cart action controls"
  \`\`\`

### Task 4: Migrate checkout completion and order-success navigation

**Files:**

- Modify: \`frontend/components/CheckoutPage.tsx:1-1847\`
- Modify: \`frontend/components/CheckoutSuccessPage.tsx:1-547\`
- Modify: \`frontend/components/ui/Button.test.tsx\`

**Interfaces:**

- Consumes: \`Button\` in the checkout form and \`ButtonLink\` on the success page; existing \`handleCheckout\`, loading flags, payment status, tracking query values, and routes.
- Produces: the sole 56px checkout submit action and success navigation CTAs with accessible brand colors.

- [ ] **Step 1: Run required impact analysis before editing checkout symbols.**

  Call:

  \`\`\`text
  gitnexus_impact({ target: "CheckoutPage", direction: "upstream", repo: "petposture" })
  gitnexus_impact({ target: "OrderSuccessContent", direction: "upstream", repo: "petposture" })
  \`\`\`

  If GitNexus cannot resolve the nested success component, rerun with \`file_path: "frontend/components/CheckoutSuccessPage.tsx"\` and use source inspection to confirm the two desktop/mobile blocks. Report callers/processes/risk and stop on HIGH/CRITICAL.

- [ ] **Step 2: Add the final migration assertions and verify their initial failure.**

  Append assertions that enforce:

  \`\`\`tsx
  expect(checkoutSource).toMatch(/<Button\s+type="submit"\s+variant="primary"\s+size="lg"/);
  expect(checkoutSource).toMatch(/disabled=\{isLoading \|\| items\.length === 0 \|\| paypalPopupWaiting\}/);
  expect(successSource).toMatch(/href="\/shop"[\s\S]*variant="primary"/);
  expect(successSource).toMatch(/returns\?token=/);
  expect(successSource).toMatch(/variant="secondary"/);
  expect(successSource).not.toMatch(/bg-\[#df8448\][^"]*text-white/);
  \`\`\`

  Run: \`rtk npm --prefix frontend exec vitest -- run components/ui/Button.test.tsx\`

  Expected: FAIL because completion is a native button without \`type\`, and success links still combine orange with white text.

- [ ] **Step 3: Replace only the approved checkout and success controls.**

  In \`CheckoutPage.tsx\`, import \`Button\` and replace the button inside \`<form onSubmit={handleCheckout}>\` with:

  \`\`\`tsx
  <Button
    type="submit"
    variant="primary"
    size="lg"
    disabled={isLoading || items.length === 0 || paypalPopupWaiting}
    className="w-full gap-2 shadow-[0_14px_30px_rgba(223,132,72,0.22)]"
  >
    {/* keep the existing waiting/loading/default child branches unchanged */}
  </Button>
  \`\`\`

  Do not add an \`onClick\`, alter \`handleCheckout\`, change the \`form\` element, or modify \`OrderSummary.tsx\`.

  In \`CheckoutSuccessPage.tsx\`, replace the two duplicated Continue shopping links with \`ButtonLink href="/shop" variant="primary"\`. Replace each conditional Request a return link with \`ButtonLink variant="secondary"\`, preserve its tracking-token/email href expression, and preserve the desktop/mobile width/layout classes. Remove \`bg-[#df8448]\`, \`text-white\`, old CTA radius, and old CTA height classes because the primitive supplies the approved styling.

- [ ] **Step 4: Run the complete frontend regression suite and perform checkout visual QA.**

  Run:

  \`\`\`powershell
  rtk npm --prefix frontend test
  rtk npm --prefix frontend run lint -- components/CheckoutPage.tsx components/CheckoutSuccessPage.tsx components/ui/Button.tsx components/ui/Button.test.tsx
  rtk npm --prefix frontend run build
  \`\`\`

  With a safe test cart, inspect 320px, 375px, and 390px widths: disabled/waiting payment copy remains visible and inert; Complete order is 56px and submits only through the form; success Continue shopping is orange with ink text; Request a return is secondary; no clipped CTAs or lost focus ring occur.

- [ ] **Step 5: Perform final staged GitNexus review and commit the checkout/success migration.**

  Stage only \`frontend/components/CheckoutPage.tsx\`, \`frontend/components/CheckoutSuccessPage.tsx\`, and \`frontend/components/ui/Button.test.tsx\`. Run \`rtk git diff --check\`, then \`gitnexus_detect_changes({ repo: "petposture", scope: "staged" })\`. Review every affected process; specifically confirm no API handler, payment flow, cart context, or route contract appears as a changed symbol. Commit:

  \`\`\`powershell
  rtk git commit -m "refactor(frontend): standardize checkout ctas"
  \`\`\`

## Final Acceptance Checklist

- [ ] Every Phase 1 primary CTA uses \`bg-secondary text-ink\`, with no orange-plus-white CTA left in Hero, product, cart, checkout, or success paths.
- [ ] Hero, product card/detail, cart page/drawer, checkout submit, and success links import the shared primitive; all non-conversion areas and legacy global button styles remain unchanged.
- [ ] All converted native buttons have explicit/default-safe type behavior, disabled behavior, focus-visible styling, and labels for icon-only actions.
- [ ] Quantity, wishlist, close, and remove controls tested in scope have 44px targets without changing their callback arguments.
- [ ] Focused component test, \`rtk npm --prefix frontend test\`, ESLint of all touched files, and \`rtk npm --prefix frontend run build\` pass.
- [ ] Visual acceptance is recorded at 320px, 375px, and 390px for Hero, product, cart page/drawer, checkout, and success.
- [ ] No unrelated dirty or untracked worktree file is staged; GitNexus staged-change detection was reviewed before every commit.
