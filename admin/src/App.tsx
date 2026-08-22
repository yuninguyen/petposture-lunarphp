import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { AppShell } from '@/layouts/AppShell';
import { LoginPage } from '@/features/auth/LoginPage';
import { PostsListPage } from '@/features/posts/PostsListPage';
import { PostFormPage } from '@/features/posts/PostFormPage';
import { AdminUser, fetchCurrentUser, getToken, isAdminRole } from '@/lib/auth';

export default function App() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [authFailed, setAuthFailed] = useState(false);
  const [loggedIn, setLoggedIn] = useState(Boolean(getToken()));

  useEffect(() => {
    if (!loggedIn || user) return;
    fetchCurrentUser()
      .then((u) => {
        if (isAdminRole(u.roles)) {
          setUser(u);
        } else {
          setAuthFailed(true);
        }
      })
      .catch(() => setAuthFailed(true));
  }, [loggedIn, user]);

  if (!loggedIn || authFailed) {
    return (
      <LoginPage
        onLoggedIn={(loggedInUser) => {
          setUser(loggedInUser);
          setAuthFailed(false);
          setLoggedIn(true);
        }}
      />
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppShell userName={user?.name ?? ''}>
          <AppRoutes />
        </AppShell>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

function AppRoutes() {
  const location = useLocation();

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/posts" replace />} />
      <Route path="/posts" element={<PostsListPage />} />
      <Route path="/posts/new" element={<PostFormPage key={location.pathname} />} />
      <Route path="/posts/:id" element={<PostFormPage key={location.pathname} />} />
    </Routes>
  );
}
