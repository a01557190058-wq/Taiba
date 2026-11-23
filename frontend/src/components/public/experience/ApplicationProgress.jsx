import { useMemo } from 'react';
import { Icon } from '../../../lib/icons.jsx';
import { formatNumber } from '../../../lib/format.js';

const REQUIRED_FIELDS = [
  'full_name',
  'date_of_birth',
  'gender',
  'national_id',
  'governorate',
  'educational_administration',
  'department_id',
  'preparatory_score',
  'guardian_name',
  'guardian_relation',
  'guardian_phone',
  'address_governorate',
  'address_center',
  'address_city',
];

const DOCUMENT_KINDS = ['success_form', 'birth_certificate', 'personal_photo'];

/** Visual completion indicator; it never validates or submits anything. */
export default function ApplicationProgress({ values, files }) {
  const progress = useMemo(() => {
    const total = REQUIRED_FIELDS.length + DOCUMENT_KINDS.length + 1;
    let done = REQUIRED_FIELDS.filter((key) => String(values[key] || '').trim()).length;
    done += DOCUMENT_KINDS.filter((kind) => files?.[kind]).length;
    if (values.consent) done += 1;
    return Math.round((done / total) * 100);
  }, [values, files]);

  const step = progress < 34 ? 1 : progress < 67 ? 2 : progress < 100 ? 3 : 4;

  return (
    <div className="application-progress" data-step={String(step)}>
      <div className="application-progress__head">
        <span>
          <Icon name="chart" size={15} aria-hidden="true" />
          تقدّم طلبك
        </span>
        <strong>{`${formatNumber(progress)}٪`}</strong>
      </div>
      <div
        className="application-progress__track"
        role="progressbar"
        aria-label="نسبة اكتمال طلب التقديم"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
      >
        <span className="application-progress__fill" />
      </div>
      <div className="application-progress__steps" aria-hidden="true">
        <span>البيانات</span>
        <span>ولي الأمر</span>
        <span>المستندات</span>
        <span>الإقرار</span>
      </div>
    </div>
  );
}
