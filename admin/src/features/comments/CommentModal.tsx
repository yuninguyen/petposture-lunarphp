import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { createComment, updateComment, Comment } from './api';
import toast from 'react-hot-toast';

interface CommentModalProps {
  open: boolean;
  onClose: () => void;
  comment?: Comment | null;
}

export function CommentModal({ open, onClose, comment }: CommentModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isEditing = Boolean(comment);

  const [postId, setPostId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [commentText, setCommentText] = useState('');

  useEffect(() => {
    if (open) {
      if (comment) {
        setPostId(comment.post_id.toString());
        setCustomerName(comment.customer_name);
        setStatus(comment.status);
        setCommentText(comment.comment);
      } else {
        setPostId('');
        setCustomerName('');
        setStatus('pending');
        setCommentText('');
      }
    }
  }, [open, comment]);

  const saveMutation = useMutation({
    mutationFn: (payload: { post_id: number; customer_name: string; status: 'pending' | 'approved' | 'rejected'; comment: string }) => {
      if (isEditing && comment) {
        return updateComment(comment.id, payload);
      }
      return createComment(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments-list'] });
      onClose();
      toast.success(isEditing ? t('comments.update_success', { defaultValue: 'Comment updated successfully' }) : t('comments.create_success', { defaultValue: 'Comment created successfully' }));
    },
    onError: (error: any) => {
      toast.error(error.message || t('common.error_occurred', { defaultValue: 'An error occurred' }));
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({
      post_id: parseInt(postId, 10),
      customer_name: customerName,
      status,
      comment: commentText,
    });
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl bg-white shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">
            {isEditing ? t('comments.edit', 'Edit Comment') : t('comments.create', 'Create Comment')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-2xl leading-none text-slate-400 hover:text-slate-600"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-6">
            {saveMutation.isError && (
              <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">
                {saveMutation.error instanceof Error ? saveMutation.error.message : 'An error occurred'}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t('comments.post_id', 'Post ID')}
              </label>
              <Input
                type="number"
                value={postId}
                onChange={(e) => setPostId(e.target.value)}
                required
                placeholder="e.g. 1"
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t('comments.customer_name', 'Customer Name')}
              </label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
                placeholder="e.g. John Doe"
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t('comments.status', 'Status')}
              </label>
              <div className="relative">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'pending' | 'approved' | 'rejected')}
                  className="appearance-none w-full px-3 py-2 pr-8 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white hover:bg-slate-50 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-colors cursor-pointer shadow-sm"
                >
                  <option value="pending">{t('comments.status_pending', 'Pending')}</option>
                  <option value="approved">{t('comments.status_approved', 'Approved')}</option>
                  <option value="rejected">{t('comments.status_rejected', 'Rejected')}</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                  </svg>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t('comments.content', 'Comment')}
              </label>
              <Textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                required
                rows={4}
                className="w-full"
              />
            </div>
          </div>

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create Comment')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
