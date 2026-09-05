import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import requestIdMiddleware from './middleware/requestId.js';
import healthRoutes from './modules/health/health.routes.js';
import authRoutes from './modules/auth/auth.routes.js';
import exerciseRoutes from './modules/exercise/exercise.routes.js';
import workoutRoutes from './modules/workout/workout.routes.js';
import statsRoutes from './modules/stats/stats.routes.js';
import exportRoutes from './modules/export/export.routes.js';
import errorHandler from './middleware/errorHandler.js';
import favoriteRoutes from './modules/favorite/favorite.routes.js';
import templateRoutes from './modules/template/template.routes.js';
import userRoutes from './modules/user/user.routes.js';
import measurementRoutes from './modules/measurement/measurement.routes.js';

const app = express();

// --- Reverse proxy trust (for X-Forwarded-Proto and HTTPS in production) ---
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// --- Request ID Correlation (Must be first) ---
app.use(requestIdMiddleware);

// --- Security headers ---
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// --- Global middleware ---
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// --- Health check endpoints (root alias & API v1) ---
app.use('/health', healthRoutes);
app.use('/api/v1/health', healthRoutes);

// --- Static media (exercise images) ---
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use('/media/exercises', express.static(path.join(__dirname, '..', '..', 'data', 'free-exercise-db', 'exercises'), {
  maxAge: '30d',
  immutable: true,
}));
app.use('/media/exercises-dataset', express.static(path.join(__dirname, '..', '..', 'data', 'exercises-media'), {
  maxAge: '30d',
  immutable: true,
}));

// --- Routes ---
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/exercises', exerciseRoutes);
app.use('/api/v1/workouts', workoutRoutes);
app.use('/api/v1/stats', statsRoutes);
app.use('/api/v1/export', exportRoutes);
app.use('/api/v1/favorites', favoriteRoutes);
app.use('/api/v1/templates', templateRoutes);
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/measurements', measurementRoutes);

// --- Error handler (must be last) ---
app.use(errorHandler);

export default app;
