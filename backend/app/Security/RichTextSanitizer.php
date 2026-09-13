<?php

namespace App\Security;

use Symfony\Component\HtmlSanitizer\HtmlSanitizer;
use Symfony\Component\HtmlSanitizer\HtmlSanitizerConfig;

class RichTextSanitizer
{
    private readonly HtmlSanitizer $sanitizer;

    public function __construct()
    {
        $config = (new HtmlSanitizerConfig)
            ->allowElement('p')
            ->allowElement('br')
            ->allowElement('strong')
            ->allowElement('b')
            ->allowElement('em')
            ->allowElement('i')
            ->allowElement('u')
            ->allowElement('s')
            ->allowElement('blockquote')
            ->allowElement('ul')
            ->allowElement('ol')
            ->allowElement('li')
            ->allowElement('h1')
            ->allowElement('h2')
            ->allowElement('h3')
            ->allowElement('h4')
            ->allowElement('h5')
            ->allowElement('h6')
            // class/style on <a> are intentionally broad here (Symfony's
            // sanitizer only allows/blocks whole attributes, it can't
            // restrict to specific values like DOMPurify hooks can). The
            // frontend's sanitizeRichHtml() is the final authority for public
            // rendering and narrows class to only pp-cta-primary/pp-cta-pill,
            // and style to only alongside one of those -- so anything else
            // stored here never actually reaches a rendered page.
            ->allowElement('a', ['href', 'title', 'rel', 'class', 'style'])
            ->allowElement('img', ['src', 'alt', 'title', 'width', 'height', 'loading'])
            ->allowElement('figure')
            ->allowElement('figcaption')
            ->allowElement('pre')
            ->allowElement('code')
            ->allowElement('hr')
            ->allowElement('table', ['width'])
            ->allowElement('thead')
            ->allowElement('tbody')
            ->allowElement('colgroup')
            ->allowElement('col', ['width', 'colwidth'])
            ->allowElement('tr')
            ->allowElement('th', ['colspan', 'rowspan', 'scope', 'colwidth'])
            ->allowElement('td', ['colspan', 'rowspan', 'colwidth'])
            ->allowRelativeLinks()
            ->allowRelativeMedias()
            ->allowMediaSchemes(['http', 'https'])
            ->withMaxInputLength(500_000);

        $this->sanitizer = new HtmlSanitizer($config);
    }

    public function sanitize(?string $html): string
    {
        return $this->sanitizer->sanitize((string) $html);
    }
}
