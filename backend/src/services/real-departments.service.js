'use strict';

const db = require('../db');
const { REAL_DEPARTMENTS } = require('../db/real-departments-data');

/** Placeholder covers used before each specialisation got its own artwork. */
const LEGACY_COVERS = new Set([
  '/assets/img/departments/default.svg',
  '/assets/img/departments/mechanical.svg',
  '/assets/img/departments/electrical.svg',
  '/assets/img/departments/electronics.svg',
  '/assets/img/departments/programming.svg',
  '/assets/img/departments/information-technology.svg',
  '/assets/img/departments/artificial-intelligence.svg',
  '/assets/img/departments/medical-devices.svg',
  '/assets/img/departments/analytical-chemistry.svg',
]);

/**
 * Idempotent seed for the real vocational specialisations of the complex.
 *
 * Unlike the demo dataset, these records are stored with is_demo = 0 so the
 * demo-data cleanup/reset endpoints can never remove them. Existing records
 * are matched by slug and never overwritten, which protects administrator
 * edits. The old fictional demo departments are unpublished at the end so
 * the public site shows only the real list.
 */
function seedRealDepartments() {
  const summary = {
    departments_inserted: 0,
    departments_converted: 0,
    covers_updated: 0,
    demo_departments_hidden: 0,
  };

  db.transaction(() => {
    for (const department of REAL_DEPARTMENTS) {
      const existing = db.get('SELECT id, is_demo, image_url FROM departments WHERE slug = ?', [
        department.slug,
      ]);

      if (!existing) {
        db.run(
          `INSERT INTO departments
             (name, slug, short_description, description, educational_focus, skills,
              admission_info, image_url, is_published, is_active, is_demo, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 0, ?)`,
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
        continue;
      }

      // Defensive: if a slug collides with an old demo record, promote it to
      // a real published department instead of creating a duplicate.
      if (existing.is_demo) {
        db.run(
          `UPDATE departments
              SET name = ?, short_description = ?, description = ?, educational_focus = ?,
                  skills = ?, admission_info = ?, image_url = ?,
                  is_published = 1, is_active = 1, is_demo = 0, sort_order = ?,
                  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE id = ?`,
          [
            department.name,
            department.short_description,
            department.description,
            department.educational_focus,
            department.skills,
            department.admission_info,
            department.image_url,
            department.sort_order,
            existing.id,
          ]
        );
        summary.departments_converted += 1;
      } else if (!existing.image_url || LEGACY_COVERS.has(existing.image_url)) {
        // Upgrade our own placeholder artwork, but never overwrite a cover
        // that an administrator has deliberately replaced.
        db.run(
          `UPDATE departments
              SET image_url = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE id = ?`,
          [department.image_url, existing.id]
        );
        summary.covers_updated += 1;
      }
    }

    const hidden = db.run(
      `UPDATE departments
          SET is_published = 0, is_active = 0
        WHERE is_demo = 1 AND (is_published <> 0 OR is_active <> 0)`
    );
    summary.demo_departments_hidden = hidden.changes;
  });

  return summary;
}

module.exports = { seedRealDepartments };
