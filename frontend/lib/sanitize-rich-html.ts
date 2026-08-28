import DOMPurify from "isomorphic-dompurify";

const allowedTags = [
    "p", "br", "strong", "b", "em", "i", "u", "s", "blockquote",
    "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6", "a", "img",
    "figure", "figcaption", "pre", "code", "hr", "table", "thead", "tbody",
    "tr", "th", "td",
];

const allowedAttributes = [
    "href", "title", "rel", "src", "alt", "width", "height",
    "loading", "colspan", "rowspan", "scope",
];

export function sanitizeRichHtml(html: string | null | undefined): string {
    return String(DOMPurify.sanitize(html ?? "", {
        ALLOWED_TAGS: allowedTags,
        ALLOWED_ATTR: allowedAttributes,
        ALLOW_DATA_ATTR: false,
        ALLOW_ARIA_ATTR: false,
        ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|\/|#)/i,
    }));
}
