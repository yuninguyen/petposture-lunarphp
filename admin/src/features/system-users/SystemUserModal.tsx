import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  createSystemUser,
  updateSystemUser,
  type SystemUser,
} from './api';
import {
  SYSTEM_USER_ROLES,
  buildSystemUserPayload,
  createSystemUserSchema,
  editSystemUserSchema,
  type SystemUserFormValues,
} from './systemUserSchema';

interface ApiError extends Error {
  status?: number;
  data?: { code?: string; message?: string };
}

interface SystemUserModalProps {
  open: boolean;
  user: SystemUser | null;
  onClose: () => void;
}

const emptyValues: SystemUserFormValues = {
  name: '',
  email: '',
  password: '',
  roles: ['staff'],
  is_active: true,
};

export function SystemUserModal({ open, user, onClose }: SystemUserModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isEditing = user !== null;
  const [values, setValues] = useState<SystemUserFormValues>(emptyValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    if (user) {
      setValues({
        name: user.name,
        email: user.email,
        password: '',
        roles: [...user.roles],
        is_active: user.is_active,
      });
    } else {
      setValues(emptyValues);
    }
    setErrors({});
  }, [user, open]);

  const saveMutation = useMutation({
    mutationFn: (formValues: SystemUserFormValues) => {
      const payload = buildSystemUserPayload(formValues, isEditing);
      return user ? updateSystemUser(user.id, payload) : createSystemUser(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-users'] });
      toast.success(
        t(isEditing ? 'system_users.update_success' : 'system_users.create_success', {
          defaultValue: isEditing
            ? 'User updated successfully'
            : 'User created successfully',
        })
      );
      onClose();
    },
    onError: (error: ApiError) => {
      if (
        error.status === 409 &&
        (error.data?.code === 'CANNOT_MODIFY_SELF' ||
          error.data?.code === 'LAST_SUPER_ADMIN')
      ) {
        toast.error(error.data.message || error.message);
        return;
      }
      toast.error(error.message || t('common.error_occurred'));
    },
  });

  function handleRoleToggle(role: string) {
    setValues((prev) => {
      const exists = prev.roles.includes(role);
      const newRoles = exists
        ? prev.roles.filter((r) => r !== role)
        : [...prev.roles, role];
      return { ...prev, roles: newRoles };
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const schema = isEditing ? editSystemUserSchema : createSystemUserSchema;
    const result = schema.safeParse(values);

    if (!result.success) {
      const nextErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        nextErrors[issue.path.join('.')] = t(issue.message);
      });
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    saveMutation.mutate(result.data as SystemUserFormValues);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      onClick={() => !saveMutation.isPending && onClose()}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {t(isEditing ? 'system_users.edit_title' : 'system_users.create_title', {
              defaultValue: isEditing ? 'Edit System User' : 'New System User',
            })}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saveMutation.isPending}
            className="text-2xl leading-none text-slate-400 hover:text-slate-600"
            aria-label={t('common.close', 'Close')}
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="max-h-[75vh] space-y-5 overflow-y-auto p-5">
            {/* Name */}
            <div>
              <label
                htmlFor="user-name"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                {t('system_users.name', 'Name')} *
              </label>
              <Input
                id="user-name"
                value={values.name}
                onChange={(e) => setValues({ ...values, name: e.target.value })}
                placeholder="Full name"
              />
              {errors.name && (
                <p className="mt-1 text-xs text-red-600">{errors.name}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="user-email"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                {t('system_users.email', 'Email')} *
              </label>
              <Input
                id="user-email"
                type="email"
                value={values.email}
                onChange={(e) => setValues({ ...values, email: e.target.value })}
                placeholder="user@example.com"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-600">{errors.email}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="user-password"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                {t('system_users.password', 'Password')}{' '}
                {isEditing ? (
                  <span className="text-xs text-slate-400">
                    ({t('system_users.password_optional_hint', 'Leave blank to keep current')})
                  </span>
                ) : (
                  '*'
                )}
              </label>
              <Input
                id="user-password"
                type="password"
                value={values.password || ''}
                onChange={(e) =>
                  setValues({ ...values, password: e.target.value })
                }
                placeholder={
                  isEditing
                    ? t('system_users.leave_blank', 'Leave blank to keep current')
                    : 'Min 8 characters'
                }
              />
              {errors.password && (
                <p className="mt-1 text-xs text-red-600">{errors.password}</p>
              )}
            </div>

            {/* Roles Checkboxes */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                {t('system_users.roles', 'Roles')} *
              </label>
              <div className="grid grid-cols-2 gap-2.5 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                {SYSTEM_USER_ROLES.map((role) => {
                  const checked = values.roles.includes(role);
                  return (
                    <label
                      key={role}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-md border p-2 text-xs transition-colors ${
                        checked
                          ? 'border-secondary bg-white font-medium text-slate-900 shadow-sm'
                          : 'border-slate-200 bg-white/60 text-slate-600 hover:bg-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleRoleToggle(role)}
                        className="h-4 w-4 rounded border-slate-300 text-secondary focus:ring-secondary"
                      />
                      <span>{role}</span>
                    </label>
                  );
                })}
              </div>
              {errors.roles && (
                <p className="mt-1 text-xs text-red-600">{errors.roles}</p>
              )}
            </div>

            {/* Status (is_active) */}
            <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
              <div>
                <span className="block text-sm font-medium text-slate-800">
                  {t('system_users.status', 'Status')}
                </span>
                <span className="text-xs text-slate-500">
                  {t(
                    'system_users.status_help',
                    'Inactive users cannot sign in to the admin panel.'
                  )}
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={values.is_active}
                onClick={() =>
                  setValues((prev) => ({ ...prev, is_active: !prev.is_active }))
                }
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-secondary ${
                  values.is_active ? 'bg-secondary' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    values.is_active ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={saveMutation.isPending}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending
                ? t('common.saving', 'Saving...')
                : t(isEditing ? 'common.save' : 'common.create', {
                    defaultValue: isEditing ? 'Save Changes' : 'Create User',
                  })}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
