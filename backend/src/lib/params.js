'use strict';

const HttpError = require('./http-error');

/** Parse a numeric route parameter, rejecting anything that is not a positive integer. */
function parseId(value, label = 'المعرّف') {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw HttpError.badRequest(`${label} غير صالح.`);
  }
  return id;
}

module.exports = { parseId };
