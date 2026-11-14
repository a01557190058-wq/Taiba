'use strict';

/**
 * Admission document helpers.
 *
 * Applicants upload three documents (success form, birth certificate and a
 * personal photo) in PDF, JPG or PNG format. The files are stored outside the
 * public web root in `uploads/applications` (configurable) and are never
 * mounted with `express.static`. Only an authenticated administrator can
 * download them through the admin API.
 *
 * The browser-supplied MIME type is only a hint: the real bytes are sniffed
 * before a file is accepted.
 */
const fs = require('node:fs');
const path = require('node:path');
const config = require('../config');
const { sniffImageType } = require('./media');

const DOCUMENT_KINDS = Object.freeze({
  success_form: 'استمارة النجاح / بيان نجاح معتمد',
  birth_certificate: 'شهادة الميلاد الكمبيوتر الحديثة',
  personal_photo: 'صورة شخصية حديثة للطالب',
});

const DOCUMENT_KIND_LIST = Object.freeze(Object.keys(DOCUMENT_KINDS));

const MAX_ORIGINAL_NAME = 180;

// Declared MIME type -> stored extension + the content type the bytes must
// actually have. `image/jpg` is a common non-standard spelling.
const ACCEPTED_TYPES = new Map([
  ['image/jpeg', { extension: '.jpg', sniff: 'image/jpeg' }],
  ['image/jpg', { extension: '.jpg', sniff: 'image/jpeg' }],
  ['image/png', { extension: '.png', sniff: 'image/png' }],
  ['application/pdf', { extension: '.pdf', sniff: 'application/pdf' }],
]);

const PDF_SIGNATURE = Buffer.from('%PDF-', 'latin1');

function uploadsDir() {
  return config.paths.applicationUploads;
}

function ensureUploadsDir() {
  fs.mkdirSync(uploadsDir(), { recursive: true });
  return uploadsDir();
}

/** Returns the stored extension for a declared upload type, or null. */
function extensionForMime(mime) {
  const entry = ACCEPTED_TYPES.get(String(mime || '').toLowerCase());
  return entry ? entry.extension : null;
}

/** Returns the content type the bytes must have for a declared MIME type. */
function expectedSniffedType(mime) {
  const entry = ACCEPTED_TYPES.get(String(mime || '').toLowerCase());
  return entry ? entry.sniff : null;
}

/**
 * Detects the real document type from the first bytes of a buffer.
 * Returns `application/pdf`, `image/jpeg`, `image/png` or null.
 */
function sniffDocumentType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return null;
  if (buffer.length >= PDF_SIGNATURE.length && buffer.subarray(0, 5).equals(PDF_SIGNATURE)) {
    return 'application/pdf';
  }
  const imageType = sniffImageType(buffer);
  if (imageType === 'image/jpeg' || imageType === 'image/png') return imageType;
  return null;
}

/** Reads the first bytes of a file and returns its real document type (or null). */
function sniffDocumentFile(filePath) {
  let fd;
  try {
    fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(16);
    const bytes = fs.readSync(fd, buffer, 0, buffer.length, 0);
    return sniffDocumentType(buffer.subarray(0, bytes));
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

/** Keeps a human-readable, filesystem-safe original name for display only. */
function sanitizeOriginalName(name) {
  const base = path.basename(String(name || '')).replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return (base || 'document').slice(0, MAX_ORIGINAL_NAME);
}

/**
 * Resolves a stored filename to an absolute path inside the uploads folder.
 * Returns null for anything outside that folder (path traversal protection).
 */
function storedFilePath(storedName) {
  if (typeof storedName !== 'string' || !storedName) return null;
  if (storedName.includes('/') || storedName.includes('\\') || storedName.startsWith('.')) {
    return null;
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(storedName)) return null;

  const root = path.resolve(uploadsDir());
  const full = path.resolve(root, storedName);
  if (full !== root && !full.startsWith(root + path.sep)) return null;
  return full;
}

/** Removes one stored document. Never throws; returns true when deleted. */
function removeStoredFile(storedName) {
  const full = storedFilePath(storedName);
  if (!full) return false;
  try {
    fs.unlinkSync(full);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  DOCUMENT_KINDS,
  DOCUMENT_KIND_LIST,
  ACCEPTED_TYPES,
  uploadsDir,
  ensureUploadsDir,
  extensionForMime,
  expectedSniffedType,
  sniffDocumentType,
  sniffDocumentFile,
  sanitizeOriginalName,
  storedFilePath,
  removeStoredFile,
};
