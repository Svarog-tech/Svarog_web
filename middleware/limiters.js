const rateLimit = require('express-rate-limit');

// Obecný rate limiter pro všechny requesty
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minut
  max: 300, // max 300 requestů za 15 minut (SPA potřebuje více – listing, detail, stats...)
  message: 'Příliš mnoho requestů z této IP, zkuste to později.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Přísnější limiter pro autentizaci
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minut
  max: 5, // max 5 pokusů o přihlášení/registraci
  message: 'Příliš mnoho pokusů o přihlášení, zkuste to za 15 minut.',
  skipSuccessfulRequests: true, // Nezapočítá úspěšné pokusy
  standardHeaders: true,
  legacyHeaders: false,
});

// Limiter pro citlivé operace (MFA, změna hesla)
const sensitiveOpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Příliš mnoho pokusů, zkuste to za 15 minut.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter pro file operace (60 req/min)
const fileOpsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { success: false, error: 'Too many file operations, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// AI Chat rate limiter
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Příliš mnoho požadavků. Zkuste to za chvíli.' }
});

// Domain availability check limiter
const domainCheckLimiter = rateLimit({
  windowMs: 60000,
  max: 20,
  message: { success: false, error: 'Příliš mnoho požadavků. Zkuste to za minutu.' }
});

module.exports = {
  generalLimiter,
  authLimiter,
  sensitiveOpLimiter,
  fileOpsLimiter,
  chatLimiter,
  domainCheckLimiter,
};
