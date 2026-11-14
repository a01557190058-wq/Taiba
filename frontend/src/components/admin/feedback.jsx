import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Icon } from '../../lib/icons.jsx';

/**
 * Shared feedback layer for the dashboard: a toast stack and a promise-based
 * confirmation dialog (including typed confirmations for destructive actions).
 * Rendering is plain React — no inline scripts or styles, so the strict CSP is
 * untouched.
 */
const FeedbackContext = createContext(null);

let nextToastId = 0;
let nextDialogId = 0;

export function AdminFeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const timers = useRef(new Set());
  const resolver = useRef(null);

  useEffect(
    () => () => {
      for (const timer of timers.current) window.clearTimeout(timer);
      timers.current.clear();
    },
    []
  );

  const toast = useCallback((message, type = 'success') => {
    const id = (nextToastId += 1);
    setToasts((current) => [...current, { id, message, type, hiding: false }]);

    const hideTimer = window.setTimeout(() => {
      setToasts((current) =>
        current.map((item) => (item.id === id ? { ...item, hiding: true } : item))
      );
      const removeTimer = window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== id));
        timers.current.delete(removeTimer);
      }, 220);
      timers.current.add(removeTimer);
      timers.current.delete(hideTimer);
    }, 4200);

    timers.current.add(hideTimer);
  }, []);

  const confirm = useCallback(
    (options = {}) =>
      new Promise((resolve) => {
        resolver.current = resolve;
        setDialog({ ...options, id: (nextDialogId += 1) });
      }),
    []
  );

  const resolveDialog = useCallback((result) => {
    setDialog(null);
    const pending = resolver.current;
    resolver.current = null;
    if (pending) pending(result);
  }, []);

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      <div className="toast-stack" aria-live="polite">
        {toasts.map((item) => (
          <div
            key={item.id}
            className={`toast${item.type === 'success' ? '' : ` toast--${item.type}`}${
              item.hiding ? ' is-hiding' : ''
            }`}
          >
            <Icon
              name={item.type === 'success' ? 'check' : item.type === 'info' ? 'info' : 'alert'}
              size={18}
            />
            <span>{item.message}</span>
          </div>
        ))}
      </div>

      {dialog ? (
        <ConfirmDialog key={dialog.id} options={dialog} onResolve={resolveDialog} />
      ) : null}
    </FeedbackContext.Provider>
  );
}

function ConfirmDialog({ options, onResolve }) {
  const {
    title = 'تأكيد العملية',
    message = '',
    confirmLabel = 'تأكيد',
    cancelLabel = 'إلغاء',
    danger = false,
    requireText = '',
  } = options;

  const [value, setValue] = useState('');
  const inputRef = useRef(null);
  const confirmRef = useRef(null);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onResolve(false);
    };
    document.addEventListener('keydown', onKey);
    const target = inputRef.current || confirmRef.current;
    if (target) target.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onResolve]);

  const disabled = Boolean(requireText) && value.trim() !== requireText;

  return (
    <div
      className="modal"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onResolve(false);
      }}
    >
      <div className="modal__dialog" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal__head">
          <h2>{title}</h2>
          <button
            className="btn btn-ghost btn-icon"
            type="button"
            aria-label="إغلاق"
            onClick={() => onResolve(false)}
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="modal__body">
          <p>{message}</p>
          {requireText ? (
            <div className="field mt-2">
              <label htmlFor="confirm-text">اكتب «{requireText}» للتأكيد</label>
              <input
                ref={inputRef}
                id="confirm-text"
                className="input"
                type="text"
                value={value}
                placeholder={requireText}
                autoComplete="off"
                dir="ltr"
                onChange={(event) => setValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !disabled) onResolve(true);
                }}
              />
              <p className="hint">
                يبقى زر التأكيد معطّلًا حتى تكتب النص أعلاه بالضبط.
              </p>
            </div>
          ) : null}
        </div>

        <div className="modal__foot">
          <button className="btn btn-outline" type="button" onClick={() => onResolve(false)}>
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            type="button"
            disabled={disabled}
            onClick={() => onResolve(true)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error('useFeedback must be used inside AdminFeedbackProvider');
  return context;
}
