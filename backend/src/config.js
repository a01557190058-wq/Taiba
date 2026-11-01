'use strict';

/**
 * Centralised configuration. Every value can be overridden through the
 * environment (see ../.env.example). Secrets are never hardcoded: in
 * production a SESSION_SECRET is mandatory, in development a random one is
 * generated at boot.
 */
const path = require('node:path');
const crypto = require('node:crypto');

const BACKEND_ROOT = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(BACKEND_ROOT, '..');

// Load backend/.env (if present) before reading process.env.
require('dotenv').config({ path: path.join(BACKEND_ROOT, '.env') });

function bool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function int(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

function resolveDbPath() {
  const configured = process.env.DB_PATH || '../database/taiba.sqlite';
  return path.isAbsolute(configured)
    ? configured
    : path.resolve(BACKEND_ROOT, configured);
}

let sessionSecret = process.env.SESSION_SECRET || '';
if (!sessionSecret) {
  if (isProduction) {
    throw new Error(
      'SESSION_SECRET must be set in production. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'
    );
  }
  sessionSecret = crypto.randomBytes(48).toString('hex');
  // eslint-disable-next-line no-console
  console.warn('[config] SESSION_SECRET is not set - using an ephemeral development secret.');
}

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const config = {
  env: nodeEnv,
  isProduction,
  host: process.env.HOST || '127.0.0.1',
  port: int(process.env.PORT, 3000),
  appOrigin: process.env.APP_ORIGIN || `http://127.0.0.1:${int(process.env.PORT, 3000)}`,
  paths: {
    backend: BACKEND_ROOT,
    project: PROJECT_ROOT,
    frontendWebsite: path.join(PROJECT_ROOT, 'frontend', 'website'),
    frontendAdmin: path.join(PROJECT_ROOT, 'frontend', 'admin'),
    databaseDir: path.join(PROJECT_ROOT, 'database'),
    schema: path.join(PROJECT_ROOT, 'database', 'schema.sql'),
    db: resolveDbPath(),
  },
  session: {
    name: 'taiba.sid',
    secret: sessionSecret,
    ttlHours: int(process.env.SESSION_TTL_HOURS, 8),
  },
  csrf: {
    cookieName: 'taiba.csrf',
    headerName: 'x-csrf-token',
    maxAgeHours: 12,
  },
  rateLimits: {
    windowMinutes: int(process.env.RATE_LIMIT_WINDOW_MINUTES, 15),
    loginMax: int(process.env.LOGIN_RATE_LIMIT_MAX, 10),
    applicationMax: int(process.env.APPLICATION_RATE_LIMIT_MAX, 5),
  },
  trustProxy: bool(process.env.TRUST_PROXY, false),
  allowedOrigins,
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    email: process.env.ADMIN_EMAIL || 'admin@taiba.demo',
    password: process.env.ADMIN_PASSWORD || '',
  },
  limits: {
    jsonBody: '100kb',
    urlEncodedBody: '50kb',
    formFields: 100,
  },
};

module.exports = config;
