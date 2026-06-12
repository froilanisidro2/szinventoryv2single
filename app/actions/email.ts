'use server';

import nodemailer from 'nodemailer';

// ─── Transporter ─────────────────────────────────────────────────────────────

export interface SmtpConfig {
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  smtp_password: string;
  from_name?: string;
  from_email?: string;
}

function createTransporter(cfg?: SmtpConfig) {
  const host = cfg?.smtp_host || process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = cfg?.smtp_port || Number(process.env.SMTP_PORT) || 587;
  const secure = cfg?.smtp_secure ?? (Number(process.env.SMTP_PORT) === 465);
  const user = cfg?.smtp_user || process.env.SMTP_USER;
  const pass = cfg?.smtp_password || process.env.SMTP_PASSWORD;
  return nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
}

function buildFrom(cfg?: SmtpConfig) {
  const name = cfg?.from_name || process.env.SMTP_FROM_NAME || 'SprintZeroPH IMS';
  const email = cfg?.from_email || process.env.SMTP_FROM_EMAIL || cfg?.smtp_user || process.env.SMTP_USER;
  return `"${name}" <${email}>`;
}

// Keep legacy constant for callers that don't pass config
const FROM = buildFrom();

// ─── Types ────────────────────────────────────────────────────────────────────

export interface POEmailPayload {
  supplierEmail: string;
  supplierName: string;
  companyName: string;
  companyEmail?: string;
  poNumber: string;
  orderDate: string;
  expectedDelivery?: string;
  paymentTerms?: string;
  notes?: string;
  items: {
    productName: string;
    quantity: number;
    unit_cost: number;
    subtotal: number;
  }[];
  subtotal: number;
  taxAmount: number;
  shippingCost: number;
  totalAmount: number;
  currency: string;
}

// ─── Email HTML builder ───────────────────────────────────────────────────────

function buildPOEmailHTML(p: POEmailPayload): string {
  const fmt = (n: number) => `₱ ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const itemRows = p.items
    .map(
      (item) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;">${item.productName}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:center;">${item.quantity}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;">${fmt(item.unit_cost)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;">${fmt(item.subtotal)}</td>
        </tr>`,
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#0ea5e9;padding:28px 32px;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Purchase Order</h1>
            <p style="margin:4px 0 0;color:#bae6fd;font-size:14px;">from ${p.companyName}</p>
          </td>
        </tr>

        <!-- PO Info -->
        <tr>
          <td style="padding:28px 32px 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="50%" style="vertical-align:top;">
                  <p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;">Purchase Order #</p>
                  <p style="margin:0;font-size:18px;font-weight:700;color:#111827;">${p.poNumber}</p>
                </td>
                <td width="50%" style="vertical-align:top;text-align:right;">
                  <p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;">Order Date</p>
                  <p style="margin:0;font-size:14px;color:#111827;">${p.orderDate}</p>
                  ${p.expectedDelivery ? `<p style="margin:4px 0 0;font-size:12px;color:#6b7280;">Expected: ${p.expectedDelivery}</p>` : ''}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Supplier greeting -->
        <tr>
          <td style="padding:24px 32px 0;">
            <p style="margin:0;font-size:15px;color:#374151;">Dear <strong>${p.supplierName}</strong>,</p>
            <p style="margin:8px 0 0;font-size:14px;color:#6b7280;line-height:1.6;">
              Please find below our Purchase Order. Kindly review the details and confirm receipt at your earliest convenience.
            </p>
          </td>
        </tr>

        <!-- Items table -->
        <tr>
          <td style="padding:24px 32px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
              <thead>
                <tr style="background:#f9fafb;">
                  <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Product</th>
                  <th style="padding:10px 12px;text-align:center;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Qty</th>
                  <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Unit Price</th>
                  <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Total</th>
                </tr>
              </thead>
              <tbody>${itemRows}</tbody>
            </table>
          </td>
        </tr>

        <!-- Totals -->
        <tr>
          <td style="padding:16px 32px 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="text-align:right;padding:4px 0;">
                  <span style="font-size:13px;color:#6b7280;">Subtotal: </span>
                  <span style="font-size:13px;color:#111827;font-weight:500;margin-left:16px;">${fmt(p.subtotal)}</span>
                </td>
              </tr>
              ${p.taxAmount > 0 ? `<tr><td style="text-align:right;padding:4px 0;"><span style="font-size:13px;color:#6b7280;">Tax: </span><span style="font-size:13px;color:#111827;margin-left:16px;">${fmt(p.taxAmount)}</span></td></tr>` : ''}
              ${p.shippingCost > 0 ? `<tr><td style="text-align:right;padding:4px 0;"><span style="font-size:13px;color:#6b7280;">Shipping: </span><span style="font-size:13px;color:#111827;margin-left:16px;">${fmt(p.shippingCost)}</span></td></tr>` : ''}
              <tr>
                <td style="text-align:right;padding:8px 0 0;border-top:2px solid #e5e7eb;margin-top:4px;">
                  <span style="font-size:15px;font-weight:700;color:#111827;">Total: ${fmt(p.totalAmount)}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Payment terms / Notes -->
        ${p.paymentTerms || p.notes ? `
        <tr>
          <td style="padding:20px 32px 0;">
            ${p.paymentTerms ? `<p style="margin:0 0 8px;font-size:13px;color:#374151;"><strong>Payment Terms:</strong> ${p.paymentTerms}</p>` : ''}
            ${p.notes ? `<p style="margin:0;font-size:13px;color:#374151;"><strong>Notes:</strong> ${p.notes}</p>` : ''}
          </td>
        </tr>` : ''}

        <!-- Footer -->
        <tr>
          <td style="padding:32px;border-top:1px solid #f0f0f0;margin-top:24px;">
            <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
              If you have any questions, please reply to this email${p.companyEmail ? ` or contact us at <a href="mailto:${p.companyEmail}" style="color:#0ea5e9;">${p.companyEmail}</a>` : ''}.
            </p>
            <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;">— ${p.companyName}</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Server Action ────────────────────────────────────────────────────────────

export async function sendPurchaseOrderEmail(payload: POEmailPayload): Promise<{ success: boolean; error?: string }> {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      return { success: false, error: 'Email is not configured. Set SMTP_USER and SMTP_PASSWORD in your environment.' };
    }

    const transporter = createTransporter();
    await transporter.verify();

    await transporter.sendMail({
      from: FROM,
      to: payload.supplierEmail,
      replyTo: payload.companyEmail || process.env.SMTP_FROM_EMAIL,
      subject: `Purchase Order ${payload.poNumber} from ${payload.companyName}`,
      html: buildPOEmailHTML(payload),
    });

    return { success: true };
  } catch (err: any) {
    console.error('[EMAIL] Failed to send PO email:', err);
    return { success: false, error: err?.message || 'Failed to send email' };
  }
}

// ─── Sales Order Email ────────────────────────────────────────────────────────

export interface SOEmailPayload {
  customerEmail: string;
  customerName: string;
  companyName: string;
  companyEmail?: string;
  soNumber: string;
  orderId?: string;
  orderDate: string;
  expectedDelivery?: string;
  paymentTerms?: string;
  notes?: string;
  items: { productName: string; quantity: number; unit_price: number; subtotal: number }[];
  subtotal: number;
  taxAmount: number;
  shippingCost: number;
  totalAmount: number;
}

function buildSOEmailHTML(p: SOEmailPayload): string {
  const fmt = (n: number) => `₱ ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const itemRows = p.items.map(item => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;">${item.productName}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:center;">${item.quantity}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;">${fmt(item.unit_price)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;">${fmt(item.subtotal)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <tr><td style="background:#0ea5e9;padding:28px 32px;">
    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">Sales Order Confirmation</h1>
    <p style="margin:4px 0 0;color:#bae6fd;font-size:14px;">from ${p.companyName}</p>
  </td></tr>
  <tr><td style="padding:28px 32px 0;">
    <table width="100%"><tr>
      <td width="50%" style="vertical-align:top;">
        <p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;">Sales Order #</p>
        <p style="margin:0;font-size:18px;font-weight:700;color:#111827;">${p.soNumber}</p>
      </td>
      <td width="50%" style="vertical-align:top;text-align:right;">
        <p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;">Order Date</p>
        <p style="margin:0;font-size:14px;color:#111827;">${p.orderDate}</p>
        ${p.expectedDelivery ? `<p style="margin:4px 0 0;font-size:12px;color:#6b7280;">Expected: ${p.expectedDelivery}</p>` : ''}
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:24px 32px 0;">
    <p style="margin:0;font-size:15px;color:#374151;">Dear <strong>${p.customerName}</strong>,</p>
    <p style="margin:8px 0 0;font-size:14px;color:#6b7280;line-height:1.6;">Thank you for your order. Please find the details below.</p>
  </td></tr>
  <tr><td style="padding:24px 32px 0;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
      <thead><tr style="background:#f9fafb;">
        <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Product</th>
        <th style="padding:10px 12px;text-align:center;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Qty</th>
        <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Unit Price</th>
        <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Total</th>
      </tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
  </td></tr>
  <tr><td style="padding:16px 32px 0;">
    <table width="100%">
      <tr><td style="text-align:right;padding:4px 0;"><span style="font-size:13px;color:#6b7280;">Subtotal: </span><span style="font-size:13px;color:#111827;font-weight:500;margin-left:16px;">${fmt(p.subtotal)}</span></td></tr>
      ${p.taxAmount > 0 ? `<tr><td style="text-align:right;padding:4px 0;"><span style="font-size:13px;color:#6b7280;">Tax: </span><span style="font-size:13px;color:#111827;margin-left:16px;">${fmt(p.taxAmount)}</span></td></tr>` : ''}
      ${p.shippingCost > 0 ? `<tr><td style="text-align:right;padding:4px 0;"><span style="font-size:13px;color:#6b7280;">Shipping: </span><span style="font-size:13px;color:#111827;margin-left:16px;">${fmt(p.shippingCost)}</span></td></tr>` : ''}
      <tr><td style="text-align:right;padding:8px 0 0;border-top:2px solid #e5e7eb;"><span style="font-size:15px;font-weight:700;color:#111827;">Total: ${fmt(p.totalAmount)}</span></td></tr>
    </table>
  </td></tr>
  ${p.paymentTerms || p.notes ? `<tr><td style="padding:20px 32px 0;">${p.paymentTerms ? `<p style="margin:0 0 8px;font-size:13px;color:#374151;"><strong>Payment Terms:</strong> ${p.paymentTerms}</p>` : ''}${p.notes ? `<p style="margin:0;font-size:13px;color:#374151;"><strong>Notes:</strong> ${p.notes}</p>` : ''}</td></tr>` : ''}
  ${p.orderId ? `<tr><td style="padding:20px 32px 0;text-align:center;">
    <a href="${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/sales-orders/${p.orderId}/print" style="display:inline-block;background:#0ea5e9;color:#fff;padding:10px 28px;border-radius:6px;font-size:13px;font-weight:600;text-decoration:none;">📄 View &amp; Print Sales Order</a>
  </td></tr>` : ''}
  <tr><td style="padding:24px 32px 32px;border-top:1px solid #f0f0f0;margin-top:24px;">
    <p style="margin:0;font-size:13px;color:#6b7280;">If you have any questions, reply to this email${p.companyEmail ? ` or contact <a href="mailto:${p.companyEmail}" style="color:#0ea5e9;">${p.companyEmail}</a>` : ''}.
    </p>
    <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;">— ${p.companyName}</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

export async function sendSalesOrderEmail(payload: SOEmailPayload): Promise<{ success: boolean; error?: string }> {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      return { success: false, error: 'Email is not configured.' };
    }
    const transporter = createTransporter();
    await transporter.verify();
    await transporter.sendMail({
      from: FROM,
      to: payload.customerEmail,
      replyTo: payload.companyEmail || process.env.SMTP_FROM_EMAIL,
      subject: `Sales Order ${payload.soNumber} from ${payload.companyName}`,
      html: buildSOEmailHTML(payload),
    });
    return { success: true };
  } catch (err: any) {
    console.error('[EMAIL] Failed to send SO email:', err);
    return { success: false, error: err?.message || 'Failed to send email' };
  }
}

// ─── GRN Received Notification ───────────────────────────────────────────────

export interface GRNEmailPayload {
  supplierEmail: string;
  supplierName: string;
  companyName: string;
  companyEmail?: string;
  poNumber: string;
  receivedDate: string;
  receivedBy?: string;
  items: {
    productName: string;
    quantityOrdered: number;
    quantityAccepted: number;
    quantityRejected: number;
    rejectionReason?: string;
  }[];
  notes?: string;
}

function buildGRNEmailHTML(p: GRNEmailPayload): string {
  const rejectionLabels: Record<string, string> = {
    damaged_in_transit: 'Damaged in Transit', defective: 'Defective/Non-Functional',
    wrong_item: 'Wrong Item', qty_mismatch: 'Quantity Mismatch',
    expired: 'Expired', quality_issue: 'Quality Issue', other: 'Other',
  };

  const hasRejections = p.items.some(i => i.quantityRejected > 0);
  const allAccepted = !hasRejections;
  const statusColor = allAccepted ? '#16a34a' : '#d97706';
  const statusLabel = allAccepted ? 'FULLY ACCEPTED' : 'PARTIALLY ACCEPTED';

  const itemRows = p.items.map(item => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;">${item.productName}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:center;">${item.quantityOrdered}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:center;color:#16a34a;font-weight:600;">${item.quantityAccepted}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:center;color:${item.quantityRejected > 0 ? '#dc2626' : '#6b7280'};font-weight:${item.quantityRejected > 0 ? '600' : '400'};">${item.quantityRejected}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#6b7280;">${item.rejectionReason ? (rejectionLabels[item.rejectionReason] || item.rejectionReason) : '—'}</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <tr><td style="background:#16a34a;padding:28px 32px;">
    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">Goods Receipt Notification</h1>
    <p style="margin:4px 0 0;color:#bbf7d0;font-size:14px;">from ${p.companyName}</p>
  </td></tr>
  <tr><td style="padding:28px 32px 0;">
    <table width="100%"><tr>
      <td width="50%" style="vertical-align:top;">
        <p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;">Reference</p>
        <p style="margin:0;font-size:16px;font-weight:700;color:#111827;">${p.poNumber}</p>
      </td>
      <td width="50%" style="vertical-align:top;text-align:right;">
        <span style="display:inline-block;padding:3px 12px;border-radius:4px;background:${statusColor}20;color:${statusColor};font-size:12px;font-weight:700;">${statusLabel}</span>
        <p style="margin:6px 0 0;font-size:12px;color:#6b7280;">Received: ${p.receivedDate}</p>
        ${p.receivedBy ? `<p style="margin:2px 0 0;font-size:12px;color:#6b7280;">By: ${p.receivedBy}</p>` : ''}
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:24px 32px 0;">
    <p style="margin:0;font-size:15px;color:#374151;">Dear <strong>${p.supplierName}</strong>,</p>
    <p style="margin:8px 0 0;font-size:14px;color:#6b7280;line-height:1.6;">We have received your delivery. Please find the receipt details below.</p>
  </td></tr>
  <tr><td style="padding:24px 32px 0;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
      <thead><tr style="background:#f9fafb;">
        <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Product</th>
        <th style="padding:10px 12px;text-align:center;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Ordered</th>
        <th style="padding:10px 12px;text-align:center;font-size:12px;color:#16a34a;font-weight:600;text-transform:uppercase;">Accepted ✓</th>
        <th style="padding:10px 12px;text-align:center;font-size:12px;color:#dc2626;font-weight:600;text-transform:uppercase;">Rejected ✗</th>
        <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Reason</th>
      </tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
  </td></tr>
  ${hasRejections ? `<tr><td style="padding:20px 32px 0;"><div style="background:#fef3c7;border:1px solid #fde68a;border-radius:6px;padding:12px 16px;"><p style="margin:0;font-size:13px;color:#92400e;"><strong>Note:</strong> ${p.items.reduce((s, i) => s + i.quantityRejected, 0)} unit(s) were rejected. Please arrange for replacement or credit note at your earliest convenience.</p></div></td></tr>` : ''}
  ${p.notes ? `<tr><td style="padding:16px 32px 0;"><p style="margin:0;font-size:13px;color:#374151;"><strong>Notes:</strong> ${p.notes}</p></td></tr>` : ''}
  <tr><td style="padding:24px 32px 32px;border-top:1px solid #f0f0f0;margin-top:24px;">
    <p style="margin:0;font-size:13px;color:#6b7280;">Questions? Reply to this email${p.companyEmail ? ` or contact <a href="mailto:${p.companyEmail}" style="color:#16a34a;">${p.companyEmail}</a>` : ''}.</p>
    <p style="margin:12px 0 0;font-size:12px;color:#9ca3af;">— ${p.companyName}</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

export async function sendGRNNotificationEmail(payload: GRNEmailPayload): Promise<{ success: boolean; error?: string }> {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      return { success: false, error: 'Email not configured. Set SMTP_USER and SMTP_PASSWORD in .env.local and restart the server.' };
    }
    const transporter = createTransporter();
    await transporter.verify();
    await transporter.sendMail({
      from: FROM,
      to: payload.supplierEmail,
      replyTo: payload.companyEmail || process.env.SMTP_FROM_EMAIL,
      subject: `Goods Receipt Confirmation — ${payload.poNumber}`,
      html: buildGRNEmailHTML(payload),
    });
    return { success: true };
  } catch (err: any) {
    console.error('[EMAIL] Failed to send GRN email:', err?.message || err);
    return { success: false, error: err?.message || 'Failed to send email' };
  }
}

// ─── Helper ───────────────────────────────────────────────────────────────────

async function sendEmail(to: string, subject: string, html: string): Promise<{ success: boolean; error?: string }> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    return { success: false, error: 'Email is not configured. Set SMTP_USER and SMTP_PASSWORD in your environment.' };
  }
  try {
    const transporter = createTransporter();
    await transporter.sendMail({ from: FROM, to, subject, html });
    return { success: true };
  } catch (err: any) {
    console.error('[EMAIL]', subject, err?.message);
    return { success: false, error: err?.message || 'Failed to send email' };
  }
}

// ─── Low Stock Alert ──────────────────────────────────────────────────────────

export interface LowStockItem {
  name: string;
  sku: string;
  quantity_on_hand: number;
  reorder_level: number;
}

export async function sendLowStockAlertEmail(
  adminEmail: string,
  companyName: string,
  items: LowStockItem[]
): Promise<{ success: boolean; error?: string }> {
  const rows = items
    .slice(0, 20)
    .map(
      (i) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;">${i.name}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-family:monospace;">${i.sku}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:center;color:#dc2626;font-weight:700;">${i.quantity_on_hand}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:center;color:#6b7280;">${i.reorder_level}</td>
      </tr>`
    )
    .join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <tr><td style="background:#f59e0b;padding:28px 32px;">
    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">⚠️ Low Stock Alert</h1>
    <p style="margin:4px 0 0;color:#fef3c7;font-size:14px;">${companyName}</p>
  </td></tr>
  <tr><td style="padding:24px 32px;">
    <p style="margin:0;font-size:15px;color:#374151;">
      The following <strong>${items.length}</strong> product${items.length !== 1 ? 's are' : ' is'} below reorder level and require restocking.
    </p>
  </td></tr>
  <tr><td style="padding:0 32px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
      <thead><tr style="background:#f9fafb;">
        <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Product</th>
        <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">SKU</th>
        <th style="padding:10px 12px;text-align:center;font-size:12px;color:#dc2626;font-weight:600;text-transform:uppercase;">On Hand</th>
        <th style="padding:10px 12px;text-align:center;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Reorder At</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${items.length > 20 ? `<p style="margin:8px 0 0;font-size:12px;color:#6b7280;">...and ${items.length - 20} more items.</p>` : ''}
  </td></tr>
  <tr><td style="padding:0 32px 32px;text-align:center;">
    <a href="${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/inventory" style="display:inline-block;background:#f59e0b;color:#fff;padding:10px 28px;border-radius:6px;font-size:13px;font-weight:600;text-decoration:none;">View Inventory</a>
  </td></tr>
  <tr><td style="padding:16px 32px;border-top:1px solid #f0f0f0;">
    <p style="margin:0;font-size:12px;color:#9ca3af;">— SprintZeroPH Inventory Management System</p>
  </td></tr>
</table></td></tr></table>
</body></html>`;

  return sendEmail(adminEmail, `[${companyName}] Low Stock Alert — ${items.length} item${items.length !== 1 ? 's' : ''} need restocking`, html);
}

// ─── Invoice Notification ─────────────────────────────────────────────────────

export async function sendInvoiceNotificationEmail(
  toEmail: string,
  companyName: string,
  invoiceNumber: string,
  customerName: string,
  totalAmount: number,
  dueDate: string,
  status: string
): Promise<{ success: boolean; error?: string }> {
  const fmt = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
  const statusColor: Record<string, string> = {
    paid: '#16a34a', pending: '#d97706', overdue: '#dc2626', sent: '#7c3aed',
  };
  const color = statusColor[status] ?? '#6b7280';

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <tr><td style="background:#0ea5e9;padding:28px 32px;">
    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">Invoice Update</h1>
    <p style="margin:4px 0 0;color:#bae6fd;font-size:14px;">${companyName}</p>
  </td></tr>
  <tr><td style="padding:28px 32px;">
    <table width="100%"><tr>
      <td><p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;">Invoice</p><p style="margin:0;font-size:20px;font-weight:700;color:#111827;">${invoiceNumber}</p></td>
      <td style="text-align:right;"><span style="display:inline-block;padding:4px 14px;border-radius:20px;background:${color}20;color:${color};font-size:12px;font-weight:700;text-transform:capitalize;">${status}</span></td>
    </tr></table>
    <table width="100%" style="margin-top:20px;background:#f9fafb;border-radius:6px;padding:16px;" cellpadding="0" cellspacing="0">
      <tr><td style="padding:4px 0;"><span style="font-size:13px;color:#6b7280;">Customer:</span><span style="font-size:13px;color:#111827;font-weight:600;margin-left:8px;">${customerName}</span></td></tr>
      <tr><td style="padding:4px 0;"><span style="font-size:13px;color:#6b7280;">Amount:</span><span style="font-size:13px;color:#111827;font-weight:700;margin-left:8px;">${fmt(totalAmount)}</span></td></tr>
      <tr><td style="padding:4px 0;"><span style="font-size:13px;color:#6b7280;">Due Date:</span><span style="font-size:13px;color:${status === 'overdue' ? '#dc2626' : '#111827'};font-weight:600;margin-left:8px;">${dueDate}</span></td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:0 32px 32px;text-align:center;">
    <a href="${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/invoices" style="display:inline-block;background:#0ea5e9;color:#fff;padding:10px 28px;border-radius:6px;font-size:13px;font-weight:600;text-decoration:none;">View Invoice</a>
  </td></tr>
  <tr><td style="padding:16px 32px;border-top:1px solid #f0f0f0;"><p style="margin:0;font-size:12px;color:#9ca3af;">— SprintZeroPH Inventory Management System</p></td></tr>
</table></td></tr></table>
</body></html>`;

  return sendEmail(toEmail, `Invoice ${invoiceNumber} — ${status.toUpperCase()} | ${companyName}`, html);
}

// ─── Payment Reminder ─────────────────────────────────────────────────────────

export interface OverdueInvoice {
  invoice_number: string;
  customer_name: string;
  total_amount: number;
  amount_paid: number;
  due_date: string;
}

export async function sendPaymentReminderEmail(
  adminEmail: string,
  companyName: string,
  overdueInvoices: OverdueInvoice[]
): Promise<{ success: boolean; error?: string }> {
  const fmt = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
  const totalOutstanding = overdueInvoices.reduce(
    (s, i) => s + (i.total_amount - (i.amount_paid ?? 0)), 0
  );

  const rows = overdueInvoices
    .slice(0, 15)
    .map(
      (i) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-weight:600;color:#111827;">${i.invoice_number}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;color:#374151;">${i.customer_name}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;color:#dc2626;font-weight:600;">${fmt(i.total_amount - (i.amount_paid ?? 0))}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;color:#6b7280;font-size:12px;">${i.due_date}</td>
      </tr>`
    )
    .join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <tr><td style="background:#dc2626;padding:28px 32px;">
    <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">Payment Reminder</h1>
    <p style="margin:4px 0 0;color:#fecaca;font-size:14px;">${companyName} — ${overdueInvoices.length} overdue invoice${overdueInvoices.length !== 1 ? 's' : ''}</p>
  </td></tr>
  <tr><td style="padding:24px 32px;">
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:16px;text-align:center;">
      <p style="margin:0;font-size:13px;color:#6b7280;">Total Outstanding</p>
      <p style="margin:4px 0 0;font-size:28px;font-weight:700;color:#dc2626;">${fmt(totalOutstanding)}</p>
    </div>
  </td></tr>
  <tr><td style="padding:0 32px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
      <thead><tr style="background:#f9fafb;">
        <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Invoice</th>
        <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Customer</th>
        <th style="padding:10px 12px;text-align:right;font-size:12px;color:#dc2626;font-weight:600;text-transform:uppercase;">Outstanding</th>
        <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Due Date</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </td></tr>
  <tr><td style="padding:0 32px 32px;text-align:center;">
    <a href="${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/invoices" style="display:inline-block;background:#dc2626;color:#fff;padding:10px 28px;border-radius:6px;font-size:13px;font-weight:600;text-decoration:none;">View Overdue Invoices</a>
  </td></tr>
  <tr><td style="padding:16px 32px;border-top:1px solid #f0f0f0;"><p style="margin:0;font-size:12px;color:#9ca3af;">— SprintZeroPH Inventory Management System</p></td></tr>
</table></td></tr></table>
</body></html>`;

  return sendEmail(adminEmail, `[${companyName}] Payment Reminder — ${fmt(totalOutstanding)} outstanding`, html);
}

