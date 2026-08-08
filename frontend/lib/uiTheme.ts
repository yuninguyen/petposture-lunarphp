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
    secondaryLight: '#fdf2ea',
    white: '#ffffff',
    grayLight: '#f4f5f6',
    grayMid: '#e8eaec',
    grayText: '#6b7280',
    border: '#e2e5e8',
    borderHover: '#c8cdd2',
};

export const F = {
    heading: "var(--font-hanken), sans-serif",
    body: "var(--font-hanken), sans-serif",
    nav: "var(--font-lato), sans-serif",
    alt: "var(--font-dancing), cursive",
};
