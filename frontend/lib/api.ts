export const getApiBaseUrl = () => {
    // Priority 1: Environment variable (works on both client and server)
    if (process.env.NEXT_PUBLIC_API_BASE_URL) {
        return process.env.NEXT_PUBLIC_API_BASE_URL;
    }

    // Priority 2: Client-side detection for local development
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname === '127.0.0.1') {
            return 'http://127.0.0.1:8000';
        }
    }

    // Default fallback
    return 'http://localhost:8000';
};

export const API_BASE_URL = getApiBaseUrl();
