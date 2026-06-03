import './globals.css';

import type { Metadata } from 'next';
import { CartProvider } from '@/context/CartContext';
import { AuthProvider } from '@/context/AuthContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { CartDrawer } from '@/components/shop/CartDrawer';

export const metadata: Metadata = {
  title: {
    default: 'PetPosture — Ergonomic Essentials for Your Pet',
    template: '%s | PetPosture',
  },
  description: 'Ergonomic essentials designed for your pet\'s unique posture and health needs.',
  icons: {
    icon: [
      { url: '/assets/Logo-PetPosture-icon-100x100.png', sizes: '32x32', type: 'image/png' },
      { url: '/assets/Logo-PetPosture-icon-100x100.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/assets/Logo-PetPosture-icon-100x100.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      style={
        {
          '--font-hanken': '"Hanken Grotesk", "Avenir Next", "Segoe UI", sans-serif',
          '--font-lato': '"Lato", "Arial Narrow", "Segoe UI", sans-serif',
          '--font-dancing': '"Dancing Script", "Brush Script MT", cursive',
        } as React.CSSProperties
      }
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;700&family=Lato:wght@700&family=Dancing+Script:wght@400&display=swap"
        />
      </head>
      <body>
        <SettingsProvider>
          <AuthProvider>
            <CartProvider>
              {children}
              <CartDrawer />
            </CartProvider>
          </AuthProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}
