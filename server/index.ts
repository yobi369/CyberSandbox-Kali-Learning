import { createApiServer } from './app.js';
import { pool } from './database.js';

const port = Number(process.env.PORT ?? 4000);
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');

const server = createApiServer();
server.listen(port, '0.0.0.0', () => {
  console.log(`CyberSandbox API listening on port ${port}`);
});

async function shutdown(signal: string) {
  console.log(`Received ${signal}; shutting down API.`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
