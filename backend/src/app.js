'use strict';

const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const session = require('express-session');

const config = require('./config');
const SqliteSessionStore = require('./db/session-store');
const { attachAdmin } = require('./middleware/auth');
const { issueCsrfToken, requireCsrf } = require('./middleware/csrf');
const { cors } = require('./middleware/cors');
const { forceHttps } = require('./middleware/https');
const { apiNotFound, errorHandler } = require('./middleware/errors');

const publicRoutes = require('./routes/public.routes');
const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin');

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy ? 1 : false);
  // The "simple" parser keeps `req.query` flat and avoids the qs nesting/
  // prototype-pollution surface of the default extended parser.
  app.set('query parser', 'simple');

  // Production is always served over HTTPS. Without this, a visitor who opens
  // the http:// link would never receive the Secure session/CSRF cookies and
  // could not log in to the admin dashboard.
  if (config.isProduction) {
    app.use(forceHttps);
  }

  // --- Security headers ----------------------------------------------------
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          mediaSrc: ["'self'", 'https:'],
          fontSrc: ["'self'"],
          connectSrc: ["'self'"],
          formAction: ["'self'"],
          // Only the video providers supported by the news editor may be
          // embedded. No arbitrary third-party frames.
          frameSrc: [
            'https://www.youtube-nocookie.com',
            'https://www.youtube.com',
            'https://player.vimeo.com',
          ],
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"],
          ...(config.isProduction ? { upgradeInsecureRequests: [] } : {}),
        },
      },
      hsts: config.isProduction ? undefined : false,
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    })
  );

  // Helmet 8 no longer ships a Permissions-Policy helper, so set it directly.
  // Only sensitive capabilities are disabled; fullscreen stays available for
  // the embedded video players.
  app.use((req, res, next) => {
    res.setHeader(
      'Permissions-Policy',
      'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=()'
    );
    next();
  });

  // --- Parsing / transport -------------------------------------------------
  app.use(compression());
  app.use(cors);
  app.use(express.json({ limit: config.limits.jsonBody }));
  app.use(
    express.urlencoded({
      extended: false,
      limit: config.limits.urlEncodedBody,
      parameterLimit: config.limits.formFields,
    })
  );
  app.use(cookieParser());

  // --- Sessions (server-side, persisted in SQLite) -------------------------
  app.use(
    session({
      name: config.session.name,
      secret: config.session.secret,
      store: new SqliteSessionStore({ defaultTtlMs: config.session.ttlHours * 60 * 60 * 1000 }),
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.isProduction,
        maxAge: config.session.ttlHours * 60 * 60 * 1000,
        path: '/',
      },
    })
  );

  app.use(attachAdmin);

  // --- Static assets -------------------------------------------------------
  // Production keeps a short cache window; development always revalidates so
  // edited styles/scripts show up immediately while working on the project.
  const staticOptions = {
    maxAge: config.isProduction ? '1h' : 0,
    setHeaders(res) {
      if (!config.isProduction) res.setHeader('Cache-Control', 'no-store');
    },
    fallthrough: true,
  };
  // User-uploaded news images are runtime data, mounted before the built
  // assets so they are served from the persistent `uploads/` folder.
  app.use(
    '/assets/uploads/news',
    express.static(config.paths.newsUploads, staticOptions)
  );
  // Photos uploaded from the gallery dashboard.
  app.use(
    '/assets/uploads/gallery',
    express.static(config.paths.galleryUploads, staticOptions)
  );
  // Department covers and photos uploaded from the dashboard.
  app.use(
    '/assets/uploads/departments',
    express.static(config.paths.departmentUploads, staticOptions)
  );
  // Hashed Vite output (JS/CSS/fonts/images) shared by both React apps.
  app.use(
    '/assets',
    express.static(path.join(config.paths.frontendDist, 'assets'), staticOptions)
  );

  // Every HTML/API response can read the CSRF cookie.
  app.use(issueCsrfToken);

  // --- API -----------------------------------------------------------------
  // API responses may contain personal data or session state: never let a
  // browser, proxy or shared cache store them.
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api', publicRoutes);
  app.use('/api', apiNotFound);

  // --- Pages ---------------------------------------------------------------
  // Both apps are React single-page applications served from `frontend/dist`.
  // The server only returns the correct HTML shell; routing and rendering
  // happen in the browser. HTML is never cached so deploys take effect at once.
  const sendPublicApp = (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(path.join(config.paths.frontendDist, 'index.html'));
  };
  const sendAdminApp = (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(path.join(config.paths.frontendDist, 'admin', 'index.html'));
  };

  // Public routes that exist in the client-side router (200). Any other path
  // still gets the public shell so React can render its "not found" page, but
  // with a 404 status for crawlers.
  app.get(
    [
      '/',
      '/about',
      '/departments',
      '/departments/:slug',
      '/subjects',
      '/news',
      '/news/:slug',
      '/gallery',
      '/admission',
      '/apply',
      '/contact',
    ],
    sendPublicApp
  );

  // The whole admin dashboard (including /admin/login and deep links).
  app.get(['/admin', '/admin/*'], sendAdminApp);

  app.get('/robots.txt', (req, res) => {
    res.type('text/plain').send('User-agent: *\nDisallow: /admin\nAllow: /\n');
  });

  // --- 404 & errors --------------------------------------------------------
  app.use((req, res) => {
    res.status(404);
    res.setHeader('Cache-Control', 'no-store');
    return res.sendFile(path.join(config.paths.frontendDist, 'index.html'));
  });

  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
