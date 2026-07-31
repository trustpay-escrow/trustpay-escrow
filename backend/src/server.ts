import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';

import { env } from './config/env.js';
import { logger, stream } from './utils/logger.js';
import projectsRouter from './routes/projectRoutes.js';
import milestonesRouter from './routes/milestoneRoutes.js';
import usersRouter from './routes/userRoutes.js';
import proposalsRouter from './routes/proposalRoutes.js';

const app = express();

const corsOptions = {
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001', 'http://127.0.0.1:3001'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};
app.use(cors(corsOptions));
// HTTP Request logging with Morgan (piped into Winston)
app.use(morgan('combined', { stream }));

// Security: Set standard HTTP headers
app.use(helmet());

// Security: Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window`
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Security: CORS configuration moved to top

// Parse JSON & URLencoded bodies with increased size limit for file attachments
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// API Routes
app.use('/api/projects', projectsRouter);
app.use('/api/milestones', milestonesRouter);
app.use('/api/users', usersRouter);
app.use('/api/proposals', proposalsRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'TrustPay Escrow API is running securely (TypeScript + Winston Logger)' });
});

// Error handling middleware (catch-all)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error(`Unhandled error: ${err.message}`, { stack: err.stack });
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    error: err.message || 'Something went wrong on the server!',
    details: err.type || err.name || 'ServerError'
  });
});

app.listen(env.port, () => {
  logger.info(`Server listening on port ${env.port} in ${env.nodeEnv} mode`);
});
