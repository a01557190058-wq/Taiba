'use strict';

const crypto = require('node:crypto');

// Ambiguous characters (0/O, 1/I) removed to keep references easy to read.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Build a human-readable, hard-to-guess reference such as TBS-2026-K7M2QX.
 * Uniqueness is guaranteed by the UNIQUE constraint plus a retry loop in the
 * applications service.
 */
function generateReferenceNumber({ year = new Date().getUTCFullYear(), length = 6 } = {}) {
  const bytes = crypto.randomBytes(length);
  let suffix = '';
  for (let i = 0; i < length; i += 1) {
    suffix += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return `TBS-${year}-${suffix}`;
}

module.exports = { generateReferenceNumber };
