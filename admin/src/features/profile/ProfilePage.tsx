import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { User, Lock, Activity, ShieldCheck, Calendar, Clock, CheckCircle2 } from 'lucide-react';
import { PasswordInput } from '@/components/ui/password-input';
import { Button } from '@/components/ui/button';
import { useProfile, useUpdateProfile, useUpdatePassword } from './profileApi';

export function ProfilePage() {
  const { t } = useTranslation();
  const { data, isLoading, isError, error } = useProfile();
  const updateProfileMutation = useUpdateProfile();
  const updatePasswordMutation = useUpdatePassword();

  // Profile form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (data?.data) {
      setName(data.data.name ?? '');
      setEmail(data.data.email ?? '');
    }
  }, [data]);

  if (isLoading) {
    return (
      <div role="status" className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
        <p className="font-medium">{t('profile.error_loading', 'Failed to load profile data.')}</p>
        <p className="text-sm mt-1">{(error as Error)?.message}</p>
      </div>
    );
  }

  const user = data?.data;
  const activityList = data?.data?.recent_activity?.items ?? [];

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileErrors({});
    setProfileSuccess(null);

    try {
      await updateProfileMutation.mutateAsync({ name, email });
      const msg = t('profile.update_success', 'Profile updated successfully.');
      setProfileSuccess(msg);
      toast.success(msg);
    } catch (err: unknown) {
      const apiErr = err as { status?: number; data?: { message?: string; errors?: Record<string, string[]> } };
      if (apiErr.data?.errors) {
        const mapped: Record<string, string> = {};
        for (const [k, msgs] of Object.entries(apiErr.data.errors)) {
          if (Array.isArray(msgs) && msgs.length > 0) {
            mapped[k] = msgs[0];
          }
        }
        setProfileErrors(mapped);
      }
      const msg = apiErr.data?.message || (err as Error)?.message || t('profile.update_failed', 'Failed to update profile.');
      toast.error(msg);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordErrors({});
    setPasswordSuccess(null);

    try {
      await updatePasswordMutation.mutateAsync({
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: confirmPassword,
      });
      const msg = t('profile.password_success', 'Password updated successfully.');
      setPasswordSuccess(msg);
      toast.success(msg);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const apiErr = err as { status?: number; data?: { message?: string; errors?: Record<string, string[]> } };
      if (apiErr.data?.errors) {
        const mapped: Record<string, string> = {};
        for (const [k, msgs] of Object.entries(apiErr.data.errors)) {
          if (Array.isArray(msgs) && msgs.length > 0) {
            mapped[k] = msgs[0];
          }
        }
        setPasswordErrors(mapped);
      }
      const msg = apiErr.data?.message || (err as Error)?.message || t('profile.password_failed', 'Failed to update password.');
      toast.error(msg);
    }
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '—';
    try {
      return new Date(isoString).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-8 p-6 max-w-6xl mx-auto">
      {/* Profile Overview Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20 flex-shrink-0">
            <span className="text-2xl font-bold text-primary">
              {(user?.name || 'A').charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold text-slate-900 truncate">{user?.name}</h1>
              {user?.role_labels?.map((role) => (
                <span
                  key={role}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 capitalize border border-slate-200"
                >
                  <ShieldCheck className="w-3 h-3 text-primary" />
                  {role.replace('_', ' ')}
                </span>
              ))}
            </div>
            <p className="text-sm text-slate-500">{user?.email}</p>
          </div>
          <div className="flex flex-col sm:items-end gap-1.5 text-xs text-slate-500 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 w-full sm:w-auto">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{t('profile.member_since', 'Member since')}:</span>
              <span className="font-medium text-slate-700">{formatDate(user?.joined_at)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{t('profile.last_login', 'Last login')}:</span>
              <span className="font-medium text-slate-700">{formatDate(user?.last_login_at)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form 1: Update Profile */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-100">
            <User className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-slate-900">
              {t('profile.edit_profile', 'Update Profile')}
            </h2>
          </div>

          {profileSuccess && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{profileSuccess}</span>
            </div>
          )}

          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div>
              <label htmlFor="profile_name" className="block text-sm font-medium text-slate-700 mb-1">
                {t('profile.name', 'Name')}
              </label>
              <input
                id="profile_name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`block w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-1 ${
                  profileErrors.name
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500 bg-red-50/20'
                    : 'border-slate-300 focus:border-primary focus:ring-primary'
                }`}
              />
              {profileErrors.name && (
                <p className="mt-1 text-xs text-red-600">{profileErrors.name}</p>
              )}
            </div>

            <div>
              <label htmlFor="profile_email" className="block text-sm font-medium text-slate-700 mb-1">
                {t('profile.email', 'Email')}
              </label>
              <input
                id="profile_email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`block w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-1 ${
                  profileErrors.email
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500 bg-red-50/20'
                    : 'border-slate-300 focus:border-primary focus:ring-primary'
                }`}
              />
              {profileErrors.email && (
                <p className="mt-1 text-xs text-red-600">{profileErrors.email}</p>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <Button type="submit" variant="primary" disabled={updateProfileMutation.isPending}>
                {updateProfileMutation.isPending
                  ? t('profile.saving', 'Saving...')
                  : t('profile.save_profile', 'Save Profile')}
              </Button>
            </div>
          </form>
        </div>

        {/* Form 2: Change Password */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-100">
            <Lock className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-slate-900">
              {t('profile.change_password', 'Change Password')}
            </h2>
          </div>

          {passwordSuccess && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{passwordSuccess}</span>
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label htmlFor="current_password" className="block text-sm font-medium text-slate-700 mb-1">
                {t('profile.current_password', 'Current Password')}
              </label>
              <PasswordInput
                id="current_password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={`rounded-lg text-sm ${
                  passwordErrors.current_password
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500 bg-red-50/20'
                    : 'border-slate-300 focus:border-primary focus:ring-primary'
                }`}
              />
              {passwordErrors.current_password && (
                <p className="mt-1 text-xs text-red-600">{passwordErrors.current_password}</p>
              )}
            </div>

            <div>
              <label htmlFor="new_password" className="block text-sm font-medium text-slate-700 mb-1">
                {t('profile.new_password', 'New Password')}
              </label>
              <PasswordInput
                id="new_password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={`rounded-lg text-sm ${
                  passwordErrors.password
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500 bg-red-50/20'
                    : 'border-slate-300 focus:border-primary focus:ring-primary'
                }`}
              />
              {passwordErrors.password && (
                <p className="mt-1 text-xs text-red-600">{passwordErrors.password}</p>
              )}
            </div>

            <div>
              <label htmlFor="confirm_password" className="block text-sm font-medium text-slate-700 mb-1">
                {t('profile.confirm_password', 'Confirm New Password')}
              </label>
              <PasswordInput
                id="confirm_password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`rounded-lg text-sm ${
                  passwordErrors.password_confirmation
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500 bg-red-50/20'
                    : 'border-slate-300 focus:border-primary focus:ring-primary'
                }`}
              />
              {passwordErrors.password_confirmation && (
                <p className="mt-1 text-xs text-red-600">{passwordErrors.password_confirmation}</p>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <Button type="submit" variant="primary" disabled={updatePasswordMutation.isPending}>
                {updatePasswordMutation.isPending
                  ? t('profile.updating', 'Updating...')
                  : t('profile.update_password', 'Update Password')}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Section 3: Recent system activity */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Activity className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-slate-900">
            {t('profile.system_activity', 'Recent system activity')}
          </h2>
        </div>
        <p className="text-xs text-slate-500 mb-5">
          {t('profile.system_activity_help', 'System-wide audit trail across operations (not limited to your account)')}
        </p>

        {activityList.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">
            {t('profile.no_activity', 'No recent system activity recorded.')}
          </p>
        ) : (
          <div className="divide-y divide-slate-100 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <th className="pb-3 pr-4">{t('profile.activity_description', 'Action')}</th>
                  <th className="pb-3 px-4">{t('profile.activity_subject', 'Target')}</th>
                  <th className="pb-3 pl-4 text-right">{t('profile.activity_time', 'Time')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activityList.map((item) => (
                  <tr key={item.id} className="text-slate-600 hover:bg-slate-50/50">
                    <td className="py-3 pr-4 font-medium text-slate-900">{item.description}</td>
                    <td className="py-3 px-4">
                      {item.subject_type ? (
                        <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600 font-mono">
                          {item.subject_type}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 pl-4 text-right text-xs text-slate-400 font-mono">
                      {formatDate(item.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
