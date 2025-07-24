import app from "./app.js";
import { pool } from "./db.js";
import { client } from "./s3.js";

const PORT = 3000;
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

async function gracefulShutdown() {
  console.log("Received kill signal, shutting down gracefully.");

  // Stop accepting new connections
  server.close(async err => {
    if (err) {
      console.error("Error closing HTTP server:", err);
      process.exit(1);
    }

    try {
      // Wait for all clients in the pool to disconnect
      await pool.end();
      console.log("Database pool has been closed.");

      // Force-close the S3 client socket
      client.destroy();
      console.log("S3 client has been closed.");

      console.log("Shutdown complete; exiting.");
      process.exit(0);
    } catch (shutdownErr) {
      console.error("Error during graceful shutdown:", shutdownErr);
      process.exit(1);
    }
  });
}

// Listen for kill signals
process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);