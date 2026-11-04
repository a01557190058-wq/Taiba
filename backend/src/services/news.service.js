'use strict';

const db = require('../db');
const HttpError = require('../lib/http-error');
const { slugify } = require('../lib/text');
const mediaLib = require('../lib/media');

const PUBLIC_FILTER = 'n.is_published = 1';

// First gallery image is used as a cover when the news item has no explicit
// cover image. This keeps cards meaningful without loading every media row.
const NEWS_SELECT = `SELECT n.*,
    (SELECT m.url FROM news_media m
      WHERE m.news_id = n.id AND m.type = 'image'
      ORDER BY m.sort_order ASC, m.id ASC
      LIMIT 1) AS cover_url
  FROM news n`;

function mapMedia(row) {
  const video = row.type === 'video' ? mediaLib.parseVideo(row.url) : null;
  return {
    id: row.id,
    type: row.type,
    url: row.url,
    caption: row.caption,
    sort_order: row.sort_order,
    provider: video ? video.provider : null,
    embed_url: video ? video.embed_url : null,
  };
}

function mapNews(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    body: row.body,
    category: row.category,
    image_url: row.image_url || row.cover_url || '',
    is_published: Boolean(row.is_published),
    is_featured: Boolean(row.is_featured),
    is_demo: Boolean(row.is_demo),
    published_at: row.published_at,
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function getMedia(newsId) {
  return db
    .all(
      'SELECT * FROM news_media WHERE news_id = ? ORDER BY sort_order ASC, id ASC',
      [newsId]
    )
    .map(mapMedia);
}

function withMedia(news) {
  if (!news) return null;
  return { ...news, media: getMedia(news.id) };
}

function replaceMedia(newsId, items = []) {
  db.run('DELETE FROM news_media WHERE news_id = ?', [newsId]);
  const insert = db.run.bind(db);
  items.forEach((item, index) => {
    insert(
      `INSERT INTO news_media (news_id, type, url, caption, sort_order)
       VALUES (?, ?, ?, ?, ?)`,
      [
        newsId,
        item.type,
        item.url,
        item.caption || '',
        Number.isInteger(item.sort_order) ? item.sort_order : index,
      ]
    );
  });
}

/**
 * Deletes uploaded image files that are no longer referenced by any news item.
 * External URLs are ignored. Never throws: a leftover file must not break a
 * successful database write.
 */
function cleanupUploadedFiles(candidates) {
  const checked = new Set();
  for (const url of candidates) {
    if (!url || checked.has(url) || !mediaLib.isUploadedNewsUrl(url)) continue;
    checked.add(url);
    const stillUsed =
      db.get('SELECT 1 AS found FROM news WHERE image_url = ? LIMIT 1', [url]) ||
      db.get('SELECT 1 AS found FROM news_media WHERE url = ? LIMIT 1', [url]);
    if (!stillUsed) mediaLib.removeUploadedFile(url);
  }
}

function escapeLike(value) {
  return String(value || '').replace(/[\\%_]/g, (match) => `\\${match}`);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
function listPublic({ q = '', category = '', featured = null, page = 1, limit = 9 } = {}) {
  const where = [PUBLIC_FILTER];
  const params = [];

  if (q) {
    where.push(
      "(n.title LIKE ? ESCAPE '\\' OR n.summary LIKE ? ESCAPE '\\' OR n.body LIKE ? ESCAPE '\\')"
    );
    const like = `%${escapeLike(q)}%`;
    params.push(like, like, like);
  }
  if (category) {
    where.push('n.category = ?');
    params.push(category);
  }
  if (featured === true) where.push('n.is_featured = 1');

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const offset = (page - 1) * limit;

  const totalRow = db.get(`SELECT COUNT(*) AS count FROM news n ${whereSql}`, params);
  const rows = db.all(
    `${NEWS_SELECT}
       ${whereSql}
      ORDER BY n.is_featured DESC, n.published_at DESC, n.id DESC
      LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return { items: rows.map(mapNews), total: totalRow.count };
}

function listCategories() {
  return db
    .all(
      `SELECT n.category, COUNT(*) AS count
         FROM news n
        WHERE ${PUBLIC_FILTER} AND length(trim(n.category)) > 0
        GROUP BY n.category
        ORDER BY count DESC, n.category ASC`
    )
    .map((row) => ({ name: row.category, count: Number(row.count) }));
}

function getPublicBySlug(slug) {
  const row = db.get(`${NEWS_SELECT} WHERE n.slug = ? AND ${PUBLIC_FILTER}`, [slug]);
  return withMedia(mapNews(row));
}

function relatedPublic(news, limit = 3) {
  if (!news) return [];
  const rows = db.all(
    `${NEWS_SELECT}
      WHERE ${PUBLIC_FILTER}
        AND n.id <> ?
        AND (n.category = ? OR ? = '')
      ORDER BY n.is_featured DESC, n.published_at DESC, n.id DESC
      LIMIT ?`,
    [news.id, news.category || '', news.category || '', limit]
  );
  return rows.map(mapNews);
}

// ---------------------------------------------------------------------------
// Admin API
// ---------------------------------------------------------------------------
function listAdmin({ q = '', state = 'all', isDemo = null, page = 1, limit = 20 } = {}) {
  const where = [];
  const params = [];

  if (q) {
    where.push(
      "(n.title LIKE ? ESCAPE '\\' OR n.slug LIKE ? ESCAPE '\\' OR n.summary LIKE ? ESCAPE '\\')"
    );
    const like = `%${escapeLike(q)}%`;
    params.push(like, like, like);
  }

  if (state === 'published') where.push('n.is_published = 1');
  else if (state === 'draft') where.push('n.is_published = 0');
  else if (state === 'featured') where.push('n.is_featured = 1');

  if (isDemo === true) where.push('n.is_demo = 1');
  else if (isDemo === false) where.push('n.is_demo = 0');

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const totalRow = db.get(`SELECT COUNT(*) AS count FROM news n ${whereSql}`, params);
  const rows = db.all(
    `${NEWS_SELECT}
       ${whereSql}
      ORDER BY n.is_published ASC, n.published_at DESC, n.id DESC
      LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return { items: rows.map(mapNews), total: totalRow.count };
}

function getById(id) {
  const row = db.get(`${NEWS_SELECT} WHERE n.id = ?`, [id]);
  return withMedia(mapNews(row));
}

function assertSlugAvailable(slug, excludeId = null) {
  const existing = db.get('SELECT id FROM news WHERE slug = ?', [slug]);
  if (existing && existing.id !== excludeId) {
    throw HttpError.conflict('SLUG_TAKEN', 'المعرّف (slug) مستخدم بالفعل. اختر معرّفًا آخر.', {
      slug: 'هذا المعرّف مستخدم لخبر آخر.',
    });
  }
}

function create(payload) {
  const slug = payload.slug || slugify(payload.title);
  if (!slug) {
    throw HttpError.badRequest('تعذّر توليد معرّف للخبر. أدخل المعرّف يدويًا.', {
      slug: 'المعرّف مطلوب.',
    });
  }
  assertSlugAvailable(slug);

  const id = db.transaction(() => {
    const result = db.run(
      `INSERT INTO news
         (title, slug, summary, body, category, image_url,
          is_published, is_featured, is_demo, published_at, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, COALESCE(?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')), ?)`,
      [
        payload.title,
        slug,
        payload.summary || '',
        payload.body || '',
        payload.category || '',
        payload.image_url || '',
        payload.is_published ? 1 : 0,
        payload.is_featured ? 1 : 0,
        payload.published_at || null,
        payload.sort_order || 0,
      ]
    );
    const newsId = Number(result.lastInsertRowid);
    replaceMedia(newsId, payload.media || []);
    return newsId;
  });

  return getById(id);
}

function update(id, payload) {
  const current = getById(id);
  if (!current) throw HttpError.notFound('الخبر غير موجود.');

  const fields = [];
  const params = [];
  const assign = (column, value) => {
    fields.push(`${column} = ?`);
    params.push(value);
  };

  if (payload.title !== undefined) assign('title', payload.title);
  if (payload.slug !== undefined && payload.slug !== current.slug) {
    assertSlugAvailable(payload.slug, id);
    assign('slug', payload.slug);
  }
  if (payload.summary !== undefined) assign('summary', payload.summary);
  if (payload.body !== undefined) assign('body', payload.body);
  if (payload.category !== undefined) assign('category', payload.category);
  if (payload.image_url !== undefined) assign('image_url', payload.image_url);
  if (payload.is_published !== undefined) assign('is_published', payload.is_published ? 1 : 0);
  if (payload.is_featured !== undefined) assign('is_featured', payload.is_featured ? 1 : 0);
  if (payload.published_at !== undefined) assign('published_at', payload.published_at);
  if (payload.sort_order !== undefined) assign('sort_order', payload.sort_order);

  const mediaChanged = payload.media !== undefined;
  if (!fields.length && !mediaChanged) return current;

  const oldUrls = [
    current.image_url,
    ...(Array.isArray(current.media) ? current.media.map((item) => item.url) : []),
  ];

  db.transaction(() => {
    if (fields.length) {
      fields.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')");
      params.push(id);
      db.run(`UPDATE news SET ${fields.join(', ')} WHERE id = ?`, params);
    }
    if (mediaChanged) replaceMedia(id, payload.media);
  });

  const updated = getById(id);
  const retainedUrls = [
    updated.image_url,
    ...(Array.isArray(updated.media) ? updated.media.map((item) => item.url) : []),
  ];
  const retained = new Set(retainedUrls.filter(Boolean));
  cleanupUploadedFiles(oldUrls.filter((url) => !retained.has(url)));

  return updated;
}

/** Full administrative control: any news item (demo or real) can be deleted. */
function remove(id) {
  const news = db.get('SELECT id, title, slug, image_url FROM news WHERE id = ?', [id]);
  if (!news) throw HttpError.notFound('الخبر غير موجود.');

  const urls = [news.image_url, ...getMedia(news.id).map((item) => item.url)];
  db.run('DELETE FROM news WHERE id = ?', [id]);
  cleanupUploadedFiles(urls);

  return { id: news.id, title: news.title, slug: news.slug };
}

function countPublished() {
  return db.get(`SELECT COUNT(*) AS count FROM news n WHERE ${PUBLIC_FILTER}`).count;
}

module.exports = {
  mapNews,
  mapMedia,
  listPublic,
  listCategories,
  getPublicBySlug,
  relatedPublic,
  listAdmin,
  getById,
  getMedia,
  create,
  update,
  remove,
  countPublished,
};
