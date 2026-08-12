/**
 * Lightweight structured logger for the Aggroso backend.
 * Outputs JSON format to make logs easily searchable in platforms like DataDog or CloudWatch.
 */

const formatMessage = (level, message, meta = {}) => {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta
  });
};

const logger = {
  info: (message, meta) => console.log(formatMessage('INFO', message, meta)),
  warn: (message, meta) => console.warn(formatMessage('WARN', message, meta)),
  error: (message, meta) => console.error(formatMessage('ERROR', message, meta)),
  debug: (message, meta) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(formatMessage('DEBUG', message, meta));
    }
  }
};

module.exports = logger;
