import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import AdminLayout from './components/admin/AdminLayout.jsx';
import { Alert, Spinner } from './components/admin/ui.jsx';
import { useAdminAuth } from './lib/admin-auth.jsx';
import LoginPage from './pages/admin/LoginPage.jsx';
import DashboardPage from './pages/admin/DashboardPage.jsx';
import DepartmentsPage from './pages/admin/DepartmentsPage.jsx';
import DepartmentFormPage from './pages/admin/DepartmentFormPage.jsx';
import ApplicationsPage from './pages/admin/ApplicationsPage.jsx';
import ApplicationDetailPage from './pages/admin/ApplicationDetailPage.jsx';
import NewsPage from './pages/admin/NewsPage.jsx';
import NewsFormPage from './pages/admin/NewsFormPage.jsx';
import ContentPage from './pages/admin/ContentPage.jsx';
import DemoDataPage from './pages/admin/DemoDataPage.jsx';
import AdminNotFoundPage from './pages/admin/AdminNotFoundPage.jsx';

function BootScreen({ children }) {
  return (
    <div className="admin-boot">
      <div className="admin-boot__card">{children}</div>
    </div>
  );
}

/** Guards every dashboard route and bounces anonymous visitors to the login. */
function RequireAdmin() {
  const { admin, loading, error, refresh } = useAdminAuth();
  const location = useLocation();

  if (loading) {
    return (
      <BootScreen>
        <Spinner />
        <p className="text-muted mt-2">جارٍ التحقق من الجلسة…</p>
      </BootScreen>
    );
  }

  if (error) {
    return (
      <BootScreen>
        <Alert
          type="error"
          message={error.message || 'تعذّر الاتصال بالخادم. أعد المحاولة بعد قليل.'}
        />
        <button
          className="btn btn-primary mt-2"
          type="button"
          onClick={() => refresh().catch(() => {})}
        >
          إعادة المحاولة
        </button>
      </BootScreen>
    );
  }

  if (!admin) {
    const next = `/admin${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  return <Outlet />;
}

export default function AdminApp() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAdmin />}>
        <Route element={<AdminLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="departments" element={<DepartmentsPage />} />
          <Route path="departments/new" element={<DepartmentFormPage />} />
          <Route path="departments/:id/edit" element={<DepartmentFormPage />} />
          <Route path="applications" element={<ApplicationsPage />} />
          <Route path="applications/:id" element={<ApplicationDetailPage />} />
          <Route path="news" element={<NewsPage />} />
          <Route path="news/new" element={<NewsFormPage />} />
          <Route path="news/:id/edit" element={<NewsFormPage />} />
          <Route path="content" element={<ContentPage />} />
          <Route path="demo-data" element={<DemoDataPage />} />
          <Route path="*" element={<AdminNotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
