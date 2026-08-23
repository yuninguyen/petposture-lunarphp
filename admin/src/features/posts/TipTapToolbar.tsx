import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Editor } from '@tiptap/react';
import clsx from 'clsx';
import { MediaLibraryModal } from '../../components/ui/media-library-modal';
import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BoldIcon,
  BracesIcon,
  CodeIcon,
  HighlighterIcon,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  ListChecksIcon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  PaletteIcon,
  PlusIcon,
  QuoteIcon,
  RedoIcon,
  StrikethroughIcon,
  TableIcon,
  UnderlineIcon,
  UndoIcon,
} from '../../components/ui/icons';

interface TipTapToolbarProps {
  editor: Editor;
  onToggleSource: () => void;
}

const TEXT_COLORS = [
  { label: 'Ink', value: '#1a2128' },
  { label: 'Secondary', value: '#df8448' },
  { label: 'Red', value: '#dc2626' },
  { label: 'Green', value: '#16a34a' },
  { label: 'Blue', value: '#2563eb' },
  { label: 'Gray', value: '#6b7280' },
];

const HIGHLIGHTS = [
  { label: 'Yellow', value: '#fef08a' },
  { label: 'Green', value: '#bbf7d0' },
  { label: 'Blue', value: '#bfdbfe' },
  { label: 'Pink', value: '#fbcfe8' },
];

function ToolButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={clsx(
        'inline-flex h-8 w-8 items-center justify-center rounded text-gray-600 hover:bg-gray-100',
        active && 'bg-gray-200 text-ink'
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 my-1 w-px self-stretch bg-gray-300" aria-hidden="true" />;
}

function Popover({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div ref={ref} className="absolute left-0 top-full z-20 mt-1 rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
      {children}
    </div>
  );
}

export function TipTapToolbar({ editor, onToggleSource }: TipTapToolbarProps) {
  const { t } = useTranslation();
  const [imageOpen, setImageOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [highlightOpen, setHighlightOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const customHighlightInputRef = useRef<HTMLInputElement>(null);

  function applyLink() {
    const url = linkUrl.trim();
    if (url) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
    setLinkUrl('');
    setLinkOpen(false);
  }

  function unsetLink() {
    editor.chain().focus().unsetLink().run();
    setLinkOpen(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-300 bg-gray-50 px-2 py-1">
      <select
        title={t('posts.toolbar.heading')}
        onChange={(e) => {
          const value = e.target.value;
          if (value === 'paragraph') {
            editor.chain().focus().setParagraph().run();
          } else {
            editor.chain().focus().toggleHeading({ level: Number(value) as 2 | 3 | 4 }).run();
          }
          e.target.value = '';
        }}
        className="h-8 rounded border border-gray-300 bg-white px-1 text-xs text-gray-600"
      >
        <option value="">{t('posts.toolbar.heading')}</option>
        <option value="paragraph">{t('posts.toolbar.paragraph')}</option>
        <option value="2">H2</option>
        <option value="3">H3</option>
        <option value="4">H4</option>
      </select>

      <Divider />

      <ToolButton label={t('posts.toolbar.bold')} active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <BoldIcon className="h-4 w-4" />
      </ToolButton>
      <ToolButton label={t('posts.toolbar.italic')} active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <ItalicIcon className="h-4 w-4" />
      </ToolButton>
      <ToolButton label={t('posts.toolbar.underline')} active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon className="h-4 w-4" />
      </ToolButton>
      <ToolButton label={t('posts.toolbar.strike')} active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <StrikethroughIcon className="h-4 w-4" />
      </ToolButton>

      <Divider />

      <ToolButton label={t('posts.toolbar.align_left')} active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}>
        <AlignLeftIcon className="h-4 w-4" />
      </ToolButton>
      <ToolButton label={t('posts.toolbar.align_center')} active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}>
        <AlignCenterIcon className="h-4 w-4" />
      </ToolButton>
      <ToolButton label={t('posts.toolbar.align_right')} active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}>
        <AlignRightIcon className="h-4 w-4" />
      </ToolButton>

      <Divider />

      <ToolButton label={t('posts.toolbar.bullet_list')} active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <ListIcon className="h-4 w-4" />
      </ToolButton>
      <ToolButton label={t('posts.toolbar.ordered_list')} active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrderedIcon className="h-4 w-4" />
      </ToolButton>
      <ToolButton label={t('posts.toolbar.checked_list')} active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()}>
        <ListChecksIcon className="h-4 w-4" />
      </ToolButton>
      <ToolButton label={t('posts.toolbar.blockquote')} active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <QuoteIcon className="h-4 w-4" />
      </ToolButton>
      <ToolButton label={t('posts.toolbar.hr')} onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <MinusIcon className="h-4 w-4" />
      </ToolButton>

      <Divider />

      <div className="relative">
        <ToolButton
          label={t('posts.toolbar.link')}
          active={editor.isActive('link')}
          onClick={() => {
            if (editor.isActive('link')) {
              unsetLink();
            } else {
              setLinkUrl(editor.getAttributes('link').href ?? '');
              setLinkOpen((v) => !v);
            }
          }}
        >
          <LinkIcon className="h-4 w-4" />
        </ToolButton>
        <Popover open={linkOpen} onClose={() => setLinkOpen(false)}>
          <div className="flex gap-1.5">
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyLink()}
              placeholder="https://…"
              className="w-52 rounded border border-gray-300 px-2 py-1 text-sm"
              autoFocus
            />
            <button type="button" onClick={applyLink} className="rounded bg-secondary px-2 py-1 text-xs font-semibold text-white">
              {t('posts.toolbar.link_apply')}
            </button>
          </div>
        </Popover>
      </div>

      <ToolButton label={t('posts.toolbar.media')} onClick={() => setImageOpen(true)}>
        <ImageIcon className="h-4 w-4" />
      </ToolButton>
      <ToolButton label={t('posts.toolbar.table')} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
        <TableIcon className="h-4 w-4" />
      </ToolButton>
      <ToolButton label={t('posts.toolbar.code_block')} active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        <CodeIcon className="h-4 w-4" />
      </ToolButton>
      <ToolButton label={t('posts.toolbar.source')} onClick={onToggleSource}>
        <BracesIcon className="h-4 w-4" />
      </ToolButton>

      <Divider />

      <div className="relative">
        <ToolButton label={t('posts.toolbar.color')} active={colorOpen} onClick={() => setColorOpen((v) => !v)}>
          <PaletteIcon className="h-4 w-4" />
        </ToolButton>
        <Popover open={colorOpen} onClose={() => setColorOpen(false)}>
          <div className="flex gap-1.5">
            {TEXT_COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                title={color.label}
                onClick={() => {
                  editor.chain().focus().setColor(color.value).run();
                  setColorOpen(false);
                }}
                className="h-6 w-6 rounded-full border border-gray-300"
                style={{ backgroundColor: color.value }}
              />
            ))}
            <button
              type="button"
              title={t('posts.toolbar.color_default')}
              onClick={() => {
                editor.chain().focus().unsetColor().run();
                setColorOpen(false);
              }}
              className="h-6 w-6 rounded-full border border-dashed border-gray-400 text-[10px] text-gray-400"
            >
              A
            </button>
          </div>
        </Popover>
      </div>

      <div className="relative">
        <ToolButton label={t('posts.toolbar.highlight')} active={highlightOpen} onClick={() => setHighlightOpen((v) => !v)}>
          <HighlighterIcon className="h-4 w-4" />
        </ToolButton>
        <Popover open={highlightOpen} onClose={() => setHighlightOpen(false)}>
          <div className="flex gap-1.5">
            {HIGHLIGHTS.map((color) => (
              <button
                key={color.value}
                type="button"
                title={color.label}
                onClick={() => {
                  editor.chain().focus().toggleHighlight({ color: color.value }).run();
                  setHighlightOpen(false);
                }}
                className="h-6 w-6 rounded-full border border-gray-300"
                style={{ backgroundColor: color.value }}
              />
            ))}
            <button
              type="button"
              title={t('posts.toolbar.highlight_custom')}
              onClick={() => customHighlightInputRef.current?.click()}
              className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-gray-400 text-gray-400"
            >
              <PlusIcon className="h-3.5 w-3.5" />
            </button>
            <input
              ref={customHighlightInputRef}
              type="color"
              className="h-0 w-0 opacity-0"
              onChange={(e) => {
                editor.chain().focus().toggleHighlight({ color: e.target.value }).run();
                setHighlightOpen(false);
              }}
            />
            <button
              type="button"
              title={t('posts.toolbar.highlight_none')}
              onClick={() => {
                editor.chain().focus().unsetHighlight().run();
                setHighlightOpen(false);
              }}
              className="h-6 w-6 rounded-full border border-dashed border-gray-400 text-[10px] text-gray-400"
            >
              A
            </button>
          </div>
        </Popover>
      </div>

      <Divider />

      <ToolButton label={t('posts.toolbar.undo')} onClick={() => editor.chain().focus().undo().run()}>
        <UndoIcon className="h-4 w-4" />
      </ToolButton>
      <ToolButton label={t('posts.toolbar.redo')} onClick={() => editor.chain().focus().redo().run()}>
        <RedoIcon className="h-4 w-4" />
      </ToolButton>

      <MediaLibraryModal
        open={imageOpen}
        onClose={() => setImageOpen(false)}
        onSelect={(media) => {
          editor.chain().focus().setImage({ src: media.url }).run();
          setImageOpen(false);
        }}
      />
    </div>
  );
}
