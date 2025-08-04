import winston from 'winston';

const logger = winston.createLogger({
  level: 'info', // minimum level to log
  format: winston.format.combine(winston.format.timestamp(), winston.format.simple()),
  transports: [
    // new winston.transports.Console(), // log to console
    new winston.transports.File({ filename: 'app.log' }), // log to file
  ],
});

export default logger;
