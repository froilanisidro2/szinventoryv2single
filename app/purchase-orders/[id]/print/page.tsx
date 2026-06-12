'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getPurchaseOrderById, getPurchaseOrderItems, getSuppliers } from '@/app/actions';

export default function POPrintPage() {
  const params = useParams();
  const id = params.id as string;

  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [supplier, setSupplier] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const companyStr = localStorage.getItem('company');
        if (companyStr) setCompany(JSON.parse(companyStr));

        const [orderRes, itemsRes, suppliersRes] = await Promise.all([
          getPurchaseOrderById(id),
          getPurchaseOrderItems(id),
          getSuppliers(),
        ]);

        const orderData = Array.isArray(orderRes.data) ? orderRes.data[0] : orderRes.data;
        setOrder(orderData);
        setItems(Array.isArray(itemsRes.data) ? itemsRes.data : []);

        if (suppliersRes.data && orderData?.supplier_id) {
          const found = (suppliersRes.data as any[]).find((s: any) => s.id === orderData.supplier_id);
          setSupplier(found || null);
        }
        setIsReady(true);
      } catch (e) {
        setIsReady(true);
      }
    };
    load();
  }, [id]);

  useEffect(() => {
    if (isReady && order) {
      setTimeout(() => window.print(), 600);
    }
  }, [isReady, order]);

  if (!isReady || !order) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Arial, sans-serif' }}>
        <p>Preparing document...</p>
      </div>
    );
  }

  const fmtNum = (n: number, decimals = 2) =>
    Number(n).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const fmt = (n: number) => `₱ ${fmtNum(n)}`;
  const fmtQty = (n: number) => Number(n).toLocaleString('en-US');

  const fmtDate = (d: string) =>
    d ? new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';

  const statusLabel: Record<string, string> = {
    draft: 'DRAFT', confirmed: 'APPROVED', sent: 'SENT',
    partially_received: 'PARTIALLY RECEIVED', received: 'RECEIVED', cancelled: 'CANCELLED',
  };

  const subtotal = items.reduce((s, i) => s + Number(i.quantity_ordered) * Number(i.unit_price), 0);

  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { background: #fff !important; font-family: 'Arial', sans-serif; font-size: 11pt; color: #111 !important; color-scheme: light !important; }
        @page { size: A4; margin: 15mm 15mm 20mm 15mm; }
        @media print {
          html, body { width: 210mm; }
          .no-print { display: none !important; }
        }
        .page { width: 100%; max-width: 900px; margin: 0 auto; padding: 24px; background: #fff !important; color: #111 !important; }
        .page * { color-scheme: light; }

        /* Two-column content layout */
        .content-grid { display: flex; gap: 20px; align-items: flex-start; }
        .content-main { flex: 1; min-width: 0; }
        .content-side { width: 250px; flex-shrink: 0; }

        /* Header */
        .doc-header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 3px solid #0ea5e9; margin-bottom: 20px; }
        .company-block { display: flex; align-items: center; gap: 12px; }
        .company-logo { width: 64px; height: 64px; object-fit: contain; }
        .company-logo-placeholder { width: 64px; height: 64px; background: #0ea5e9; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 20px; }
        .company-name { font-size: 18pt; font-weight: 700; color: #0ea5e9; line-height: 1.1; }
        .company-sub { font-size: 9pt; color: #6b7280; margin-top: 2px; }
        .doc-title-block { text-align: right; }
        .doc-title { font-size: 22pt; font-weight: 700; letter-spacing: 2px; color: #111; text-transform: uppercase; }
        .doc-po-number { font-size: 11pt; color: #0ea5e9; font-weight: 600; margin-top: 4px; }
        .status-badge { display: inline-block; padding: 2px 10px; border-radius: 4px; font-size: 8pt; font-weight: 700; letter-spacing: 1px; margin-top: 6px;
          background: ${order.status === 'cancelled' ? '#fee2e2' : order.status === 'received' ? '#dcfce7' : '#dbeafe'};
          color: ${order.status === 'cancelled' ? '#991b1b' : order.status === 'received' ? '#166534' : '#1e40af'};
          border: 1px solid ${order.status === 'cancelled' ? '#fca5a5' : order.status === 'received' ? '#86efac' : '#93c5fd'};
        }

        /* Meta box */
        .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 14px; }
        .meta-box-title { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 6px; }
        .meta-row { display: flex; justify-content: space-between; font-size: 9.5pt; padding: 2px 0; }
        .meta-row .label { color: #64748b; }
        .meta-row .value { font-weight: 600; color: #111; }

        /* Addresses */
        .addr-box { border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 14px; }
        .addr-box-title { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
        .addr-name { font-size: 11pt; font-weight: 700; color: #111; margin-bottom: 2px; }
        .addr-detail { font-size: 9.5pt; color: #374151; line-height: 1.5; }

        /* Items table */
        .items-section { margin-bottom: 20px; }
        .section-title { font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; }
        thead tr { background: #0ea5e9; color: #fff; }
        thead th { padding: 8px 10px; text-align: left; font-size: 9pt; font-weight: 600; }
        thead th:not(:first-child) { text-align: right; }
        tbody tr { border-bottom: 1px solid #f1f5f9; }
        tbody tr:nth-child(even) { background: #f8fafc; }
        tbody td { padding: 7px 10px; font-size: 9.5pt; }
        tbody td:not(:first-child) { text-align: right; }

        /* Totals / Summary sidebar */
        .totals-box { border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; }
        .totals-row-item { display: flex; justify-content: space-between; padding: 6px 14px; font-size: 9.5pt; border-bottom: 1px solid #f1f5f9; }
        .totals-row-item .t-label { color: #64748b; }
        .totals-row-item .t-value { font-weight: 600; }
        .totals-grand { display: flex; justify-content: space-between; padding: 10px 14px; background: #0ea5e9; color: #fff; font-size: 11pt; font-weight: 700; }

        /* Notes */
        .notes-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 12px 14px; margin-bottom: 20px; }
        .notes-label { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #92400e; margin-bottom: 4px; }
        .notes-text { font-size: 9.5pt; color: #78350f; }

        /* Signatures */
        .sig-section { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 30px; margin-top: 40px; }
        .sig-block { border-top: 1px solid #94a3b8; padding-top: 6px; }
        .sig-name { font-size: 9pt; font-weight: 700; color: #111; }
        .sig-role { font-size: 8pt; color: #64748b; }

        /* Footer */
        .doc-footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 8pt; color: #94a3b8; }

        /* Print button */
        .print-btn { position: fixed; top: 16px; right: 16px; background: #0ea5e9; color: #fff; border: none; padding: 8px 18px; border-radius: 6px; font-size: 10pt; font-weight: 600; cursor: pointer; }
      `}</style>

      <button className="print-btn no-print" onClick={() => window.print()}>Print / Save PDF</button>

      <div className="page">
        {/* ── Document Header ── */}
        <div className="doc-header">
          <div className="company-block">
            {company?.logo_url ? (
              <img src={company.logo_url} alt="logo" className="company-logo" />
            ) : (
              <div className="company-logo-placeholder">
                {(company?.name || 'C').charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <div className="company-name">{company?.name || 'Company Name'}</div>
              {company?.email && <div className="company-sub">{company.email}</div>}
              {company?.phone && <div className="company-sub">{company.phone}</div>}
            </div>
          </div>
          <div className="doc-title-block">
            <div className="doc-title">Purchase Order</div>
            <div className="doc-po-number">{order.po_number}</div>
            <div><span className="status-badge">{statusLabel[order.status] || order.status.toUpperCase()}</span></div>
          </div>
        </div>

        {/* ── Main content: details sidebar (left) + line items (right) ── */}
        <div className="content-grid">
          {/* ── Sidebar: Order Details, From, To, Summary ── */}
          <div className="content-side">
            <div className="meta-box" style={{ marginBottom: 12 }}>
              <div className="meta-box-title">Order Details</div>
              <div className="meta-row"><span className="label">PO Number</span><span className="value">{order.po_number}</span></div>
              <div className="meta-row"><span className="label">Order Date</span><span className="value">{fmtDate(order.order_date)}</span></div>
              {order.expected_delivery_date && (
                <div className="meta-row"><span className="label">Expected Delivery</span><span className="value">{fmtDate(order.expected_delivery_date)}</span></div>
              )}
              {order.payment_terms && (
                <div className="meta-row"><span className="label">Payment Terms</span><span className="value">{order.payment_terms}</span></div>
              )}
              <div className="meta-row"><span className="label">Currency</span><span className="value">PHP (₱)</span></div>
            </div>

            <div className="addr-box" style={{ marginBottom: 12 }}>
              <div className="addr-box-title">From (Buyer)</div>
              <div className="addr-name">{company?.name || '—'}</div>
              {company?.email && <div className="addr-detail">{company.email}</div>}
              {company?.phone && <div className="addr-detail">{company.phone}</div>}
            </div>

            <div className="addr-box" style={{ marginBottom: 12 }}>
              <div className="addr-box-title">To (Supplier)</div>
              <div className="addr-name">{supplier?.name || '—'}</div>
              {supplier?.contact_person && <div className="addr-detail">Attn: {supplier.contact_person}</div>}
              {supplier?.email && <div className="addr-detail">{supplier.email}</div>}
              {supplier?.phone && <div className="addr-detail">{supplier.phone}</div>}
              {supplier?.address && <div className="addr-detail">{supplier.address}</div>}
            </div>

            <div className="totals-box">
              <div className="section-title" style={{ padding: '10px 14px 0' }}>Order Summary</div>
              <div className="totals-row-item"><span className="t-label">Total Items</span><span className="t-value">{items.length}</span></div>
              <div className="totals-row-item"><span className="t-label">Total Qty Ordered</span><span className="t-value">{fmtQty(items.reduce((s, i) => s + Number(i.quantity_ordered), 0))}</span></div>
              <div className="totals-row-item"><span className="t-label">Subtotal</span><span className="t-value">{fmt(Number(order.subtotal || subtotal))}</span></div>
              {Number(order.tax_amount) > 0 && (
                <div className="totals-row-item"><span className="t-label">Tax</span><span className="t-value">{fmt(Number(order.tax_amount))}</span></div>
              )}
              {Number(order.shipping_cost) > 0 && (
                <div className="totals-row-item"><span className="t-label">Shipping</span><span className="t-value">{fmt(Number(order.shipping_cost))}</span></div>
              )}
              <div className="totals-grand"><span>Total Amount</span><span>{fmt(Number(order.total_amount))}</span></div>
            </div>
          </div>

          {/* ── Line Items ── */}
          <div className="content-main">
            <div className="items-section">
              <div className="section-title">Line Items</div>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '34%' }}>Product / Description</th>
                    <th style={{ width: '13%' }}>Qty Ordered</th>
                    <th style={{ width: '13%' }}>Qty Received</th>
                    <th style={{ width: '13%' }}>Unit Price</th>
                    <th style={{ width: '13%' }}>Tax %</th>
                    <th style={{ width: '14%' }}>Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={item.id || i}>
                      <td style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 600 }}>{item.description || item.product_name || `Item ${i + 1}`}</div>
                        {item.notes && <div style={{ fontSize: '8.5pt', color: '#6b7280', marginTop: 2 }}>{item.notes}</div>}
                      </td>
                      <td>{fmtQty(Number(item.quantity_ordered))}</td>
                      <td>{fmtQty(Number(item.quantity_received || 0))}</td>
                      <td>{fmt(Number(item.unit_price))}</td>
                      <td>{Number(item.tax_rate || 0).toFixed(1)}%</td>
                      <td style={{ fontWeight: 600 }}>{fmt(Number(item.line_total || Number(item.quantity_ordered) * Number(item.unit_price)))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Notes ── */}
        {order.notes && (
          <div className="notes-box">
            <div className="notes-label">Notes / Remarks</div>
            <div className="notes-text">{order.notes}</div>
          </div>
        )}

        {/* ── Signatures ── */}
        <div className="sig-section">
          <div className="sig-block">
            <div style={{ height: 32 }} />
            <div className="sig-name">Prepared by</div>
            <div className="sig-role">Purchasing Officer</div>
          </div>
          <div className="sig-block">
            <div style={{ height: 32 }} />
            <div className="sig-name">Approved by</div>
            <div className="sig-role">Manager / Admin</div>
          </div>
          <div className="sig-block">
            <div style={{ height: 32 }} />
            <div className="sig-name">Received by</div>
            <div className="sig-role">Supplier Representative</div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="doc-footer">
          This is an official Purchase Order issued by {company?.name || 'the company'}.
          &nbsp;&bull;&nbsp; Generated {new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
          &nbsp;&bull;&nbsp; {order.po_number}
        </div>
      </div>
    </>
  );
}
