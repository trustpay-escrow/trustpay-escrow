import winston from 'winston';
import { env } from '../config/env.js';

const { combine, timestamp, printf, colorize } = winston.format;

// Define custom log format
const myFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

export const logger = winston.createLogger({
  level: env.nodeEnv === 'development' ? 'debug' : 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    env.nodeEnv === 'development' ? colorize() : winston.format.uncolorize(),
    myFormat
  ),
  transports: [
    new winston.transports.Console(),
    // Optionally add file transports here for production
    // new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    // new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// A stream object for Morgan integration
export const stream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};
