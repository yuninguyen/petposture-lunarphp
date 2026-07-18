import './globals.css';

import type { Metadata } from 'next';
import { Hanken_Grotesk, Lato, Dancing_Script } from 'next/font/google';
import { CartProvider } from '@/context/CartContext';
import { AuthProvider } from '@/context/AuthContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { CartDrawer } from '@/components/shop/CartDrawer';
import { AttributionTracker } from '@/components/AttributionTracker';
import { SITE_URL } from '@/lib/site';

const hankenGrotesk = Hanken_Grotesk({ subsets: ['latin'], weight: ['400', '700'], display: 'swap' });
const lato = Lato({ subsets: ['latin'], weight: ['700'], display: 'swap' });
const dancingScript = Dancing_Script({ subsets: ['latin'], weight: ['400'], display: 'swap' });

const DEFAULT_DESCRIPTION = 'Ergonomic essentials designed for your pet\'s unique posture and health needs.';

async function getShopSettings() {
  let shopName = 'PetPosture';
  let shopLogo: string | null = null;
  let shopFavicon: string | null = null;
  let social: { facebook?: string | null; instagram?: string | null; twitter?: string | null } = {};
  let contact: { phone?: string | null; address?: string | null } = {};
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.petposture.com';
    const res = await fetch(`${apiUrl}/api/settings`, { next: { revalidate: 3600 } });
    const json = await res.json();
    shopName = json?.data?.shop_name || shopName;
    shopLogo = json?.data?.shop_logo || null;
    shopFavicon = json?.data?.shop_favicon || null;
    social = json?.data?.social || {};
    contact = json?.data?.contact || {};
  } catch { }

  return { shopName, shopLogo, shopFavicon, social, contact };
}

export async function generateMetadata(): Promise<Metadata> {
  const { shopName, shopLogo, shopFavicon } = await getShopSettings();

  const faviconUrl = shopFavicon || '/assets/Logo PetPosture-icon.png';

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: `${shopName} — Ergonomic Essentials for Your Pet`,
      template: `%s | ${shopName}`,
    },
    description: DEFAULT_DESCRIPTION,
    openGraph: {
      siteName: shopName,
      type: 'website',
      url: SITE_URL,
      title: `${shopName} — Ergonomic Essentials for Your Pet`,
      description: DEFAULT_DESCRIPTION,
      images: shopLogo ? [shopLogo] : undefined,
    },
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { shopName, shopLogo, social, contact } = await getShopSettings();

  const sameAs = [social.facebook, social.instagram, social.twitter].filter(
    (url): url is string => Boolean(url)
  );

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: shopName,
        url: SITE_URL,
        ...(shopLogo ? { logo: shopLogo } : {}),
        description: DEFAULT_DESCRIPTION,
        ...(sameAs.length ? { sameAs } : {}),
        ...(contact.phone ? { telephone: contact.phone } : {}),
        ...(contact.address ? { address: { '@type': 'PostalAddress', streetAddress: contact.address } } : {}),
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        name: shopName,
        url: SITE_URL,
      },
    ],
  };

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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
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
