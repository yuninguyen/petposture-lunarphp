export const getApiBaseUrl = () => {
    let url = '';

    // Priority 1: Environment variable (works on both client and server)
    if (process.env.NEXT_PUBLIC_API_URL) {
        url = process.env.NEXT_PUBLIC_API_URL;
    } else {
        // Priority 2: Client-side detection for local development
        if (typeof window !== 'undefined') {
            const hostname = window.location.hostname;
            if (hostname === '127.0.0.1') {
                url = 'http://127.0.0.1:8000';
            }
        }
    }

    if (!url) {
        // Default fallback
        url = 'http://localhost:8000';
    }

    // Clean up trailing slash
    return url.endsWith('/') ? url.slice(0, -1) : url;
};

export const API_BASE_URL = getApiBaseUrl();
