import './globals.css';

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Hanken_Grotesk, Lato, Dancing_Script } from 'next/font/google';
import { CartProvider } from '@/context/CartContext';
import { AuthProvider } from '@/context/AuthContext';
import { WishlistProvider } from '@/context/WishlistContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { CartDrawer } from '@/components/shop/CartDrawer';
import { AttributionTracker } from '@/components/AttributionTracker';
import { CookieBanner } from '@/components/CookieBanner';
import { GoogleAnalytics } from '@/components/GoogleAnalytics';
import { SITE_URL } from '@/lib/site';

const hankenGrotesk = Hanken_Grotesk({ subsets: ['latin'], weight: ['400', '700'], display: 'swap' });
const lato = Lato({ subsets: ['latin'], weight: ['700'], display: 'swap' });
const dancingScript = Dancing_Script({ subsets: ['latin'], weight: ['400'], display: 'swap' });

const DEFAULT_DESCRIPTION = 'Breed-focused pet product recommendations based on practical fit, materials, usability and everyday comfort.';

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
  const { shopName, shopFavicon, description } = await getShopSettings();

  const faviconUrl = shopFavicon || '/favicon.png';
  const metaDescription = description || DEFAULT_DESCRIPTION;
  const socialPreview = {
    url: '/assets/banner/social-preview.webp',
    width: 1200,
    height: 630,
    alt: `${shopName} pet products`,
  };

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: `${shopName} — Breed-Focused Pet Product Recommendations`,
      template: `%s | ${shopName}`,
    },
    description: metaDescription,
    openGraph: {
      siteName: shopName,
      type: 'website',
      url: SITE_URL,
      title: `${shopName} — Breed-Focused Pet Product Recommendations`,
      description: metaDescription,
      images: [socialPreview],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${shopName} — Breed-Focused Pet Product Recommendations`,
      description: metaDescription,
      images: [socialPreview.url],
    },
    icons: {
      icon: [{ url: faviconUrl, sizes: '100x100', type: 'image/png' }],
      apple: faviconUrl,
      shortcut: faviconUrl,
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
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
        {googleAnalyticsId ? <GoogleAnalytics measurementId={googleAnalyticsId} /> : null}
        <script
          nonce={nonce}
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
                <CookieBanner />
              </CartProvider>
            </WishlistProvider>
          </AuthProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}
