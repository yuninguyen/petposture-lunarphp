const isDevelopment = process.env.NODE_ENV === "development";
const scriptOrigins = "https://js.stripe.com https://www.paypal.com https://www.sandbox.paypal.com https://maps.googleapis.com https://www.googletagmanager.com https://challenges.cloudflare.com";

function buildPolicy(scriptSource: string, styleSource: string): string {
    return [
        "default-src 'self'",
        scriptSource,
        styleSource,
        "style-src-attr 'unsafe-inline'",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data: https://fonts.gstatic.com",
        `connect-src 'self' https: wss:${isDevelopment ? " http: ws:" : ""}`,
        "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://www.paypal.com https://www.sandbox.paypal.com https://challenges.cloudflare.com",
        "media-src 'self' https:",
        "worker-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
    ].join("; ");
}

export function buildPublicContentSecurityPolicy(): string {
    return buildPolicy(
        `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""} ${scriptOrigins}`,
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    );
}

export function buildPrivateContentSecurityPolicy(nonce: string): string {
    return buildPolicy(
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""} ${scriptOrigins}`,
        `style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com`,
    );
}

export function containsRequestNonce(value: string): boolean {
    const nonceSource = /^'nonce-[A-Za-z0-9+/_-]+={0,2}'$/i;
    const hasCspNonce = value.split(";").some((directive) => {
        const sources = directive.trim().split(/\s+/);
        return sources.slice(1).some((source) => nonceSource.test(source));
    });

    if (hasCspNonce) {
        return true;
    }

    const nonceAttribute = /(?:^|\s)nonce(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?(?=\s|\/?>)/i;
    return value.match(/<[A-Za-z][^>]*>/g)?.some((tag) => nonceAttribute.test(tag)) === true;
}

export function buildContentSecurityPolicy(nonce: string): string {
    return buildPrivateContentSecurityPolicy(nonce);
}
