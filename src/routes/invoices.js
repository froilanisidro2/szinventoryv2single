import express from 'express';
import { createInvoice, addInvoiceItems, getInvoiceDetails, generateInvoicePDF, updateInvoiceStatus } from '../services/invoiceService.js';
import { getRequest } from '../utils/postgrest.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/invoices - Get all invoices
 */
router.get('/', async (req, res) => {
  try {
    const { companyId, customerId, status, limit = 20, offset = 0 } = req.query;

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

    if (customerId) filters.customer_id = `eq.${customerId}`;
    if (status) filters.status = `eq.${status}`;

    const invoices = await getRequest('/invoices', filters, true, 1800);

    res.json({
      success: true,
      data: invoices,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: invoices ? invoices.length : 0
      }
    });
  } catch (error) {
    logger.error('Error fetching invoices:', error);
    res.status(500).json({
      error: 'Failed to fetch invoices',
      message: error.message
    });
  }
});

/**
 * GET /api/invoices/:id - Get invoice details
 */
router.get('/:id', async (req, res) => {
  try {
    const invoice = await getInvoiceDetails(req.params.id);

    res.json({
      success: true,
      data: invoice
    });
  } catch (error) {
    logger.error(`Error fetching invoice ${req.params.id}:`, error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      error: 'Failed to fetch invoice',
      message: error.message
    });
  }
});

/**
 * POST /api/invoices - Create a new invoice
 */
router.post('/', async (req, res) => {
  try {
    const { companyId, customerId, issueDate, dueDate, billingAddress, shippingAddress, notes, items } = req.body;

    if (!companyId) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'companyId is required'
      });
    }

    const invoice = await createInvoice(companyId, {
      customerId,
      issueDate,
      dueDate,
      billingAddress,
      shippingAddress,
      notes
    }, req.user?.id);

    // Add line items if provided
    if (items && items.length > 0) {
      await addInvoiceItems(invoice.id, items);
    }

    const fullInvoice = await getInvoiceDetails(invoice.id);

    res.status(201).json({
      success: true,
      data: fullInvoice,
      message: 'Invoice created successfully'
    });
  } catch (error) {
    logger.error('Error creating invoice:', error);
    res.status(400).json({
      error: 'Failed to create invoice',
      message: error.message
    });
  }
});

/**
 * PATCH /api/invoices/:id/status - Update invoice status
 */
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        error: 'Missing required field',
        message: 'status is required'
      });
    }

    await updateInvoiceStatus(req.params.id, status);

    const invoice = await getInvoiceDetails(req.params.id);

    res.json({
      success: true,
      data: invoice,
      message: 'Invoice status updated'
    });
  } catch (error) {
    logger.error(`Error updating invoice status:`, error);
    res.status(500).json({
      error: 'Failed to update invoice status',
      message: error.message
    });
  }
});

/**
 * POST /api/invoices/:id/items - Add items to invoice
 */
router.post('/:id/items', async (req, res) => {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'items array is required'
      });
    }

    await addInvoiceItems(req.params.id, items);

    const invoice = await getInvoiceDetails(req.params.id);

    res.json({
      success: true,
      data: invoice,
      message: 'Items added to invoice'
    });
  } catch (error) {
    logger.error('Error adding invoice items:', error);
    res.status(400).json({
      error: 'Failed to add items',
      message: error.message
    });
  }
});

/**
 * GET /api/invoices/:id/pdf - Generate PDF invoice
 */
router.get('/:id/pdf', async (req, res) => {
  try {
    const invoice = await getInvoiceDetails(req.params.id);

    const pdfBuffer = await generateInvoicePDF(invoice);

    res.contentType('application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Invoice-${invoice.invoice_number}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    logger.error(`Error generating invoice PDF:`, error);
    res.status(500).json({
      error: 'Failed to generate PDF',
      message: error.message
    });
  }
});

/**
 * GET /api/invoices/summary/outstanding - Get outstanding invoices
 */
router.get('/summary/outstanding', async (req, res) => {
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

    res.json({
      success: true,
      data: invoices
    });
  } catch (error) {
    logger.error('Error fetching outstanding invoices:', error);
    res.status(500).json({
      error: 'Failed to fetch outstanding invoices',
      message: error.message
    });
  }
});

export default router;
