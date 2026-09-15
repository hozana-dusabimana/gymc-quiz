import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env, aiConfigured, storageConfigured, emailConfigured } from './config/env.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { notFoundHandler, errorHandler } from './middleware/error.js';
import { ok } from './utils/response.js';

import authRoutes from './routes/auth.routes.js';
import courseRoutes from './routes/courses.routes.js';
import materialRoutes from './routes/materials.routes.js';
import questionRoutes from './routes/questions.routes.js';
import quizRoutes from './routes/quizzes.routes.js';
import attemptRoutes from './routes/attempts.routes.js';
import resultRoutes from './routes/results.routes.js';
import userRoutes from './routes/users.routes.js';
import notificationRoutes from './routes/notifications.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import fileRoutes from './routes/files.routes.js';
import { storageDriver } from './lib/storage.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin(origin, cb) {
        // allow same-origin / curl (no origin) and configured browser origins
        if (!origin || env.corsOrigins.includes(origin)) return cb(null, true);
        cb(new Error(`Origin ${origin} not allowed by CORS`));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  if (!env.isTest) app.use(morgan(env.isProd ? 'combined' : 'dev'));
  app.use('/api', apiLimiter);

  app.get(['/health', '/api/health'], (_req, res) =>
    ok(res, {
      status: 'ok',
      env: env.nodeEnv,
      time: new Date().toISOString(),
      services: {
        ai: aiConfigured(),
        storage: storageConfigured(),
        storageDriver: storageDriver(),
        email: emailConfigured(),
      },
    }),
  );

  app.use('/api/auth', authRoutes);
  app.use('/api/courses', courseRoutes);
  app.use('/api/materials', materialRoutes);
  app.use('/api/questions', questionRoutes);
  app.use('/api/quizzes', quizRoutes);
  app.use('/api/attempts', attemptRoutes);
  app.use('/api/results', resultRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/files', fileRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
