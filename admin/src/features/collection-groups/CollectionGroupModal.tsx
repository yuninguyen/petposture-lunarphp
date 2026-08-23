import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CollectionGroup, createCollectionGroup, updateCollectionGroup } from './api';
import {
  applyCollectionGroupNameChange,
  buildCollectionGroupPayload,
  collectionGroupFormSchema,
  CollectionGroupFormValues,
} from './collectionGroupSchema';

interface CollectionGroupModalProps {
  open: boolean;
  collectionGroup: CollectionGroup | null;
  onClose: () => void;
}

const emptyValues: CollectionGroupFormValues = { name: '', handle: '' };

export function CollectionGroupModal({ open, collectionGroup, onClose }: CollectionGroupModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isEditing = collectionGroup !== null;
  const [values, setValues] = useState<CollectionGroupFormValues>(emptyValues);
  const [handleEdited, setHandleEdited] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setValues(collectionGroup
      ? { name: collectionGroup.name, handle: collectionGroup.handle }
      : emptyValues);
    setHandleEdited(Boolean(collectionGroup));
    setErrors({});
  }, [collectionGroup, open]);

  const saveMutation = useMutation({
    mutationFn: (formValues: CollectionGroupFormValues) => collectionGroup
      ? updateCollectionGroup(collectionGroup.id, buildCollectionGroupPayload(formValues))
      : createCollectionGroup(buildCollectionGroupPayload(formValues)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection-groups'] });
      toast.success(t(isEditing ? 'collection_groups.update_success' : 'collection_groups.create_success'));
      onClose();
    },
    onError: (error: Error) => toast.error(error.message || t('common.error_occurred')),
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = collectionGroupFormSchema.safeParse(values);
    if (!result.success) {
      const nextErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => { nextErrors[issue.path.join('.')] = t(issue.message); });
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    saveMutation.mutate(result.data);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onClick={() => !saveMutation.isPending && onClose()}>
      <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{t(isEditing ? 'collection_groups.edit_title' : 'collection_groups.create_title')}</h2>
          <button type="button" onClick={onClose} disabled={saveMutation.isPending} className="text-2xl leading-none text-slate-400 hover:text-slate-600" aria-label={t('common.close', 'Close')}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="space-y-5 p-5">
            <div>
              <label htmlFor="collection-group-name" className="mb-1 block text-sm font-medium text-slate-700">{t('collection_groups.name')} *</label>
              <Input
                id="collection-group-name"
                value={values.name}
                maxLength={255}
                onChange={(event) => setValues((current) => applyCollectionGroupNameChange(current, event.target.value, isEditing, handleEdited))}
              />
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
            </div>
            <div>
              <label htmlFor="collection-group-handle" className="mb-1 block text-sm font-medium text-slate-700">{t('collection_groups.handle')} *</label>
              <Input
                id="collection-group-handle"
                value={values.handle}
                maxLength={255}
                onChange={(event) => {
                  setHandleEdited(true);
                  setValues((current) => ({ ...current, handle: event.target.value }));
                }}
              />
              {errors.handle && <p className="mt-1 text-xs text-red-600">{errors.handle}</p>}
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
            <Button type="button" variant="primary" onClick={onClose} disabled={saveMutation.isPending}>{t('common.cancel', 'Cancel')}</Button>
            <Button type="submit" variant="secondary" disabled={saveMutation.isPending}>
              {saveMutation.isPending
                ? t('collection_groups.saving')
                : isEditing
                  ? t('common.save', 'Save changes')
                  : t('collection_groups.create')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
