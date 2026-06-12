import express from 'express';
import { getRequest, postRequest, patchRequest } from '../utils/postgrest.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/customers - Get all customers
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

    const customers = await getRequest('/customers', {
      company_id: `eq.${companyId}`,
      deleted_at: 'is.null',
      limit,
      offset
    }, true, 1800);

    res.json({
      success: true,
      data: customers
    });
  } catch (error) {
    logger.error('Error fetching customers:', error);
    res.status(500).json({
      error: 'Failed to fetch customers',
      message: error.message
    });
  }
});

/**
 * GET /api/customers/:id - Get a single customer
 */
router.get('/:id', async (req, res) => {
  try {
    const customer = await getRequest(`/customers?id=eq.${req.params.id}`, {}, true, 3600);

    if (!customer || customer.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Customer not found'
      });
    }

    res.json({
      success: true,
      data: customer[0]
    });
  } catch (error) {
    logger.error(`Error fetching customer ${req.params.id}:`, error);
    res.status(500).json({
      error: 'Failed to fetch customer',
      message: error.message
    });
  }
});

/**
 * POST /api/customers - Create a new customer
 */
router.post('/', async (req, res) => {
  try {
    const { companyId, name, email, phone, billingAddress, taxId, notes } = req.body;

    if (!companyId || !name) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'companyId and name are required'
      });
    }

    // Generate customer code
    const customers = await getRequest('/customers', {
      company_id: `eq.${companyId}`,
      order: 'customer_code.desc',
      limit: 1
    }, false);

    let nextCode = 'CUST-001';
    if (customers && customers.length > 0) {
      const lastCode = parseInt(customers[0].customer_code.split('-')[1]) + 1;
      nextCode = `CUST-${String(lastCode).padStart(3, '0')}`;
    }

    const payload = {
      company_id: companyId,
      customer_code: nextCode,
      name,
      email,
      phone,
      billing_address: billingAddress,
      tax_id: taxId,
      notes,
      status: 'active'
    };

    const response = await postRequest('/customers', payload);

    res.status(201).json({
      success: true,
      data: response[0],
      message: 'Customer created successfully'
    });
  } catch (error) {
    logger.error('Error creating customer:', error);
    res.status(400).json({
      error: 'Failed to create customer',
      message: error.message
    });
  }
});

/**
 * PATCH /api/customers/:id - Update a customer
 */
router.patch('/:id', async (req, res) => {
  try {
    const response = await patchRequest(`/customers?id=eq.${req.params.id}`, req.body);

    res.json({
      success: true,
      data: response[0],
      message: 'Customer updated successfully'
    });
  } catch (error) {
    logger.error(`Error updating customer ${req.params.id}:`, error);
    res.status(500).json({
      error: 'Failed to update customer',
      message: error.message
    });
  }
});

export default router;
