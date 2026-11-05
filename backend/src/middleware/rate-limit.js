'use strict';

const rateLimit = require('express-rate-limit');
const config = require('../config');

const windowMs = config.rateLimits.windowMinutes * 60 * 1000;

const sharedOptions = {
  windowMs,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Every attempt counts, including successful ones. Otherwise a spammer
  // could submit an unlimited number of *valid* applications without ever
  // hitting the limit.
  skipSuccessfulRequests: false,
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: `عدد المحاولات كبير. يرجى الانتظار ${config.rateLimits.windowMinutes} دقيقة قبل المحاولة مجددًا.`,
      },
    });
  },
};

/** Protects the login endpoint from brute-force attempts. */
const loginLimiter = rateLimit({
  ...sharedOptions,
  limit: config.rateLimits.loginMax,
  skipSuccessfulRequests: false,
});

/** Protects the public application form from spam submissions. */
const applicationLimiter = rateLimit({
  ...sharedOptions,
  limit: config.rateLimits.applicationMax,
});

module.exports = { loginLimiter, applicationLimiter };
