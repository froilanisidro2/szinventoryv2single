import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const API_KEY = process.env.POSTGREST_API_KEY;

/**
 * Verify JWT Token
 */
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    logger.error('JWT verification failed:', error.message);
    return null;
  }
};

/**
 * Generate JWT Token
 */
export const generateToken = (payload, expiresIn = process.env.JWT_EXPIRY || '7d') => {
  try {
    return jwt.sign(payload, JWT_SECRET, { expiresIn });
  } catch (error) {
    logger.error('JWT generation failed:', error.message);
    return null;
  }
};

/**
 * Authentication Middleware - API Key Based
 */
export const authenticateAPI = (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'] || req.headers['api-key'];
    const authHeader = req.headers['authorization'];

    // Check API Key
    if (apiKey && apiKey === API_KEY) {
      req.authenticated = true;
      req.authType = 'api-key';
      return next();
    }

    // Check JWT Token
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);

      if (decoded) {
        req.user = decoded;
        req.authenticated = true;
        req.authType = 'jwt';
        return next();
      }
    }

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid authentication credentials'
    });
  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(500).json({
      error: 'Authentication error',
      message: error.message
    });
  }
};

/**
 * Authentication Middleware - JWT Only
 */
export const authenticateJWT = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing authentication token'
      });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token'
      });
    }

    req.user = decoded;
    req.authenticated = true;
    next();
  } catch (error) {
    logger.error('JWT authentication error:', error);
    return res.status(500).json({
      error: 'Authentication error',
      message: error.message
    });
  }
};

/**
 * Authorization Middleware - Check role
 */
export const authorizeRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'User role not authorized for this action'
      });
    }

    next();
  };
};

/**
 * Hash password
 */
export const hashPassword = async (password) => {
  const bcrypt = (await import('bcryptjs')).default;
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

/**
 * Compare password
 */
export const comparePassword = async (password, hash) => {
  const bcrypt = (await import('bcryptjs')).default;
  return bcrypt.compare(password, hash);
};
