import app from './app.js';
import { pool } from './services/db.js';
import { client } from './services/s3.js';
import logger from './utils/logger.js';

const PORT = 3000;
const server = app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});

async function gracefulShutdown() {
  logger.info('Received kill signal, shutting down gracefully.');

  server.close(async () => {
    logger.info('HTTP server closed.');
    try {
      await pool.end();
      logger.info('Database pool has been closed.');

      client.destroy();
      logger.info('S3 client has been closed.');

      logger.info('Graceful shutdown complete.');
    } catch (err) {
      logger.error('Error during graceful shutdown:', err);
      throw err;
    }
  });
}

// Listen for kill signals
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
