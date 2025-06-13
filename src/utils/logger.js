// Logger utility for consistent logging throughout the application
const winston = require('winston');

/**
 * Create a configured logger instance
 * @returns {winston.Logger} Configured winston logger
 */
function createLogger() {
  const logFormat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
    let metaStr = '';
    if (Object.keys(metadata).length > 0) {
      metaStr = JSON.stringify(metadata);
    }
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  });

  const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
      logFormat
    ),
    transports: [
      // Console transport for all environments
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          logFormat
        ),
      }),
      // File transport for non-development environments
      ...(process.env.NODE_ENV !== 'development' ? [
        new winston.transports.File({ 
          filename: 'logs/error.log', 
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        }),
        new winston.transports.File({ 
          filename: 'logs/combined.log',
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        })
      ] : []),
    ],
    exitOnError: false,
  });

  return logger;
}

module.exports = {
  createLogger,
}; 