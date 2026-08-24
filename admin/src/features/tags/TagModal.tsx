import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createTag, updateTag, BlogTag } from './api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import toast from 'react-hot-toast';

export function TagModal({
  open,
  onClose,
  tag,
}: {
  open: boolean;
  onClose: () => void;
  tag?: BlogTag | null;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isEditing = !!tag;

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');

  useEffect(() => {
    if (open) {
      setName(tag?.name ?? '');
      setSlug(tag?.slug ?? '');
    }
  }, [open, tag]);

  const mutation = useMutation({
    mutationFn: (data: { name: string; slug?: string }) => {
      return isEditing ? updateTag(tag.id, data) : createTag(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags-list'] });
      onClose();
      toast.success(isEditing ? t('tags.update_success', { defaultValue: 'Tag updated successfully' }) : t('tags.create_success', { defaultValue: 'Tag created successfully' }));
    },
    onError: (error: any) => {
      toast.error(error.message || t('common.error_occurred', { defaultValue: 'An error occurred' }));
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({ name, slug: slug || undefined });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden ring-1 ring-slate-900/5">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-lg font-semibold text-slate-800">
            {isEditing ? t('tags.edit_tag') : t('tags.new_tag')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-md hover:bg-slate-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('tags.name')}</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full focus:ring-primary/20"
                placeholder={t('tags.name_placeholder', { defaultValue: 'e.g. Training' })}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {t('tags.slug')} 
                <span className="text-slate-400 font-normal ml-1 text-xs">(optional)</span>
              </label>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full focus:ring-primary/20"
                placeholder={t('tags.slug_placeholder', { defaultValue: 'Auto-generated if empty' })}
              />
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button 
              type="submit" 
              variant="primary"
              disabled={mutation.isPending}
              className="min-w-[100px]"
            >
              {mutation.isPending ? (
                <svg className="animate-spin h-5 w-5 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                t('common.save', { defaultValue: 'Save' })
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
