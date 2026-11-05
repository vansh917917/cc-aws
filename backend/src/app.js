import express from 'express';
import cors from 'cors';
import { env, validateConfig } from './config/env.js';
import healthRoutes from './routes/healthRoutes.js';
import fileRoutes from './routes/fileRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

validateConfig();

const app = express();

const allowedOrigins = env.CORS_ORIGIN === '*'
  ? '*'
  : env.CORS_ORIGIN.split(',').map((origin) => origin.trim());

app.use(
  cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Disposition']
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`);
  });
  next();
});

app.use('/api/health', healthRoutes);
app.use('/api/files', fileRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint not found: ${req.method} ${req.originalUrl}`
  });
});

app.use(errorHandler);

export default app;
