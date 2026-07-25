import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';

// Lazy-loaded pages for code splitting
import { lazy, Suspense } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { PageSpinner } from '@/components/ui/PageSpinner';

const LoginPage = lazy(() => import('@/pages/Auth/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/Auth/RegisterPage'));
const AuthCallbackPage = lazy(() => import('@/pages/Auth/AuthCallbackPage'));
const DashboardPage = lazy(() => import('@/pages/Dashboard/DashboardPage'));
const PipelinesPage = lazy(() => import('@/pages/Pipelines/PipelinesPage'));
const AnalyticsPage = lazy(() => import('@/pages/Analytics/AnalyticsPage'));
const RepositoriesPage = lazy(() => import('@/pages/Repositories/RepositoriesPage'));
const AdminPage = lazy(() => import('@/pages/Admin/AdminPage'));
const PipelineDetailsPage = lazy(() => import('@/pages/Pipelines/PipelineDetailsPage'));
const LeaderboardPage = lazy(() => import('@/pages/Leaderboard/LeaderboardPage'));
const SettingsPage = lazy(() => import('@/pages/Settings/SettingsPage'));

// Route guard component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return !isAuthenticated ? <>{children}</> : <Navigate to="/dashboard" replace />;
};

export const AppRouter = () => (
  <BrowserRouter>
    <Suspense fallback={<PageSpinner />}>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
        <Route path="/auth/callback" element={<PublicRoute><AuthCallbackPage /></PublicRoute>} />

        {/* Protected routes — wrapped in AppShell (sidebar + topbar) */}
        <Route path="/" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="pipelines" element={<PipelinesPage />} />
          <Route path="pipelines/:id" element={<PipelineDetailsPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="repositories" element={<RepositoriesPage />} />
          <Route path="leaderboard" element={<LeaderboardPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="admin" element={<AdminPage />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  </BrowserRouter>
);
