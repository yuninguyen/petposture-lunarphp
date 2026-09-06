import { describe, expect, it } from 'vitest';
import { buildSiteSchema, serializeJsonLd } from './site-schema';

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

  it('canonicalizes supported social links independent of input insertion order', () => {
    const baseSettings = {
      shopName: 'PetPosture',
      shopLogo: null,
      description: null,
      contact: {},
    };
    const first = buildSiteSchema({
      ...baseSettings,
      social: {
        youtube: 'https://youtube.com/@petposture',
        unsupported: 'https://example.com/petposture',
        facebook: 'https://facebook.com/petposture',
        instagram: '   ',
        twitter: 'https://twitter.com/petposture',
      },
    });
    const second = buildSiteSchema({
      ...baseSettings,
      social: {
        twitter: 'https://twitter.com/petposture',
        facebook: 'https://facebook.com/petposture',
        instagram: '',
        youtube: 'https://youtube.com/@petposture',
      },
    });

    expect(first).toEqual(second);
    expect((first as { '@graph': Array<{ sameAs?: string[] }> })['@graph'][0].sameAs).toEqual([
      'https://facebook.com/petposture',
      'https://twitter.com/petposture',
      'https://youtube.com/@petposture',
    ]);
  });

  it('serializes CMS values without allowing an application/ld+json script breakout', () => {
    const payload = '</script><script>alert(document.domain)</script>';
    const schema = buildSiteSchema({
      shopName: payload,
      shopLogo: null,
      description: `line separator:\u2028 paragraph separator:\u2029`,
      social: {},
      contact: {},
    });

    const serialized = serializeJsonLd(schema);

    expect(serialized.toLowerCase()).not.toContain('</script');
    expect(serialized).not.toContain('<script>alert(document.domain)</script>');
    expect(`<script type="application/ld+json">${serialized}</script>`).not.toContain(
      '<script>alert(document.domain)</script>',
    );
    expect(serialized).toContain('\\u003c/script>\\u003cscript>alert(document.domain)\\u003c/script>');
    expect(serialized).toContain('\\u2028');
    expect(serialized).toContain('\\u2029');
    expect(JSON.parse(serialized)).toEqual(schema);
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
