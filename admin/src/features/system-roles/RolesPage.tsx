import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { humanizeRole } from '@/lib/humanizeRole';
import {
  fetchRoles,
  updateRolePermissions,
  type RoleItem,
} from './api';

interface ApiError extends Error {
  status?: number;
  data?: {
    message?: string;
    errors?: Record<string, string[]>;
  };
}

const ROLE_BADGE_STYLES: Record<string, string> = {
  super_admin: 'bg-purple-50 text-purple-700 border-purple-200',
  admin: 'bg-slate-100 text-slate-800 border-slate-200',
  staff: 'bg-sky-50 text-sky-700 border-sky-200',
  'Product Manager': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Order Manager': 'bg-amber-50 text-amber-700 border-amber-200',
  Support: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

function formatGroupName(groupKey: string): string {
  const map: Record<string, string> = {
    PRODUCT: 'Product',
    ORDER: 'Order',
    REVIEW: 'Review',
    POST: 'Post',
  };
  return map[groupKey] || groupKey.charAt(0).toUpperCase() + groupKey.slice(1).toLowerCase();
}

function formatPermissionLabel(permKey: string): string {
  return permKey
    .replace(/_/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function RolesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [editingRole, setEditingRole] = useState<RoleItem | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: response, isLoading, isError } = useQuery({
    queryKey: ['system-roles'],
    queryFn: fetchRoles,
  });

  const roles = response?.data ?? [];
  const permissionGroups = useMemo(() => {
    return response?.permission_groups ?? {
      PRODUCT: [],
      ORDER: [],
      REVIEW: [],
      POST: [],
    };
  }, [response?.permission_groups]);

  const allMatrixPermissions = useMemo(() => {
    return Object.values(permissionGroups).flat();
  }, [permissionGroups]);

  const updateMutation = useMutation({
    mutationFn: ({ roleId, permissions }: { roleId: number; permissions: string[] }) =>
      updateRolePermissions(roleId, permissions),
    onSuccess: (updatedRole) => {
      queryClient.invalidateQueries({ queryKey: ['system-roles'] });
      toast.success(
        t('system_roles.update_success', 'Permissions updated successfully')
      );
      setEditingRole(null);
      setErrorMessage(null);
    },
    onError: (error: ApiError) => {
      let msg = error.message || t('system_roles.update_error', 'Failed to update permissions');
      if (error.status === 422 && error.data?.errors) {
        const errorList = Object.values(error.data.errors).flat();
        if (errorList.length > 0) {
          msg = errorList.join(', ');
        }
      }
      setErrorMessage(msg);
      toast.error(msg);
    },
  });

  function handleOpenEdit(role: RoleItem) {
    setEditingRole(role);
    setSelectedPermissions([...role.permissions]);
    setErrorMessage(null);
  }

  function handleCloseModal() {
    setEditingRole(null);
    setErrorMessage(null);
  }

  function handleTogglePermission(perm: string) {
    setSelectedPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  }

  function handleSelectAllInGroup(groupPermissions: string[]) {
    setSelectedPermissions((prev) => {
      const set = new Set([...prev, ...groupPermissions]);
      return Array.from(set);
    });
  }

  function handleDeselectAllInGroup(groupPermissions: string[]) {
    setSelectedPermissions((prev) =>
      prev.filter((p) => !groupPermissions.includes(p))
    );
  }

  function handleSave() {
    if (!editingRole) return;
    setErrorMessage(null);
    updateMutation.mutate({
      roleId: editingRole.id,
      permissions: selectedPermissions,
    });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {t('system_roles.title', 'Roles & Permissions')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {t(
              'system_roles.subtitle',
              'View administrator roles and configure access permissions'
            )}
          </p>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm">{t('common.loading', 'Loading roles...')}</span>
          </div>
        </div>
      ) : isError ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xs">
          <p className="text-sm text-red-600">
            {t('common.error_occurred', 'Failed to load roles.')}
          </p>
          <Button
            variant="secondary"
            className="mt-3"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['system-roles'] })}
          >
            {t('common.retry', 'Retry')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => {
            const isCoreRole = !role.editable;
            const badgeStyle =
              ROLE_BADGE_STYLES[role.name] || 'bg-slate-100 text-slate-800 border-slate-200';

            return (
              <div
                key={role.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-shadow hover:shadow-sm"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">
                        {humanizeRole(role.name)}
                      </h2>
                      <span
                        className={`mt-1.5 inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${badgeStyle}`}
                      >
                        {role.name}
                      </span>
                    </div>

                    {isCoreRole ? (
                      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                        {t('system_roles.full_access', 'Full access')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                        {t('system_roles.permissions_count', {
                          count: role.permissions.length,
                          total: allMatrixPermissions.length,
                          defaultValue: `${role.permissions.length} / ${allMatrixPermissions.length} permissions`,
                        })}
                      </span>
                    )}
                  </div>

                  {/* Description / Summary */}
                  <div className="mt-4 text-xs leading-relaxed text-slate-500">
                    {isCoreRole ? (
                      <p>
                        {t(
                          'system_roles.core_role_description',
                          'This administrative role always has full access across all platform capabilities and cannot be modified.'
                        )}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <p className="font-medium text-slate-600">
                          {t('system_roles.granted_domains', 'Domain permissions:')}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(permissionGroups).map(([groupKey, groupPerms]) => {
                            const grantedInGroup = groupPerms.filter((p) =>
                              role.permissions.includes(p)
                            ).length;
                            const hasAccess = grantedInGroup > 0;
                            return (
                              <span
                                key={groupKey}
                                className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${
                                  hasAccess
                                    ? 'bg-secondary/10 text-secondary-dark'
                                    : 'bg-slate-100 text-slate-400'
                                }`}
                              >
                                {t(`system_roles.groups.${groupKey}`, formatGroupName(groupKey))}:{' '}
                                {grantedInGroup}/{groupPerms.length}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Action */}
                {!isCoreRole && (
                  <div className="mt-6 border-t border-slate-100 pt-4">
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full text-xs font-semibold"
                      onClick={() => handleOpenEdit(role)}
                    >
                      {t('system_roles.edit_permissions', 'Edit permissions')}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Permissions Modal */}
      {editingRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white shadow-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {t('system_roles.modal_title', {
                    name: humanizeRole(editingRole.name),
                    defaultValue: `Edit Permissions: ${humanizeRole(editingRole.name)}`,
                  })}
                </h3>
                <p className="text-xs text-slate-500">
                  {t(
                    'system_roles.modal_subtitle',
                    'Configure capabilities for this role across system domains'
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label={t('common.close', 'Close')}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Modal Body: Scrollable Permission Groups */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
              {errorMessage && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  {errorMessage}
                </div>
              )}

              {Object.entries(permissionGroups).map(([groupKey, perms]) => {
                const groupTitle = t(
                  `system_roles.groups.${groupKey}`,
                  formatGroupName(groupKey)
                );
                const selectedCount = perms.filter((p) =>
                  selectedPermissions.includes(p)
                ).length;
                const allSelected = selectedCount === perms.length;

                return (
                  <div
                    key={groupKey}
                    className="rounded-xl border border-slate-200 bg-slate-50/50 p-4"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-800">
                          {groupTitle}
                        </span>
                        <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                          {selectedCount}/{perms.length}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => handleSelectAllInGroup(perms)}
                          className="font-medium text-secondary hover:underline"
                        >
                          {t('system_roles.select_all', 'Select all')}
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => handleDeselectAllInGroup(perms)}
                          className="font-medium text-slate-500 hover:text-slate-700"
                        >
                          {t('system_roles.deselect_all', 'Deselect all')}
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      {perms.map((perm) => {
                        const checked = selectedPermissions.includes(perm);
                        return (
                          <label
                            key={perm}
                            className={`flex cursor-pointer select-none items-start gap-2.5 rounded-lg border p-2.5 transition-colors ${
                              checked
                                ? 'border-secondary/40 bg-secondary/5 text-slate-900'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleTogglePermission(perm)}
                              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-secondary focus:ring-secondary accent-secondary"
                            />
                            <div className="flex flex-col">
                              <span className="text-xs font-semibold leading-tight">
                                {formatPermissionLabel(perm)}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {perm}
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
              <span className="text-xs text-slate-500">
                {t('system_roles.total_selected', {
                  count: selectedPermissions.length,
                  total: allMatrixPermissions.length,
                  defaultValue: `${selectedPermissions.length} of ${allMatrixPermissions.length} selected`,
                })}
              </span>

              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleCloseModal}
                  disabled={updateMutation.isPending}
                >
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending
                    ? t('common.saving', 'Saving...')
                    : t('system_roles.save', 'Save Changes')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
