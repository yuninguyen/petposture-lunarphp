import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createCollection, updateCollection, type CollectionNode } from './api';
import {
  buildCollectionFormData,
  collectionFormSchema,
  emptyCollectionFormValues,
  type CollectionFormValues,
} from './collectionSchema';

interface CollectionFormModalProps {
  open: boolean;
  collectionGroupId: number | null;
  parentId: number | null;
  collection: CollectionNode | null;
  onClose: () => void;
  onSaved?: (node: CollectionNode) => void;
}

export function CollectionFormModal({
  open,
  collectionGroupId,
  parentId,
  collection,
  onClose,
  onSaved,
}: CollectionFormModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<CollectionFormValues>(emptyCollectionFormValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setValues(collection ? { name: collection.name.en } : emptyCollectionFormValues);
    setErrors({});
  }, [collection, open]);

  const saveMutation = useMutation({
    mutationFn: (formValues: CollectionFormValues) => {
      const groupId = collection?.collection_group_id ?? collectionGroupId;
      if (groupId === null) throw new Error('A collection group is required.');
      const data = buildCollectionFormData(formValues, {
        collectionGroupId: groupId,
        parentId: collection ? collection.parent_id : parentId,
        isUpdate: Boolean(collection),
      });
      return collection ? updateCollection(collection.id, data) : createCollection(data);
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['collections', 'tree'] });
      toast.success(t(collection ? 'collections.update_success' : 'collections.create_success', {
        defaultValue: collection ? 'Collection updated.' : 'Collection created.',
      }));
      onSaved?.(saved);
      onClose();
    },
    onError: (error: Error) => toast.error(error.message || t('common.error_occurred', { defaultValue: 'Something went wrong.' })),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = collectionFormSchema.safeParse(values);
    if (!result.success) {
      const next: Record<string, string> = {};
      result.error.issues.forEach((issue) => { next[issue.path.join('.')] = t(issue.message); });
      setErrors(next);
      return;
    }
    setErrors({});
    saveMutation.mutate(result.data);
  }

  if (!open) return null;
  const isEditing = collection !== null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 p-4" onClick={() => !saveMutation.isPending && onClose()}>
      <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {t(isEditing ? 'collections.edit_title' : parentId ? 'collections.add_child_title' : 'collections.add_root_title', {
              defaultValue: isEditing ? 'Edit collection' : parentId ? 'Add child collection' : 'Add root collection',
            })}
          </h2>
          <button type="button" disabled={saveMutation.isPending} onClick={onClose} className="text-2xl text-slate-400 hover:text-slate-600" aria-label={t('common.close')}>×</button>
        </div>
        <form onSubmit={submit}>
          <div className="p-5">
            <label htmlFor="collection-name" className="mb-1 block text-sm font-medium text-slate-700">{t('collections.name', { defaultValue: 'Name' })} *</label>
            <Input id="collection-name" value={values.name} onChange={(event) => setValues({ name: event.target.value })} />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
            <Button type="button" variant="secondary" disabled={saveMutation.isPending} onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="submit" variant="primary" disabled={saveMutation.isPending}>{saveMutation.isPending ? t('common.saving') : t('common.save', { defaultValue: 'Save' })}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
