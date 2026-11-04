'use strict';

/**
 * News media helpers: URL validation, video provider detection and safe
 * handling of administrator-uploaded image files.
 *
 * Videos are never uploaded; they are referenced by a YouTube/Vimeo link or a
 * direct video file URL. Images can be uploaded to the local assets folder.
 */
const fs = require('node:fs');
const path = require('node:path');
const config = require('../config');

const UPLOAD_URL_PREFIX = '/assets/uploads/news/';
const IMAGE_EXTENSION = /\.(jpe?g|png|webp|gif|avif)(?:[?#].*)?$/i;
const VIDEO_EXTENSION = /\.(mp4|webm|ogg|ogv|mov|m4v)(?:[?#].*)?$/i;

function isHttpUrl(value) {
  if (typeof value !== 'string' || !value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isLocalAssetPath(value) {
  return (
    typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.includes('\\') &&
    !/\s/.test(value)
  );
}

/** A cover/gallery image: a local asset path or an absolute http(s) URL. */
function isImageUrl(value) {
  if (typeof value !== 'string' || !value || value.length > 500) return false;
  if (isLocalAssetPath(value)) return IMAGE_EXTENSION.test(value) || value.startsWith('/assets/');
  return isHttpUrl(value);
}

/**
 * Parses a supported video URL.
 * Returns `{ provider, id, embed_url, src }` or null.
 */
function parseVideo(value) {
  if (typeof value !== 'string' || !value || value.length > 500) return null;
  const trimmed = value.trim();
  if (!isHttpUrl(trimmed)) return null;

  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./i, '').toLowerCase();
  const pathname = url.pathname;

  if (host === 'youtu.be') {
    const id = pathname.split('/').filter(Boolean)[0] || '';
    if (/^[A-Za-z0-9_-]{6,20}$/.test(id)) {
      return youtube(id, trimmed);
    }
  }

  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    let id = '';
    if (pathname === '/watch') {
      id = url.searchParams.get('v') || '';
    } else {
      const match = pathname.match(/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{6,20})/);
      if (match) id = match[1];
    }
    if (/^[A-Za-z0-9_-]{6,20}$/.test(id)) {
      return youtube(id, trimmed);
    }
  }

  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const match = pathname.match(/^\/(?:video\/)?(\d{6,12})/);
    if (match) {
      return {
        provider: 'vimeo',
        id: match[1],
        embed_url: `https://player.vimeo.com/video/${match[1]}`,
        src: trimmed,
      };
    }
  }

  if (VIDEO_EXTENSION.test(pathname)) {
    return { provider: 'file', id: null, embed_url: null, src: trimmed };
  }

  return null;
}

function youtube(id, src) {
  return {
    provider: 'youtube',
    id,
    // Privacy-enhanced domain: no cookies until playback.
    embed_url: `https://www.youtube-nocookie.com/embed/${id}`,
    src,
  };
}

function isVideoUrl(value) {
  return Boolean(parseVideo(value));
}

// ---------------------------------------------------------------------------
// Uploaded files
// ---------------------------------------------------------------------------
function uploadsDir() {
  return config.paths.newsUploads;
}

function ensureUploadsDir() {
  fs.mkdirSync(uploadsDir(), { recursive: true });
  return uploadsDir();
}

function isUploadedNewsUrl(value) {
  return typeof value === 'string' && value.startsWith(UPLOAD_URL_PREFIX);
}

/**
 * Resolves an uploaded news URL to an absolute path inside the uploads folder.
 * Returns null for anything outside that folder (path traversal protection).
 */
function uploadedFilePath(value) {
  if (!isUploadedNewsUrl(value)) return null;
  let name;
  try {
    name = decodeURIComponent(value.slice(UPLOAD_URL_PREFIX.length));
  } catch {
    return null;
  }
  if (!name || name.includes('/') || name.includes('\\') || name.startsWith('.')) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) return null;

  const root = path.resolve(uploadsDir());
  const full = path.resolve(root, name);
  if (full !== root && !full.startsWith(root + path.sep)) return null;
  return full;
}

/** Removes one uploaded file. Never throws; returns true when deleted. */
function removeUploadedFile(value) {
  const full = uploadedFilePath(value);
  if (!full) return false;
  try {
    fs.unlinkSync(full);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  UPLOAD_URL_PREFIX,
  IMAGE_EXTENSION,
  isHttpUrl,
  isImageUrl,
  isVideoUrl,
  parseVideo,
  uploadsDir,
  ensureUploadsDir,
  isUploadedNewsUrl,
  uploadedFilePath,
  removeUploadedFile,
};
