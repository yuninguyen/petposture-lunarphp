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

// TipTap's resizable table extension stores per-cell column widths as a
// `colwidth` attribute directly on the first row's <th>/<td> elements (a
// comma-separated pixel list, one entry per column the cell spans) -- it
// never persists an actual <colgroup> into the saved HTML, that's purely an
// in-editor rendering artifact. Rebuild a real <colgroup> from that data so
// the resize an author does in the editor actually affects the published
// page instead of being silently ignored.
function withColumnWidths(tableHtml: string): string {
    if (tableHtml.includes('<colgroup')) {
        return tableHtml;
    }

    const firstRowMatch = tableHtml.match(/<tr\b[^>]*>([\s\S]*?)<\/tr>/i);
    if (!firstRowMatch) return tableHtml;

    const cellRegex = /<(th|td)\b([^>]*)>/gi;
    const widths: (string | null)[] = [];
    let cellMatch: RegExpExecArray | null;

    while ((cellMatch = cellRegex.exec(firstRowMatch[1])) !== null) {
        const attrs = cellMatch[2];
        const colspanMatch = attrs.match(/\scolspan="(\d+)"/i);
        const colspan = colspanMatch ? parseInt(colspanMatch[1], 10) : 1;
        const colwidthMatch = attrs.match(/\scolwidth="([\d,]+)"/i);
        const perColumn = colwidthMatch ? colwidthMatch[1].split(',') : [];

        for (let i = 0; i < colspan; i += 1) {
            widths.push(perColumn[i]?.trim() || null);
        }
    }

    if (widths.length === 0 || widths.every((width) => !width)) {
        return tableHtml;
    }

    const cols = widths
        .map((width) => (width ? `<col style="width:${width}px">` : '<col>'))
        .join('');

    return tableHtml.replace(/(<table\b[^>]*>)/i, `$1<colgroup>${cols}</colgroup>`);
}

export function withResponsiveTables(html: string): string {
    if (!html || typeof html !== 'string' || !html.includes('<table')) {
        return html;
    }

    return html.replace(/<table\b[\s\S]*?<\/table>/gi, (tableHtml) => {
        const withWidths = withColumnWidths(tableHtml);
        return `<div class="rich-table-scroll" role="region" aria-label="Scrollable data table" tabindex="0">${withWidths}</div>`;
    });
}

