import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { AppShell } from '@/layouts/AppShell';
import { LoginPage } from '@/features/auth/LoginPage';
import { PostsListPage } from '@/features/posts/PostsListPage';
import { PostFormPage } from '@/features/posts/PostFormPage';
import { ToastContainer } from '@/components/ui/toast';
import { AdminUser, fetchCurrentUser, getToken, isAdminRole } from '@/lib/auth';

export default function App() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      setChecked(true);
      return;
    }
    fetchCurrentUser()
      .then((u) => setUser(isAdminRole(u.roles) ? u : null))
      .catch(() => setUser(null))
      .finally(() => setChecked(true));
  }, []);

  if (!checked) return null;

  if (!user) {
    return <LoginPage onLoggedIn={() => window.location.reload()} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppShell userName={user.name}>
          <Routes>
            <Route path="/" element={<Navigate to="/posts" replace />} />
            <Route path="/posts" element={<PostsListPage />} />
            <Route path="/posts/new" element={<PostFormPage />} />
            <Route path="/posts/:id" element={<PostFormPage />} />
          </Routes>
        </AppShell>
        <ToastContainer />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
