import { useEffect, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { prettifyHtml } from '@/lib/htmlFormat';
import { TipTapToolbar } from '@/features/posts/TipTapToolbar';

const LinkWithStyle = Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      class: { default: null, parseHTML: (element: HTMLElement) => element.getAttribute('class') },
      style: { default: null, parseHTML: (element: HTMLElement) => element.getAttribute('style') },
    };
  },
});

export function ProductDescriptionEditor({ value, onChange, disabled = false }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const { t } = useTranslation();
  const [sourceMode, setSourceMode] = useState(false);
  const [sourceHtml, setSourceHtml] = useState('');
  const editor = useEditor({
    editable: !disabled,
    extensions: [
      StarterKit, Underline, TextStyle, Color, Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      LinkWithStyle.configure({ openOnClick: false, autolink: true, defaultProtocol: 'https' }),
      Image.configure({ inline: false }), Table.configure({ resizable: true }), TableRow, TableHeader, TableCell,
      TaskList, TaskItem.configure({ nested: true }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  useEffect(() => { editor?.setEditable(!disabled); }, [disabled, editor]);
  useEffect(() => {
    if (editor && !sourceMode && editor.getHTML() !== (value || '')) editor.commands.setContent(value || '', false);
  }, [editor, sourceMode, value]);

  function toggleSource() {
    if (!editor || sourceMode) return;
    setSourceHtml(prettifyHtml(editor.getHTML()));
    setSourceMode(true);
  }

  function applySource() {
    editor?.commands.setContent(sourceHtml);
    onChange(sourceHtml);
    setSourceMode(false);
  }

  if (sourceMode) return <div className="overflow-hidden rounded-lg border border-gray-300"><div className="flex items-center justify-between bg-gray-50 px-3 py-2"><span className="text-xs font-semibold text-gray-500">{t('posts.source_title')}</span><div className="flex gap-2"><Button type="button" variant="primary" onClick={applySource}>{t('posts.source_apply')}</Button><Button type="button" variant="secondary" onClick={() => setSourceMode(false)}>{t('posts.source_cancel')}</Button></div></div><textarea value={sourceHtml} onChange={(event) => setSourceHtml(event.target.value)} disabled={disabled} className="h-64 w-full p-3 font-mono text-xs text-ink" spellCheck={false}/></div>;

  return <div className="overflow-hidden rounded-lg border border-gray-300">{editor && <TipTapToolbar editor={editor} onToggleSource={toggleSource} mediaContext="product"/>}<div className="min-h-[220px] p-3"><EditorContent editor={editor}/></div></div>;
}
