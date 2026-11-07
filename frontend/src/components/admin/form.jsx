/**
 * Small, accessible form primitives shared by the admin forms. Every field
 * renders its own hint/error nodes and wires `aria-describedby` / `aria-invalid`
 * so validation feedback is announced correctly.
 */

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
