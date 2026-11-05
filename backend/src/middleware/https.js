'use strict';

const config = require('../config');

/**
 * True when the original client request used HTTPS.
 *
 * TLS normally terminates at a reverse proxy (Cloudflare tunnel, Render,
 * Nginx), so `req.secure` is only reliable when `trust proxy` is enabled. The
 * X-Forwarded-Proto header is used as a fallback to avoid a redirect loop on a
 * misconfigured proxy. A direct client could spoof that header, but that only
 * keeps its own request on HTTP, where the Secure session/CSRF cookies are
 * rejected by the browser, so it gains nothing.
 */
function isSecureRequest(req) {
  if (req.secure) return true;
  const forwarded = req.get('x-forwarded-proto');
  if (!forwarded) return false;
  return forwarded.split(',')[0].trim().toLowerCase() === 'https';
}

/**
 * Redirects insecure requests to HTTPS. Mounted only in production.
 *
 * - `/api/health` stays reachable over HTTP so platform health checks that do
 *   not follow redirects keep working; it exposes no sensitive data.
 * - The configured https APP_ORIGIN is preferred for the redirect target. If it
 *   is not set to https, a strictly validated Host header is used instead, which
 *   prevents host-header injection into the Location header.
 * - The redirect is never cached, so a spoofed Host cannot poison a shared cache.
 */
function forceHttps(req, res, next) {
  if (isSecureRequest(req) || req.path === '/api/health') return next();

  const host = req.get('host') || '';
  if (!/^[a-z0-9.-]+(?::\d+)?$/i.test(host)) return next();

  let origin = null;
  try {
    const configured = new URL(config.appOrigin);
    if (configured.protocol === 'https:') origin = configured.origin;
  } catch {
    /* fall back to the validated Host header */
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.redirect(308, `${origin || `https://${host}`}${req.originalUrl}`);
}

module.exports = { forceHttps };
