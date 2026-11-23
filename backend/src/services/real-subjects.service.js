'use strict';

const db = require('../db');
const content = require('./content.service');
const { REAL_SUBJECTS } = require('../db/real-subjects-data');

/**
 * Idempotent seed for the real study plan of Taiba Technology Complex.
 *
 * Records are matched by (name, type, grade, department). General subjects have
 * a NULL department and are automatically included with every section by the
 * public API. Demo subjects are hidden — never deleted — so the test harness
 * and admin history remain intact. Existing non-demo records are left alone so
 * administrator edits are never overwritten.
 */
function findExisting(name, type, grade, departmentId) {
  if (departmentId === null) {
    return db.get(
      `SELECT id, is_demo FROM subjects
        WHERE name = ? AND type = ? AND grade = ? AND department_id IS NULL`,
      [name, type, grade]
    );
  }
  return db.get(
    `SELECT id, is_demo FROM subjects
      WHERE name = ? AND type = ? AND grade = ? AND department_id = ?`,
    [name, type, grade, departmentId]
  );
}

function seedRealSubjects() {
  const summary = {
    subjects_inserted: 0,
    subjects_promoted: 0,
    demo_subjects_hidden: 0,
    content_note_updated: 0,
  };

  db.transaction(() => {
    for (const subject of REAL_SUBJECTS) {
      let departmentId = null;
      if (subject.department_slug) {
        const department = db.get('SELECT id FROM departments WHERE slug = ?', [
          subject.department_slug,
        ]);
        if (!department) {
          throw new Error(`Real subject seed: missing department '${subject.department_slug}'.`);
        }
        departmentId = department.id;
      }

      const existing = findExisting(subject.name, subject.type, subject.grade, departmentId);
      if (existing) {
        if (!existing.is_demo) continue;
        db.run(
          `UPDATE subjects
              SET description = ?, icon = ?, weekly_periods = ?, sort_order = ?,
                  is_published = 1, is_demo = 0,
                  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE id = ?`,
          [
            subject.description,
            subject.icon,
            subject.weekly_periods,
            subject.sort_order,
            existing.id,
          ]
        );
        summary.subjects_promoted += 1;
        continue;
      }

      db.run(
        `INSERT INTO subjects
           (name, description, type, grade, department_id, icon,
            is_published, is_demo, sort_order, weekly_periods)
         VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`,
        [
          subject.name,
          subject.description,
          subject.type,
          subject.grade,
          departmentId,
          subject.icon,
          subject.sort_order,
          subject.weekly_periods,
        ]
      );
      summary.subjects_inserted += 1;
    }

    const hidden = db.run(
      `UPDATE subjects SET is_published = 0
        WHERE is_demo = 1 AND is_published <> 0`
    );
    summary.demo_subjects_hidden = hidden.changes;

    // Existing installations already contain the old demo wording. Refresh it
    // once, but leave any administrator-customised note untouched.
    const currentNote = db.get(
      "SELECT content_value FROM school_content WHERE content_key = 'subjects_note'"
    );
    if (!currentNote || currentNote.content_value.includes('تجريبية لأغراض العرض')) {
      content.updateContent({ subjects_note: content.DEFAULT_CONTENT.subjects_note });
      summary.content_note_updated = 1;
    }
  });

  return summary;
}

module.exports = { seedRealSubjects };
