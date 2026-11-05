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

// Magic-byte signatures for the raster formats the upload endpoint accepts.
// The browser-supplied MIME type can lie, so the actual file content is
// checked before the upload is accepted.
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);

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

/**
 * Detects the real image type from the first bytes of a buffer.
 * Returns an allowed MIME type or null when the content is not a raster image.
 */
function sniffImageType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 3) return null;

  if (buffer.length >= JPEG_SIGNATURE.length && buffer.subarray(0, 3).equals(JPEG_SIGNATURE)) {
    return 'image/jpeg';
  }
  if (buffer.length >= PNG_SIGNATURE.length && buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return 'image/png';
  }
  const header = buffer.subarray(0, 6).toString('latin1');
  if (header === 'GIF87a' || header === 'GIF89a') return 'image/gif';
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('latin1') === 'RIFF' &&
    buffer.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

/** Reads the first bytes of a file and returns its real image MIME type (or null). */
function sniffImageFile(filePath) {
  let fd;
  try {
    fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(16);
    const bytes = fs.readSync(fd, buffer, 0, buffer.length, 0);
    return sniffImageType(buffer.subarray(0, bytes));
  } catch {
    return null;
  } finally {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch {
        /* ignore close errors */
      }
    }
  }
}

/** Removes a temporary upload without ever throwing. */
function removeFileQuietly(filePath) {
  if (!filePath) return;
  try {
    fs.unlinkSync(filePath);
  } catch {
    /* ignore missing/permission errors */
  }
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
  sniffImageType,
  sniffImageFile,
  removeFileQuietly,
  isUploadedNewsUrl,
  uploadedFilePath,
  removeUploadedFile,
};
