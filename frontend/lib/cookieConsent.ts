const STORAGE_KEY = "petposture-cookie-consent";
export const CONSENT_CHANGED_EVENT = "petposture-cookie-consent-changed";

export type CookieConsent = {
    essential: true;
    analytics: boolean;
    method: "accept_all" | "customize" | "gpc";
    decidedAt: number;
};

export function hasGpcSignal(): boolean {
    if (typeof navigator === "undefined") return false;
    return (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
}

export function getConsent(): CookieConsent | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as CookieConsent) : null;
    } catch {
        return null;
    }
}

export function saveConsent(consent: Omit<CookieConsent, "essential" | "decidedAt">): CookieConsent {
    const full: CookieConsent = { essential: true, decidedAt: Date.now(), ...consent };

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(full));
        window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: full }));
    } catch { }

    return full;
}
