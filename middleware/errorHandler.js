/**
 * Centralizované error handling
 * Jednotná struktura error responses
 */

const logger = require('../utils/logger');

/**
 * Custom Error třída pro aplikaci
 */
class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.name = this.constructor.name;
    
    // Zachytit stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error handler middleware
 * Musí být poslední middleware v Express app
 */
const errorHandler = (err, req, res, next) => {
  // Pokud response už byl odeslán, předat dalšímu error handleru
  if (res.headersSent) {
    return next(err);
  }

  // Získat status code
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  // Logovat error
  logger.errorRequest(req, err, {
    statusCode,
    isOperational: err.isOperational !== false
  });

  // Vytvořit error response
  const errorResponse = {
    success: false,
    error: message
  };

  // Přidat validation errors pokud existují
  if (err.validationErrors) {
    errorResponse.validationErrors = err.validationErrors;
  }

  // V development módu přidat stack trace a detaily
  if (process.env.NODE_ENV !== 'production') {
    errorResponse.stack = err.stack;
    errorResponse.details = {
      name: err.name,
      statusCode,
      isOperational: err.isOperational !== false
    };
  }

  // V produkci skrýt detaily pro non-operational errors
  if (process.env.NODE_ENV === 'production' && err.isOperational === false) {
    errorResponse.error = 'Internal server error';
  }

  res.status(statusCode).json(errorResponse);
};

/**
 * Async error wrapper
 * Automaticky zachytí errors z async funkcí
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404 Not Found handler
 */
const notFoundHandler = (req, res, next) => {
  const error = new AppError(`Route ${req.method} ${req.path} not found`, 404);
  next(error);
};

module.exports = {
  AppError,
  errorHandler,
  asyncHandler,
  notFoundHandler
};
