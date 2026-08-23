import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { DeleteConfirmModal } from '@/components/ui/delete-confirm-modal';
import { Input } from '@/components/ui/input';
import { CollectionGroup, deleteCollectionGroup, fetchCollectionGroups } from './api';
import { CollectionGroupModal } from './CollectionGroupModal';
import { CollectionGroupRowActions } from './CollectionGroupRowActions';

interface ApiError extends Error {
  status?: number;
  data?: { code?: string; message?: string };
}

export function CollectionGroupsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCollectionGroup, setEditingCollectionGroup] = useState<CollectionGroup | null>(null);
  const [deletingCollectionGroup, setDeletingCollectionGroup] = useState<CollectionGroup | null>(null);
  const [searchInput, setSearchInput] = useState('');

  const collectionGroupsQuery = useQuery({ queryKey: ['collection-groups'], queryFn: fetchCollectionGroups });
  const deleteMutation = useMutation({
    mutationFn: deleteCollectionGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection-groups'] });
      toast.success(t('collection_groups.delete_success'));
      setDeletingCollectionGroup(null);
    },
    onError: (error: ApiError) => {
      if (error.status === 409 && error.data?.code === 'COLLECTION_GROUP_IN_USE') {
        toast.error(error.data.message || error.message);
        return;
      }
      toast.error(error.message || t('common.error_occurred'));
    },
  });

  const collectionGroups = collectionGroupsQuery.data ?? [];
  const filteredCollectionGroups = useMemo(() => {
    const search = searchInput.trim().toLowerCase();
    if (!search) return collectionGroups;
    return collectionGroups.filter((collectionGroup) =>
      collectionGroup.name.toLowerCase().includes(search)
      || collectionGroup.handle.toLowerCase().includes(search));
  }, [collectionGroups, searchInput]);

  function openCreate() {
    setEditingCollectionGroup(null);
    setModalOpen(true);
  }

  function openEdit(collectionGroup: CollectionGroup) {
    setEditingCollectionGroup(collectionGroup);
    setModalOpen(true);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('collection_groups.title')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('collection_groups.subtitle')}</p>
        </div>
        <Button variant="primary" className="flex items-center gap-2" onClick={openCreate}>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          {t('collection_groups.create')}
        </Button>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-t-xl border border-b-0 border-slate-200 bg-white p-4">
        <div className="relative max-w-sm flex-1">
          <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <Input
            type="text"
            placeholder={t('collection_groups.search')}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-b-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="whitespace-nowrap px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{t('collection_groups.name')}</th>
                <th className="whitespace-nowrap px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{t('collection_groups.handle')}</th>
                <th className="whitespace-nowrap px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{t('collection_groups.collections')}</th>
                <th className="whitespace-nowrap px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">{t('common.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {collectionGroupsQuery.isLoading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    <div className="mb-2 flex justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
                    {t('common.loading', 'Loading...')}
                  </td>
                </tr>
              ) : collectionGroupsQuery.isError ? (
                <tr><td colSpan={4} className="px-4 py-12 text-center text-red-600">{collectionGroupsQuery.error instanceof Error ? collectionGroupsQuery.error.message : t('common.error_occurred')}</td></tr>
              ) : filteredCollectionGroups.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-12 text-center text-slate-500"><p className="text-base font-medium text-slate-900">{t('collection_groups.empty')}</p></td></tr>
              ) : filteredCollectionGroups.map((collectionGroup) => (
                <tr key={collectionGroup.id} className="group transition-colors hover:bg-slate-50">
                  <td className="px-6 py-3 text-sm font-semibold text-slate-900">{collectionGroup.name}</td>
                  <td className="px-6 py-3 font-mono text-sm text-slate-700">{collectionGroup.handle}</td>
                  <td className="px-6 py-3 text-sm font-medium text-slate-700">{collectionGroup.collections_count}</td>
                  <td className="px-6 py-3 text-sm">
                    <CollectionGroupRowActions collectionGroup={collectionGroup} onEdit={openEdit} onDelete={setDeletingCollectionGroup} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <CollectionGroupModal open={modalOpen} collectionGroup={editingCollectionGroup} onClose={() => setModalOpen(false)} />
      <DeleteConfirmModal
        open={deletingCollectionGroup !== null}
        title={t('collection_groups.delete_title')}
        message={t('collection_groups.delete_message', { name: deletingCollectionGroup?.name ?? '' })}
        isLoading={deleteMutation.isPending}
        onClose={() => setDeletingCollectionGroup(null)}
        onConfirm={() => deletingCollectionGroup && deleteMutation.mutate(deletingCollectionGroup.id)}
      />
    </div>
  );
}
