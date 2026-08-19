import CodeMirror from 'codemirror';
import 'codemirror/mode/xml/xml';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/mode/css/css';
import 'codemirror/mode/htmlmixed/htmlmixed';
import 'codemirror/lib/codemirror.css';
import { html_beautify } from 'js-beautify';

function attach(textarea) {
    if (textarea.dataset.cmAttached) return;
    textarea.dataset.cmAttached = '1';

    const pretty = html_beautify(textarea.value, {
        indent_size: 2,
        wrap_line_length: 0,
        preserve_newlines: false,
    });

    textarea.style.display = 'none';

    const cm = CodeMirror(
        (el) => {
            el.classList.add('source-code-mirror');
            textarea.insertAdjacentElement('afterend', el);
        },
        {
            value: pretty,
            mode: 'htmlmixed',
            lineNumbers: true,
            lineWrapping: true,
            viewportMargin: Infinity,
        },
    );

    cm.setSize('100%', '60vh');

    // Sync on blur only (not on every keystroke/`change`) -- Livewire's wire:model
    // on this textarea round-trips over the network on each dispatched input event,
    // and re-syncing on every CodeMirror change (including its own initial setValue)
    // caused the modal to re-render, re-attach a fresh CodeMirror, and loop forever.
    // A blur reliably fires before the Submit button's click handler runs.
    cm.on('blur', () => {
        textarea.value = cm.getValue();
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

function scan() {
    // Vendor's extraAttributes() class lands on the field wrapper div, not the textarea itself.
    document.querySelectorAll('.source_code_editor textarea').forEach(attach);
}

document.addEventListener('DOMContentLoaded', () => {
    scan();
    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
});
