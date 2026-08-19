// js-beautify 2.x exports html_beautify on its default export only — a named
// import resolves to undefined (silently breaking pretty-print) in this version.
import beautify from 'js-beautify';

const { html_beautify } = beautify;

function prettyPrint(textarea) {
    // The modal's textarea is inserted before Livewire fills its value, and
    // Livewire may also re-fill it after our first pass (overwriting the
    // formatted copy on the same element). Skip empty values and anything
    // already multi-line (already formatted, or user-edited), and format
    // whatever still looks like raw one-line HTML — the interval below keeps
    // re-scanning so a late Livewire fill still gets formatted.
    if (!textarea.value || textarea.value.includes('\n')) return;
    textarea.dataset.formatted = '1';

    // Display-only: reformat for readability, but do NOT sync this back to
    // Livewire yet. TipTap's HTML->JSON converter treats stray whitespace
    // between block tags (e.g. between <li> elements) as real content, which
    // broke list-item editability after submitting. The whitespace is
    // collapsed back out in the submit-time listener below.
    textarea.value = html_beautify(textarea.value, {
        indent_size: 2,
        wrap_line_length: 0,
        preserve_newlines: false,
    });

    textarea.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    textarea.style.fontSize = '13px';
    textarea.style.whiteSpace = 'pre';
    textarea.style.tabSize = '2';
}

function scan() {
    // Vendor's extraAttributes() class lands on the field wrapper div, not the textarea itself.
    document.querySelectorAll('.source_code_editor textarea').forEach(prettyPrint);
}

document.addEventListener('DOMContentLoaded', () => {
    scan();
    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });

    // Retry until Livewire has populated the value (the observer only sees the
    // element insertion, not the later value fill).
    setInterval(scan, 500);
});

// Capture phase so this runs before Livewire's own click handler reads the
// entangled form state -- collapses whitespace between tags back out so the
// TipTap converter sees the same tag-adjacency as the original compact HTML.
document.addEventListener(
    'click',
    (event) => {
        const button = event.target.closest('button');
        if (!button) return;

        const modal = button.closest('.fi-modal');
        if (!modal) return;

        const textarea = modal.querySelector('.source_code_editor textarea[data-formatted]');
        if (!textarea) return;

        textarea.value = textarea.value.replace(/>\s+</g, '><');
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    },
    true,
);

// Clear the local autosave-draft snapshot on Save Draft / Update & Publish.
// This used to be an inline onclick="localStorage.removeItem('...')" built
// from a PHP string; Filament's HTML-escaping of the single quotes produced
// a literal "&#039;" in the attribute value, which the browser then tried to
// parse as JS and threw "Uncaught SyntaxError: Unexpected token '&'" --
// silently breaking the click before Livewire's own handler ever ran.
document.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;

    const label = button.textContent.trim();
    if (label !== 'Save Draft' && label !== 'Update & Publish') return;

    localStorage.removeItem('petposture-draft:' + window.location.pathname);
});
