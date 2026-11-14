'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  db,
  resetDatabase,
  anonymousAgent,
  adminAgent,
  submitApplication,
  APPLICATION_UPLOADS_DIR,
  DOCUMENT_FIXTURES,
  DEFAULT_DOCUMENTS,
} = require('./helpers');

beforeEach(() => resetDatabase());

function storedDocumentFiles() {
  if (!fs.existsSync(APPLICATION_UPLOADS_DIR)) return [];
  return fs.readdirSync(APPLICATION_UPLOADS_DIR);
}

test('a student can submit an application and receives a reference number', async () => {
  const { agent, token } = await anonymousAgent();
  const res = await submitApplication(agent, token, {
    full_name: 'ليلى محمود',
    phone: '01012345678',
    email: 'laila@example.com',
  });

  assert.equal(res.status, 201);
  const data = res.body.data;
  assert.match(data.reference_number, /^TBS-\d{4}-[A-Z2-9]{6}$/);
  assert.equal(data.status, 'NEW');
  assert.equal(data.status_label, 'جديد');
  assert.ok(data.department_name);
  assert.ok(data.message.includes('لا يعني القبول'));

  // Public response must never expose internal fields.
  assert.equal(data.admin_notes, undefined);
  assert.equal(data.id, undefined);
  assert.equal(data.is_demo, undefined);

  const row = db.get('SELECT * FROM applications WHERE reference_number = ?', [data.reference_number]);
  assert.ok(row, 'application must be persisted');
  assert.equal(row.is_demo, 0);
  assert.equal(row.status, 'NEW');
});

test('submitted applications appear in the admin dashboard listing', async () => {
  const { agent, token } = await anonymousAgent();
  const created = await submitApplication(agent, token, {
    full_name: 'ياسمين فؤاد',
    phone: '01098765432',
  });
  assert.equal(created.status, 201);
  const reference = created.body.data.reference_number;

  const { agent: admin } = await adminAgent();
  const list = await admin.get('/api/admin/applications?q=' + encodeURIComponent(reference));
  assert.equal(list.status, 200);
  assert.equal(list.body.meta.total, 1);
  assert.equal(list.body.data[0].reference_number, reference);
  assert.equal(list.body.data[0].admin_notes, undefined, 'notes are omitted from the list');

  const searchByName = await admin.get('/api/admin/applications?q=' + encodeURIComponent('ياسمين'));
  assert.equal(searchByName.body.meta.total, 1);

  const stats = await admin.get('/api/admin/dashboard/stats');
  assert.ok(stats.body.data.applications.total >= 1);
});

test('server-side validation rejects invalid payloads with Arabic field errors', async () => {
  const { agent, token } = await anonymousAgent();
  const res = await submitApplication(agent, token, {
    full_name: 'ا',
    phone: '12',
    email: 'not-an-email',
    consent: false,
    department_id: 0,
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  for (const field of ['full_name', 'phone', 'email', 'consent', 'department_id']) {
    assert.ok(res.body.error.fields[field], `expected an error for ${field}`);
  }
});

test('the consent checkbox is mandatory', async () => {
  const { agent, token } = await anonymousAgent();
  const res = await submitApplication(agent, token, { consent: undefined });
  assert.equal(res.status, 400);
  assert.ok(res.body.error.fields.consent);
});

test('guardian and student phone numbers accept Arabic-Indic digits and are normalised', async () => {
  const { agent, token } = await anonymousAgent();
  const res = await submitApplication(agent, token, {
    guardian_phone: '٠١٠١٢٣٤٥٦٧٨',
    phone: '٠١١١٢٢٣٣٤٤',
  });
  assert.equal(res.status, 201);
  const row = db.get(
    'SELECT guardian_phone, phone FROM applications WHERE reference_number = ?',
    [res.body.data.reference_number]
  );
  assert.equal(row.guardian_phone, '01012345678');
  assert.equal(row.phone, '0111223344');
});

test('an unknown department is rejected', async () => {
  const { agent, token } = await anonymousAgent();
  const res = await submitApplication(agent, token, { department_id: 999999 });
  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'DEPARTMENT_UNAVAILABLE');
});

test('an unpublished department cannot receive applications', async () => {
  const department = db.get('SELECT id FROM departments WHERE is_published = 1 LIMIT 1');
  db.run('UPDATE departments SET is_published = 0 WHERE id = ?', [department.id]);

  const { agent, token } = await anonymousAgent();
  const res = await submitApplication(agent, token, { department_id: department.id });
  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'DEPARTMENT_NOT_ACCEPTING');
});

test('an archived department cannot receive applications', async () => {
  const department = db.get('SELECT id FROM departments WHERE is_published = 1 LIMIT 1');
  db.run('UPDATE departments SET is_active = 0 WHERE id = ?', [department.id]);

  const { agent, token } = await anonymousAgent();
  const res = await submitApplication(agent, token, { department_id: department.id });
  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'DEPARTMENT_NOT_ACCEPTING');
});

test('obvious duplicate submissions are rejected', async () => {
  const department = db.get('SELECT id FROM departments WHERE is_published = 1 LIMIT 1');
  const { agent, token } = await anonymousAgent();
  const payload = { guardian_phone: '01555555555', department_id: department.id };

  const first = await submitApplication(agent, token, payload);
  assert.equal(first.status, 201);

  const second = await submitApplication(agent, token, payload);
  assert.equal(second.status, 409);
  assert.equal(second.body.error.code, 'DUPLICATE_APPLICATION');
  // The public error must not confirm or leak the previous application's
  // reference number to whoever knows the phone number.
  assert.ok(!second.body.error.message.includes(first.body.data.reference_number));
});

test('the same guardian phone can apply to a different department', async () => {
  const departments = db.all('SELECT id FROM departments WHERE is_published = 1 LIMIT 2');
  const { agent, token } = await anonymousAgent();

  const first = await submitApplication(agent, token, {
    guardian_phone: '01555555556',
    department_id: departments[0].id,
  });
  const second = await submitApplication(agent, token, {
    guardian_phone: '01555555556',
    department_id: departments[1].id,
  });
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
});

test('application submission without CSRF token is rejected', async () => {
  const { agent } = await anonymousAgent();
  const department = db.get('SELECT id FROM departments WHERE is_published = 1 LIMIT 1');
  const res = await agent.post('/api/applications').send({
    full_name: 'طالب بلا رمز',
    phone: '01000000099',
    department_id: department.id,
    consent: true,
  });
  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'CSRF_TOKEN_INVALID');
});

test('administrators can change an application status', async () => {
  const { agent, token } = await anonymousAgent();
  const created = await submitApplication(agent, token, { phone: '01234567890' });
  const id = db.get('SELECT id FROM applications WHERE reference_number = ?', [
    created.body.data.reference_number,
  ]).id;

  const { agent: admin, token: adminToken } = await adminAgent();
  const res = await admin
    .patch(`/api/admin/applications/${id}/status`)
    .set('x-csrf-token', adminToken)
    .send({ status: 'UNDER_REVIEW' });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.status, 'UNDER_REVIEW');
  assert.equal(res.body.data.status_label, 'قيد المراجعة');

  const detail = await admin.get(`/api/admin/applications/${id}`);
  assert.equal(detail.body.data.status, 'UNDER_REVIEW');

  const invalid = await admin
    .patch(`/api/admin/applications/${id}/status`)
    .set('x-csrf-token', adminToken)
    .send({ status: 'MAYBE' });
  assert.equal(invalid.status, 400);

  const missing = await admin
    .patch('/api/admin/applications/999999/status')
    .set('x-csrf-token', adminToken)
    .send({ status: 'ACCEPTED' });
  assert.equal(missing.status, 404);
});

test('internal administrative notes are private', async () => {
  const { agent, token } = await anonymousAgent();
  const created = await submitApplication(agent, token, { phone: '01234567891' });
  const id = db.get('SELECT id FROM applications WHERE reference_number = ?', [
    created.body.data.reference_number,
  ]).id;

  const { agent: admin, token: adminToken } = await adminAgent();
  const saved = await admin
    .patch(`/api/admin/applications/${id}/notes`)
    .set('x-csrf-token', adminToken)
    .send({ admin_notes: 'ملاحظة داخلية سرية' });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.data.admin_notes, 'ملاحظة داخلية سرية');
  assert.equal(saved.body.data.has_admin_notes, true);

  // Public endpoints never expose application records at all.
  const publicList = await agent.get('/api/departments');
  assert.equal(JSON.stringify(publicList.body).includes('ملاحظة داخلية سرية'), false);
  const publicContent = await agent.get('/api/school-content');
  assert.equal(JSON.stringify(publicContent.body).includes('ملاحظة داخلية سرية'), false);

  // Anonymous callers cannot read the admin detail endpoint.
  const anonymousDetail = await agent.get(`/api/admin/applications/${id}`);
  assert.equal(anonymousDetail.status, 401);
});

test('applications can be filtered by status and department, and paginated', async () => {
  const departments = db.all('SELECT id FROM departments WHERE is_published = 1 LIMIT 2');
  const { agent, token } = await anonymousAgent();

  for (let index = 0; index < 3; index += 1) {
    const res = await submitApplication(agent, token, {
      phone: `0100000100${index}`,
      department_id: departments[0].id,
    });
    assert.equal(res.status, 201);
  }
  const other = await submitApplication(agent, token, {
    phone: '01000001009',
    department_id: departments[1].id,
  });
  assert.equal(other.status, 201);

  const { agent: admin } = await adminAgent();

  const page1 = await admin.get('/api/admin/applications?page=1&limit=2');
  assert.equal(page1.body.meta.limit, 2);
  assert.equal(page1.body.data.length, 2);
  assert.ok(page1.body.meta.total >= 4);
  assert.equal(page1.body.meta.hasNext, true);

  const page2 = await admin.get('/api/admin/applications?page=2&limit=2');
  assert.equal(page2.body.meta.page, 2);
  assert.notEqual(page1.body.data[0].id, page2.body.data[0].id);

  const byDepartment = await admin.get(
    `/api/admin/applications?department_id=${departments[1].id}`
  );
  assert.equal(byDepartment.body.meta.total, 1);
  assert.equal(byDepartment.body.data[0].department_id, departments[1].id);

  const byStatus = await admin.get('/api/admin/applications?status=NEW');
  assert.ok(byStatus.body.meta.total >= 4);
  assert.ok(byStatus.body.data.every((row) => row.status === 'NEW'));

  const sorted = await admin.get('/api/admin/applications?sort=oldest');
  assert.equal(sorted.status, 200);
});

test('administrators can delete any application, demo or real', async () => {
  const { agent, token } = await anonymousAgent();
  const created = await submitApplication(agent, token, { phone: '01234567892' });
  const realId = db.get('SELECT id FROM applications WHERE reference_number = ?', [
    created.body.data.reference_number,
  ]).id;
  const demo = db.get('SELECT id FROM applications WHERE is_demo = 1 LIMIT 1');

  const { agent: admin, token: adminToken } = await adminAgent();

  const realDelete = await admin.delete(`/api/admin/applications/${realId}`).set('x-csrf-token', adminToken);
  assert.equal(realDelete.status, 200);
  assert.equal(realDelete.body.data.id, realId);
  assert.equal(realDelete.body.data.was_demo, false);
  assert.equal(db.get('SELECT id FROM applications WHERE id = ?', [realId]), undefined);

  const demoDelete = await admin.delete(`/api/admin/applications/${demo.id}`).set('x-csrf-token', adminToken);
  assert.equal(demoDelete.status, 200);
  assert.equal(demoDelete.body.data.was_demo, true);
  assert.equal(db.get('SELECT id FROM applications WHERE id = ?', [demo.id]), undefined);
});

test('CSV export is protected and contains the application', async () => {
  const { agent: admin, token } = await adminAgent();
  const res = await admin.get('/api/admin/applications/export.csv');
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /text\/csv/);
  assert.match(res.headers['content-disposition'], /attachment/);
  assert.ok(res.text.startsWith('\uFEFF'), 'CSV must start with a UTF-8 BOM for Excel');
  assert.ok(res.text.includes('DEMO-2026-0001'));

  const { agent: anonymous } = await anonymousAgent();
  const denied = await anonymous.get('/api/admin/applications/export.csv');
  assert.equal(denied.status, 401);
});

test('CSV export neutralises spreadsheet formula injection', async () => {
  const { agent, token } = await anonymousAgent();
  const created = await submitApplication(agent, token, {
    phone: '01666666666',
    additional_notes: '=HYPERLINK("http://evil.example","click")',
  });
  assert.equal(created.status, 201);

  const { agent: admin } = await adminAgent();
  const res = await admin.get('/api/admin/applications/export.csv');
  assert.equal(res.status, 200);
  assert.ok(res.text.includes("'=HYPERLINK("), 'formula must be prefixed with an apostrophe');
  assert.ok(!res.text.includes('"=HYPERLINK('), 'formula must never start a CSV cell unescaped');
});

test('CSV export includes the new admission columns', async () => {
  const { agent: admin } = await adminAgent();
  const res = await admin.get('/api/admin/applications/export.csv');
  assert.equal(res.status, 200);
  for (const header of [
    'تاريخ الميلاد',
    'الرقم القومي / الهوية',
    'اسم ولي الأمر',
    'صلة القرابة',
    'هاتف ولي الأمر',
    'محافظة العنوان',
    'المركز',
    'المدينة / القرية',
    'المجموع / النسبة',
  ]) {
    assert.ok(res.text.includes(header), `expected CSV header: ${header}`);
  }
  assert.ok(res.text.includes('DEMO-2026-0001'));
});

test('the student extra phone is optional', async () => {
  const { agent, token } = await anonymousAgent();
  const res = await submitApplication(agent, token, { phone: '' });
  assert.equal(res.status, 201);
  const row = db.get('SELECT phone FROM applications WHERE reference_number = ?', [
    res.body.data.reference_number,
  ]);
  assert.equal(row.phone, '');
});

test('duplicate detection normalises the guardian phone', async () => {
  const department = db.get('SELECT id FROM departments WHERE is_published = 1 LIMIT 1');
  const { agent, token } = await anonymousAgent();

  const first = await submitApplication(agent, token, {
    guardian_phone: '01011112222',
    department_id: department.id,
  });
  assert.equal(first.status, 201);

  const second = await submitApplication(agent, token, {
    guardian_phone: '٠١٠١١١١٢٢٢٢',
    department_id: department.id,
  });
  assert.equal(second.status, 409);
  assert.equal(second.body.error.code, 'DUPLICATE_APPLICATION');
});

test('all three admission documents are required', async () => {
  const { agent, token } = await anonymousAgent();
  const res = await submitApplication(agent, token, {
    documents: {
      success_form: DOCUMENT_FIXTURES.pdf,
      birth_certificate: DOCUMENT_FIXTURES.png,
    },
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  assert.ok(res.body.error.fields.personal_photo);
  assert.equal(
    db.get('SELECT COUNT(*) AS count FROM applications WHERE is_demo = 0').count,
    0,
    'no application may be stored when a required document is missing'
  );
  assert.deepEqual(storedDocumentFiles(), [], 'uploaded files must be cleaned up');
});

test('documents whose real content does not match their type are rejected', async () => {
  const { agent, token } = await anonymousAgent();
  const res = await submitApplication(agent, token, {
    documents: {
      success_form: {
        buffer: Buffer.from('this is definitely not a pdf'),
        filename: 'fake.pdf',
        contentType: 'application/pdf',
      },
      birth_certificate: DOCUMENT_FIXTURES.png,
      personal_photo: DOCUMENT_FIXTURES.jpeg,
    },
  });

  assert.equal(res.status, 400);
  assert.ok(res.body.error.fields.success_form);
  assert.equal(db.get('SELECT COUNT(*) AS count FROM applications WHERE is_demo = 0').count, 0);
  assert.deepEqual(storedDocumentFiles(), []);
});

test('unsupported document types are rejected before storage', async () => {
  const { agent, token } = await anonymousAgent();
  const res = await submitApplication(agent, token, {
    documents: {
      ...DEFAULT_DOCUMENTS,
      success_form: {
        buffer: Buffer.from('GIF89a', 'latin1'),
        filename: 'animation.gif',
        contentType: 'image/gif',
      },
    },
  });

  assert.equal(res.status, 400);
  assert.ok(res.body.error.fields.success_form);
  assert.equal(db.get('SELECT COUNT(*) AS count FROM applications WHERE is_demo = 0').count, 0);
  assert.deepEqual(storedDocumentFiles(), []);
});

test('invalid form data removes the uploaded files', async () => {
  const { agent, token } = await anonymousAgent();
  const res = await submitApplication(agent, token, { full_name: 'ا' });
  assert.equal(res.status, 400);
  assert.ok(res.body.error.fields.full_name);
  assert.deepEqual(storedDocumentFiles(), []);
});

test('uploaded documents stay private and can only be downloaded by admins', async () => {
  const { agent, token } = await anonymousAgent();
  const created = await submitApplication(agent, token, { guardian_phone: '01777777777' });
  assert.equal(created.status, 201);

  const application = db.get('SELECT id FROM applications WHERE reference_number = ?', [
    created.body.data.reference_number,
  ]);
  const documents = db.all(
    'SELECT * FROM application_documents WHERE application_id = ? ORDER BY id ASC',
    [application.id]
  );
  assert.equal(documents.length, 3);
  for (const document of documents) {
    assert.ok(
      fs.existsSync(path.join(APPLICATION_UPLOADS_DIR, document.stored_name)),
      'document bytes must be stored on disk'
    );
  }

  const { agent: admin } = await adminAgent();
  const detail = await admin.get(`/api/admin/applications/${application.id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.data.documents.length, 3);
  assert.equal(detail.body.data.documents[0].kind_label, 'استمارة النجاح / بيان نجاح معتمد');

  const successForm = detail.body.data.documents.find((item) => item.kind === 'success_form');
  assert.ok(successForm.download_url.includes('/documents/'));

  const downloaded = await admin.get(successForm.download_url);
  assert.equal(downloaded.status, 200);
  assert.match(downloaded.headers['content-type'], /application\/pdf/);
  assert.match(downloaded.headers['content-disposition'], /attachment/);

  const anonymous = await agent.get(successForm.download_url);
  assert.equal(anonymous.status, 401);

  // The uploads folder must never be served as public static assets.
  const staticAttempt = await agent.get(`/uploads/applications/${documents[0].stored_name}`);
  assert.equal(staticAttempt.status, 404);
});

test('deleting an application removes its stored documents', async () => {
  const { agent, token } = await anonymousAgent();
  const created = await submitApplication(agent, token, { guardian_phone: '01888888888' });
  assert.equal(created.status, 201);

  const application = db.get('SELECT id FROM applications WHERE reference_number = ?', [
    created.body.data.reference_number,
  ]);
  const storedNames = db
    .all('SELECT stored_name FROM application_documents WHERE application_id = ?', [application.id])
    .map((row) => row.stored_name);
  assert.equal(storedNames.length, 3);

  const { agent: admin, token: adminToken } = await adminAgent();
  const deleted = await admin
    .delete(`/api/admin/applications/${application.id}`)
    .set('x-csrf-token', adminToken);
  assert.equal(deleted.status, 200);

  for (const storedName of storedNames) {
    assert.equal(
      fs.existsSync(path.join(APPLICATION_UPLOADS_DIR, storedName)),
      false,
      'deleted applications must not leave files behind'
    );
  }
  assert.equal(
    db.get('SELECT COUNT(*) AS count FROM application_documents WHERE application_id = ?', [
      application.id,
    ]).count,
    0
  );
});

after(() => db.closeDatabase());
