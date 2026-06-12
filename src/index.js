import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import logger from './utils/logger.js';
import { authenticateAPI } from './middleware/auth.js';
import {
  responseCacheMiddleware,
  cacheControlMiddleware,
  conditionalRequestMiddleware,
  cacheBusterMiddleware
} from './utils/caching.js';
import userRoutes from './routes/users.js';
import productRoutes from './routes/products.js';
import invoiceRoutes from './routes/invoices.js';
import customerRoutes from './routes/customers.js';
import paymentRoutes from './routes/payments.js';
import authRoutes from './routes/auth.js';
import inventoryRoutes from './routes/inventory.js';
import reportRoutes from './routes/reports.js';
import cacheRoutes from './routes/cache.js';

// Load environment variables
dotenv.config({ path: '.env.local' });

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes.'
});
app.use('/api/', limiter);

// Body Parsing Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Caching Middleware
app.use(cacheBusterMiddleware);
app.use(cacheControlMiddleware);
app.use(conditionalRequestMiddleware);

// Logging Middleware
app.use((req, res, next) => {
  logger.info({
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip
  });
  next();
});

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '1.0.0'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authenticateAPI, userRoutes);
app.use('/api/products', authenticateAPI, responseCacheMiddleware(1800), productRoutes);
app.use('/api/customers', authenticateAPI, responseCacheMiddleware(3600), customerRoutes);
app.use('/api/invoices', authenticateAPI, responseCacheMiddleware(3600), invoiceRoutes);
app.use('/api/payments', authenticateAPI, responseCacheMiddleware(1800), paymentRoutes);
app.use('/api/inventory', authenticateAPI, responseCacheMiddleware(1800), inventoryRoutes);
app.use('/api/reports', authenticateAPI, responseCacheMiddleware(3600), reportRoutes);
app.use('/api/cache', authenticateAPI, cacheRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
    method: req.method
  });
});

// Error Handler
app.use((err, req, res, next) => {
  logger.error(err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start Server
app.listen(PORT, () => {
  logger.info(`🚀 Server running on http://localhost:${PORT}`);
  logger.info(`📊 Inventory System initialized`);
  logger.info(`🔗 PostgREST API: ${process.env.POSTGREST_URL}`);
});

export default app;
