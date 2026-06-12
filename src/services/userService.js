import logger from '../utils/logger.js';
import { getRequest, postRequest, patchRequest } from '../utils/postgrest.js';
import { deleteFromCache, getFromCache, setInCache } from '../utils/cache.js';
import { generateToken, hashPassword, comparePassword } from '../middleware/auth.js';
import moment from 'moment';

/**
 * Register a new user
 */
export const registerUser = async (companyId, userData) => {
  try {
    // Check if user already exists
    const existingUser = await getRequest('/users', {
      company_id: `eq.${companyId}`,
      email: `eq.${userData.email}`
    }, false);

    if (existingUser && existingUser.length > 0) {
      throw new Error('User with this email already exists');
    }

    // Get role
    const roleResponse = await getRequest('/roles', {
      name: `eq.${userData.role || 'viewer'}`
    }, false);

    if (!roleResponse || roleResponse.length === 0) {
      throw new Error('Invalid role specified');
    }

    const hashedPassword = await hashPassword(userData.password);

    const payload = {
      company_id: companyId,
      email: userData.email,
      phone: userData.phone || null,
      first_name: userData.firstName || '',
      last_name: userData.lastName || '',
      password_hash: hashedPassword,
      role_id: roleResponse[0].id,
      avatar_url: userData.avatarUrl || null,
      status: 'active'
    };

    const response = await postRequest('/users', payload);

    logger.info(`User registered: ${userData.email}`);
    return response[0];
  } catch (error) {
    logger.error('Error registering user:', error);
    throw error;
  }
};

/**
 * Login user
 */
export const loginUser = async (email, password, companyId) => {
  try {
    const users = await getRequest('/users', {
      email: `eq.${email}`,
      company_id: `eq.${companyId}`,
      deleted_at: 'is.null'
    }, false);

    if (!users || users.length === 0) {
      throw new Error('Invalid email or password');
    }

    const user = users[0];

    if (user.status !== 'active') {
      throw new Error('User account is not active');
    }

    const passwordMatch = await comparePassword(password, user.password_hash);

    if (!passwordMatch) {
      throw new Error('Invalid email or password');
    }

    // Get user role
    const roleResponse = await getRequest(`/roles?id=eq.${user.role_id}`, {}, false);
    const role = roleResponse ? roleResponse[0] : null;

    // Update last login
    await patchRequest(`/users?id=eq.${user.id}`, {
      last_login: moment().toISOString()
    });

    // Generate token
    const token = generateToken({
      id: user.id,
      email: user.email,
      companyId: user.company_id,
      role: role?.name || 'viewer'
    });

    // Store session
    await postRequest('/user_sessions', {
      user_id: user.id,
      token_hash: token,
      expires_at: moment().add(7, 'days').toISOString()
    });

    logger.info(`User logged in: ${email}`);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: role?.name || 'viewer',
        status: user.status
      },
      token: token
    };
  } catch (error) {
    logger.error('Error during login:', error);
    throw error;
  }
};

/**
 * Get user by ID
 */
export const getUser = async (userId) => {
  try {
    const cacheKey = `user:${userId}`;
    const cached = await getFromCache(cacheKey);
    if (cached) return cached;

    const users = await getRequest(`/users?id=eq.${userId}`, {}, true, 3600);

    if (!users || users.length === 0) {
      throw new Error('User not found');
    }

    const user = users[0];
    await setInCache(cacheKey, user, 3600);

    return user;
  } catch (error) {
    logger.error(`Error fetching user ${userId}:`, error);
    throw error;
  }
};

/**
 * Get all users in a company
 */
export const getCompanyUsers = async (companyId, limit = 20, offset = 0) => {
  try {
    const cacheKey = `company_users:${companyId}:${limit}:${offset}`;
    const cached = await getFromCache(cacheKey);
    if (cached) return cached;

    const users = await getRequest('/users', {
      company_id: `eq.${companyId}`,
      deleted_at: 'is.null',
      limit: limit,
      offset: offset
    }, true, 1800);

    await setInCache(cacheKey, users, 1800);
    return users;
  } catch (error) {
    logger.error('Error fetching company users:', error);
    throw error;
  }
};

/**
 * Update user profile
 */
export const updateUserProfile = async (userId, userData) => {
  try {
    const updatePayload = {
      ...userData,
      updated_at: moment().toISOString()
    };

    const response = await patchRequest(`/users?id=eq.${userId}`, updatePayload);

    // Clear cache
    await deleteFromCache(`user:${userId}`);

    logger.info(`User ${userId} profile updated`);
    return response[0];
  } catch (error) {
    logger.error('Error updating user profile:', error);
    throw error;
  }
};

/**
 * Change user password
 */
export const changeUserPassword = async (userId, currentPassword, newPassword) => {
  try {
    const user = await getUser(userId);

    const passwordMatch = await comparePassword(currentPassword, user.password_hash);

    if (!passwordMatch) {
      throw new Error('Current password is incorrect');
    }

    const hashedPassword = await hashPassword(newPassword);

    await patchRequest(`/users?id=eq.${userId}`, {
      password_hash: hashedPassword,
      updated_at: moment().toISOString()
    });

    // Clear cache
    await deleteFromCache(`user:${userId}`);

    logger.info(`Password changed for user ${userId}`);
    return true;
  } catch (error) {
    logger.error('Error changing password:', error);
    throw error;
  }
};

/**
 * Deactivate user
 */
export const deactivateUser = async (userId) => {
  try {
    await patchRequest(`/users?id=eq.${userId}`, {
      status: 'inactive',
      updated_at: moment().toISOString()
    });

    // Clear cache
    await deleteFromCache(`user:${userId}`);

    logger.info(`User ${userId} deactivated`);
    return true;
  } catch (error) {
    logger.error('Error deactivating user:', error);
    throw error;
  }
};

/**
 * Get user permissions
 */
export const getUserPermissions = async (roleId) => {
  try {
    const cacheKey = `permissions:${roleId}`;
    const cached = await getFromCache(cacheKey);
    if (cached) return cached;

    const roles = await getRequest(`/roles?id=eq.${roleId}`, {}, true, 3600);

    if (!roles || roles.length === 0) {
      return [];
    }

    const permissions = roles[0].permissions || [];
    await setInCache(cacheKey, permissions, 3600);

    return permissions;
  } catch (error) {
    logger.error('Error fetching user permissions:', error);
    throw error;
  }
};

/**
 * Logout user (invalidate session)
 */
export const logoutUser = async (userId, token) => {
  try {
    // Delete session
    await getRequest(`/user_sessions?token_hash=eq.${token}`, {
      deleted_at: `is.null`
    }, false);

    logger.info(`User ${userId} logged out`);
    return true;
  } catch (error) {
    logger.error('Error during logout:', error);
    throw error;
  }
};

export default {
  registerUser,
  loginUser,
  getUser,
  getCompanyUsers,
  updateUserProfile,
  changeUserPassword,
  deactivateUser,
  getUserPermissions,
  logoutUser
};
