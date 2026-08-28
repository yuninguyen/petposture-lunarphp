export function buildPreviewQuery(
    searchParams: Record<string, string | string[] | undefined>,
): string | undefined {
    const expires = searchParams.expires;
    const signature = searchParams.signature;

    if (typeof expires !== 'string' || typeof signature !== 'string') {
        return undefined;
    }

    return `expires=${encodeURIComponent(expires)}&signature=${encodeURIComponent(signature)}`;
}
