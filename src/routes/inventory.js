import express from 'express';
import { getStockLevels, getProductStock, updateStockLevel, createStockTransaction, getLowStockProducts, getInventoryValue } from '../services/inventoryService.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/inventory/stock - Get all stock levels
 */
router.get('/stock', async (req, res) => {
  try {
    const { companyId } = req.query;

    if (!companyId) {
      return res.status(400).json({
        error: 'Missing required parameter',
        message: 'companyId is required'
      });
    }

    const stockLevels = await getStockLevels(companyId);

    res.json({
      success: true,
      data: stockLevels
    });
  } catch (error) {
    logger.error('Error fetching stock levels:', error);
    res.status(500).json({
      error: 'Failed to fetch stock levels',
      message: error.message
    });
  }
});

/**
 * GET /api/inventory/stock/:productId - Get stock for a product
 */
router.get('/stock/:productId', async (req, res) => {
  try {
    const stock = await getProductStock(req.params.productId);

    res.json({
      success: true,
      data: stock
    });
  } catch (error) {
    logger.error(`Error fetching stock for product:`, error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      error: 'Failed to fetch stock',
      message: error.message
    });
  }
});

/**
 * PATCH /api/inventory/stock/:productId - Update stock level
 */
router.patch('/stock/:productId', async (req, res) => {
  try {
    const { quantity } = req.body;

    if (quantity === undefined) {
      return res.status(400).json({
        error: 'Missing required field',
        message: 'quantity is required'
      });
    }

    const stock = await updateStockLevel(req.params.productId, quantity);

    res.json({
      success: true,
      data: stock,
      message: 'Stock updated successfully'
    });
  } catch (error) {
    logger.error('Error updating stock:', error);
    res.status(500).json({
      error: 'Failed to update stock',
      message: error.message
    });
  }
});

/**
 * POST /api/inventory/transaction - Create a stock transaction
 */
router.post('/transaction', async (req, res) => {
  try {
    const { companyId, productId, transactionType, quantity, referenceType, referenceId, notes } = req.body;

    if (!companyId || !productId || !transactionType || !quantity) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'companyId, productId, transactionType, and quantity are required'
      });
    }

    const transaction = await createStockTransaction(
      companyId,
      productId,
      transactionType,
      quantity,
      referenceType,
      referenceId,
      notes,
      req.user?.id
    );

    res.status(201).json({
      success: true,
      data: transaction,
      message: 'Stock transaction created successfully'
    });
  } catch (error) {
    logger.error('Error creating stock transaction:', error);
    res.status(400).json({
      error: 'Failed to create transaction',
      message: error.message
    });
  }
});

/**
 * GET /api/inventory/low-stock - Get low stock products
 */
router.get('/low-stock', async (req, res) => {
  try {
    const { companyId } = req.query;

    if (!companyId) {
      return res.status(400).json({
        error: 'Missing required parameter',
        message: 'companyId is required'
      });
    }

    const lowStock = await getLowStockProducts(companyId);

    res.json({
      success: true,
      data: lowStock
    });
  } catch (error) {
    logger.error('Error fetching low stock products:', error);
    res.status(500).json({
      error: 'Failed to fetch low stock products',
      message: error.message
    });
  }
});

/**
 * GET /api/inventory/value - Get inventory value
 */
router.get('/value', async (req, res) => {
  try {
    const { companyId } = req.query;

    if (!companyId) {
      return res.status(400).json({
        error: 'Missing required parameter',
        message: 'companyId is required'
      });
    }

    const value = await getInventoryValue(companyId);

    res.json({
      success: true,
      data: {
        inventory_value: value
      }
    });
  } catch (error) {
    logger.error('Error calculating inventory value:', error);
    res.status(500).json({
      error: 'Failed to calculate inventory value',
      message: error.message
    });
  }
});

export default router;
