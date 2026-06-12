'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getPurchaseOrderById, getPurchaseOrderItems, getSuppliers, getGRNByPurchaseOrderId } from '@/app/actions';

const rejectionLabels: Record<string, string> = {
  damaged_in_transit: 'Damaged in Transit',
  defective: 'Defective/Non-Functional',
  wrong_item: 'Wrong Item',
  qty_mismatch: 'Quantity Mismatch',
  expired: 'Expired',
  quality_issue: 'Quality Issue',
  other: 'Other',
};

export default function GRNPrintPage() {
  const params = useParams();
  const id = params.id as string;

  const [order, setOrder] = useState<any>(null);
  const [grn, setGrn] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [supplier, setSupplier] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const companyStr = localStorage.getItem('company');
        if (companyStr) setCompany(JSON.parse(companyStr));

        const [orderRes, itemsRes, suppliersRes, grnRes] = await Promise.all([
          getPurchaseOrderById(id),
          getPurchaseOrderItems(id),
          getSuppliers(),
          getGRNByPurchaseOrderId(id),
        ]);

        const orderData = Array.isArray(orderRes.data) ? orderRes.data[0] : orderRes.data;
        setOrder(orderData);
        setItems(Array.isArray(itemsRes.data) ? itemsRes.data : []);

        const grnData = Array.isArray(grnRes.data) ? grnRes.data[0] : null;
        setGrn(grnData || null);

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

  const fmtQty = (n: number) => Number(n).toLocaleString('en-US');

  const fmtDate = (d: string | Date | undefined) =>
    d ? new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';

  const receivedItems = items.filter(i => Number(i.quantity_received) > 0);

  const totalOrdered = grn ? Number(grn.total_items_ordered) : items.reduce((s, i) => s + Number(i.quantity_ordered), 0);
  const totalReceived = grn ? Number(grn.total_items_received) : receivedItems.reduce((s, i) => s + Number(i.quantity_received), 0);
  const totalAccepted = grn ? Number(grn.total_items_accepted) : receivedItems.reduce((s, i) => s + Number(i.quantity_accepted || 0), 0);
  const totalRejected = grn ? Number(grn.total_items_rejected) : receivedItems.reduce((s, i) => s + Number(i.quantity_rejected || 0), 0);

  const qualityLabel: Record<string, string> = {
    pending: 'PENDING', good: 'FULLY ACCEPTED', partial: 'PARTIALLY ACCEPTED', rejected: 'REJECTED',
  };
  const qualityStatus = grn?.quality_status || (totalRejected > 0 ? 'partial' : 'good');

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
        .doc-header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 3px solid #16a34a; margin-bottom: 20px; }
        .company-block { display: flex; align-items: center; gap: 12px; }
        .company-logo { width: 64px; height: 64px; object-fit: contain; }
        .company-logo-placeholder { width: 64px; height: 64px; background: #16a34a; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 20px; }
        .company-name { font-size: 18pt; font-weight: 700; color: #16a34a; line-height: 1.1; }
        .company-sub { font-size: 9pt; color: #6b7280; margin-top: 2px; }
        .doc-title-block { text-align: right; }
        .doc-title { font-size: 22pt; font-weight: 700; letter-spacing: 2px; color: #111; text-transform: uppercase; }
        .doc-po-number { font-size: 11pt; color: #16a34a; font-weight: 600; margin-top: 4px; }
        .status-badge { display: inline-block; padding: 2px 10px; border-radius: 4px; font-size: 8pt; font-weight: 700; letter-spacing: 1px; margin-top: 6px;
          background: ${qualityStatus === 'rejected' ? '#fee2e2' : qualityStatus === 'good' ? '#dcfce7' : '#fef9c3'};
          color: ${qualityStatus === 'rejected' ? '#991b1b' : qualityStatus === 'good' ? '#166534' : '#854d0e'};
          border: 1px solid ${qualityStatus === 'rejected' ? '#fca5a5' : qualityStatus === 'good' ? '#86efac' : '#fde047'};
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
        thead tr { background: #16a34a; color: #fff; }
        thead th { padding: 8px 10px; text-align: left; font-size: 9pt; font-weight: 600; }
        thead th:not(:first-child) { text-align: center; }
        tbody tr { border-bottom: 1px solid #f1f5f9; }
        tbody tr:nth-child(even) { background: #f8fafc; }
        tbody td { padding: 7px 10px; font-size: 9.5pt; }
        tbody td:not(:first-child) { text-align: center; }

        /* Totals / Summary sidebar */
        .totals-box { border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; }
        .totals-row-item { display: flex; justify-content: space-between; padding: 6px 14px; font-size: 9.5pt; border-bottom: 1px solid #f1f5f9; }
        .totals-row-item .t-label { color: #64748b; }
        .totals-row-item .t-value { font-weight: 600; }
        .totals-grand { display: flex; justify-content: space-between; padding: 10px 14px; background: #16a34a; color: #fff; font-size: 11pt; font-weight: 700; }
        .totals-rej .t-value { color: #dc2626; }

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
        .print-btn { position: fixed; top: 16px; right: 16px; background: #16a34a; color: #fff; border: none; padding: 8px 18px; border-radius: 6px; font-size: 10pt; font-weight: 600; cursor: pointer; }
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
            <div className="doc-title">Goods Receipt Notice</div>
            <div className="doc-po-number">{grn?.grn_number || order.po_number}</div>
            <div><span className="status-badge">{qualityLabel[qualityStatus] || qualityStatus.toUpperCase()}</span></div>
          </div>
        </div>

        {/* ── Main content: details sidebar (left) + line items (right) ── */}
        <div className="content-grid">
          {/* ── Sidebar: Receipt Details, Received By, Supplier, Summary ── */}
          <div className="content-side">
            <div className="meta-box" style={{ marginBottom: 12 }}>
              <div className="meta-box-title">Receipt Details</div>
              <div className="meta-row"><span className="label">GRN Number</span><span className="value">{grn?.grn_number || '—'}</span></div>
              <div className="meta-row"><span className="label">Receipt Date</span><span className="value">{fmtDate(grn?.receipt_date)}</span></div>
              <div className="meta-row"><span className="label">Reference PO</span><span className="value">{order.po_number}</span></div>
              {order.expected_delivery_date && (
                <div className="meta-row"><span className="label">Expected Delivery</span><span className="value">{fmtDate(order.expected_delivery_date)}</span></div>
              )}
            </div>

            <div className="addr-box" style={{ marginBottom: 12 }}>
              <div className="addr-box-title">Received By (Buyer)</div>
              <div className="addr-name">{company?.name || '—'}</div>
              {company?.email && <div className="addr-detail">{company.email}</div>}
              {company?.phone && <div className="addr-detail">{company.phone}</div>}
            </div>

            <div className="addr-box" style={{ marginBottom: 12 }}>
              <div className="addr-box-title">Supplier</div>
              <div className="addr-name">{supplier?.name || '—'}</div>
              {supplier?.contact_person && <div className="addr-detail">Attn: {supplier.contact_person}</div>}
              {supplier?.email && <div className="addr-detail">{supplier.email}</div>}
              {supplier?.phone && <div className="addr-detail">{supplier.phone}</div>}
              {supplier?.address && <div className="addr-detail">{supplier.address}</div>}
            </div>

            <div className="totals-box">
              <div className="section-title" style={{ padding: '10px 14px 0' }}>Receipt Summary</div>
              <div className="totals-row-item"><span className="t-label">Total Ordered</span><span className="t-value">{fmtQty(totalOrdered)}</span></div>
              <div className="totals-row-item"><span className="t-label">Total Accepted</span><span className="t-value">{fmtQty(totalAccepted)}</span></div>
              <div className="totals-row-item totals-rej"><span className="t-label">Total Rejected</span><span className="t-value">{fmtQty(totalRejected)}</span></div>
              <div className="totals-grand"><span>Total Received</span><span>{fmtQty(totalReceived)}</span></div>
            </div>
          </div>

          {/* ── Line Items ── */}
          <div className="content-main">
            <div className="items-section">
              <div className="section-title">Received Items</div>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '34%' }}>Product / Description</th>
                    <th style={{ width: '13%' }}>Qty Ordered</th>
                    <th style={{ width: '13%' }}>Qty Received</th>
                    <th style={{ width: '13%' }}>Accepted</th>
                    <th style={{ width: '13%' }}>Rejected</th>
                    <th style={{ width: '14%' }}>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {receivedItems.length > 0 ? receivedItems.map((item, i) => (
                    <tr key={item.id || i}>
                      <td style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 600 }}>{item.description || item.product_name || `Item ${i + 1}`}</div>
                      </td>
                      <td>{fmtQty(Number(item.quantity_ordered))}</td>
                      <td>{fmtQty(Number(item.quantity_received))}</td>
                      <td style={{ fontWeight: 600 }}>{fmtQty(Number(item.quantity_accepted || 0))}</td>
                      <td style={{ fontWeight: 600, color: Number(item.quantity_rejected) > 0 ? '#dc2626' : undefined }}>
                        {Number(item.quantity_rejected) > 0 ? fmtQty(Number(item.quantity_rejected)) : '—'}
                      </td>
                      <td style={{ fontSize: '8.5pt', color: '#6b7280' }}>
                        {item.rejection_reason ? (rejectionLabels[item.rejection_reason] || item.rejection_reason) : '—'}
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '20px', color: '#9ca3af' }}>No received items</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Notes ── */}
        {grn?.inspection_notes && (
          <div className="notes-box">
            <div className="notes-label">Inspection Notes</div>
            <div className="notes-text">{grn.inspection_notes}</div>
          </div>
        )}

        {/* ── Signatures ── */}
        <div className="sig-section">
          <div className="sig-block">
            <div style={{ height: 32 }} />
            <div className="sig-name">Received by</div>
            <div className="sig-role">Warehouse Staff</div>
          </div>
          <div className="sig-block">
            <div style={{ height: 32 }} />
            <div className="sig-name">Inspected by</div>
            <div className="sig-role">QC / Receiving Officer</div>
          </div>
          <div className="sig-block">
            <div style={{ height: 32 }} />
            <div className="sig-name">Approved by</div>
            <div className="sig-role">Manager / Admin</div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="doc-footer">
          This is an official Goods Receipt Notice issued by {company?.name || 'the company'}.
          &nbsp;&bull;&nbsp; Generated {new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
          &nbsp;&bull;&nbsp; {grn?.grn_number || order.po_number}
        </div>
      </div>
    </>
  );
}
