import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import projectsRouter from './routes/projects.js';
import milestonesRouter from './routes/milestones.js';
import usersRouter from './routes/users.js';

// Load environment variables
dotenv.config();

const app = express();

// Security: Set standard HTTP headers
app.use(helmet());

// Security: Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use(limiter);

// Security: CORS configuration
const corsOptions = {
  origin: 'http://localhost:3000', // Allow only the Next.js frontend for now
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));

// Parse JSON bodies
app.use(express.json());

// API Routes
app.use('/api/projects', projectsRouter);
app.use('/api/milestones', milestonesRouter);
app.use('/api/users', usersRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'TrustPay Escrow API is running securely' });
});

// Error handling middleware (catch-all)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong on the server!' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
