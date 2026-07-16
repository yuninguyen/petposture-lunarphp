const ORIGIN_COOKIE = 'petposture_attribution_origin';
const VIEWS_KEY = 'petposture_session_views';

function setCookie(name: string, value: string, days: number) {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
}

function getCookie(name: string): string | null {
    const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
}

function resolveOrigin(): string {
    const params = new URLSearchParams(window.location.search);
    const utmSource = params.get('utm_source');
    const utmMedium = params.get('utm_medium');
    const utmCampaign = params.get('utm_campaign');

    if (utmSource) {
        const parts = [utmSource];
        if (utmMedium) parts.push(utmMedium);
        if (utmCampaign) parts.push(utmCampaign);
        return parts.join(' / ');
    }

    const referrer = document.referrer;
    if (!referrer) return 'Direct';

    try {
        const host = new URL(referrer).hostname.replace(/^www\./, '');
        if (host === window.location.hostname) return 'Direct';
        if (host.includes('google.')) return 'Organic Google';
        if (host.includes('bing.')) return 'Organic Bing';
        if (host.includes('facebook.') || host.includes('fb.com')) return 'Facebook';
        if (host.includes('instagram.')) return 'Instagram';
        return host;
    } catch {
        return 'Direct';
    }
}

/** Captures first-touch origin (once per 30 days) and increments the session page-view count. Call on every page load. */
export function trackPageView() {
    if (typeof window === 'undefined') return;

    if (!getCookie(ORIGIN_COOKIE)) {
        setCookie(ORIGIN_COOKIE, resolveOrigin(), 30);
    }

    const current = parseInt(sessionStorage.getItem(VIEWS_KEY) || '0', 10);
    sessionStorage.setItem(VIEWS_KEY, String(current + 1));
}

export function getAttributionData(): { origin: string; session_page_views: number } {
    if (typeof window === 'undefined') {
        return { origin: 'Direct', session_page_views: 1 };
    }

    return {
        origin: getCookie(ORIGIN_COOKIE) || 'Direct',
        session_page_views: parseInt(sessionStorage.getItem(VIEWS_KEY) || '1', 10),
    };
}
