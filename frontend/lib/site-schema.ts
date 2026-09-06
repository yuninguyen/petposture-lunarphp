import { SITE_URL } from './site';

const DEFAULT_DESCRIPTION =
  'Breed-focused pet product recommendations based on practical fit, materials, usability and everyday comfort.';
const SUPPORTED_SOCIAL_KEYS = [
  'facebook',
  'instagram',
  'twitter',
  'tiktok',
  'pinterest',
  'youtube',
] as const;

type SiteSchemaSettings = {
  shopName: string;
  shopLogo: string | null;
  description: string | null;
  social: Record<string, string | null | undefined>;
  contact: { phone?: string | null; address?: string | null };
};

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function buildSiteSchema(settings: SiteSchemaSettings): object {
  const sameAs = SUPPORTED_SOCIAL_KEYS.map((key) => settings.social[key]).filter(
    (url): url is string => typeof url === 'string' && url.trim().length > 0,
  );

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: settings.shopName,
        url: SITE_URL,
        ...(settings.shopLogo ? { logo: settings.shopLogo } : {}),
        description: settings.description || DEFAULT_DESCRIPTION,
        ...(sameAs.length ? { sameAs } : {}),
        ...(settings.contact.phone ? { telephone: settings.contact.phone } : {}),
        ...(settings.contact.address
          ? {
              address: {
                '@type': 'PostalAddress',
                streetAddress: settings.contact.address,
              },
            }
          : {}),
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        name: settings.shopName,
        url: SITE_URL,
      },
    ],
  };
}
