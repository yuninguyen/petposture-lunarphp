import { html_beautify } from 'js-beautify';

function attach(textarea) {
    if (textarea.dataset.formatted) return;
    textarea.dataset.formatted = '1';

    textarea.value = html_beautify(textarea.value, {
        indent_size: 2,
        wrap_line_length: 0,
        preserve_newlines: false,
    });
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    textarea.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
    textarea.style.fontSize = '13px';
    textarea.style.whiteSpace = 'pre';
    textarea.style.tabSize = '2';
}

function scan() {
    // Vendor's extraAttributes() class lands on the field wrapper div, not the textarea itself.
    document.querySelectorAll('.source_code_editor textarea').forEach(attach);
}

document.addEventListener('DOMContentLoaded', () => {
    scan();
    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
});
