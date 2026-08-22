import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { Post } from './postsApi';
import { useFrontendUrl } from './postsApi';
import { EyeIcon, PencilIcon, CopyIcon, TrashIcon, DotsVerticalIcon } from '../../components/ui/icons';

interface PostRowActionsProps {
  post: Post;
  onDuplicate: (post: Post) => void;
  onDelete: (post: Post) => void;
}

export function PostRowActions({ post, onDuplicate, onDelete }: PostRowActionsProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Same source as the preview endpoint — points at the local storefront in
  // dev and petposture.com in production, never the wrong one.
  const { data: frontendUrl } = useFrontendUrl();
  const viewBaseUrl = frontendUrl ?? import.meta.env.VITE_FRONTEND_URL ?? 'https://petposture.com';

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="flex items-center justify-end gap-1">
      {post.status === 'published' && (
        <a
          href={`${viewBaseUrl}/blog/${post.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          title={t('posts.action_view')}
          className="inline-flex items-center justify-center rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        >
          <EyeIcon />
        </a>
      )}

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          title={t('posts.action_more')}
          onClick={() => setOpen((value) => !value)}
          className="inline-flex items-center justify-center rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        >
          <DotsVerticalIcon />
        </button>

        {open && (
          <div className="absolute right-0 z-10 mt-1 min-w-[160px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate(`/posts/${post.id}`);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-gray-50"
            >
              <PencilIcon className="h-4 w-4 text-gray-400" />
              {t('posts.action_edit')}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onDuplicate(post);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-gray-50"
            >
              <CopyIcon className="h-4 w-4 text-gray-400" />
              {t('posts.action_duplicate')}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onDelete(post);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            >
              <TrashIcon className="h-4 w-4 text-red-400" />
              {t('posts.action_delete')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
