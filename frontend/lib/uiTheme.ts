/**
 * Shared inline-style design tokens (color/font values keyed to match
 * how HomePage.tsx / ContactPage.tsx historically used local `C`/`F`
 * constants). Values mirror tailwind.config.ts and app/tokens.css —
 * keep all three in sync if the brand palette changes.
 */
export const C = {
    primary: '#3e4c57',
    primaryHover: '#2c3840',
    secondary: '#df8448',
    secondaryHover: '#c9713a',
    secondaryText: '#df8448',
    secondaryTextHover: '#c9713a',
    // Text-only accessible orange (WCAG AA, 6.63:1) — for eyebrow labels/prices
    // on light backgrounds. Not for hover backgrounds (use secondaryTextHover).
    rust: '#8f4a1f',
    secondaryLight: '#fdf2ea',
    white: '#ffffff',
    // Near-black text for use on top of `secondary`/`secondaryText` orange —
    // white-on-orange fails WCAG AA contrast (2.78:1); this passes (5.63:1).
    ink: '#1a2128',
    grayLight: '#f4f5f6',
    grayMid: '#e8eaec',
    grayText: '#4b5563',
    border: '#e2e5e8',
    borderHover: '#c8cdd2',
};

export const F = {
    heading: "var(--font-hanken), sans-serif",
    body: "var(--font-hanken), sans-serif",
    nav: "var(--font-lato), sans-serif",
    alt: "var(--font-dancing), cursive",
};
