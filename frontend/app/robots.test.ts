import { describe, expect, it } from 'vitest';
import robots from './robots';

type Rule = { userAgent?: string | string[]; allow?: string | string[]; disallow?: string | string[] };

const rules = () => (Array.isArray(robots().rules) ? robots().rules : [robots().rules]) as Rule[];
const agents = (rule: Rule) => (Array.isArray(rule.userAgent) ? rule.userAgent : [rule.userAgent ?? '']);

describe('robots.txt', () => {
    it('keeps every crawler out of the private and tracking paths and leaves the rest open', () => {
        const everyone = rules().find((rule) => agents(rule).includes('*'));

        expect(everyone?.allow).toBe('/');
        expect(everyone?.disallow).toEqual(
            expect.arrayContaining(['/account', '/cart', '/checkout', '/auth', '/sign-in', '/sign-up', '/admin', '/product/', '/go/']),
        );
    });

    it('turns the AI and data-collection crawlers away from the whole site', () => {
        const blocked = rules().find((rule) => rule.disallow === '/');

        expect(blocked).toBeDefined();
        expect(agents(blocked as Rule)).toEqual(
            expect.arrayContaining(['GPTBot', 'ClaudeBot', 'CCBot', 'Google-Extended', 'anthropic-ai', 'Bytespider', 'Amazonbot', 'Applebot-Extended', 'meta-externalagent']),
        );
    });

    it('never turns away a search engine or a social crawler that sends readers to the site', () => {
        const blocked = rules().filter((rule) => rule.disallow === '/').flatMap(agents).map((agent) => agent.toLowerCase());

        for (const allowed of ['googlebot', 'bingbot', 'duckduckbot', 'pinterestbot', 'facebookexternalhit', 'twitterbot', 'applebot', '*']) {
            expect(blocked, allowed).not.toContain(allowed);
        }
    });

    it('lists each blocked crawler once and uses only standard directives', () => {
        const names = rules().flatMap(agents);

        expect(new Set(names).size).toBe(names.length);
        expect(JSON.stringify(robots())).not.toMatch(/content-signal/i);
        expect(robots().sitemap).toMatch(/\/sitemap\.xml$/);
    });
});
