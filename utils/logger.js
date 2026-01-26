/**
 * Strukturované logování pomocí Winston
 * Rotace log souborů, různé úrovně logování
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

// Vytvoř logs složku pokud neexistuje
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Formát pro logy
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console formát pro development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Vytvoř logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: logFormat,
  defaultMeta: { service: 'alatyr-hosting' },
  transports: [
    // Error logy - pouze errors
    new DailyRotateFile({
      filename: path.join(logsDir, 'error-%DATE%.log'),
      level: 'error',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true
    }),
    // Combined logy - všechny úrovně
    new DailyRotateFile({
      filename: path.join(logsDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true
    })
  ],
  // Neukončit proces při chybě v loggeru
  exitOnError: false
});

// V development módu přidat console output
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// Helper metody pro konzistentní logování
logger.request = (req, message, meta = {}) => {
  // SECURITY: Sanitizovat meta data - nesmí obsahovat passwords, tokens, secrets
  const sanitizedMeta = { ...meta };
  const sensitiveKeys = ['password', 'secret', 'token', 'key', 'authorization', 'auth'];
  
  Object.keys(sanitizedMeta).forEach(key => {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
      sanitizedMeta[key] = '[REDACTED]';
    }
  });
  
  logger.info({
    message,
    requestId: req.id,
    method: req.method,
    path: req.path,
    ip: req.ip,
    user: req.user?.id,
    ...sanitizedMeta
  });
};

logger.errorRequest = (req, error, meta = {}) => {
  // SECURITY: Sanitizovat meta data - nesmí obsahovat passwords, tokens, secrets
  const sanitizedMeta = { ...meta };
  const sensitiveKeys = ['password', 'secret', 'token', 'key', 'authorization', 'auth'];
  
  Object.keys(sanitizedMeta).forEach(key => {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
      sanitizedMeta[key] = '[REDACTED]';
    }
  });
  
  logger.error({
    message: error.message,
    stack: error.stack,
    requestId: req.id,
    method: req.method,
    path: req.path,
    ip: req.ip,
    user: req.user?.id,
    ...sanitizedMeta
  });
};

module.exports = logger;
