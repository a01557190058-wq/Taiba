import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../../lib/icons.jsx';
import { useAdminAuth } from '../../lib/admin-auth.jsx';

const NAV_ITEMS = [
  { key: 'dashboard', to: '/dashboard', label: 'نظرة عامة', icon: 'dashboard' },
  { key: 'departments', to: '/departments', label: 'الأقسام', icon: 'layers' },
  { key: 'applications', to: '/applications', label: 'طلبات التقديم', icon: 'inbox' },
  { key: 'news', to: '/news', label: 'الأخبار', icon: 'news' },
  { key: 'content', to: '/content', label: 'المحتوى والأسئلة', icon: 'file' },
  { key: 'demo', to: '/demo-data', label: 'البيانات التجريبية', icon: 'database' },
];

/** Topbar copy for each dashboard route (the list pages share a title). */
function chromeFor(pathname) {
  if (pathname.startsWith('/departments/new')) {
    return { title: 'قسم جديد', subtitle: 'إضافة قسم تعليمي جديد إلى الموقع' };
  }
  if (/^\/departments\/\d+\/edit/.test(pathname)) {
    return { title: 'تحرير قسم', subtitle: 'تحديث بيانات القسم وحالة نشره' };
  }
  if (pathname.startsWith('/departments')) {
    return { title: 'الأقسام', subtitle: 'إنشاء وتحرير ونشر الأقسام التعليمية' };
  }
  if (/^\/applications\/\d+/.test(pathname)) {
    return { title: 'تفاصيل الطلب', subtitle: 'مراجعة بيانات المتقدم وتحديث حالة الطلب' };
  }
  if (pathname.startsWith('/applications')) {
    return { title: 'طلبات التقديم', subtitle: 'مراجعة الطلبات الواردة وتحديث حالتها' };
  }
  if (pathname.startsWith('/news/new')) {
    return { title: 'خبر جديد', subtitle: 'إضافة خبر جديد إلى صفحة الأخبار' };
  }
  if (/^\/news\/\d+\/edit/.test(pathname)) {
    return { title: 'تحرير خبر', subtitle: 'تحديث نص الخبر وحالة نشره' };
  }
  if (pathname.startsWith('/news')) {
    return { title: 'الأخبار', subtitle: 'إنشاء الأخبار وتحريرها ونشرها على الموقع' };
  }
  if (pathname.startsWith('/content')) {
    return { title: 'المحتوى والأسئلة', subtitle: 'تحرير نصوص الموقع والأسئلة الشائعة' };
  }
  if (pathname.startsWith('/demo-data')) {
    return {
      title: 'البيانات التجريبية',
      subtitle: 'إدارة سجلات العرض التجريبية دون المساس بالبيانات الحقيقية',
    };
  }
  return { title: 'نظرة عامة', subtitle: 'ملخص مباشر من قاعدة بيانات المدرسة' };
}

export default function AdminLayout() {
  const { admin, logout } = useAdminAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const { title, subtitle } = chromeFor(location.pathname);
  const name = admin?.display_name || admin?.username || 'مدير';

  const onLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="admin-layout">
      <aside
        className={`admin-sidebar${drawerOpen ? ' is-open' : ''}`}
        id="admin-sidebar"
        aria-label="قائمة لوحة التحكم"
      >
        <Link className="admin-brand" to="/dashboard">
          <img src="/assets/img/logo.svg" alt="" width="42" height="42" />
          <span>
            <strong>مدرسة طيبة تكنولوجي</strong>
            <span>لوحة التحكم</span>
          </span>
        </Link>

        <nav className="admin-nav" aria-label="التنقل الإداري">
          <span className="admin-nav__label">الإدارة</span>
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.key} className="admin-nav__link" to={item.to}>
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="admin-sidebar__foot">
          <a className="btn btn-ghost" href="/" target="_blank" rel="noopener">
            <Icon name="external" size={18} />
            <span>زيارة الموقع</span>
          </a>
          <button className="btn btn-ghost" type="button" onClick={onLogout}>
            <Icon name="logout" size={18} />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      <button
        className={`sidebar-backdrop${drawerOpen ? ' is-open' : ''}`}
        type="button"
        aria-label="إغلاق القائمة"
        tabIndex={drawerOpen ? 0 : -1}
        onClick={() => setDrawerOpen(false)}
      />

      <div className="admin-main">
        <header className="admin-topbar">
          <button
            className="sidebar-toggle"
            type="button"
            aria-label="فتح القائمة"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen((value) => !value)}
          >
            <Icon name="menu" size={20} />
          </button>

          <div className="admin-topbar__title">
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>

          <div className="admin-topbar__actions">
            <a className="btn btn-outline btn-sm" href="/" target="_blank" rel="noopener">
              <Icon name="external" size={16} />
              <span>الموقع</span>
            </a>
            <div className="admin-user">
              <span className="admin-user__avatar">{name.slice(0, 1)}</span>
              <span className="admin-user__name">{name}</span>
            </div>
          </div>
        </header>

        <main className="admin-content" key={location.pathname}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
