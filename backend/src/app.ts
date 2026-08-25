import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';

import { logger, stream } from './shared/utils/logger.js';
import projectsRouter from './modules/projects/project.routes.js';
import milestonesRouter from './modules/milestones/milestone.routes.js';
import usersRouter from './modules/users/user.routes.js';
import proposalsRouter from './modules/proposals/proposal.routes.js';
import notificationsRouter from './modules/notifications/notification.routes.js';

export const app = express();

const corsOptions = {
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001', 'http://127.0.0.1:3001'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(morgan('combined', { stream }));
app.use(helmet());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Feature Domain Module Routes
app.use('/api/projects', projectsRouter);
app.use('/api/milestones', milestonesRouter);
app.use('/api/users', usersRouter);
app.use('/api/proposals', proposalsRouter);
app.use('/api/notifications', notificationsRouter);

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    architecture: 'Modular Domain Architecture',
    message: 'TrustPay Escrow API is running securely'
  });
});

// Centralized Catch-All Error Handler Middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error(`Unhandled error: ${err.message}`, { stack: err.stack });
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    error: err.message || 'Something went wrong on the server!',
    details: err.type || err.name || 'ServerError'
  });
});
