import winston from 'winston';

const { combine, timestamp, printf, colorize } = winston.format;

const myFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level}]: ${message}`;
});

const logger = winston.createLogger({
  level: 'info',
  format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), myFormat),
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize(), // colors by log level in console
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        myFormat
      ),
    }),
  ],
});

export default logger;
