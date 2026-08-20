import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { login, setToken, isAdminRole } from '@/lib/auth';

export function LoginPage({ onLoggedIn }: { onLoggedIn: () => void }) {
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
        setError('Tài khoản này không có quyền truy cập admin.');
        return;
      }
      setToken(token);
      onLoggedIn();
    } catch {
      setError('Email hoặc mật khẩu không đúng.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold text-ink mb-6">PetPosture Admin</h1>
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
        <label className="block text-xs font-semibold text-primary-light mb-1">Email</label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mb-4" required />
        <label className="block text-xs font-semibold text-primary-light mb-1">Mật khẩu</label>
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mb-6" required />
        <Button type="submit" variant="secondary" className="w-full" disabled={submitting}>
          {submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </Button>
      </form>
    </div>
  );
}
