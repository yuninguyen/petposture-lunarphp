import './globals.css';

import { Hanken_Grotesk, Lato, Dancing_Script } from 'next/font/google';
import { CartProvider } from '@/context/CartContext';
import { AuthProvider } from '@/context/AuthContext';
import { CartDrawer } from '@/components/shop/CartDrawer';

const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-hanken',
  display: 'swap',
});

const lato = Lato({
  subsets: ['latin'],
  weight: ['700'],
  variable: '--font-lato',
  display: 'swap',
});

const dancing = Dancing_Script({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-dancing',
  display: 'swap',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${hanken.variable} ${lato.variable} ${dancing.variable}`}>
      <body>
        <AuthProvider>
          <CartProvider>
            {children}
            <CartDrawer />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}