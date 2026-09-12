import DOMPurify from "isomorphic-dompurify";

const allowedTags = [
    "p", "br", "strong", "b", "em", "i", "u", "s", "blockquote",
    "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6", "a", "img",
    "figure", "figcaption", "pre", "code", "hr", "table", "thead", "tbody",
    "tr", "th", "td", "colgroup", "col",
];

const allowedAttributes = [
    "href", "title", "rel", "src", "alt", "width", "height",
    "loading", "colspan", "rowspan", "scope", "colwidth", "class", "style",
];

// The only class values editorial content is allowed to set -- matches the
// admin's LinkWithStyle TipTap extension and the .pp-cta-* rules in
// globals.css. This lets authors mark a link as a styled CTA button without
// opening up arbitrary class injection.
const ALLOWED_CLASSES = new Set(["pp-cta-primary", "pp-cta-pill"]);

// DOMPurify still runs its own built-in per-tag/attribute validation after
// uponSanitizeAttribute returns, unless forceKeepAttr is set explicitly.
// Without it, table-metadata attributes (width/colwidth/scope/etc.) get
// silently dropped again once multiple attrName branches exist in this hook,
// even though keepAttr was never set to false for them.
DOMPurify.addHook("uponSanitizeAttribute", (node, data) => {
    const tagName = (node.nodeName || (node as Element).tagName || "").toLowerCase();

    if (data.attrName === "class") {
        data.attrValue = data.attrValue
            .split(/\s+/)
            .filter((value) => ALLOWED_CLASSES.has(value))
            .join(" ");
        if (!data.attrValue) {
            data.keepAttr = false;
        }
        return;
    }

    if (data.attrName === "style") {
        // Only CTA links carry hand-authored inline style; drop it everywhere
        // else instead of opening style on arbitrary elements.
        const classAttr = (node as Element).getAttribute?.("class") ?? "";
        const hasCtaClass = classAttr.split(/\s+/).some((value) => ALLOWED_CLASSES.has(value));
        if (!hasCtaClass) {
            data.keepAttr = false;
        }
        return;
    }

    if (data.attrName === "width") {
        const validOnTableOrCol = (tagName === "table" || tagName === "col")
            && /^\d+(?:px|%)?$/i.test(data.attrValue.trim());
        const validOnImg = tagName === "img" && /^\d+(?:px)?$/i.test(data.attrValue.trim());
        if (validOnTableOrCol || validOnImg) {
            data.forceKeepAttr = true;
        } else {
            data.keepAttr = false;
        }
        return;
    }

    if (data.attrName === "colwidth") {
        const validOnTableCell = (tagName === "th" || tagName === "td" || tagName === "col")
            && /^\d+(?:,\d+)*$/.test(data.attrValue.trim());
        if (validOnTableCell) {
            data.forceKeepAttr = true;
        } else {
            data.keepAttr = false;
        }
        return;
    }

    if (data.attrName === "colspan" || data.attrName === "rowspan" || data.attrName === "scope") {
        data.forceKeepAttr = true;
    }
});

export function sanitizeRichHtml(html: string | null | undefined): string {
    return String(DOMPurify.sanitize(html ?? "", {
        ALLOWED_TAGS: allowedTags,
        ALLOWED_ATTR: allowedAttributes,
        ALLOW_DATA_ATTR: false,
        ALLOW_ARIA_ATTR: false,
        ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|\/|#)/i,
    }));
}
