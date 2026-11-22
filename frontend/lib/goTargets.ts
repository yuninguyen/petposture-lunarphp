// Where a "Buy" link last led, remembered for a few minutes so the next press can redirect at once and let the
// backend count the click in the background. Only used by app/go/pick/[slug]/route.ts (and its test, which clears it).
const TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 500;

const targets = new Map<string, { location: string; expires: number }>();

/** The remembered link for this Pick and choice (merchant, variant, second retailer), while it is fresh. */
export function rememberedTarget(key: string, now = Date.now()): string | null {
    const entry = targets.get(key);
    if (!entry) return null;
    if (entry.expires <= now) {
        targets.delete(key);
        return null;
    }

    return entry.location;
}

export function rememberTarget(key: string, location: string, now = Date.now()): void {
    if (targets.size >= MAX_ENTRIES && !targets.has(key)) {
        const oldest = targets.keys().next().value;
        if (oldest !== undefined) targets.delete(oldest);
    }
    targets.set(key, { location, expires: now + TTL_MS });
}

export function clearRememberedTargets(): void {
    targets.clear();
}
