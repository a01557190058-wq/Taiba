'use strict';

/**
 * Gallery photo helpers.
 *
 * Photos uploaded from the dashboard live in `uploads/gallery` (configurable)
 * and are served from `/assets/uploads/gallery/`. The helpers below mirror the
 * news upload helpers: the real file content is sniffed before accepting an
 * upload, and URL -> path resolution is guarded against traversal.
 */
const fs = require('node:fs');
const path = require('node:path');
const config = require('../config');

const UPLOAD_URL_PREFIX = '/assets/uploads/gallery/';

function uploadsDir() {
  return config.paths.galleryUploads;
}

function ensureUploadsDir() {
  fs.mkdirSync(uploadsDir(), { recursive: true });
  return uploadsDir();
}

function isGalleryUploadUrl(value) {
  return typeof value === 'string' && value.startsWith(UPLOAD_URL_PREFIX);
}

/**
 * Resolves an uploaded gallery URL to an absolute path inside the uploads
 * folder. Returns null for anything outside that folder.
 */
function uploadedFilePath(value) {
  if (!isGalleryUploadUrl(value)) return null;
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

/** Removes one uploaded photo. Never throws; returns true when deleted. */
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
  uploadsDir,
  ensureUploadsDir,
  isGalleryUploadUrl,
  uploadedFilePath,
  removeUploadedFile,
};
