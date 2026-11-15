import { SITE_URL } from '@/lib/site';

// SHOP-HIDDEN: this file used to call PetPosture "a pet supplies e-commerce store", labelled the home page
// "Store homepage" and listed "- [Shop](${SITE_URL}/shop): Full product catalog". Revert the "hide the shop"
// commits to restore that wording.
const content = `# PetPosture

> PetPosture is a breed-focused guide to posture-correcting and orthopedic products for dogs (dachshunds, French bulldogs, pugs, and other breeds prone to spinal and joint issues).

## Main Pages

- [Home](${SITE_URL}/): Homepage
- [Our Mission](${SITE_URL}/our-mission): Company mission and story
- [Blog](${SITE_URL}/blog): Pet health and care articles

## Breed Guides

- [Dachshund](${SITE_URL}/dogs/dachshund)
- [French Bulldog](${SITE_URL}/dogs/french-bulldog)
- [Pug](${SITE_URL}/dogs/pug)
`;

export function GET() {
    return new Response(content, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
        },
    });
}
