import type { Config } from 'tailwindcss';

/**
 * ============================================================
 *  PetPosture — Tailwind Config
 *  Extend Tailwind với toàn bộ design tokens của dự án.
 *  Tất cả class Tailwind custom đều mirror tokens.css và tokens.ts.
 * ============================================================
 */

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],

  theme: {
    // ── Container ─────────────────────────────────────────────
    container: {
      center: true,
      padding: {
        DEFAULT: '1.5rem',   // 24px
        sm: '1rem',          // 16px
        lg: '2rem',          // 32px
      },
      screens: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1200px',        // container-max
        '2xl': '1400px',     // container-wide
      },
    },

    extend: {

      // ── COLORS ──────────────────────────────────────────────
      colors: {
        // Brand palette
        primary: {
          DEFAULT: '#3e4c57',
          light: '#5a6c7a',
          dark: '#2c3840',
        },
        secondary: {
          DEFAULT: '#df8448',
          light: '#fdf2ea',
          dark: '#c9713a',
        },

        // Semantic
        success: {
          DEFAULT: '#28a745',
          light: '#e9f7ec',
        },
        danger: {
          DEFAULT: '#dc3545',
          light: '#fdecea',
        },
        warning: {
          DEFAULT: '#ffc107',
          light: '#fff8e1',
        },

        // Neutrals
        gray: {
          50: '#f4f5f6',
          100: '#e8eaec',
          200: '#d1d5db',
          400: '#9ca3af',
          600: '#6b7280',
          800: '#374151',
        },

        // Shop
        'add-to-cart': '#df8448',
        'sale-bubble': '#df8448',
        'review-stars': '#df8448',
        'sale-price': '#3e4c57',
      },

      // ── FONTS ────────────────────────────────────────────────
      fontFamily: {
        heading: ["'Hanken Grotesk'", 'sans-serif'],
        body: ["'Hanken Grotesk'", 'sans-serif'],
        nav: ["'Lato'", 'sans-serif'],
        alt: ["'Dancing Script'", 'cursive'],
        mono: ["'JetBrains Mono'", 'monospace'],
        sans: ["'Hanken Grotesk'", 'sans-serif'],  // override Tailwind default
      },

      fontWeight: {
        regular: '400',
        medium: '500',
        bold: '700',
        black: '900',
      },

      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        md: ['1rem', { lineHeight: '1.65' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1.2' }],
        '6xl': ['clamp(2.5rem, 5vw, 4rem)', { lineHeight: '1.1' }],

        // Heading scale
        'h1': ['clamp(2.25rem, 4vw, 3.5rem)', { lineHeight: '1.1', fontWeight: '700' }],
        'h2': ['clamp(1.75rem, 3vw, 2.5rem)', { lineHeight: '1.2', fontWeight: '700' }],
        'h3': ['clamp(1.375rem, 2.5vw, 1.875rem)', { lineHeight: '1.3', fontWeight: '700' }],
        'h4': ['clamp(1.125rem, 2vw, 1.5rem)', { lineHeight: '1.4', fontWeight: '700' }],
        'h5': ['1.125rem', { lineHeight: '1.5', fontWeight: '700' }],
        'h6': ['1rem', { lineHeight: '1.5', fontWeight: '700' }],
      },

      lineHeight: {
        tight: '1.1',
        heading: '1.2',
        snug: '1.4',
        base: '1.65',
        relaxed: '1.8',
      },

      letterSpacing: {
        tight: '-0.02em',
        normal: '0em',
        wide: '0.04em',
        wider: '0.08em',
        widest: '0.12em',
      },

      // ── SPACING ──────────────────────────────────────────────
      // Tailwind đã có scale 4px — chỉ thêm alias cho clarity
      spacing: {
        'page-x': '1.5rem',    // container side padding desktop
        'page-x-sm': '1rem',   // container side padding mobile
      },

      // ── BORDER RADIUS ────────────────────────────────────────
      borderRadius: {
        none: '0',
        sm: '0.25rem',
        DEFAULT: '0.375rem',
        md: '0.375rem',
        lg: '0.625rem',
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
        full: '9999px',
      },

      // ── SHADOWS ──────────────────────────────────────────────
      boxShadow: {
        sm: '0 1px 3px rgba(62, 76, 87, 0.08)',
        md: '0 4px 12px rgba(62, 76, 87, 0.10)',
        DEFAULT: '0 4px 12px rgba(62, 76, 87, 0.10)',
        lg: '0 8px 28px rgba(62, 76, 87, 0.14)',
        xl: '0 16px 48px rgba(62, 76, 87, 0.18)',
        focus: '0 0 0 3px rgba(223, 132, 72, 0.35)',
        none: 'none',
      },

      // ── TRANSITIONS ──────────────────────────────────────────
      transitionDuration: {
        fast: '150ms',
        base: '200ms',
        slow: '300ms',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },

      // ── Z-INDEX ──────────────────────────────────────────────
      zIndex: {
        below: '-1',
        base: '0',
        raised: '10',
        dropdown: '100',
        sticky: '200',
        overlay: '300',
        modal: '400',
        toast: '500',
        tooltip: '600',
      },

      // ── SCREENS ──────────────────────────────────────────────
      screens: {
        xs: '375px',
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1200px',
        '2xl': '1400px',
      },

      // ── CUSTOM ANIMATIONS ─────────────────────────────────────
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease forwards',
        'slide-up': 'slide-up 300ms ease forwards',
        'scale-in': 'scale-in 200ms ease forwards',
      },
    },
  },

  plugins: [],
};

export default config;
