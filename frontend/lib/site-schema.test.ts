import { describe, expect, it } from 'vitest';
import { buildSiteSchema } from './site-schema';

describe('buildSiteSchema', () => {
  it('builds deterministic Organization and WebSite JSON-LD', () => {
    const settings = {
      shopName: 'PetPosture',
      shopLogo: 'https://cdn.petposture.com/logo.png',
      description: 'Breed-focused recommendations.',
      social: {
        facebook: 'https://facebook.com/petposture',
        instagram: null,
        youtube: 'https://youtube.com/@petposture',
      },
      contact: {
        phone: '+1-555-0100',
        address: '1 Pet Posture Way',
      },
    };

    const first = buildSiteSchema(settings);
    const second = buildSiteSchema(settings);

    expect(first).toEqual(second);
    expect(first).toEqual({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          '@id': 'https://petposture.com/#organization',
          name: 'PetPosture',
          url: 'https://petposture.com',
          logo: 'https://cdn.petposture.com/logo.png',
          description: 'Breed-focused recommendations.',
          sameAs: [
            'https://facebook.com/petposture',
            'https://youtube.com/@petposture',
          ],
          telephone: '+1-555-0100',
          address: {
            '@type': 'PostalAddress',
            streetAddress: '1 Pet Posture Way',
          },
        },
        {
          '@type': 'WebSite',
          '@id': 'https://petposture.com/#website',
          name: 'PetPosture',
          url: 'https://petposture.com',
        },
      ],
    });
  });

  it('uses the default description and omits empty optional fields', () => {
    expect(
      buildSiteSchema({
        shopName: 'PetPosture',
        shopLogo: null,
        description: null,
        social: { facebook: null, instagram: undefined },
        contact: { phone: null, address: null },
      }),
    ).toEqual({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          '@id': 'https://petposture.com/#organization',
          name: 'PetPosture',
          url: 'https://petposture.com',
          description:
            'Breed-focused pet product recommendations based on practical fit, materials, usability and everyday comfort.',
        },
        {
          '@type': 'WebSite',
          '@id': 'https://petposture.com/#website',
          name: 'PetPosture',
          url: 'https://petposture.com',
        },
      ],
    });
  });
});
