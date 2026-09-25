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

it("keeps secondary hover neutral and constrains Hero CTAs at the horizontal breakpoint", () => {
  const secondaryClasses = buttonClasses({ variant: "secondary" });
  const heroSource = readFileSync(new URL("../Hero.tsx", import.meta.url), "utf8");

  expect(secondaryClasses).toContain("hover:bg-zinc-100");
  expect(secondaryClasses).not.toContain("hover:bg-primary");
  expect(secondaryClasses).not.toContain("hover:text-white");
  expect(
    heroSource.match(
      /className="w-full rounded-\[3px\] px-3 shadow-md min-\[400px\]:w-auto min-\[400px\]:min-w-0 min-\[400px\]:flex-1 lg:px-7"/g,
    ),
  ).toHaveLength(2);
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
