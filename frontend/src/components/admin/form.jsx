/**
 * Small, accessible form primitives shared by the admin forms. Every field
 * renders its own hint/error nodes and wires `aria-describedby` / `aria-invalid`
 * so validation feedback is announced correctly.
 */
import { useState } from 'react';
import { Icon } from '../../lib/icons.jsx';
import { cleanPasswordInput, findNonAscii } from '../../lib/password.js';

function FieldShell({ id, label, required, hint, error, full, children }) {
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className={`field${full ? ' field--full' : ''}`}>
      <label htmlFor={id}>
        <span>{label}</span>
        {required ? <span className="req"> *</span> : null}
      </label>
      {children({ hintId })}
      {hint ? (
        <p className="hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      <p className="error-text">{error || ''}</p>
    </div>
  );
}

export function TextField({
  id,
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  hint = '',
  error = '',
  placeholder = '',
  dir,
  maxLength,
  inputMode,
  full = false,
  autoComplete = 'off',
  ...rest
}) {
  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error} full={full}>
      {({ hintId }) => (
        <input
          id={id}
          className="input"
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder || undefined}
          dir={dir || undefined}
          maxLength={maxLength || undefined}
          inputMode={inputMode || undefined}
          autoComplete={autoComplete}
          aria-required={required || undefined}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={hintId}
          {...rest}
        />
      )}
    </FieldShell>
  );
}

/**
 * Password input with a built-in show/hide toggle. The toggle is a real button
 * so it is keyboard accessible, and it never changes the submitted value.
 *
 * Input is normalised through `cleanPasswordInput`, which converts Arabic-Indic
 * digits to ASCII digits and removes invisible marks. Everything else (case,
 * spaces, symbols) is sent exactly as typed.
 */
export function PasswordField({
  id,
  label,
  value,
  onChange,
  onValueChange,
  required = false,
  hint = '',
  error = '',
  autoComplete = 'current-password',
  maxLength,
  full = false,
}) {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [notes, setNotes] = useState([]);

  const toggleLabel = visible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور';

  const emit = (next) => {
    if (onValueChange) onValueChange(next);
    else if (onChange) onChange({ target: { value: next } });
  };

  const handleChange = (event) => {
    const cleaned = cleanPasswordInput(event.target.value);
    setNotes(cleaned.notes);
    emit(cleaned.value);
  };

  const syncCapsLock = (event) => {
    if (typeof event.getModifierState === 'function') {
      setCapsLock(event.getModifierState('CapsLock'));
    }
  };

  const nonAscii = findNonAscii(value);
  const messages = [];
  if (capsLock) messages.push('Caps Lock مفعّل: الحروف تُكتب كبيرة.');
  if (nonAscii.length) {
    messages.push(
      `الكلمة تحتوي على حروف غير إنجليزية (${nonAscii.slice(0, 4).join(' ')}). تأكد أن لوحة المفاتيح على الإنجليزية.`
    );
  }
  messages.push(...notes);

  return (
    <FieldShell
      id={id}
      label={label}
      required={required}
      hint={messages.length ? messages.join(' ') : hint}
      error={error}
      full={full}
    >
      {({ hintId }) => (
        <div className="input-affix">
          <input
            id={id}
            className="input"
            type={visible ? 'text' : 'password'}
            value={value}
            onChange={handleChange}
            onKeyDown={syncCapsLock}
            onKeyUp={syncCapsLock}
            dir="ltr"
            maxLength={maxLength || undefined}
            autoComplete={autoComplete}
            aria-required={required || undefined}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={hintId}
          />
          <button
            type="button"
            className="input-affix__toggle"
            onClick={() => setVisible((current) => !current)}
            aria-label={toggleLabel}
            aria-pressed={visible}
            title={toggleLabel}
          >
            <Icon name={visible ? 'eyeOff' : 'eye'} size={18} />
          </button>
        </div>
      )}
    </FieldShell>
  );
}

export function TextareaField({
  id,
  label,
  value,
  onChange,
  required = false,
  hint = '',
  error = '',
  placeholder = '',
  rows = 5,
  maxLength,
  dir,
  full = false,
}) {
  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error} full={full}>
      {({ hintId }) => (
        <textarea
          id={id}
          className="textarea"
          rows={rows}
          value={value}
          onChange={onChange}
          placeholder={placeholder || undefined}
          dir={dir || undefined}
          maxLength={maxLength || undefined}
          aria-required={required || undefined}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={hintId}
        />
      )}
    </FieldShell>
  );
}

export function CheckboxField({ id, label, hint = '', checked, onChange }) {
  return (
    <div className="field">
      <label className="checkbox" htmlFor={id}>
        <input id={id} type="checkbox" checked={checked} onChange={onChange} />
        <span>
          <strong>{label}</strong>
          {hint ? <span className="hint">{hint}</span> : null}
        </span>
      </label>
    </div>
  );
}

export function FormSection({ title, description, children }) {
  return (
    <section className="panel">
      <div className="panel__head">
        <div>
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      <div className="panel__body">{children}</div>
    </section>
  );
}

/** Client-side slug generation mirroring the backend `slugify` helper. */
export function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 140);
}

/** Converts an ISO timestamp into a value accepted by `datetime-local`. */
export function toLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}
