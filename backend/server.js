import app from "./app.js";
import { pool } from "./db.js";

const PORT = 3000;
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

const gracefulShutdown = () => {
  console.log("Received kill signal, shutting down gracefully.");
  server.close(() => {
    console.log("Closed out remaining connections.");
    pool.end(() => {
      console.log("Database pool has been closed.");
      process.exit(0);
    });
  });
};

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);
