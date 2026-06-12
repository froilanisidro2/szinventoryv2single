import PDFDocument from 'pdfkit';
import logger from '../utils/logger.js';
import { getRequest, patchRequest, postRequest } from '../utils/postgrest.js';
import { setInCache, deleteFromCache } from '../utils/cache.js';
import moment from 'moment';
import { v4 as uuidv4 } from 'uuid';

/**
 * Generate next invoice number
 */
export const generateInvoiceNumber = async (companyId) => {
  try {
    const prefix = process.env.INVOICE_PREFIX || 'INV';
    const startNumber = parseInt(process.env.INVOICE_STARTING_NUMBER || '1000');
    
    // Get the latest invoice number
    const invoices = await getRequest('/invoices', {
      company_id: `eq.${companyId}`,
      order: 'invoice_number.desc',
      limit: 1
    }, false);

    let nextNumber = startNumber;
    if (invoices && invoices.length > 0) {
      const lastInvoice = invoices[0];
      const lastNumber = parseInt(lastInvoice.invoice_number.replace(prefix, ''));
      nextNumber = lastNumber + 1;
    }

    return `${prefix}-${String(nextNumber).padStart(6, '0')}-${moment().format('YYYY')}`;
  } catch (error) {
    logger.error('Error generating invoice number:', error);
    throw error;
  }
};

/**
 * Create a new invoice
 */
export const createInvoice = async (companyId, invoiceData, userId) => {
  try {
    const invoiceNumber = await generateInvoiceNumber(companyId);

    const payload = {
      company_id: companyId,
      invoice_number: invoiceNumber,
      customer_id: invoiceData.customerId,
      issued_by_id: userId,
      issue_date: invoiceData.issueDate || moment().format('YYYY-MM-DD'),
      due_date: invoiceData.dueDate || moment().add(parseInt(process.env.INVOICE_DUE_DAYS || 30), 'days').format('YYYY-MM-DD'),
      billing_address: invoiceData.billingAddress,
      shipping_address: invoiceData.shippingAddress,
      status: 'draft',
      notes: invoiceData.notes || '',
      currency_code: invoiceData.currencyCode || 'USD'
    };

    const response = await postRequest('/invoices', payload);
    logger.info(`Invoice created: ${invoiceNumber}`);

    return response[0];
  } catch (error) {
    logger.error('Error creating invoice:', error);
    throw error;
  }
};

/**
 * Add items to invoice
 */
export const addInvoiceItems = async (invoiceId, items) => {
  try {
    const itemPromises = items.map(item => {
      return postRequest('/invoice_items', {
        invoice_id: invoiceId,
        product_id: item.productId || null,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        tax_rate: item.taxRate || 0,
        discount_percent: item.discountPercent || 0,
        sort_order: item.sortOrder || 0
      });
    });

    const results = await Promise.all(itemPromises);
    logger.info(`Added ${results.length} items to invoice ${invoiceId}`);

    // Clear cache for this invoice
    await deleteFromCache(`invoice:${invoiceId}`);

    return results;
  } catch (error) {
    logger.error('Error adding invoice items:', error);
    throw error;
  }
};

/**
 * Get invoice with all details
 */
export const getInvoiceDetails = async (invoiceId) => {
  try {
    const invoice = await getRequest(`/invoices?id=eq.${invoiceId}`, {}, true, 3600);

    if (!invoice || invoice.length === 0) {
      throw new Error('Invoice not found');
    }

    // Get invoice items
    const items = await getRequest(`/invoice_items?invoice_id=eq.${invoiceId}`, {}, true, 3600);

    // Get customer details
    const customer = invoice[0].customer_id 
      ? await getRequest(`/customers?id=eq.${invoice[0].customer_id}`, {}, true, 3600)
      : null;

    // Get company details
    const company = await getRequest(`/companies?id=eq.${invoice[0].company_id}`, {}, true, 3600);

    return {
      ...invoice[0],
      items: items || [],
      customer: customer ? customer[0] : null,
      company: company ? company[0] : null
    };
  } catch (error) {
    logger.error(`Error retrieving invoice details: ${error.message}`);
    throw error;
  }
};

/**
 * Update invoice totals (automatically handled by trigger, but this is for manual updates)
 */
export const calculateInvoiceTotals = (invoice) => {
  try {
    let subtotal = 0;
    let taxTotal = 0;

    (invoice.items || []).forEach(item => {
      const lineSubtotal = item.quantity * item.unit_price * (1 - (item.discount_percent || 0) / 100);
      const lineTax = lineSubtotal * (item.tax_rate || 0) / 100;

      subtotal += lineSubtotal;
      taxTotal += lineTax;
    });

    const total = subtotal + taxTotal + (invoice.shipping_cost || 0) - (invoice.discount_amount || 0);

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      tax_amount: Math.round(taxTotal * 100) / 100,
      total_amount: Math.round(total * 100) / 100,
      amount_due: Math.round((total - (invoice.amount_paid || 0)) * 100) / 100
    };
  } catch (error) {
    logger.error('Error calculating invoice totals:', error);
    throw error;
  }
};

/**
 * Generate PDF Invoice
 */
export const generateInvoicePDF = async (invoice) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        bufferPages: true,
        margin: 50
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });

      // Header
      if (invoice.company && invoice.company.logo_url) {
        doc.image(invoice.company.logo_url, 50, 50, { width: 100 });
      }

      doc.fontSize(20).font('Helvetica-Bold').text(invoice.company?.name || 'Invoice', 150, 50);
      doc.fontSize(10).font('Helvetica').text('INVOICE', 150, 75);

      // Company Info
      if (invoice.company) {
        doc.fontSize(9)
          .text(invoice.company.email, 300, 50)
          .text(invoice.company.phone, 300, 65)
          .text(invoice.company.address, 300, 80);
      }

      // Invoice Details
      doc.fontSize(10).font('Helvetica-Bold').text('Invoice Details', 50, 150);
      doc.fontSize(9).font('Helvetica')
        .text(`Invoice #: ${invoice.invoice_number}`, 50, 170)
        .text(`Date: ${moment(invoice.issue_date).format('MMMM DD, YYYY')}`, 50, 185)
        .text(`Due Date: ${moment(invoice.due_date).format('MMMM DD, YYYY')}`, 50, 200)
        .text(`Status: ${invoice.status.toUpperCase()}`, 50, 215);

      // Customer Info
      if (invoice.customer) {
        doc.fontSize(10).font('Helvetica-Bold').text('Bill To:', 50, 250);
        doc.fontSize(9).font('Helvetica')
          .text(invoice.customer.name, 50, 270)
          .text(invoice.customer.email || '', 50, 285)
          .text(invoice.customer.phone || '', 50, 300)
          .text(invoice.customer.billing_address || '', 50, 315);
      }

      // Line Items Table
      const tableTop = 360;
      const col1 = 50;
      const col2 = 250;
      const col3 = 350;
      const col4 = 450;

      doc.fontSize(10).font('Helvetica-Bold')
        .text('Description', col1, tableTop)
        .text('Qty', col2, tableTop)
        .text('Unit Price', col3, tableTop)
        .text('Amount', col4, tableTop);

      doc.moveTo(col1, tableTop + 15).lineTo(530, tableTop + 15).stroke();

      let yPosition = tableTop + 30;
      let totalAmount = 0;

      (invoice.items || []).forEach(item => {
        const lineTotal = item.quantity * item.unit_price * (1 - (item.discount_percent || 0) / 100);
        totalAmount += lineTotal;

        doc.fontSize(9).font('Helvetica')
          .text(item.description.substring(0, 30), col1, yPosition)
          .text(item.quantity.toString(), col2, yPosition)
          .text(`$${item.unit_price.toFixed(2)}`, col3, yPosition)
          .text(`$${lineTotal.toFixed(2)}`, col4, yPosition);

        yPosition += 20;
      });

      doc.moveTo(col1, yPosition).lineTo(530, yPosition).stroke();

      // Totals
      yPosition += 15;
      doc.fontSize(9).font('Helvetica')
        .text(`Subtotal:`, col3, yPosition)
        .text(`$${invoice.subtotal.toFixed(2)}`, col4, yPosition);

      yPosition += 15;
      if (invoice.tax_amount > 0) {
        doc.text(`Tax:`, col3, yPosition)
          .text(`$${invoice.tax_amount.toFixed(2)}`, col4, yPosition);
        yPosition += 15;
      }

      if (invoice.discount_amount > 0) {
        doc.text(`Discount:`, col3, yPosition)
          .text(`-$${invoice.discount_amount.toFixed(2)}`, col4, yPosition);
        yPosition += 15;
      }

      if (invoice.shipping_cost > 0) {
        doc.text(`Shipping:`, col3, yPosition)
          .text(`$${invoice.shipping_cost.toFixed(2)}`, col4, yPosition);
        yPosition += 15;
      }

      doc.fontSize(10).font('Helvetica-Bold')
        .text(`Total:`, col3, yPosition + 5)
        .text(`$${invoice.total_amount.toFixed(2)}`, col4, yPosition + 5);

      // Footer
      doc.fontSize(8).font('Helvetica')
        .text('Thank you for your business!', 50, 700)
        .text(`Generated on ${moment().format('MMMM DD, YYYY HH:mm')}`, 50, 715);

      doc.end();
    } catch (error) {
      logger.error('Error generating PDF:', error);
      reject(error);
    }
  });
};

/**
 * Send invoice via email
 */
export const sendInvoiceEmail = async (invoice, recipientEmail) => {
  try {
    // TODO: Implement email sending using nodemailer
    logger.info(`Invoice ${invoice.invoice_number} would be sent to ${recipientEmail}`);
    return true;
  } catch (error) {
    logger.error('Error sending invoice email:', error);
    throw error;
  }
};

/**
 * Update invoice status
 */
export const updateInvoiceStatus = async (invoiceId, status) => {
  try {
    await patchRequest(`/invoices?id=eq.${invoiceId}`, {
      status: status,
      updated_at: moment().toISOString()
    });

    // Clear cache
    await deleteFromCache(`invoice:${invoiceId}`);

    logger.info(`Invoice ${invoiceId} status updated to ${status}`);
    return true;
  } catch (error) {
    logger.error('Error updating invoice status:', error);
    throw error;
  }
};

export default {
  generateInvoiceNumber,
  createInvoice,
  addInvoiceItems,
  getInvoiceDetails,
  calculateInvoiceTotals,
  generateInvoicePDF,
  sendInvoiceEmail,
  updateInvoiceStatus
};
