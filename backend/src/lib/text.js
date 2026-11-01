'use strict';

/**
 * Text helpers shared by validators and services. They never attempt to
 * "sanitise" HTML by regex: the API stores plain text and every frontend
 * renders it with `textContent`, which is the only safe approach.
 */

// Arabic-Indic and extended Arabic-Indic digits -> ASCII digits
const DIGIT_MAP = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
};

/** Trim, normalise newlines and drop control characters (keeps \n and \t). */
function cleanText(value) {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/\r\n?/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Normalise a phone number to a comparable, storable form. */
function normalizePhone(value) {
  if (!value) return '';
  const converted = String(value)
    .replace(/[٠-٩۰-۹]/g, (digit) => DIGIT_MAP[digit] || digit)
    .replace(/[\s\-().]/g, '');
  return converted;
}

/** Convert a free-text name into a URL-safe slug (works with Arabic). */
function slugify(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 140);
}

/** Turn a newline separated list into a clean array (used for skills). */
function toLines(value) {
  return cleanText(value)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

module.exports = { cleanText, normalizePhone, slugify, toLines };
