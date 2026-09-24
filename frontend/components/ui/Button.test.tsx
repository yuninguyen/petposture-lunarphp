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
