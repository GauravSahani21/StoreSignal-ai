import { buildApp } from './app.js';
import { loadEnv } from './config/env.js';

async function startServer(): Promise<void> {
  const env = loadEnv();
  const app = await buildApp({ env });

  const closeGracefully = async (signal: string) => {
    app.log.info(`Received ${signal}, closing application gracefully...`);
    try {
      await app.close();
      app.log.info('Application closed cleanly.');
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, 'Error during application shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => void closeGracefully('SIGINT'));
  process.on('SIGTERM', () => void closeGracefully('SIGTERM'));

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    app.log.info(`StoreSignal API listening on http://0.0.0.0:${env.PORT} in ${env.NODE_ENV} mode`);
  } catch (err) {
    app.log.error({ err }, 'Failed to start StoreSignal API server');
    process.exit(1);
  }
}

void startServer();
