import express from 'express';
import { getProducts, getProduct, createProduct, updateProduct, createProductCategory, getProductCategories } from '../services/inventoryService.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/products - Get all products
 */
router.get('/', async (req, res) => {
  try {
    const { companyId, categoryId, status, limit = 20, offset = 0 } = req.query;

    if (!companyId) {
      return res.status(400).json({
        error: 'Missing required parameter',
        message: 'companyId is required'
      });
    }

    const filters = {};
    if (categoryId) filters.category_id = `eq.${categoryId}`;
    if (status) filters.status = `eq.${status}`;

    const products = await getProducts(companyId, filters, parseInt(limit), parseInt(offset));

    res.json({
      success: true,
      data: products,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: products ? products.length : 0
      }
    });
  } catch (error) {
    logger.error('Error fetching products:', error);
    res.status(500).json({
      error: 'Failed to fetch products',
      message: error.message
    });
  }
});

/**
 * GET /api/products/:id - Get a single product
 */
router.get('/:id', async (req, res) => {
  try {
    const product = await getProduct(req.params.id);

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    logger.error(`Error fetching product ${req.params.id}:`, error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      error: 'Failed to fetch product',
      message: error.message
    });
  }
});

/**
 * POST /api/products - Create a new product
 */
router.post('/', async (req, res) => {
  try {
    const { companyId, sku, name, description, categoryId, sellingPrice, costPrice, taxRate, reorderLevel } = req.body;

    if (!companyId || !sku || !name || !sellingPrice) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'companyId, sku, name, and sellingPrice are required'
      });
    }

    const product = await createProduct(companyId, {
      sku,
      name,
      description,
      categoryId,
      sellingPrice,
      costPrice,
      taxRate,
      reorderLevel
    }, req.user?.id);

    res.status(201).json({
      success: true,
      data: product,
      message: 'Product created successfully'
    });
  } catch (error) {
    logger.error('Error creating product:', error);
    res.status(400).json({
      error: 'Failed to create product',
      message: error.message
    });
  }
});

/**
 * PATCH /api/products/:id - Update a product
 */
router.patch('/:id', async (req, res) => {
  try {
    const product = await updateProduct(req.params.id, req.body);

    res.json({
      success: true,
      data: product,
      message: 'Product updated successfully'
    });
  } catch (error) {
    logger.error(`Error updating product ${req.params.id}:`, error);
    res.status(500).json({
      error: 'Failed to update product',
      message: error.message
    });
  }
});

/**
 * GET /api/products/categories/list - Get all categories
 */
router.get('/categories/list', async (req, res) => {
  try {
    const { companyId } = req.query;

    if (!companyId) {
      return res.status(400).json({
        error: 'Missing required parameter',
        message: 'companyId is required'
      });
    }

    const categories = await getProductCategories(companyId);

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    logger.error('Error fetching categories:', error);
    res.status(500).json({
      error: 'Failed to fetch categories',
      message: error.message
    });
  }
});

/**
 * POST /api/products/categories - Create a product category
 */
router.post('/categories', async (req, res) => {
  try {
    const { companyId, name, description, parentCategoryId } = req.body;

    if (!companyId || !name) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'companyId and name are required'
      });
    }

    const category = await createProductCategory(companyId, {
      name,
      description,
      parentCategoryId
    });

    res.status(201).json({
      success: true,
      data: category,
      message: 'Category created successfully'
    });
  } catch (error) {
    logger.error('Error creating category:', error);
    res.status(400).json({
      error: 'Failed to create category',
      message: error.message
    });
  }
});

export default router;
