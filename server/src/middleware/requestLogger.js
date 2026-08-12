const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

const requestLogger = (req, res, next) => {
  const start = Date.now();
  req.id = uuidv4(); // Generate a unique ID for the request

  // Intercept the response finish event to log duration
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    logger.info('API Request', {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs
    });
  });

  next();
};

module.exports = requestLogger;
