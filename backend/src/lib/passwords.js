'use strict';

/**
 * Password hashing and verification.
 *
 * Every place that creates or checks a password (login, change-password, the
 * create-admin script) goes through this module, so a password can never be
 * hashed one way and verified another way.
 *
 * Why normalisation exists
 * ------------------------
 * On an Arabic keyboard layout the number row emits Arabic-Indic digits
 * (`٠١٢٣٤٥٦٧٨٩` = U+0660..U+0669), and some editors insert invisible bidi or
 * zero-width marks. Those characters look identical on screen but are
 * different bytes, so `TaibaSchool2026` typed on an Arabic layout never
 * matched the stored ASCII password — pasting the same text worked, typing it
 * did not. Normalising the *visible* form (Arabic digits -> ASCII digits,
 * dropping invisible control marks) fixes that without trimming spaces or
 * changing letter case.
 *
 * The raw input is always tried first, so any hash that was created before
 * this module existed (including one built from Arabic digits) keeps working.
 */
const bcrypt = require('bcryptjs');
const config = require('../config');

/** bcrypt only reads the first 72 bytes of input; longer input is truncated. */
const MAX_PASSWORD_BYTES = 72;

const ARABIC_INDIC_DIGITS = /[\u0660-\u0669]/g;
const EXTENDED_ARABIC_INDIC_DIGITS = /[\u06F0-\u06F9]/g;
// Zero-width spaces/joiners and bidi control characters: invisible, never
// typed on purpose, and a classic source of "the password looks right but is
// rejected".
const INVISIBLE_MARKS = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;

/** Maps Arabic-Indic digits to ASCII digits and drops invisible marks. */
function normalizePasswordInput(value) {
  return String(value ?? '')
    .replace(ARABIC_INDIC_DIGITS, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(EXTENDED_ARABIC_INDIC_DIGITS, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(INVISIBLE_MARKS, '');
}

/** UTF-8 byte length, which is what bcrypt actually limits. */
function passwordByteLength(value) {
  return Buffer.byteLength(String(value ?? ''), 'utf8');
}

/** Hashes the normalised password with bcrypt. */
function hashPassword(password) {
  const normalized = normalizePasswordInput(password);
  if (!normalized) throw new Error('Password must not be empty.');
  if (passwordByteLength(normalized) > MAX_PASSWORD_BYTES) {
    throw new Error(`Password must not exceed ${MAX_PASSWORD_BYTES} bytes.`);
  }
  return bcrypt.hashSync(normalized, config.security.bcryptRounds);
}

/**
 * Verifies a password against a stored bcrypt hash.
 *
 * Tries the exact bytes first (legacy hashes), then the normalised form (what
 * the dashboard now sends). Returns `false` for malformed hashes instead of
 * throwing, so a corrupt row cannot crash the login route.
 */
function verifyPassword(password, hash) {
  if (typeof hash !== 'string' || hash.length < 20) return false;

  const raw = String(password ?? '');
  try {
    if (bcrypt.compareSync(raw, hash)) return true;
    const normalized = normalizePasswordInput(raw);
    if (normalized === raw) return false;
    return bcrypt.compareSync(normalized, hash);
  } catch {
    return false;
  }
}

module.exports = {
  MAX_PASSWORD_BYTES,
  normalizePasswordInput,
  passwordByteLength,
  hashPassword,
  verifyPassword,
};
