import { SITE_URL } from './site';

const DEFAULT_DESCRIPTION =
  'Breed-focused pet product recommendations based on practical fit, materials, usability and everyday comfort.';

type SiteSchemaSettings = {
  shopName: string;
  shopLogo: string | null;
  description: string | null;
  social: Record<string, string | null | undefined>;
  contact: { phone?: string | null; address?: string | null };
};

export function buildSiteSchema(settings: SiteSchemaSettings): object {
  const sameAs = Object.values(settings.social).filter(
    (url): url is string => Boolean(url),
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
