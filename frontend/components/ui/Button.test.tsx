import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button, buttonClasses } from "./Button";

describe("buttonClasses", () => {
  it.each([
    ["primary", "bg-secondary", "text-ink"],
    ["secondary", "border-primary", "text-primary"],
    ["quiet", "bg-transparent", "text-primary"],
    ["dark", "bg-primary", "text-white"],
  ] as const)(
    "%s exposes its visual contract",
    (variant, requiredBackground, requiredText) => {
      const classes = buttonClasses({ variant });
      expect(classes).toContain(requiredBackground);
      expect(classes).toContain(requiredText);
    },
  );

  it("keeps orange primary text accessible and exposes all three sizes", () => {
    expect(buttonClasses({ variant: "primary" })).not.toContain("text-white");
    expect(buttonClasses({ size: "md" })).toContain("h-12");
    expect(buttonClasses({ size: "lg" })).toContain("h-14");
    expect(buttonClasses({ size: "icon" })).toContain("h-11");
    expect(buttonClasses({ size: "icon" })).toContain("w-11");
    expect(buttonClasses({ size: "md" })).toContain("rounded-[3px]");
    expect(buttonClasses({ size: "lg" })).toContain("rounded-[3px]");
    expect(buttonClasses({ size: "icon" })).toContain("rounded-[3px]");
  });
});

it("defaults a native action to type button and preserves disabled semantics", () => {
  const markup = renderToStaticMarkup(<Button disabled>Save</Button>);
  expect(markup).toContain('type="button"');
  expect(markup).toContain("disabled");
});

it("migrates hero and product conversion controls to the shared primitive", () => {
  const heroSource = readFileSync(new URL("../Hero.tsx", import.meta.url), "utf8");
  const detailsSource = readFileSync(
    new URL("../product/ProductDetails.tsx", import.meta.url),
    "utf8",
  );
  const cardSource = readFileSync(
    new URL("../shop/ProductCard.tsx", import.meta.url),
    "utf8",
  );

  expect(heroSource).toMatch(/import\s+\{\s*ButtonLink\s*\}\s+from\s+["']@\/components\/ui\/Button["']/);
  expect(heroSource).toMatch(/href="\/dogs"[\s\S]*variant="primary"/);
  expect(heroSource).toMatch(/href="\/shop\/solutions"[\s\S]*variant="secondary"/);

  expect(detailsSource).toMatch(/<Button\s+type="button"\s+variant="primary"/);
  expect(detailsSource).toMatch(/aria-label="Decrease quantity"/);
  expect(detailsSource).toMatch(/aria-label="Increase quantity"/);

  expect(cardSource).toMatch(/<ButtonLink[\s\S]*variant="quiet"/);
  expect(cardSource).toMatch(/<Button\s+type="button"\s+variant="primary"/);
  expect(cardSource).toMatch(/<Button[\s\S]*size="icon"[\s\S]*aria-label=\{wishlisted/);
});

it("keeps secondary hover neutral and preserves the Hero CTA reference treatment", () => {
  const secondaryClasses = buttonClasses({ variant: "secondary" });
  const heroSource = readFileSync(new URL("../Hero.tsx", import.meta.url), "utf8");

  expect(secondaryClasses).toContain("hover:bg-zinc-100");
  expect(secondaryClasses).not.toContain("hover:bg-primary");
  expect(secondaryClasses).not.toContain("hover:text-white");
  expect(heroSource).toContain('className="w-full shadow-none hover:bg-zinc-200 sm:w-auto"');
  expect(heroSource).toContain("padding: '16px 40px'");
  expect(heroSource).toContain("borderRadius: 3");
  expect(heroSource).toContain("borderWidth: 0");
  expect(heroSource).toContain("sm:flex-row");
  expect(heroSource).toContain("<span className=\"lg:hidden\">Better Products for the Way Your Dog Is Built.</span>");
});

it("migrates cart page and drawer actions to the shared primitive", () => {
  const cartPageSource = readFileSync(
    new URL("../../app/cart/page.tsx", import.meta.url),
    "utf8",
  );
  const drawerSource = readFileSync(
    new URL("../shop/CartDrawer.tsx", import.meta.url),
    "utf8",
  );

  expect(cartPageSource).toMatch(/href="\/shop"[\s\S]*variant="secondary"/);
  expect(cartPageSource).toMatch(/variant="primary"[\s\S]*router\.push\(["']\/checkout["']\)/);
  expect(cartPageSource).toMatch(/size="icon"[\s\S]*aria-label="Decrease quantity"/);
  expect(drawerSource).toMatch(/variant="secondary"[\s\S]*Continue Shopping/);
  expect(drawerSource).toMatch(/variant="primary"[\s\S]*Checkout/);
  expect(drawerSource).toMatch(/size="icon"[\s\S]*aria-label="Remove item"/);
});

it("migrates checkout completion and success navigation to the shared primitive", () => {
  const checkoutSource = readFileSync(
    new URL("../CheckoutPage.tsx", import.meta.url),
    "utf8",
  );
  const successSource = readFileSync(
    new URL("../CheckoutSuccessPage.tsx", import.meta.url),
    "utf8",
  );

  expect(checkoutSource).toMatch(/<Button\s+type="submit"\s+variant="primary"\s+size="lg"/);
  expect(checkoutSource).toMatch(/disabled=\{isLoading \|\| items\.length === 0 \|\| paypalPopupWaiting\}/);
  expect(successSource).toMatch(/href="\/shop"[\s\S]*variant="primary"/);
  expect(successSource).toMatch(/returns\?token=/);
  expect(successSource).toMatch(/variant="secondary"/);
  expect(successSource).not.toMatch(/bg-\[#df8448\][^"]*text-white/);
  expect(checkoutSource).toContain("rounded-tl-[8px] rounded-tr-[8px]");
  expect(checkoutSource).toContain("rounded-bl-[8px] rounded-br-[8px]");
  expect(checkoutSource).toContain("overflow-visible rounded-[8px]");
});
