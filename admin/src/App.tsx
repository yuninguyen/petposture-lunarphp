import { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { AppShell } from '@/layouts/AppShell';
import { LoginPage } from '@/features/auth/LoginPage';
import { AdminUser, fetchCurrentUser, getToken, isAdminRole } from '@/lib/auth';
import { Toaster } from 'react-hot-toast';

// Lazy-load all page components → Vite creates separate chunks per route
const PostsListPage   = lazy(() => import('@/features/posts/PostsListPage').then(m => ({ default: m.PostsListPage })));
const PostFormPage    = lazy(() => import('@/features/posts/PostFormPage').then(m => ({ default: m.PostFormPage })));
const BlogCategoriesList = lazy(() => import('@/features/blog-categories/BlogCategoriesList').then(m => ({ default: m.BlogCategoriesList })));
const CommentsList    = lazy(() => import('@/features/comments/CommentsList').then(m => ({ default: m.CommentsList })));
const TagsList        = lazy(() => import('@/features/tags/TagsList').then(m => ({ default: m.TagsList })));
const SeoSocialPage   = lazy(() => import('@/features/settings/seo-social/SeoSocialPage').then(m => ({ default: m.SeoSocialPage })));
const PagesListPage   = lazy(() => import('@/features/pages/PagesListPage').then(m => ({ default: m.PagesListPage })));
const PageFormPage    = lazy(() => import('@/features/pages/PageFormPage').then(m => ({ default: m.PageFormPage })));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
}


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
      <Toaster 
        position="top-right" 
        toastOptions={{
          className: 'text-sm font-medium shadow-lg rounded-xl border border-slate-100',
          style: {
            background: '#ffffff',
            color: '#0f172a',
            padding: '12px 16px',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#ffffff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#ffffff',
            },
          },
        }}
      />
      <BrowserRouter>
        <AppShell userName={user?.name ?? ''}>
          <Suspense fallback={<PageLoader />}>
            <AppRoutes />
          </Suspense>
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
      <Route path="/blog-categories" element={<BlogCategoriesList />} />
      <Route path="/comments" element={<CommentsList />} />
      <Route path="/tags" element={<TagsList />} />
      <Route path="/seo-social" element={<SeoSocialPage />} />
      <Route path="/legal-policies" element={<PagesListPage />} />
      <Route path="/legal-policies/create" element={<PageFormPage key={location.pathname} />} />
      <Route path="/legal-policies/:id" element={<PageFormPage key={location.pathname} />} />
    </Routes>
  );
}
