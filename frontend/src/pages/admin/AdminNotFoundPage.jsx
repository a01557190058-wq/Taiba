import { Link } from 'react-router-dom';
import { Icon } from '../../lib/icons.jsx';

export default function AdminNotFoundPage() {
  return (
    <div className="panel">
      <div className="panel__body">
        <div className="empty-state">
          <div className="empty-state__icon">
            <Icon name="search" size={26} />
          </div>
          <h3>الصفحة غير موجودة</h3>
          <p>الرابط الذي طلبته غير متاح داخل لوحة التحكم. ربما تغيّر المسار أو حُذف العنصر.</p>
          <Link className="btn btn-primary btn-sm" to="/dashboard">
            العودة إلى النظرة العامة
          </Link>
        </div>
      </div>
    </div>
  );
}
