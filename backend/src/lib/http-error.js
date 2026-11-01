'use strict';

/** Error type used across the API. `status` maps directly to an HTTP code. */
class HttpError extends Error {
  constructor(status, code, message, fields = null) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.expose = true;
  }

  static badRequest(message, fields) {
    return new HttpError(400, 'VALIDATION_ERROR', message, fields);
  }

  static unauthorized(message = 'يجب تسجيل الدخول للمتابعة.') {
    return new HttpError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'لا تملك صلاحية تنفيذ هذا الإجراء.') {
    return new HttpError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'العنصر المطلوب غير موجود.') {
    return new HttpError(404, 'NOT_FOUND', message);
  }

  static conflict(code, message, fields) {
    return new HttpError(409, code, message, fields);
  }

  static tooManyRequests(message = 'عدد المحاولات كبير. يرجى المحاولة لاحقًا.') {
    return new HttpError(429, 'RATE_LIMITED', message);
  }
}

module.exports = HttpError;
