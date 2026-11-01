/**
 * Admin fetch wrapper.
 * `request()` returns the full `{ data, meta }` envelope (needed for paginated
 * tables); `api()` returns only `data` for convenience. CSRF handling mirrors
 * the public site: double-submit cookie + `x-csrf-token` header.
 */

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'ERROR', fields = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

function readCookie(name) {
  const prefix = `${name}=`;
  const found = document.cookie.split('; ').find((part) => part.startsWith(prefix));
  return found ? decodeURIComponent(found.slice(prefix.length)) : '';
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

async function perform(path, options) {
  const response = await fetch(path, options);
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    const error = payload && payload.error ? payload.error : {};
    throw new ApiError(error.message || 'تعذّر إكمال الطلب. حاول مرة أخرى.', {
      status: response.status,
      code: error.code || 'ERROR',
      fields: error.fields || null,
    });
  }

  return payload || { data: null };
}

export async function request(path, { method = 'GET', body, headers = {}, retry = true } = {}) {
  const requestHeaders = { Accept: 'application/json', ...headers };
  const options = { method, headers: requestHeaders, credentials: 'same-origin' };

  if (body !== undefined) {
    requestHeaders['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  if (!SAFE_METHODS.has(method)) {
    requestHeaders['X-CSRF-Token'] = readCookie('taiba.csrf');
  }

  try {
    return await perform(path, options);
  } catch (error) {
    if (
      retry &&
      error instanceof ApiError &&
      error.status === 403 &&
      error.code === 'CSRF_TOKEN_INVALID'
    ) {
      await fetch('/api/health', { credentials: 'same-origin' });
      requestHeaders['X-CSRF-Token'] = readCookie('taiba.csrf');
      return perform(path, options);
    }
    throw error;
  }
}

export async function api(path, options) {
  const payload = await request(path, options);
  return Object.prototype.hasOwnProperty.call(payload, 'data') ? payload.data : payload;
}
