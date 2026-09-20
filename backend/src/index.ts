import express from 'express';
import { env } from './config/env.js';
import { checkDatabaseConnection } from './config/database.js';
import { errorHandler } from './shared/errors/errorHandler.js';

const app = express();

app.use(express.json());

app.get('/health', async (_req, res, next) => {
  try {
    const dbOk = await checkDatabaseConnection();
    if (!dbOk) {
      res.status(503).json({
        status: 'unhealthy',
        database: 'disconnected',
      });
      return;
    }
    res.status(200).json({
      status: 'ok',
      database: 'connected',
    });
  } catch (err) {
    next(err);
  }
});

app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`Server listening on port ${env.port}`);
});
