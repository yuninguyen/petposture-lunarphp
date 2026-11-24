import type { Metadata } from 'next';
import HomePage from "@/components/HomePage";
import { getApiBaseUrl } from "@/lib/api";
import { buildSiteSchema, serializeJsonLd } from "@/lib/site-schema";
import { fetchInsightPosts, fetchPicks } from "@/lib/storefront-content";
import { STOREFRONT_SETTINGS_TAG, STOREFRONT_SITE_MEDIA_TAG } from '@/lib/storefront-cache-tags';

// The homepage has its own title and description (the global ones in the admin settings stay as they are for every
// other page). Open Graph and Twitter repeat them because a page-level openGraph/twitter replaces the layout's whole
// object, so the image has to be repeated too.
const HOME_TITLE = 'PetPosture | Dog Product Picks by Breed & Body Type';
const HOME_DESCRIPTION =
    'Dog product picks matched to breed and body type. Ramp guides for Dachshunds, harness and feeding guides for French Bulldogs.';

const HOME_SOCIAL_IMAGE = {
    url: '/assets/banner/social-preview.webp',
    width: 1200,
    height: 630,
    alt: 'PetPosture pet products',
};

export const metadata: Metadata = {
    title: { absolute: HOME_TITLE },
    description: HOME_DESCRIPTION,
    alternates: { canonical: '/' },
    openGraph: {
        siteName: 'PetPosture',
        type: 'website',
        url: '/',
        title: HOME_TITLE,
        description: HOME_DESCRIPTION,
        images: [HOME_SOCIAL_IMAGE],
    },
    twitter: {
        card: 'summary_large_image',
        title: HOME_TITLE,
        description: HOME_DESCRIPTION,
        images: [HOME_SOCIAL_IMAGE.url],
    },
};

async function fetchHeroImage(): Promise<string | null> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/site-media?collection=banner`, {
      next: { revalidate: 300, tags: [STOREFRONT_SITE_MEDIA_TAG] },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const items: { title: string | null; url: string }[] = json?.data ?? [];
    return items.find((item) => item.title === "hero")?.url ?? null;
  } catch {
    return null;
  }
}

async function fetchSiteSettings() {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/settings`, {
      next: { revalidate: 3600, tags: [STOREFRONT_SETTINGS_TAG] },
    });
    const json = await res.json();
    return {
      shopName: json?.data?.shop_name || 'PetPosture',
      shopLogo: json?.data?.shop_logo || null,
      description: json?.data?.description || null,
      social: json?.data?.social || {},
      contact: json?.data?.contact || {},
    };
  } catch {
    return {
      shopName: 'PetPosture',
      shopLogo: null,
      description: null,
      social: {},
      contact: {},
    };
  }
}

export default async function Home() {
  const [heroImage, settings, initialProducts, initialPosts] = await Promise.all([
    fetchHeroImage(),
    fetchSiteSettings(),
    fetchPicks(),
    fetchInsightPosts(),
  ]);
  const siteSchema = buildSiteSchema(settings);

  return (
    <>
      <script
        suppressHydrationWarning
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(siteSchema) }}
      />
      <HomePage heroImage={heroImage} initialProducts={initialProducts} initialPosts={initialPosts} />
    </>
  );
}
