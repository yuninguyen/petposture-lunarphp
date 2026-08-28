const isDevelopment = process.env.NODE_ENV === "development";

export function buildContentSecurityPolicy(nonce: string): string {
    return [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""} https://js.stripe.com https://www.paypal.com https://maps.googleapis.com https://www.googletagmanager.com https://challenges.cloudflare.com`,
        `style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com`,
        "style-src-attr 'unsafe-inline'",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data: https://fonts.gstatic.com",
        `connect-src 'self' https: wss:${isDevelopment ? " http: ws:" : ""}`,
        "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://www.paypal.com https://challenges.cloudflare.com",
        "media-src 'self' https:",
        "worker-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
    ].join("; ");
}
