import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './shared/utils/logger.js';
import { startAutoReleaseWorker } from './modules/auto-release/autoRelease.service.js';

app.listen(env.port, () => {
  logger.info(`Server listening on port ${env.port} in ${env.nodeEnv} mode (Modular Domain Architecture)`);
  startAutoReleaseWorker();
});
