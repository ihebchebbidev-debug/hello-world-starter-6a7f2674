import path from 'node:path';
import fs from 'node:fs';
import winston from 'winston';
import 'winston-daily-rotate-file';
import { env } from '../config/env.js';

// Resolve a log directory we can always write to.
export const LOG_DIR = process.env.LOG_DIR
  ? path.resolve(process.env.LOG_DIR)
  : path.resolve(process.cwd(), 'logs');

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// File pattern: ecobus-YYYY-MM-DD.log (one file per day, 14 days, 20MB cap)
export const LOG_FILE_PATTERN = 'ecobus-%DATE%.log';

const fileTransport = new winston.transports.DailyRotateFile({
  dirname: LOG_DIR,
  filename: LOG_FILE_PATTERN,
  datePattern: 'YYYY-MM-DD',
  zippedArchive: false,
  maxSize: '20m',
  maxFiles: '14d',
  level: env.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
});

const consoleTransport = new winston.transports.Console({
  level: env.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, requestId, ...meta }) => {
      const rid = requestId ? ` [${requestId}]` : '';
      const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      return `${timestamp} ${level}${rid} ${message}${rest}`;
    }),
  ),
});

export const logger = winston.createLogger({
  level: env.logLevel,
  defaultMeta: { service: 'ecobus-api' },
  transports: [consoleTransport, fileTransport],
});

logger.info(`Logger ready, writing files to ${LOG_DIR}`);
