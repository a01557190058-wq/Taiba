'use strict';

/**
 * Department media helpers.
 *
 * Covers and photos uploaded from the dashboard live in `uploads/departments`
 * (configurable) and are served from `/assets/uploads/departments/`. The
 * helpers mirror the news/gallery upload helpers: URL -> path resolution is
 * guarded against traversal and removal never throws.
 */
const fs = require('node:fs');
const path = require('node:path');
const config = require('../config');

const UPLOAD_URL_PREFIX = '/assets/uploads/departments/';

function uploadsDir() {
  return config.paths.departmentUploads;
}

function ensureUploadsDir() {
  fs.mkdirSync(uploadsDir(), { recursive: true });
  return uploadsDir();
}

function isDepartmentUploadUrl(value) {
  return typeof value === 'string' && value.startsWith(UPLOAD_URL_PREFIX);
}

/**
 * Resolves an uploaded department URL to an absolute path inside the uploads
 * folder. Returns null for anything outside that folder.
 */
function uploadedFilePath(value) {
  if (!isDepartmentUploadUrl(value)) return null;
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
  uploadsDir,
  ensureUploadsDir,
  isDepartmentUploadUrl,
  uploadedFilePath,
  removeUploadedFile,
};
