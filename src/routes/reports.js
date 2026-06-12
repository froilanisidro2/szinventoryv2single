import express from 'express';
import { getRequest } from '../utils/postgrest.js';
import logger from '../utils/logger.js';
import moment from 'moment';

const router = express.Router();

/**
 * GET /api/reports/sales - Get sales report
 */
router.get('/sales', async (req, res) => {
  try {
    const { companyId, startDate, endDate } = req.query;

    if (!companyId) {
      return res.status(400).json({
        error: 'Missing required parameter',
        message: 'companyId is required'
      });
    }

    const filters = {
      company_id: `eq.${companyId}`,
      deleted_at: 'is.null'
    };

    if (startDate) {
      filters.issue_date = `gte.${startDate}`;
    }

    if (endDate) {
      filters.issue_date = `lte.${endDate}`;
    }

    const invoices = await getRequest('/invoices', filters, true, 3600);

    let totalRevenue = 0;
    let totalTax = 0;
    let totalInvoices = 0;
    let paidInvoices = 0;

    (invoices || []).forEach(invoice => {
      totalRevenue += invoice.total_amount || 0;
      totalTax += invoice.tax_amount || 0;
      totalInvoices += 1;
      if (invoice.status === 'paid') paidInvoices += 1;
    });

    res.json({
      success: true,
      data: {
        period: {
          startDate: startDate || 'all-time',
          endDate: endDate || 'all-time'
        },
        summary: {
          totalInvoices,
          paidInvoices,
          outstandingInvoices: totalInvoices - paidInvoices,
          totalRevenue,
          totalTax,
          averageInvoiceValue: totalInvoices > 0 ? totalRevenue / totalInvoices : 0
        }
      }
    });
  } catch (error) {
    logger.error('Error generating sales report:', error);
    res.status(500).json({
      error: 'Failed to generate sales report',
      message: error.message
    });
  }
});

/**
 * GET /api/reports/inventory - Get inventory report
 */
router.get('/inventory', async (req, res) => {
  try {
    const { companyId } = req.query;

    if (!companyId) {
      return res.status(400).json({
        error: 'Missing required parameter',
        message: 'companyId is required'
      });
    }

    const products = await getRequest('/products', {
      company_id: `eq.${companyId}`,
      deleted_at: 'is.null'
    }, true, 3600);

    const stockLevels = await getRequest('/stock_levels', {
      company_id: `eq.${companyId}`
    }, true, 3600);

    let totalProducts = products ? products.length : 0;
    let totalValue = 0;
    let totalOnHand = 0;
    let lowStockCount = 0;

    (stockLevels || []).forEach(stock => {
      const product = products?.find(p => p.id === stock.product_id);
      if (product) {
        totalValue += (stock.quantity_on_hand * (product.cost_price || 0));
        totalOnHand += stock.quantity_on_hand;
        if (stock.quantity_on_hand <= (product.reorder_level || 10)) {
          lowStockCount += 1;
        }
      }
    });

    res.json({
      success: true,
      data: {
        summary: {
          totalProducts,
          lowStockProducts: lowStockCount,
          totalItemsOnHand: totalOnHand,
          totalInventoryValue: totalValue
        }
      }
    });
  } catch (error) {
    logger.error('Error generating inventory report:', error);
    res.status(500).json({
      error: 'Failed to generate inventory report',
      message: error.message
    });
  }
});

/**
 * GET /api/reports/outstanding-invoices - Get outstanding invoices report
 */
router.get('/outstanding-invoices', async (req, res) => {
  try {
    const { companyId } = req.query;

    if (!companyId) {
      return res.status(400).json({
        error: 'Missing required parameter',
        message: 'companyId is required'
      });
    }

    const invoices = await getRequest('/outstanding_invoices', {
      company_id: `eq.${companyId}`
    }, true, 3600);

    let totalOutstanding = 0;
    let totalOverdue = 0;
    let overdueCount = 0;

    (invoices || []).forEach(invoice => {
      totalOutstanding += invoice.amount_due || 0;
      if (invoice.days_overdue > 0) {
        totalOverdue += invoice.amount_due || 0;
        overdueCount += 1;
      }
    });

    res.json({
      success: true,
      data: {
        summary: {
          totalOutstandingInvoices: invoices ? invoices.length : 0,
          totalOutstandingAmount: totalOutstanding,
          overdueInvoices: overdueCount,
          totalOverdueAmount: totalOverdue
        },
        invoices: invoices || []
      }
    });
  } catch (error) {
    logger.error('Error generating outstanding invoices report:', error);
    res.status(500).json({
      error: 'Failed to generate outstanding invoices report',
      message: error.message
    });
  }
});

/**
 * GET /api/reports/customer-analytics - Get customer analytics
 */
router.get('/customer-analytics', async (req, res) => {
  try {
    const { companyId } = req.query;

    if (!companyId) {
      return res.status(400).json({
        error: 'Missing required parameter',
        message: 'companyId is required'
      });
    }

    const customers = await getRequest('/customers', {
      company_id: `eq.${companyId}`,
      deleted_at: 'is.null'
    }, true, 3600);

    const invoices = await getRequest('/invoices', {
      company_id: `eq.${companyId}`,
      deleted_at: 'is.null'
    }, true, 3600);

    res.json({
      success: true,
      data: {
        summary: {
          totalCustomers: customers ? customers.length : 0,
          totalInvoices: invoices ? invoices.length : 0,
          averageInvoicesPerCustomer: (customers && customers.length > 0) ? (invoices ? invoices.length / customers.length : 0) : 0
        }
      }
    });
  } catch (error) {
    logger.error('Error generating customer analytics:', error);
    res.status(500).json({
      error: 'Failed to generate customer analytics',
      message: error.message
    });
  }
});

export default router;
