import './globals.css';

import type { Metadata } from 'next';
import { Hanken_Grotesk, Lato, Dancing_Script } from 'next/font/google';
import { CartProvider } from '@/context/CartContext';
import { AuthProvider } from '@/context/AuthContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { CartDrawer } from '@/components/shop/CartDrawer';
import { AttributionTracker } from '@/components/AttributionTracker';

const hankenGrotesk = Hanken_Grotesk({ subsets: ['latin'], weight: ['400', '700'], display: 'swap' });
const lato = Lato({ subsets: ['latin'], weight: ['700'], display: 'swap' });
const dancingScript = Dancing_Script({ subsets: ['latin'], weight: ['400'], display: 'swap' });

export async function generateMetadata(): Promise<Metadata> {
  let shopName = 'PetPosture';
  let shopLogo: string | null = null;
  let shopFavicon: string | null = null;
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.petposture.com';
    const res = await fetch(`${apiUrl}/api/settings`, { next: { revalidate: 3600 } });
    const json = await res.json();
    shopName = json?.data?.shop_name || shopName;
    shopLogo = json?.data?.shop_logo || null;
    shopFavicon = json?.data?.shop_favicon || null;
  } catch { }

  const faviconUrl = shopFavicon || '/assets/Logo PetPosture-icon.png';

  return {
    title: {
      default: `${shopName} — Ergonomic Essentials for Your Pet`,
      template: `%s | ${shopName}`,
    },
    description: 'Ergonomic essentials designed for your pet\'s unique posture and health needs.',
    icons: {
      icon: [
        { url: faviconUrl, sizes: '16x16', type: 'image/png' },
        { url: faviconUrl, sizes: '32x32', type: 'image/png' },
        { url: faviconUrl, sizes: '96x96', type: 'image/png' },
        { url: faviconUrl, sizes: '192x192', type: 'image/png' },
        { url: faviconUrl, sizes: '512x512', type: 'image/png' },
      ],
      apple: faviconUrl,
      shortcut: faviconUrl,
    },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      style={
        {
          '--font-hanken': `${hankenGrotesk.style.fontFamily}, "Avenir Next", "Segoe UI", sans-serif`,
          '--font-lato': `${lato.style.fontFamily}, "Arial Narrow", "Segoe UI", sans-serif`,
          '--font-dancing': `${dancingScript.style.fontFamily}, "Brush Script MT", cursive`,
        } as React.CSSProperties
      }
    >
      <body>
        <SettingsProvider>
          <AuthProvider>
            <CartProvider>
              <AttributionTracker />
              {children}
              <CartDrawer />
            </CartProvider>
          </AuthProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}
