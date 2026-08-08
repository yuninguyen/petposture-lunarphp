export function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export type TocItem = { id: string; text: string; level: 2 | 3 };

export function withTableOfContents(html: string): { html: string; items: TocItem[] } {
    const items: TocItem[] = [];
    const seen = new Map<string, number>();

    const processedHtml = html.replace(/<h([23])([^>]*)>([\s\S]*?)<\/h\1>/gi, (match, level, attrs, inner) => {
        const text = stripHtml(inner);
        if (!text) return match;

        let id = text
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-');

        const count = seen.get(id) ?? 0;
        seen.set(id, count + 1);
        if (count > 0) id = `${id}-${count}`;

        items.push({ id, text, level: Number(level) as 2 | 3 });

        const hasId = /\sid=/.test(attrs);
        const newAttrs = hasId ? attrs : `${attrs} id="${id}"`;

        return `<h${level}${newAttrs}>${inner}</h${level}>`;
    });

    return { html: processedHtml, items };
}
