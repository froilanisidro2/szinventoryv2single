import express from 'express';
import { getCompanyUsers, updateUserProfile, changeUserPassword, deactivateUser } from '../services/userService.js';
import { authorizeRole } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/users - Get all users in company
 */
router.get('/', async (req, res) => {
  try {
    const { companyId, limit = 20, offset = 0 } = req.query;

    if (!companyId) {
      return res.status(400).json({
        error: 'Missing required parameter',
        message: 'companyId is required'
      });
    }

    const users = await getCompanyUsers(companyId, parseInt(limit), parseInt(offset));

    res.json({
      success: true,
      data: users,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: users ? users.length : 0
      }
    });
  } catch (error) {
    logger.error('Error fetching users:', error);
    res.status(500).json({
      error: 'Failed to fetch users',
      message: error.message
    });
  }
});

/**
 * GET /api/users/profile - Get current user profile
 */
router.get('/me', async (req, res) => {
  try {
    res.json({
      success: true,
      data: req.user
    });
  } catch (error) {
    logger.error('Error fetching user profile:', error);
    res.status(500).json({
      error: 'Failed to fetch profile',
      message: error.message
    });
  }
});

/**
 * PATCH /api/users/:id/profile - Update user profile
 */
router.patch('/:id/profile', async (req, res) => {
  try {
    const { firstName, lastName, phone, avatarUrl } = req.body;

    const updatedUser = await updateUserProfile(req.params.id, {
      first_name: firstName,
      last_name: lastName,
      phone,
      avatar_url: avatarUrl
    });

    res.json({
      success: true,
      data: updatedUser,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    logger.error('Error updating user profile:', error);
    res.status(500).json({
      error: 'Failed to update profile',
      message: error.message
    });
  }
});

/**
 * POST /api/users/:id/change-password - Change password
 */
router.post('/:id/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'currentPassword and newPassword are required'
      });
    }

    await changeUserPassword(req.params.id, currentPassword, newPassword);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    logger.error('Error changing password:', error);
    res.status(400).json({
      error: 'Failed to change password',
      message: error.message
    });
  }
});

/**
 * POST /api/users/:id/deactivate - Deactivate user
 */
router.post('/:id/deactivate', authorizeRole(['admin', 'manager']), async (req, res) => {
  try {
    await deactivateUser(req.params.id);

    res.json({
      success: true,
      message: 'User deactivated successfully'
    });
  } catch (error) {
    logger.error('Error deactivating user:', error);
    res.status(500).json({
      error: 'Failed to deactivate user',
      message: error.message
    });
  }
});

export default router;
