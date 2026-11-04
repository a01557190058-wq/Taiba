'use strict';

const db = require('../db');
const content = require('./content.service');
const { DEMO_DEPARTMENTS, DEMO_APPLICATIONS, DEMO_NEWS } = require('../db/demo-data');

/**
 * Idempotent demo seeding. Records are matched by their natural keys
 * (department slug / application reference) so running this repeatedly never
 * creates duplicates. Existing records are never overwritten, which keeps
 * administrator edits intact.
 */
function seedDemoData() {
  const summary = {
    departments_inserted: 0,
    applications_inserted: 0,
    faqs_inserted: 0,
    content_inserted: 0,
    news_inserted: 0,
  };

  db.transaction(() => {
    // --- School content defaults (only missing keys) -----------------------
    for (const [key, value] of Object.entries(content.DEFAULT_CONTENT)) {
      const exists = db.get('SELECT 1 AS found FROM school_content WHERE content_key = ?', [key]);
      if (!exists) {
        db.run(
          `INSERT INTO school_content (content_key, content_value, updated_at)
           VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
          [key, value]
        );
        summary.content_inserted += 1;
      }
    }

    // --- FAQ defaults (only missing questions) ----------------------------
    for (const faq of content.FAQ_SEED) {
      const exists = db.get('SELECT 1 AS found FROM faqs WHERE question = ?', [faq.question]);
      if (!exists) {
        db.run(
          `INSERT INTO faqs (question, answer, sort_order, is_published, is_demo)
           VALUES (?, ?, ?, 1, 0)`,
          [faq.question, faq.answer, faq.sort_order]
        );
        summary.faqs_inserted += 1;
      }
    }

    // --- Demo departments --------------------------------------------------
    for (const department of DEMO_DEPARTMENTS) {
      const exists = db.get('SELECT id FROM departments WHERE slug = ?', [department.slug]);
      if (!exists) {
        db.run(
          `INSERT INTO departments
             (name, slug, short_description, description, educational_focus, skills,
              admission_info, image_url, is_published, is_active, is_demo, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 1, ?)`,
          [
            department.name,
            department.slug,
            department.short_description,
            department.description,
            department.educational_focus,
            department.skills,
            department.admission_info,
            department.image_url,
            department.sort_order,
          ]
        );
        summary.departments_inserted += 1;
      }
    }

    // --- Demo applications -------------------------------------------------
    for (const application of DEMO_APPLICATIONS) {
      const exists = db.get('SELECT id FROM applications WHERE reference_number = ?', [
        application.reference_number,
      ]);
      if (exists) continue;

      const department = db.get('SELECT id, name FROM departments WHERE slug = ?', [
        application.department_slug,
      ]);
      if (!department) continue;

      db.run(
        `INSERT INTO applications
           (reference_number, full_name, phone, email, department_id,
            department_name_snapshot, previous_education, additional_notes,
            status, admin_notes, is_demo, submitted_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [
          application.reference_number,
          application.full_name,
          application.phone,
          application.email,
          department.id,
          department.name,
          application.previous_education,
          application.additional_notes,
          application.status,
          application.admin_notes,
          application.submitted_at,
          application.submitted_at,
        ]
      );
      summary.applications_inserted += 1;
    }

    // --- Demo news ---------------------------------------------------------
    for (const item of DEMO_NEWS) {
      const exists = db.get('SELECT id FROM news WHERE slug = ?', [item.slug]);
      if (exists) continue;
      db.run(
        `INSERT INTO news
           (title, slug, summary, body, category, image_url,
            is_published, is_featured, is_demo, published_at, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, 1, ?, ?)`,
        [
          item.title,
          item.slug,
          item.summary,
          item.body,
          item.category,
          item.image_url,
          item.is_featured ? 1 : 0,
          item.published_at,
          item.sort_order,
        ]
      );
      summary.news_inserted += 1;
    }
  });

  return summary;
}

function getDemoSummary() {
  const departments = db.all(
    `SELECT id, name, slug, is_published, is_active, updated_at
       FROM departments WHERE is_demo = 1 ORDER BY sort_order ASC, id ASC`
  );
  const applications = db.all(
    `SELECT id, reference_number, full_name, department_name_snapshot, status, submitted_at
       FROM applications WHERE is_demo = 1 ORDER BY submitted_at DESC`
  );
  const news = db.all(
    `SELECT id, title, slug, category, is_published, published_at
       FROM news WHERE is_demo = 1 ORDER BY published_at DESC, id DESC`
  );
  const counts = db.get(
    `SELECT
       (SELECT COUNT(*) FROM departments WHERE is_demo = 1) AS demo_departments,
       (SELECT COUNT(*) FROM applications WHERE is_demo = 1) AS demo_applications,
       (SELECT COUNT(*) FROM news WHERE is_demo = 1) AS demo_news,
       (SELECT COUNT(*) FROM departments WHERE is_demo = 0) AS real_departments,
       (SELECT COUNT(*) FROM applications WHERE is_demo = 0) AS real_applications,
       (SELECT COUNT(*) FROM news WHERE is_demo = 0) AS real_news`
  );

  return {
    counts: {
      demo_departments: counts.demo_departments,
      demo_applications: counts.demo_applications,
      demo_news: counts.demo_news,
      real_departments: counts.real_departments,
      real_applications: counts.real_applications,
      real_news: counts.real_news,
    },
    departments: departments.map((row) => ({
      ...row,
      is_published: Boolean(row.is_published),
      is_active: Boolean(row.is_active),
    })),
    applications,
    news: news.map((row) => ({ ...row, is_published: Boolean(row.is_published) })),
  };
}

/**
 * Removes demo applications, then demo departments.
 * - Demo applications are always removable (explicit flag).
 * - A demo department that still has *real* applications cannot be deleted
 *   (FK RESTRICT); it is archived instead so student history is preserved.
 * Real applications are never touched.
 */
function cleanupDemoData() {
  const result = {
    deleted_applications: 0,
    deleted_departments: 0,
    archived_departments: 0,
    deleted_news: 0,
  };

  db.transaction(() => {
    const deletedApps = db.run('DELETE FROM applications WHERE is_demo = 1');
    result.deleted_applications = Number(deletedApps.changes);

    const deletedNews = db.run('DELETE FROM news WHERE is_demo = 1');
    result.deleted_news = Number(deletedNews.changes);

    const demoDepartments = db.all('SELECT id, name FROM departments WHERE is_demo = 1');
    for (const department of demoDepartments) {
      const references = db.get(
        'SELECT COUNT(*) AS count FROM applications WHERE department_id = ?',
        [department.id]
      );
      if (references.count > 0) {
        db.run(
          `UPDATE departments
              SET is_published = 0, is_active = 0,
                  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE id = ?`,
          [department.id]
        );
        result.archived_departments += 1;
      } else {
        db.run('DELETE FROM departments WHERE id = ?', [department.id]);
        result.deleted_departments += 1;
      }
    }
  });

  return result;
}

/** Explicit, confirmed reset: cleanup followed by a fresh idempotent seed. */
function resetDemoData() {
  const cleanup = cleanupDemoData();

  // A demo department that still has real applications is archived by cleanup
  // instead of being deleted. Reset must bring those retained departments back
  // to the published demo state before the fresh demo set is seeded, otherwise
  // the new demo applications would reference hidden departments. Departments
  // archived manually by an administrator and without applications are left
  // untouched.
  const restored = db.run(
    `UPDATE departments
        SET is_published = 1, is_active = 1,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE is_demo = 1
        AND id IN (SELECT DISTINCT department_id FROM applications)`
  );

  const seed = seedDemoData();

  return {
    cleanup,
    seed,
    restored_departments: Number(restored.changes),
    overview: getDemoSummary(),
  };
}

module.exports = { seedDemoData, cleanupDemoData, resetDemoData, getDemoSummary };
