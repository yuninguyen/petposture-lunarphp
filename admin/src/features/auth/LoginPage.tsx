import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { login, isAdminRole, AdminUser } from '@/lib/auth';
import { useBranding } from '@/context/BrandingContext';

export function LoginPage({ onLoggedIn }: { onLoggedIn: (user: AdminUser) => void }) {
  const { t, i18n } = useTranslation();
  const branding = useBranding();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { user } = await login(email, password);
      if (!isAdminRole(user.roles)) {
        setError(t('auth.error_no_permission'));
        return;
      }
      onLoggedIn(user);
    } catch {
      setError(t('auth.error_invalid_credentials'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-white">
      {/* Left Column: Brand/Logo (Hidden on Mobile) */}
      <div className="relative hidden lg:flex lg:w-1/2 flex-col items-center justify-center bg-slate-50">
        <img src={branding.logoUrl} alt="Pet Posture" className="h-24 w-auto object-contain" />
        <p className="mt-5 text-sm font-medium tracking-wide text-slate-500 uppercase">
          {t('auth.slogan')}
        </p>
        
        {/* Minimalist Footer */}
        <div className="absolute bottom-8 left-0 right-0 text-center">
          <p className="text-xs font-medium text-slate-400 tracking-wide">
            &copy; {new Date().getFullYear()} PetPosture. {t('auth.copyright')}
          </p>
        </div>
      </div>

      {/* Right Column: Form Area */}
      <div className="relative flex w-full flex-col items-center justify-start px-4 pt-20 pb-12 sm:px-6 lg:w-1/2 lg:justify-center lg:px-8 lg:py-12">
        
        {/* Language Selector */}
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
          <div className="flex items-center rounded-full bg-gray-50 p-1 shadow-sm ring-1 ring-gray-900/5">
            <button
              type="button"
              onClick={() => i18n.changeLanguage('vi')}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                i18n.language === 'vi' || i18n.language?.startsWith('vi')
                  ? 'bg-primary text-white shadow'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              VI
            </button>
            <button
              type="button"
              onClick={() => i18n.changeLanguage('en')}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                i18n.language === 'en' || i18n.language?.startsWith('en')
                  ? 'bg-primary text-white shadow'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              EN
            </button>
          </div>
        </div>

        {/* Form Container */}
        <div className="w-full max-w-sm xl:max-w-md">
          {/* Mobile Logo */}
          <div className="flex lg:hidden items-center justify-center mt-10 mb-8">
            <img src={branding.logoUrl} alt="Pet Posture" className="h-16 w-auto object-contain" />
          </div>

          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">
              {t('auth.welcome')}
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              {t('auth.subtitle')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600 ring-1 ring-red-600/10">
                {error}
              </div>
            )}

            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium leading-6 text-gray-900">
                  {t('auth.email')}
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="sm:text-sm sm:leading-6"
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-sm font-medium leading-6 text-gray-900">
                    {t('auth.password')}
                  </label>
                </div>
                <PasswordInput
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="sm:text-sm sm:leading-6"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              className="mt-2 w-full rounded-lg py-2.5 shadow-sm transition-all duration-200"
              disabled={submitting}
            >
              {submitting ? t('auth.logging_in') : t('auth.login')}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
