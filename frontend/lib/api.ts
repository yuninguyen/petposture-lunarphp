export const getApiBaseUrl = () => {
    let url = '';

    // Server-side rendering should call the backend directly instead of
    // looping through Cloudflare, which can challenge VPS-origin requests.
    if (typeof window === 'undefined' && process.env.INTERNAL_API_URL) {
        url = process.env.INTERNAL_API_URL;
    } else if (process.env.NEXT_PUBLIC_API_URL) {
        // Browser requests use the public API hostname.
        url = process.env.NEXT_PUBLIC_API_URL;
    } else if (typeof window !== 'undefined') {
        // Client-side detection for local development.
        const hostname = window.location.hostname;
        if (hostname === '127.0.0.1') {
            url = 'http://127.0.0.1:8000';
        }
    }

    if (!url) {
        url = 'http://localhost:8000';
    }

    return url.endsWith('/') ? url.slice(0, -1) : url;
};

export const API_BASE_URL = getApiBaseUrl();
