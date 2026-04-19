/**
 * ============================================================
 *  PetPosture — Design Tokens (TypeScript)
 *  Dùng trong component khi cần reference token theo tên,
 *  hoặc truyền vào inline style.
 *  Ưu tiên dùng CSS variables (tokens.css) hoặc class Tailwind
 *  thay vì hardcode hex ở đây.
 * ============================================================
 */

// ── COLORS ──────────────────────────────────────────────────────
export const colors = {
  // Brand
  primary:         '#3e4c57',
  primaryLight:    '#5a6c7a',
  primaryDark:     '#2c3840',

  secondary:       '#df8448',
  secondaryLight:  '#fdf2ea',
  secondaryDark:   '#c9713a',

  // Semantic
  success:         '#28a745',
  successLight:    '#e9f7ec',
  alert:           '#dc3545',
  alertLight:      '#fdecea',
  warning:         '#ffc107',
  warningLight:    '#fff8e1',

  // Neutral
  white:           '#ffffff',
  gray50:          '#f4f5f6',
  gray100:         '#e8eaec',
  gray200:         '#d1d5db',
  gray400:         '#9ca3af',
  gray600:         '#6b7280',
  gray800:         '#374151',
  black:           '#111111',

  // Shop-specific
  addToCart:       '#df8448',
  checkoutBtn:     '#df8448',
  saleBubble:      '#df8448',
  reviewStars:     '#df8448',
  salePrice:       '#3e4c57',
  originalPrice:   '#9ca3af',

  // UI
  link:            '#3e4c57',
  linkHover:       '#df8448',
  border:          '#e8eaec',
  borderFocus:     '#df8448',
  tooltipText:     '#ffffff',
  tooltipBg:       '#3e4c57',
} as const;

export type ColorKey = keyof typeof colors;


// ── TYPOGRAPHY ───────────────────────────────────────────────────
export const fonts = {
  heading:  "'Hanken Grotesk', sans-serif",
  body:     "'Hanken Grotesk', sans-serif",
  nav:      "'Lato', sans-serif",
  alt:      "'Dancing Script', cursive",
  mono:     "'JetBrains Mono', monospace",
} as const;

export const fontWeights = {
  regular: 400,
  medium:  500,
  bold:    700,
  black:   900,
} as const;

export const fontSizes = {
  xs:   '0.75rem',    // 12px
  sm:   '0.875rem',   // 14px
  md:   '1rem',       // 16px
  lg:   '1.125rem',   // 18px
  xl:   '1.25rem',    // 20px
  '2xl':'1.5rem',     // 24px
  '3xl':'1.875rem',   // 30px
  '4xl':'2.25rem',    // 36px
  '5xl':'3rem',       // 48px
} as const;

export const lineHeights = {
  tight:   1.1,
  heading: 1.2,
  snug:    1.4,
  base:    1.65,
  relaxed: 1.8,
} as const;

export const letterSpacing = {
  tight:   '-0.02em',
  normal:  '0em',
  wide:    '0.04em',
  wider:   '0.08em',
  widest:  '0.12em',
} as const;

/** Uppercase transform áp dụng đồng thời text-transform + letter-spacing */
export const textTransforms = {
  btn:        { textTransform: 'uppercase' as const, letterSpacing: letterSpacing.wider },
  nav:        { textTransform: 'uppercase' as const, letterSpacing: letterSpacing.widest },
  section:    { textTransform: 'uppercase' as const, letterSpacing: letterSpacing.wider },
  widget:     { textTransform: 'uppercase' as const, letterSpacing: letterSpacing.wider },
  breadcrumb: { textTransform: 'uppercase' as const, letterSpacing: letterSpacing.wide },
  badge:      { textTransform: 'uppercase' as const, letterSpacing: letterSpacing.wider },
};


// ── SPACING ──────────────────────────────────────────────────────
export const spacing = {
  1:  '0.25rem',   //  4px
  2:  '0.5rem',    //  8px
  3:  '0.75rem',   // 12px
  4:  '1rem',      // 16px
  5:  '1.25rem',   // 20px
  6:  '1.5rem',    // 24px
  8:  '2rem',      // 32px
  10: '2.5rem',    // 40px
  12: '3rem',      // 48px
  16: '4rem',      // 64px
  20: '5rem',      // 80px
  24: '6rem',      // 96px
} as const;


// ── LAYOUT ───────────────────────────────────────────────────────
export const layout = {
  containerMax:     '1200px',
  containerWide:    '1400px',
  containerNarrow:  '720px',
  containerPadding: '1.5rem',
} as const;


// ── BORDER RADIUS ────────────────────────────────────────────────
export const radius = {
  none:  '0',
  sm:    '0.25rem',    //  4px — tags, badges
  md:    '0.375rem',   //  6px — buttons
  lg:    '0.625rem',   // 10px — cards
  xl:    '0.75rem',    // 12px — panels
  '2xl': '1rem',       // 16px — modals
  full:  '9999px',     // pills, avatars
} as const;


// ── SHADOWS ──────────────────────────────────────────────────────
export const shadows = {
  none:  'none',
  sm:    '0 1px 3px rgba(62, 76, 87, 0.08)',
  md:    '0 4px 12px rgba(62, 76, 87, 0.10)',
  lg:    '0 8px 28px rgba(62, 76, 87, 0.14)',
  xl:    '0 16px 48px rgba(62, 76, 87, 0.18)',
  focus: '0 0 0 3px rgba(223, 132, 72, 0.35)',
} as const;


// ── TRANSITIONS ──────────────────────────────────────────────────
export const transitions = {
  fast:   '150ms ease',
  base:   '200ms ease',
  slow:   '300ms ease',
  spring: '300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;


// ── Z-INDEX ──────────────────────────────────────────────────────
export const zIndex = {
  below:    -1,
  base:      0,
  raised:   10,
  dropdown: 100,
  sticky:   200,
  overlay:  300,
  modal:    400,
  toast:    500,
  tooltip:  600,
} as const;


// ── BARREL EXPORT ────────────────────────────────────────────────
const tokens = {
  colors,
  fonts,
  fontWeights,
  fontSizes,
  lineHeights,
  letterSpacing,
  textTransforms,
  spacing,
  layout,
  radius,
  shadows,
  transitions,
  zIndex,
} as const;

export default tokens;
