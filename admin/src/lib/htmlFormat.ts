const BLOCK_TAGS = new Set([
  'html', 'head', 'body', 'header', 'footer', 'nav', 'main', 'section', 'article', 'aside',
  'div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'table', 'thead', 'tbody',
  'tfoot', 'tr', 'td', 'th', 'blockquote', 'pre', 'figure', 'figcaption', 'hr', 'form',
  'fieldset', 'details', 'summary', 'dl', 'dt', 'dd',
]);

const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

/**
 * Pretty-prints HTML by putting each block-level element on its own indented
 * line. Inline elements/text stay on the same line as their surrounding
 * content so no rendering-visible whitespace is introduced.
 */
export function prettifyHtml(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) return '';

  const tokens = trimmed.split(/(<[^>]+>)/g).filter((token) => token !== '');
  const lines: string[] = [];
  let indent = 0;
  let currentLine = '';

  const flush = () => {
    if (currentLine.trim()) {
      lines.push('  '.repeat(indent) + currentLine.trim());
    }
    currentLine = '';
  };

  for (const token of tokens) {
    if (!token.startsWith('<')) {
      currentLine += token;
      continue;
    }

    const closeMatch = token.match(/^<\/([a-zA-Z0-9-]+)>$/);
    const openMatch = token.match(/^<([a-zA-Z0-9-]+)/);
    const tagName = (closeMatch?.[1] ?? openMatch?.[1] ?? '').toLowerCase();
    const isBlock = BLOCK_TAGS.has(tagName);

    if (closeMatch) {
      if (isBlock) {
        flush();
        indent = Math.max(indent - 1, 0);
        lines.push('  '.repeat(indent) + token);
      } else {
        currentLine += token;
      }
      continue;
    }

    const isSelfClosing = /\/>$/.test(token) || VOID_TAGS.has(tagName);
    if (isBlock) {
      flush();
      lines.push('  '.repeat(indent) + token);
      if (!isSelfClosing) indent += 1;
    } else {
      currentLine += token;
    }
  }
  flush();

  return lines.join('\n');
}
