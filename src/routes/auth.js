import express from 'express';
import { loginUser, registerUser } from '../services/userService.js';
import { authenticateJWT } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password, companyId } = req.body;

    if (!email || !password || !companyId) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Email, password, and companyId are required'
      });
    }

    const result = await loginUser(email, password, companyId);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(401).json({
      error: 'Authentication failed',
      message: error.message
    });
  }
});

/**
 * POST /api/auth/register
 */
router.post('/register', async (req, res) => {
  try {
    const { companyId, email, firstName, lastName, password, phone, role } = req.body;

    if (!companyId || !email || !password || !firstName || !lastName) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'companyId, email, password, firstName, and lastName are required'
      });
    }

    const user = await registerUser(companyId, {
      email,
      firstName,
      lastName,
      password,
      phone,
      role: role || 'viewer'
    });

    res.status(201).json({
      success: true,
      data: user,
      message: 'User registered successfully'
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(400).json({
      error: 'Registration failed',
      message: error.message
    });
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', authenticateJWT, async (req, res) => {
  try {
    // Token is invalidated by client anyway
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      error: 'Logout failed',
      message: error.message
    });
  }
});

/**
 * GET /api/auth/verify
 */
router.get('/verify', authenticateJWT, async (req, res) => {
  try {
    res.json({
      success: true,
      data: req.user,
      message: 'Token is valid'
    });
  } catch (error) {
    logger.error('Token verification error:', error);
    res.status(500).json({
      error: 'Verification failed',
      message: error.message
    });
  }
});

export default router;
