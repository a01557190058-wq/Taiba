import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';

/**
 * Loads the editable school content once per page load and shares it with the
 * header, footer and every public page. Content values are plain text; the
 * static Arabic fallbacks from the original site are used until the request
 * resolves (and if a key is not stored in the database).
 */
const SchoolContentContext = createContext({
  content: {},
  faqs: [],
  objectives: [],
  admissionSteps: [],
  loading: true,
  error: null,
  reload: () => {},
});

export function SchoolContentProvider({ children }) {
  const [state, setState] = useState({
    content: {},
    faqs: [],
    objectives: [],
    admissionSteps: [],
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const data = await api('/api/school-content');
      setState({
        content: data && data.content ? data.content : {},
        faqs: Array.isArray(data && data.faqs) ? data.faqs : [],
        objectives: Array.isArray(data && data.objectives) ? data.objectives : [],
        admissionSteps: Array.isArray(data && data.admission_steps) ? data.admission_steps : [],
        loading: false,
        error: null,
      });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const value = useMemo(() => ({ ...state, reload: load }), [state, load]);
  return <SchoolContentContext.Provider value={value}>{children}</SchoolContentContext.Provider>;
}

export function useSchoolContent() {
  return useContext(SchoolContentContext);
}

/** Returns a stored content string, or the static Arabic fallback. */
export function contentText(content, key, fallback = '') {
  const value = content ? content[key] : undefined;
  return typeof value === 'string' ? value : fallback;
}

/** Contact helpers: build safe tel:/mailto: links from stored values. */
export function phoneHref(phone) {
  const digits = String(phone || '').replace(/[^\d+]/g, '');
  return digits.length >= 7 ? `tel:${digits}` : '';
}

export function emailHref(email) {
  const value = String(email || '').trim();
  return value ? `mailto:${value}` : '';
}
