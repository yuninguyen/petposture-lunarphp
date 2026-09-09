import type { Metadata } from 'next';
import HomePage from "@/components/HomePage";
import { getApiBaseUrl } from "@/lib/api";
import { buildSiteSchema, serializeJsonLd } from "@/lib/site-schema";
import { STOREFRONT_SETTINGS_TAG, STOREFRONT_SITE_MEDIA_TAG } from '@/lib/storefront-cache-tags';

export const metadata: Metadata = {
    alternates: { canonical: '/' },
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
  const [heroImage, settings] = await Promise.all([fetchHeroImage(), fetchSiteSettings()]);
  const siteSchema = buildSiteSchema(settings);

  return (
    <>
      <script
        suppressHydrationWarning
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(siteSchema) }}
      />
      <HomePage heroImage={heroImage} />
    </>
  );
}
