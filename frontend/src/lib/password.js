/**
 * Password input helpers shared by the admin login form and the account page.
 *
 * Why this exists
 * ---------------
 * On an Arabic keyboard layout the number row types Arabic-Indic digits
 * (`٠١٢٣٤٥٦٧٨٩` = U+0660..U+0669). They look almost identical to `0123456789`
 * but are different characters, so a password typed that way never matched
 * the stored ASCII one — while the exact same password pasted from a document
 * worked. Some editors also insert invisible bidi/zero-width marks.
 *
 * We convert the visible characters to their ASCII form while typing and drop
 * invisible marks. Letter case and spaces are never changed, and nothing is
 * trimmed, so the password the administrator intends is preserved.
 */

const ARABIC_INDIC_DIGITS = /[\u0660-\u0669]/g;
const EXTENDED_ARABIC_INDIC_DIGITS = /[\u06F0-\u06F9]/g;
const INVISIBLE_MARKS = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;

/** bcrypt only reads the first 72 bytes, so longer passwords are rejected. */
export const MAX_PASSWORD_BYTES = 72;

/** Maps Arabic-Indic digits to ASCII digits and removes invisible marks. */
export function normalizePasswordInput(value) {
  return String(value ?? '')
    .replace(ARABIC_INDIC_DIGITS, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(EXTENDED_ARABIC_INDIC_DIGITS, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(INVISIBLE_MARKS, '');
}

/** UTF-8 byte length, matching what the server checks before hashing. */
export function passwordByteLength(value) {
  return new TextEncoder().encode(String(value ?? '')).length;
}

/**
 * Normalises what the user typed and reports what changed, so the form can
 * tell them instead of silently altering their input.
 */
export function cleanPasswordInput(rawValue) {
  const raw = String(rawValue ?? '');
  const value = normalizePasswordInput(raw);
  const notes = [];

  if (/[\u0660-\u0669\u06F0-\u06F9]/.test(raw)) {
    notes.push('تم تحويل الأرقام العربية (٠١٢…) إلى أرقام إنجليزية (012…) تلقائيًا.');
  }
  if (raw.replace(INVISIBLE_MARKS, '').length !== raw.length) {
    notes.push('تم حذف محارف غير مرئية من الكلمة.');
  }

  return { value, notes };
}

/** Characters outside printable ASCII that are still in the password. */
export function findNonAscii(value) {
  return String(value ?? '').match(/[^\x20-\x7E]/g) || [];
}
