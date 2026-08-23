import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Comment, deleteComment, approveComment } from './api';
import { CommentModal } from './CommentModal';
import { Button } from '@/components/ui/button';
import { PencilIcon, TrashIcon, DotsVerticalIcon } from '../../components/ui/icons';
import toast from 'react-hot-toast';

// We need a check icon
const CheckIcon = ({ className = "h-4 w-4" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
  </svg>
);

interface CommentRowActionsProps {
  comment: Comment;
  onDelete?: () => void;
}

export function CommentRowActions({ comment, onDelete }: CommentRowActionsProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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


  const approveMutation = useMutation({
    mutationFn: () => approveComment(comment.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments-list'] });
      toast.success(t('comments.approve_success', { defaultValue: 'Comment approved successfully' }));
    },
    onError: (error: any) => {
      toast.error(error.message || t('common.error_occurred', { defaultValue: 'An error occurred' }));
    }
  });

  return (
    <>
      <div className="flex items-center justify-end gap-1">
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex items-center justify-center rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            <DotsVerticalIcon />
          </button>

          {open && (
            <div className="absolute right-0 z-10 mt-1 min-w-[160px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              {comment.status === 'pending' && (
                <button
                  type="button"
                  disabled={approveMutation.isPending}
                  onClick={() => {
                    setOpen(false);
                    approveMutation.mutate();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-gray-50"
                >
                  <CheckIcon className="h-4 w-4 text-green-600" />
                  {t('comments.approve', 'Approve')}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setIsEditModalOpen(true);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-gray-50"
              >
                <PencilIcon className="h-4 w-4 text-gray-400" />
                {t('common.edit', 'Edit')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onDelete?.();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
              >
                <TrashIcon className="h-4 w-4 text-red-400" />
                {t('common.delete', 'Delete')}
              </button>
            </div>
          )}
        </div>
      </div>

      <CommentModal
        open={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        comment={comment}
      />
    </>
  );
}
