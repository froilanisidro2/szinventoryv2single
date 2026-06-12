import logger from '../utils/logger.js';
import { getRequest, postRequest, patchRequest } from '../utils/postgrest.js';
import { setInCache, deleteFromCache, getFromCache } from '../utils/cache.js';
import moment from 'moment';

/**
 * Get all products for a company
 */
export const getProducts = async (companyId, filters = {}, limit = 20, offset = 0) => {
  try {
    const cacheKey = `products:${companyId}:${JSON.stringify(filters)}:${limit}:${offset}`;
    const cached = await getFromCache(cacheKey);
    if (cached) return cached;

    const query = {
      company_id: `eq.${companyId}`,
      deleted_at: `is.null`,
      ...filters
    };

    const products = await getRequest('/products', query, true, 1800);

    await setInCache(cacheKey, products, 1800);
    return products;
  } catch (error) {
    logger.error('Error fetching products:', error);
    throw error;
  }
};

/**
 * Get a single product
 */
export const getProduct = async (productId) => {
  try {
    const cacheKey = `product:${productId}`;
    const cached = await getFromCache(cacheKey);
    if (cached) return cached;

    const product = await getRequest(`/products?id=eq.${productId}`, {}, true, 3600);

    if (!product || product.length === 0) {
      throw new Error('Product not found');
    }

    const result = product[0];
    await setInCache(cacheKey, result, 3600);
    return result;
  } catch (error) {
    logger.error(`Error fetching product ${productId}:`, error);
    throw error;
  }
};

/**
 * Create a new product
 */
export const createProduct = async (companyId, productData, userId) => {
  try {
    const payload = {
      company_id: companyId,
      sku: productData.sku,
      name: productData.name,
      description: productData.description || '',
      category_id: productData.categoryId || null,
      unit_of_measure: productData.unitOfMeasure || 'piece',
      purchase_price: productData.purchasePrice || 0,
      selling_price: productData.sellingPrice || 0,
      cost_price: productData.costPrice || 0,
      tax_rate: productData.taxRate || 0,
      reorder_level: productData.reorderLevel || 10,
      reorder_quantity: productData.reorderQuantity || 50,
      image_url: productData.imageUrl || null,
      status: 'active'
    };

    const response = await postRequest('/products', payload);

    // Create stock level record
    if (response && response[0]) {
      await postRequest('/stock_levels', {
        company_id: companyId,
        product_id: response[0].id,
        quantity_on_hand: 0,
        quantity_reserved: 0
      });
    }

    // Clear product cache
    await deleteFromCache(`products:${companyId}`);

    logger.info(`Product created: ${productData.sku}`);
    return response[0];
  } catch (error) {
    logger.error('Error creating product:', error);
    throw error;
  }
};

/**
 * Update product
 */
export const updateProduct = async (productId, productData) => {
  try {
    const response = await patchRequest(`/products?id=eq.${productId}`, {
      ...productData,
      updated_at: moment().toISOString()
    });

    // Clear cache
    await deleteFromCache(`product:${productId}`);

    logger.info(`Product ${productId} updated`);
    return response[0];
  } catch (error) {
    logger.error('Error updating product:', error);
    throw error;
  }
};

/**
 * Get stock levels
 */
export const getStockLevels = async (companyId) => {
  try {
    const cacheKey = `stock_levels:${companyId}`;
    const cached = await getFromCache(cacheKey);
    if (cached) return cached;

    const query = {
      company_id: `eq.${companyId}`
    };

    const stockLevels = await getRequest('/stock_levels', query, true, 1800);

    await setInCache(cacheKey, stockLevels, 1800);
    return stockLevels;
  } catch (error) {
    logger.error('Error fetching stock levels:', error);
    throw error;
  }
};

/**
 * Get stock for a single product
 */
export const getProductStock = async (productId) => {
  try {
    const cacheKey = `stock:${productId}`;
    const cached = await getFromCache(cacheKey);
    if (cached) return cached;

    const stock = await getRequest(`/stock_levels?product_id=eq.${productId}`, {}, true);

    if (!stock || stock.length === 0) {
      throw new Error('Stock not found for product');
    }

    const result = stock[0];
    await setInCache(cacheKey, result, 1800);
    return result;
  } catch (error) {
    logger.error(`Error fetching stock for product ${productId}:`, error);
    throw error;
  }
};

/**
 * Update stock level
 */
export const updateStockLevel = async (productId, quantity) => {
  try {
    const response = await patchRequest(`/stock_levels?product_id=eq.${productId}`, {
      quantity_on_hand: quantity,
      updated_at: moment().toISOString()
    });

    // Clear cache
    await deleteFromCache(`stock:${productId}`);

    logger.info(`Stock updated for product ${productId}: ${quantity}`);
    return response[0];
  } catch (error) {
    logger.error('Error updating stock level:', error);
    throw error;
  }
};

/**
 * Create stock transaction
 */
export const createStockTransaction = async (companyId, productId, transactionType, quantity, referenceType, referenceId, notes, userId) => {
  try {
    const payload = {
      company_id: companyId,
      product_id: productId,
      transaction_type: transactionType,
      quantity: quantity,
      reference_type: referenceType,
      reference_id: referenceId,
      notes: notes || '',
      created_by: userId
    };

    const response = await postRequest('/stock_transactions', payload);

    logger.info(`Stock transaction created: ${transactionType} of ${quantity} units for product ${productId}`);
    return response[0];
  } catch (error) {
    logger.error('Error creating stock transaction:', error);
    throw error;
  }
};

/**
 * Get low stock products
 */
export const getLowStockProducts = async (companyId) => {
  try {
    const cacheKey = `low_stock:${companyId}`;
    const cached = await getFromCache(cacheKey);
    if (cached) return cached;

    const lowStock = await getRequest('/low_stock_products', {
      company_id: `eq.${companyId}`
    }, true, 3600);

    await setInCache(cacheKey, lowStock, 3600);
    return lowStock;
  } catch (error) {
    logger.error('Error fetching low stock products:', error);
    throw error;
  }
};

/**
 * Get inventory value
 */
export const getInventoryValue = async (companyId) => {
  try {
    const cacheKey = `inventory_value:${companyId}`;
    const cached = await getFromCache(cacheKey);
    if (cached) return cached;

    // This uses the PostgreSQL function we created
    const result = await getRequest(`/rpc/get_inventory_value`, {
      p_company_id: companyId
    }, true, 3600);

    await setInCache(cacheKey, result, 3600);
    return result;
  } catch (error) {
    logger.error('Error calculating inventory value:', error);
    return 0;
  }
};

/**
 * Get product categories
 */
export const getProductCategories = async (companyId) => {
  try {
    const cacheKey = `categories:${companyId}`;
    const cached = await getFromCache(cacheKey);
    if (cached) return cached;

    const categories = await getRequest('/product_categories', {
      company_id: `eq.${companyId}`
    }, true, 3600);

    await setInCache(cacheKey, categories, 3600);
    return categories;
  } catch (error) {
    logger.error('Error fetching product categories:', error);
    throw error;
  }
};

/**
 * Create product category
 */
export const createProductCategory = async (companyId, categoryData) => {
  try {
    const payload = {
      company_id: companyId,
      name: categoryData.name,
      description: categoryData.description || '',
      parent_category_id: categoryData.parentCategoryId || null,
      sort_order: categoryData.sortOrder || 0
    };

    const response = await postRequest('/product_categories', payload);

    // Clear cache
    await deleteFromCache(`categories:${companyId}`);

    logger.info(`Product category created: ${categoryData.name}`);
    return response[0];
  } catch (error) {
    logger.error('Error creating product category:', error);
    throw error;
  }
};

export default {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  getStockLevels,
  getProductStock,
  updateStockLevel,
  createStockTransaction,
  getLowStockProducts,
  getInventoryValue,
  getProductCategories,
  createProductCategory
};
