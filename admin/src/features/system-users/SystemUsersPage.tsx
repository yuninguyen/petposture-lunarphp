import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DeleteConfirmModal } from '@/components/ui/delete-confirm-modal';
import { humanizeRole } from '@/lib/humanizeRole';
import {
  deleteSystemUser,
  fetchSystemUsers,
  type SystemUser,
} from './api';
import { SystemUserModal } from './SystemUserModal';
import { SystemUserRowActions } from './SystemUserRowActions';

interface ApiError extends Error {
  status?: number;
  data?: { code?: string; message?: string };
}

const ROLE_BADGE_STYLES: Record<string, string> = {
  super_admin: 'bg-purple-50 text-purple-700 border-purple-200',
  admin: 'bg-slate-100 text-slate-800 border-slate-200',
  staff: 'bg-sky-50 text-sky-700 border-sky-200',
  'Product Manager': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Order Manager': 'bg-amber-50 text-amber-700 border-amber-200',
  Support: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

export function SystemUsersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<SystemUser | null>(null);
  const [searchInput, setSearchInput] = useState('');

  const usersQuery = useQuery({
    queryKey: ['system-users'],
    queryFn: fetchSystemUsers,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSystemUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-users'] });
      toast.success(
        t('system_users.delete_success', 'User deleted successfully')
      );
      setDeletingUser(null);
    },
    onError: (error: ApiError) => {
      if (
        error.status === 409 &&
        (error.data?.code === 'CANNOT_MODIFY_SELF' ||
          error.data?.code === 'LAST_SUPER_ADMIN')
      ) {
        toast.error(error.data.message || error.message);
        setDeletingUser(null);
        return;
      }
      toast.error(error.message || t('common.error_occurred'));
      setDeletingUser(null);
    },
  });

  const users = usersQuery.data ?? [];
  const filteredUsers = useMemo(() => {
    if (!searchInput.trim()) return users;
    const lowerSearch = searchInput.toLowerCase();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(lowerSearch) ||
        u.email.toLowerCase().includes(lowerSearch) ||
        u.roles.some((r) => r.toLowerCase().includes(lowerSearch))
    );
  }, [users, searchInput]);

  function openCreate() {
    setEditingUser(null);
    setModalOpen(true);
  }

  function openEdit(user: SystemUser) {
    setEditingUser(user);
    setModalOpen(true);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {t('system_users.title', 'Users')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {t(
              'system_users.subtitle',
              'Manage administrative accounts and access control'
            )}
          </p>
        </div>
        <Button
          variant="primary"
          className="flex items-center gap-2"
          onClick={openCreate}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 4v16m8-8H4"
            />
          </svg>
          {t('system_users.create', 'New User')}
        </Button>
      </div>

      {/* Filters & Actions */}
      <div className="flex items-center justify-between gap-4 rounded-t-xl border border-b-0 border-slate-200 bg-white p-4">
        <div className="relative max-w-sm flex-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <Input
            type="text"
            placeholder={t('system_users.search', 'Search users by name, email, or role...')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-b-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="whitespace-nowrap px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t('system_users.user', 'User')}
                </th>
                <th className="whitespace-nowrap px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t('system_users.roles', 'Roles')}
                </th>
                <th className="whitespace-nowrap px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t('system_users.status', 'Status')}
                </th>
                <th className="whitespace-nowrap px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t('system_users.last_login', 'Last Login')}
                </th>
                <th className="whitespace-nowrap px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t('common.actions', 'Actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {usersQuery.isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      <span>{t('common.loading', 'Loading users...')}</span>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-500">
                    {searchInput
                      ? t('system_users.no_search_results', 'No users found matching your search.')
                      : t('system_users.no_users', 'No users found.')}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="text-sm font-semibold text-slate-900">
                        {user.name}
                      </div>
                      <div className="text-xs text-slate-500">{user.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {user.roles.map((role) => {
                          const badgeStyle =
                            ROLE_BADGE_STYLES[role] ||
                            'bg-slate-100 text-slate-700 border-slate-200';
                          return (
                            <span
                              key={role}
                              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${badgeStyle}`}
                            >
                              {humanizeRole(role)}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                          user.is_active
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 bg-slate-100 text-slate-600'
                        }`}
                      >
                        {user.is_active
                          ? t('system_users.active', 'Active')
                          : t('system_users.inactive', 'Inactive')}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-xs text-slate-500">
                      {user.last_login_at
                        ? new Date(user.last_login_at).toLocaleDateString()
                        : t('system_users.never', 'Never')}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <SystemUserRowActions
                        user={user}
                        onEdit={openEdit}
                        onDelete={setDeletingUser}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      <SystemUserModal
        open={modalOpen}
        user={editingUser}
        onClose={() => setModalOpen(false)}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        open={deletingUser !== null}
        title={t('system_users.delete_confirm_title', 'Delete User')}
        message={t(
          'system_users.delete_confirm_message',
          'Are you sure you want to delete user {{name}}? This action cannot be undone.',
          { name: deletingUser?.name || '' }
        )}
        isLoading={deleteMutation.isPending}
        onConfirm={() => deletingUser && deleteMutation.mutate(deletingUser.id)}
        onClose={() => setDeletingUser(null)}
      />
    </div>
  );
}
