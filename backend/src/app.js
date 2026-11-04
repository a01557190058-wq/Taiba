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
const { apiNotFound, errorHandler } = require('./middleware/errors');

const publicRoutes = require('./routes/public.routes');
const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin');

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy ? 1 : false);

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
          imgSrc: ["'self'", 'data:', 'https:'],
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

  // --- Parsing / transport -------------------------------------------------
  app.use(compression());
  app.use(cors);
  app.use(express.json({ limit: config.limits.jsonBody }));
  app.use(express.urlencoded({ extended: false, limit: config.limits.urlEncodedBody }));
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
  app.use(
    '/assets',
    express.static(path.join(config.paths.frontendWebsite, 'assets'), staticOptions)
  );
  app.use(
    '/admin/assets',
    express.static(path.join(config.paths.frontendAdmin, 'assets'), staticOptions)
  );

  // Every HTML/API response can read the CSRF cookie.
  app.use(issueCsrfToken);

  // --- API -----------------------------------------------------------------
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api', publicRoutes);
  app.use('/api', apiNotFound);

  // --- Pages ---------------------------------------------------------------
  const sendPage = (file) => (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(path.join(config.paths.frontendWebsite, file));
  };
  const sendAdminPage = (file) => (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(path.join(config.paths.frontendAdmin, file));
  };

  app.get('/', sendPage('index.html'));
  app.get('/about', sendPage('about.html'));
  app.get('/departments', sendPage('departments.html'));
  app.get('/student-life', sendPage('student-life.html'));
  app.get('/news', sendPage('news.html'));
  app.get('/news/:slug', sendPage('news-article.html'));
  app.get('/departments/:slug', sendPage('department.html'));
  app.get('/admission', sendPage('admission.html'));
  app.get('/apply', sendPage('apply.html'));

  app.get(['/admin', '/admin/', '/admin/login'], sendAdminPage('login.html'));
  app.get('/admin/dashboard', sendAdminPage('dashboard.html'));
  app.get('/admin/departments', sendAdminPage('departments.html'));
  app.get('/admin/departments/new', sendAdminPage('department-form.html'));
  app.get('/admin/departments/:id/edit', sendAdminPage('department-form.html'));
  app.get('/admin/applications', sendAdminPage('applications.html'));
  app.get('/admin/applications/:id', sendAdminPage('application.html'));
  app.get('/admin/news', sendAdminPage('news.html'));
  app.get('/admin/news/new', sendAdminPage('news-form.html'));
  app.get('/admin/news/:id/edit', sendAdminPage('news-form.html'));
  app.get('/admin/content', sendAdminPage('content.html'));
  app.get('/admin/demo-data', sendAdminPage('demo-data.html'));

  app.get('/robots.txt', (req, res) => {
    res.type('text/plain').send('User-agent: *\nDisallow: /admin\nAllow: /\n');
  });

  // --- 404 & errors --------------------------------------------------------
  app.use((req, res) => {
    res.status(404);
    if (req.path.startsWith('/admin')) {
      return res.sendFile(path.join(config.paths.frontendAdmin, '404.html'));
    }
    return res.sendFile(path.join(config.paths.frontendWebsite, '404.html'));
  });

  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
