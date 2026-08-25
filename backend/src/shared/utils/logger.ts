import winston from 'winston';
import { env } from '../../config/env.js';

const { combine, timestamp, printf, colorize } = winston.format;

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
  ],
});

export const stream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};
