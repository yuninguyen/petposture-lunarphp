import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createBlogCategory, updateBlogCategory, BlogCategory } from './api';
import toast from 'react-hot-toast';

interface BlogCategoryModalProps {
  open: boolean;
  onClose: () => void;
  category?: BlogCategory | null;
}

export function BlogCategoryModal({ open, onClose, category }: BlogCategoryModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isEditing = Boolean(category);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  
  // Basic auto-slug functionality if slug is empty or user is typing name and hasn't manually edited slug
  const [slugEdited, setSlugEdited] = useState(false);

  useEffect(() => {
    if (open) {
      if (category) {
        setName(category.name);
        setSlug(category.slug);
        setSlugEdited(true);
      } else {
        setName('');
        setSlug('');
        setSlugEdited(false);
      }
    }
  }, [open, category]);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!slugEdited && !isEditing) {
      setSlug(
        val
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
      );
    }
  };

  const handleSlugChange = (val: string) => {
    setSlug(val);
    setSlugEdited(true);
  };

  const saveMutation = useMutation({
    mutationFn: (payload: { name: string; slug: string }) => {
      if (isEditing && category) {
        return updateBlogCategory(category.id, payload);
      }
      return createBlogCategory(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blog-categories-list'] });
      onClose();
      toast.success(isEditing ? t('blog_categories.update_success', 'Category updated successfully') : t('blog_categories.create_success', 'Category created successfully'));
    },
    onError: (err: any) => {
      toast.error(err.message || t('common.error_occurred', 'An error occurred'));
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({ name, slug });
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
            {isEditing ? t('blog_categories.edit', 'Edit Category') : t('blog_categories.create', 'Create Category')}
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
                {t('blog_categories.name', 'Name')}
              </label>
              <Input
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                required
                placeholder="e.g. Health & Wellness"
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t('blog_categories.slug', 'Slug')}
              </label>
              <Input
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                required
                placeholder="e.g. health-wellness"
                className="w-full bg-slate-50"
              />
            </div>
          </div>

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
            <Button
              type="button"
              variant="primary"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" variant="secondary" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create Category')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
