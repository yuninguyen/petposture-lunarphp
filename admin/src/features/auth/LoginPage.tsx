import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { login, setToken, isAdminRole } from '@/lib/auth';

export function LoginPage({ onLoggedIn }: { onLoggedIn: () => void }) {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { user, token } = await login(email, password);
      if (!isAdminRole(user.roles)) {
        setError(t('auth.error_no_permission'));
        return;
      }
      setToken(token);
      onLoggedIn();
    } catch {
      setError(t('auth.error_invalid_credentials'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <div className="flex justify-end px-6 py-4">
        <select
          value={i18n.language}
          onChange={(e) => i18n.changeLanguage(e.target.value)}
          className="text-sm bg-white text-gray-700 border border-gray-300 rounded px-3 py-1.5 cursor-pointer hover:border-gray-400"
        >
          <option value="vi">Tiếng Việt</option>
          <option value="en">English</option>
        </select>
      </div>
      <div className="flex items-center justify-center flex-1">
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-8 w-full max-w-sm">
          <h1 className="text-xl font-bold text-ink mb-6">{t('app.title')}</h1>
          {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
          <label className="block text-xs font-semibold text-primary-light mb-1">{t('auth.email')}</label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mb-4" required />
          <label className="block text-xs font-semibold text-primary-light mb-1">{t('auth.password')}</label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mb-6" required />
          <Button type="submit" variant="secondary" className="w-full" disabled={submitting}>
            {submitting ? t('auth.logging_in') : t('auth.login')}
          </Button>
        </form>
      </div>
    </div>
  );
}
