import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#3e4c57', light: '#5a6c7a', dark: '#2c3840' },
        secondary: { DEFAULT: '#df8448', light: '#fdf2ea', dark: '#c9713a' },
        ink: '#1a2128',
      },
      fontFamily: {
        sans: ["'Hanken Grotesk'", 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
