/**
 * Input validation middleware
 * Používá express-validator pro konzistentní validaci
 */

const { validationResult, body, param, query } = require('express-validator');
const { AppError } = require('./errorHandler');

/**
 * Middleware pro validaci výsledků
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(err => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value
    }));

    const error = new AppError('Validation failed', 400);
    error.validationErrors = errorMessages;
    throw error;
  }
  
  next();
};

/**
 * Validátory pro GoPay API
 */
const validateCreatePayment = [
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be a positive number greater than 0.01'),
  body('currency')
    .isIn(['CZK', 'EUR', 'USD'])
    .withMessage('Currency must be CZK, EUR, or USD'),
  // BUG FIX: Validátor kontroluje 'orderId', protože handler používá paymentData.orderId
  // (order_number je interní GoPay field, orderId je field z frontendu)
  body('orderId')
    .notEmpty()
    .withMessage('Order ID is required'),
  body('description')
    .optional()
    .isString()
    .isLength({ max: 255 })
    .withMessage('Description must be a string with max 255 characters'),
  body('customerName')
    .optional()
    .isString()
    .withMessage('Customer name must be a string'),
  body('customerEmail')
    .optional()
    .isEmail()
    .withMessage('Customer email must be a valid email'),
  // BUG FIX: returnUrl a notifyUrl jsou povinné pro GoPay API callback
  body('returnUrl')
    .notEmpty()
    .isURL({ 
      protocols: ['http', 'https'],
      require_protocol: true 
    })
    .withMessage('Return URL is required and must be a valid HTTP/HTTPS URL'),
  body('notifyUrl')
    .notEmpty()
    .isURL({ 
      protocols: ['http', 'https'],
      require_protocol: true 
    })
    .withMessage('Notification URL is required and must be a valid HTTP/HTTPS URL'),
  validate
];

/**
 * Validátory pro HestiaCP
 */
const validateCreateAccount = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('domain')
    .isString()
    .notEmpty()
    .matches(/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i)
    .withMessage('Valid domain name is required'),
  body('package')
    .optional()
    .isString()
    .withMessage('Package must be a string'),
  validate
];

/**
 * Validátory pro webhook
 */
const validateWebhook = [
  body('id')
    .notEmpty()
    .withMessage('Payment ID is required'),
  body('state')
    .isIn(['CREATED', 'PAID', 'CANCELED', 'TIMEOUTED', 'REFUNDED', 'PARTIALLY_REFUNDED'])
    .withMessage('Invalid payment state'),
  body('order_number')
    .optional()
    .isString()
    .withMessage('Order number must be a string'),
  validate
];

/**
 * Validátory pro suspend/unsuspend/delete
 */
const validateUsername = [
  body('username')
    .isString()
    .notEmpty()
    .matches(/^[a-z0-9_-]+$/)
    .withMessage('Username must be alphanumeric with underscores and hyphens only'),
  validate
];

/**
 * Validátory pro check payment
 */
const validateCheckPayment = [
  body('paymentId')
    .isString()
    .notEmpty()
    .withMessage('Payment ID is required'),
  validate
];

module.exports = {
  validate,
  validateCreatePayment,
  validateCreateAccount,
  validateWebhook,
  validateUsername,
  validateCheckPayment
};
