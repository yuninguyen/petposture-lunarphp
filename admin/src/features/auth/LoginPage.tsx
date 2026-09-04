import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { login, isAdminRole, AdminUser } from '@/lib/auth';

export function LoginPage({ onLoggedIn }: { onLoggedIn: (user: AdminUser) => void }) {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
        <img src="/logo.png" alt="Pet Posture" className="h-24 w-auto object-contain" />
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
            <img src="/logo.png" alt="Pet Posture" className="h-16 w-auto object-contain" />
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
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10 sm:text-sm sm:leading-6"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>
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
