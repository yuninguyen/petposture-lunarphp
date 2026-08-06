import './globals.css';

import type { Metadata } from 'next';
import Script from 'next/script';
import { Hanken_Grotesk, Lato, Dancing_Script } from 'next/font/google';
import { CartProvider } from '@/context/CartContext';
import { AuthProvider } from '@/context/AuthContext';
import { WishlistProvider } from '@/context/WishlistContext';
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
  let description: string | null = null;
  let social: { facebook?: string | null; instagram?: string | null; twitter?: string | null; tiktok?: string | null; pinterest?: string | null; youtube?: string | null } = {};
  let contact: { phone?: string | null; address?: string | null } = {};
  let googleAnalyticsId: string | null = null;
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.petposture.com';
    const res = await fetch(`${apiUrl}/api/settings`, { next: { revalidate: 3600 } });
    const json = await res.json();
    shopName = json?.data?.shop_name || shopName;
    shopLogo = json?.data?.shop_logo || null;
    shopFavicon = json?.data?.shop_favicon || null;
    description = json?.data?.description || null;
    social = json?.data?.social || {};
    contact = json?.data?.contact || {};
    googleAnalyticsId = json?.data?.analytics?.google_analytics_id || null;
  } catch { }

  return { shopName, shopLogo, shopFavicon, description, social, contact, googleAnalyticsId };
}

export async function generateMetadata(): Promise<Metadata> {
  const { shopName, shopLogo, shopFavicon, description } = await getShopSettings();

  const faviconUrl = shopFavicon || '/assets/Logo PetPosture-icon.png';
  const metaDescription = description || DEFAULT_DESCRIPTION;

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: `${shopName} — Ergonomic Essentials for Your Pet`,
      template: `%s | ${shopName}`,
    },
    description: metaDescription,
    openGraph: {
      siteName: shopName,
      type: 'website',
      url: SITE_URL,
      title: `${shopName} — Ergonomic Essentials for Your Pet`,
      description: metaDescription,
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
  const { shopName, shopLogo, description, social, contact, googleAnalyticsId } = await getShopSettings();

  const sameAs = [social.facebook, social.instagram, social.twitter, social.tiktok, social.pinterest, social.youtube].filter(
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
        description: description || DEFAULT_DESCRIPTION,
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
        {googleAnalyticsId ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${googleAnalyticsId}');
              `}
            </Script>
          </>
        ) : null}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <SettingsProvider>
          <AuthProvider>
            <WishlistProvider>
              <CartProvider>
                <AttributionTracker />
                {children}
                <CartDrawer />
              </CartProvider>
            </WishlistProvider>
          </AuthProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}
