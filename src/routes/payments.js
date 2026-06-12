import express from 'express';
import { getRequest, postRequest } from '../utils/postgrest.js';
import logger from '../utils/logger.js';
import moment from 'moment';

const router = express.Router();

/**
 * GET /api/payments - Get all payments
 */
router.get('/', async (req, res) => {
  try {
    const { companyId, invoiceId, limit = 20, offset = 0 } = req.query;

    if (!companyId) {
      return res.status(400).json({
        error: 'Missing required parameter',
        message: 'companyId is required'
      });
    }

    const filters = {
      company_id: `eq.${companyId}`,
      limit,
      offset
    };

    if (invoiceId) filters.invoice_id = `eq.${invoiceId}`;

    const payments = await getRequest('/payments', filters, true, 1800);

    res.json({
      success: true,
      data: payments
    });
  } catch (error) {
    logger.error('Error fetching payments:', error);
    res.status(500).json({
      error: 'Failed to fetch payments',
      message: error.message
    });
  }
});

/**
 * POST /api/payments - Record a payment
 */
router.post('/', async (req, res) => {
  try {
    const { companyId, invoiceId, amount, paymentMethod, paymentDate, transactionReference, notes } = req.body;

    if (!companyId || !invoiceId || !amount || !paymentMethod) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'companyId, invoiceId, amount, and paymentMethod are required'
      });
    }

    const payload = {
      company_id: companyId,
      invoice_id: invoiceId,
      amount,
      payment_method: paymentMethod,
      payment_date: paymentDate || moment().format('YYYY-MM-DD'),
      transaction_reference: transactionReference,
      notes,
      recorded_by_id: req.user?.id
    };

    const response = await postRequest('/payments', payload);

    // Update invoice amount_paid and status
    const invoice = await getRequest(`/invoices?id=eq.${invoiceId}`, {}, false);

    if (invoice && invoice[0]) {
      const newAmountPaid = (invoice[0].amount_paid || 0) + amount;
      const totalAmount = invoice[0].total_amount;
      const newStatus = newAmountPaid >= totalAmount ? 'paid' : 'partially_paid';

      await getRequest(`/invoices?id=eq.${invoiceId}`, {
        amount_paid: newAmountPaid,
        status: newStatus
      }, false);
    }

    res.status(201).json({
      success: true,
      data: response[0],
      message: 'Payment recorded successfully'
    });
  } catch (error) {
    logger.error('Error recording payment:', error);
    res.status(400).json({
      error: 'Failed to record payment',
      message: error.message
    });
  }
});

/**
 * GET /api/payments/invoice/:invoiceId - Get payments for an invoice
 */
router.get('/invoice/:invoiceId', async (req, res) => {
  try {
    const payments = await getRequest('/payments', {
      invoice_id: `eq.${req.params.invoiceId}`
    }, true, 3600);

    res.json({
      success: true,
      data: payments
    });
  } catch (error) {
    logger.error(`Error fetching payments for invoice:`, error);
    res.status(500).json({
      error: 'Failed to fetch payments',
      message: error.message
    });
  }
});

export default router;
