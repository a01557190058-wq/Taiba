-- ===========================================================================
-- Taiba Technology School - SQLite schema (MVP)
-- All timestamps are ISO-8601 UTC strings so the data can be migrated to
-- PostgreSQL with minimal changes (TEXT -> TIMESTAMPTZ, INTEGER -> BOOLEAN).
-- ===========================================================================

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- Migration bookkeeping
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schema_migrations (
  version     TEXT PRIMARY KEY,
  applied_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ---------------------------------------------------------------------------
-- Administrators
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admins (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  username       TEXT NOT NULL UNIQUE,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  display_name   TEXT NOT NULL DEFAULT 'مدير المدرسة',
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ---------------------------------------------------------------------------
-- Departments
--   is_published : visible on the public website / application form
--   is_active    : archived departments stay readable for history but are
--                  hidden from the public website (never cascade deletes)
--   is_demo      : explicit demo-data flag used by the demo-data manager
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS departments (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  name              TEXT NOT NULL,
  slug              TEXT NOT NULL UNIQUE,
  short_description TEXT NOT NULL DEFAULT '',
  description       TEXT NOT NULL DEFAULT '',
  educational_focus TEXT NOT NULL DEFAULT '',
  skills            TEXT NOT NULL DEFAULT '',           -- one skill per line
  admission_info    TEXT NOT NULL DEFAULT '',
  image_url         TEXT NOT NULL DEFAULT '',
  is_published      INTEGER NOT NULL DEFAULT 1 CHECK (is_published IN (0, 1)),
  is_active         INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  is_demo           INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (length(trim(name)) > 0),
  CHECK (length(trim(slug)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_departments_public
  ON departments (is_published, is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_departments_demo
  ON departments (is_demo);

-- Extra photos attached to a department. The cover image stays in
-- `departments.image_url`; these photos are shown in the department page
-- gallery and are removed automatically when the department is deleted.
CREATE TABLE IF NOT EXISTS department_images (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  department_id INTEGER NOT NULL
                  REFERENCES departments (id)
                  ON DELETE CASCADE ON UPDATE CASCADE,
  url           TEXT NOT NULL,
  alt           TEXT NOT NULL DEFAULT '',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (length(trim(url)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_department_images_department
  ON department_images (department_id, sort_order, id);

-- ---------------------------------------------------------------------------
-- Student admission applications
--   department_id uses ON DELETE RESTRICT: a department referenced by an
--   application can never be deleted, so student history is preserved.
--   department_name_snapshot keeps the historical name even if the
--   department is renamed later.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS applications (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  reference_number         TEXT NOT NULL UNIQUE,
  full_name                TEXT NOT NULL,
  phone                    TEXT NOT NULL DEFAULT '',
  email                    TEXT NOT NULL DEFAULT '',
  department_id            INTEGER NOT NULL
                             REFERENCES departments (id)
                             ON DELETE RESTRICT ON UPDATE CASCADE,
  department_name_snapshot TEXT NOT NULL,
  previous_education       TEXT NOT NULL DEFAULT '',
  additional_notes         TEXT NOT NULL DEFAULT '',
  -- Student details
  date_of_birth            TEXT NOT NULL DEFAULT '',
  gender                   TEXT NOT NULL DEFAULT ''
                             CHECK (gender IN ('', 'male', 'female')),
  national_id              TEXT NOT NULL DEFAULT '',
  governorate              TEXT NOT NULL DEFAULT '',
  educational_administration TEXT NOT NULL DEFAULT '',
  -- Guardian / contact details
  guardian_name            TEXT NOT NULL DEFAULT '',
  guardian_relation        TEXT NOT NULL DEFAULT ''
                             CHECK (guardian_relation IN ('', 'father', 'mother', 'other')),
  guardian_phone           TEXT NOT NULL DEFAULT '',
  address_governorate      TEXT NOT NULL DEFAULT '',
  address_center           TEXT NOT NULL DEFAULT '',
  address_city             TEXT NOT NULL DEFAULT '',
  -- Academic details
  preparatory_score        TEXT NOT NULL DEFAULT '',
  status                   TEXT NOT NULL DEFAULT 'NEW'
                             CHECK (status IN ('NEW', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED')),
  admin_notes              TEXT NOT NULL DEFAULT '',
  is_demo                  INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  submitted_at             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at               TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (length(trim(full_name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_applications_status     ON applications (status);
CREATE INDEX IF NOT EXISTS idx_applications_submitted  ON applications (submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_applications_department ON applications (department_id);
CREATE INDEX IF NOT EXISTS idx_applications_phone      ON applications (phone);
CREATE INDEX IF NOT EXISTS idx_applications_guardian_phone ON applications (guardian_phone);
CREATE INDEX IF NOT EXISTS idx_applications_demo       ON applications (is_demo);

-- ---------------------------------------------------------------------------
-- Documents uploaded with an admission application.
--   Files live outside the public web root and are only downloadable by an
--   authenticated administrator. Rows disappear with their application.
--   kind:
--     success_form      : استمارة النجاح / بيان نجاح معتمد
--     birth_certificate : شهادة الميلاد الكمبيوتر الحديثة
--     personal_photo    : صورة شخصية حديثة للطالب
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS application_documents (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL
                  REFERENCES applications (id)
                  ON DELETE CASCADE ON UPDATE CASCADE,
  kind          TEXT NOT NULL
                  CHECK (kind IN ('success_form', 'birth_certificate', 'personal_photo')),
  original_name TEXT NOT NULL DEFAULT '',
  stored_name   TEXT NOT NULL,
  mime_type     TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (length(trim(stored_name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_application_documents_application
  ON application_documents (application_id, kind, id);

-- ---------------------------------------------------------------------------
-- Editable school content (key/value)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_content (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  content_key   TEXT NOT NULL UNIQUE,
  content_value TEXT NOT NULL DEFAULT '',
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ---------------------------------------------------------------------------
-- Frequently asked questions (managed from the dashboard)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS faqs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  question    TEXT NOT NULL,
  answer      TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_published INTEGER NOT NULL DEFAULT 1 CHECK (is_published IN (0, 1)),
  is_demo     INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (length(trim(question)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_faqs_order ON faqs (sort_order, id);

-- ---------------------------------------------------------------------------
-- School news (managed from the dashboard)
--   is_published : visible on the public website
--   is_featured  : highlighted on the home page and the news listing
--   is_demo      : explicit demo-data flag used by the demo-data manager
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS news (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  summary      TEXT NOT NULL DEFAULT '',
  body         TEXT NOT NULL DEFAULT '',
  category     TEXT NOT NULL DEFAULT '',
  image_url    TEXT NOT NULL DEFAULT '',
  is_published INTEGER NOT NULL DEFAULT 0 CHECK (is_published IN (0, 1)),
  is_featured  INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0, 1)),
  is_demo      INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  published_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (length(trim(title)) > 0),
  CHECK (length(trim(slug)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_news_public
  ON news (is_published, published_at DESC, sort_order);
CREATE INDEX IF NOT EXISTS idx_news_demo
  ON news (is_demo);

-- ---------------------------------------------------------------------------
-- News media (gallery images and video links)
--   type = 'image' : uploaded file or external image URL
--   type = 'video' : YouTube/Vimeo link or direct video file URL
--   Deleting a news item removes its media rows automatically.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS news_media (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  news_id    INTEGER NOT NULL
               REFERENCES news (id)
               ON DELETE CASCADE ON UPDATE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('image', 'video')),
  url        TEXT NOT NULL,
  caption    TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (length(trim(url)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_news_media_news
  ON news_media (news_id, sort_order, id);

-- ---------------------------------------------------------------------------
-- Public photo gallery (managed from the dashboard)
--   gallery_settings : single row (id = 1) with the page hero + credits text
--   gallery_sections : the page sections (e.g. النظري / العملي)
--   gallery_images   : photos belonging to a section, ordered by sort_order
--   is_published     : hide a section or a single photo without deleting it
--   thumb_url        : optional smaller version used by the grid; falls back
--                      to `url` when empty (uploaded photos have no thumbnail)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gallery_settings (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  eyebrow       TEXT NOT NULL DEFAULT '',
  title         TEXT NOT NULL DEFAULT '',
  lead          TEXT NOT NULL DEFAULT '',
  credits_note  TEXT NOT NULL DEFAULT '',
  show_credits  INTEGER NOT NULL DEFAULT 1 CHECK (show_credits IN (0, 1)),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS gallery_sections (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  slug          TEXT NOT NULL UNIQUE,
  eyebrow       TEXT NOT NULL DEFAULT '',
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  icon          TEXT NOT NULL DEFAULT 'image',
  is_published  INTEGER NOT NULL DEFAULT 1 CHECK (is_published IN (0, 1)),
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (length(trim(title)) > 0),
  CHECK (length(trim(slug)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_gallery_sections_public
  ON gallery_sections (is_published, sort_order, id);

CREATE TABLE IF NOT EXISTS gallery_images (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id    INTEGER NOT NULL
                  REFERENCES gallery_sections (id)
                  ON DELETE CASCADE ON UPDATE CASCADE,
  url           TEXT NOT NULL,
  thumb_url     TEXT NOT NULL DEFAULT '',
  alt           TEXT NOT NULL DEFAULT '',
  caption       TEXT NOT NULL DEFAULT '',
  credit        TEXT NOT NULL DEFAULT '',
  credit_url    TEXT NOT NULL DEFAULT '',
  is_published  INTEGER NOT NULL DEFAULT 1 CHECK (is_published IN (0, 1)),
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (length(trim(url)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_gallery_images_section
  ON gallery_images (section_id, sort_order, id);

-- ---------------------------------------------------------------------------
-- Study subjects (المواد الدراسية, managed from the dashboard)
--   type          : 'theoretical' (نظرية) or 'practical' (عملية)
--   grade         : 'first' | 'second' | 'third' secondary grade
--   department_id : optional link to a department; NULL = general subject
--                   shown for every department of that grade
--   icon          : one of the shared inline icon names, used on the public page
--   is_published  : visible on the public subjects page
--   is_demo       : explicit demo-data flag used by the demo-data manager
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subjects (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  type          TEXT NOT NULL CHECK (type IN ('theoretical', 'practical')),
  grade         TEXT NOT NULL DEFAULT 'first'
                  CHECK (grade IN ('first', 'second', 'third')),
  department_id INTEGER
                  REFERENCES departments (id)
                  ON DELETE SET NULL ON UPDATE CASCADE,
  icon          TEXT NOT NULL DEFAULT 'book',
  is_published  INTEGER NOT NULL DEFAULT 1 CHECK (is_published IN (0, 1)),
  is_demo       INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_subjects_public
  ON subjects (is_published, type, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_subjects_grade
  ON subjects (is_published, grade, department_id, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_subjects_demo
  ON subjects (is_demo);

-- ---------------------------------------------------------------------------
-- Server-side sessions (custom store, survives restarts)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  sid         TEXT PRIMARY KEY,
  sess        TEXT NOT NULL,
  expires_at  INTEGER NOT NULL,          -- unix epoch milliseconds
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_at);
