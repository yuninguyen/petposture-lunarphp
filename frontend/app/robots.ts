import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

// Crawlers that collect pages to train or feed AI models, or that are otherwise not wanted. This is the list
// Cloudflare used to add to robots.txt itself; it is kept here so the file does not depend on that setting.
// Search engines that send readers to the site (Googlebot, Bingbot, Pinterestbot…) are deliberately not here.
const BLOCKED_CRAWLERS = [
    'Amazonbot',
    'Applebot-Extended',
    'Bytespider',
    'CCBot',
    'ClaudeBot',
    'Diffbot',
    'Google-Extended',
    'GPTBot',
    'omgili',
    'anthropic-ai',
    'Claude-Web',
    'cohere-ai',
    'MistralAI-Training',
    'meta-externalagent',
    'GoogleOther',
    'Baiduspider',
    'PetalBot',
    'AwarioSmartBot',
    'AwarioRssBot',
    'Google-CloudVertexBot',
    'QualifiedBot',
    'Cotoyogi',
    'ICC-Crawler',
    'atlassian-bot',
    'FishBot',
    'BorderxBot',
    'NavuBot',
    'SemrushBot-SWA',
    'WARDBot',
    'magpie-crawler',
    'KimiBot',
    'CitibotSiteCrawler',
];

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: [
                    '/account',
                    '/cart',
                    '/checkout',
                    '/auth',
                    '/sign-in',
                    '/sign-up',
                    '/admin',
                    '/product/',
                    '/go/',
                ],
            },
            { userAgent: BLOCKED_CRAWLERS, disallow: '/' },
        ],
        sitemap: `${SITE_URL}/sitemap.xml`,
    };
}
