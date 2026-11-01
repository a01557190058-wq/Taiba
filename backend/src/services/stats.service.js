'use strict';

const db = require('../db');
const applications = require('./applications.service');

function getDashboardStats() {
  const row = db.get(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN status = 'NEW' THEN 1 ELSE 0 END) AS new_count,
       SUM(CASE WHEN status = 'UNDER_REVIEW' THEN 1 ELSE 0 END) AS under_review,
       SUM(CASE WHEN status = 'ACCEPTED' THEN 1 ELSE 0 END) AS accepted,
       SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) AS rejected,
       SUM(CASE WHEN is_demo = 1 THEN 1 ELSE 0 END) AS demo_applications,
       SUM(CASE WHEN is_demo = 0 THEN 1 ELSE 0 END) AS real_applications
     FROM applications`
  );

  const departments = db.get(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN is_published = 1 AND is_active = 1 THEN 1 ELSE 0 END) AS published,
       SUM(CASE WHEN is_published = 0 AND is_active = 1 THEN 1 ELSE 0 END) AS drafts,
       SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) AS archived,
       SUM(CASE WHEN is_demo = 1 THEN 1 ELSE 0 END) AS demo_departments
     FROM departments`
  );

  return {
    applications: {
      total: row.total || 0,
      new: row.new_count || 0,
      under_review: row.under_review || 0,
      accepted: row.accepted || 0,
      rejected: row.rejected || 0,
      demo: row.demo_applications || 0,
      real: row.real_applications || 0,
    },
    departments: {
      total: departments.total || 0,
      published: departments.published || 0,
      drafts: departments.drafts || 0,
      archived: departments.archived || 0,
      demo: departments.demo_departments || 0,
    },
    recent_applications: applications.recent(5),
    generated_at: new Date().toISOString(),
  };
}

module.exports = { getDashboardStats };
