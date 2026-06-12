'use client';

import { useState, useMemo } from 'react';
import {
  Download, Package, Wrench, Layers,
  BarChart2, AlertTriangle, Play, X, ClipboardList, ClipboardCheck, Truck, RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getSalesOrders, getCustomers, getPurchaseOrders, getSuppliers,
  getInvoices, getProducts, getStockLevels,
  getLowStockProducts, getProductCategories, getJobOrders,
  getMaterialRequestItemsForReport, getMaterialIssueSlipItemsForReport,
  getMaterialReturnSlipItemsForReport,
  getProductSupplierMap,
} from '@/app/actions';

// ── helpers ───────────────────────────────────────────────────────────────────

function buildCSV(headers: string[], rows: (string | number)[][]): string {
  return [headers, ...rows]
    .map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

function dlCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function inRange(dateStr: string, from: string, to: string): boolean {
  if (!from && !to) return true;
  const d = new Date(dateStr);
  if (from && d < new Date(from)) return false;
  if (to && d > new Date(to + 'T23:59:59')) return false;
  return true;
}

// ── preset / custom-source factories (warehouse-aware) ────────────────────────

interface PresetReport {
  id: string;
  title: string;
  description: string;
  color: string;
  bgColor: string;
  icon: React.ComponentType<{ className?: string }>;
  hasDateFilter: boolean;
  generate: (from: string, to: string) => Promise<{ headers: string[]; rows: (string | number)[][]; count: number }>;
}

function makePresets(wh?: string): PresetReport[] {
  return [
    {
      id: 'purchase-orders',
      title: 'Purchase Orders',
      description: 'All purchase orders with supplier, status, and spend',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      icon: Package,
      hasDateFilter: true,
      generate: async (from, to) => {
        const [poRes, suppRes] = await Promise.all([getPurchaseOrders(1000, 0, wh), getSuppliers(500)]);
        const orders = Array.isArray(poRes.data) ? poRes.data : [];
        const suppMap: Record<string, string> = {};
        if (Array.isArray(suppRes.data)) suppRes.data.forEach((s: any) => { suppMap[s.id] = s.name; });
        const filtered = orders.filter((o: any) => inRange(o.order_date || o.created_at, from, to));
        const headers = ['PO Number', 'Supplier', 'Order Date', 'Status', 'Subtotal', 'Tax', 'Total Amount', 'Payment Terms'];
        const rows = filtered.map((o: any) => [
          o.po_number, suppMap[o.supplier_id] || '—',
          new Date(o.order_date).toLocaleDateString('en-PH'),
          (o.status || '').replace(/_/g, ' '),
          Number(o.subtotal || 0).toFixed(2), Number(o.tax_amount || 0).toFixed(2),
          Number(o.total_amount || 0).toFixed(2), o.payment_terms || '—',
        ]);
        return { headers, rows, count: rows.length };
      },
    },
    {
      id: 'inventory-valuation',
      title: 'Inventory Valuation',
      description: 'Stock levels with cost and selling value per product',
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-50 dark:bg-cyan-900/20',
      icon: BarChart2,
      hasDateFilter: false,
      generate: async (_from, _to) => {
        const [stockRes, prodRes, catRes] = await Promise.all([
          getStockLevels(1000, 0, wh), getProducts(1000, 0, wh), getProductCategories(100),
        ]);
        const stock = Array.isArray(stockRes.data) ? stockRes.data : [];
        const prodMap: Record<string, any> = {};
        if (Array.isArray(prodRes.data)) prodRes.data.forEach((p: any) => { prodMap[p.id] = p; });
        const catMap: Record<string, string> = {};
        if (Array.isArray(catRes.data)) catRes.data.forEach((c: any) => { catMap[c.id] = c.name; });
        const headers = ['SKU', 'Product', 'Category', 'UOM', 'On Hand', 'Reserved', 'Available', 'Cost Price', 'Selling Price', 'Stock Value (Cost)', 'Stock Value (Selling)'];
        const rows = stock.map((s: any) => {
          const p = prodMap[s.product_id] || {};
          const qty = Number(s.quantity_on_hand || 0);
          const cost = Number(p.cost_price || 0);
          const sell = Number(p.selling_price || 0);
          return [
            p.sku || '—', p.name || '—', catMap[p.category_id] || '—', p.unit_of_measure || '—',
            qty, Number(s.quantity_allocated || 0), Number(s.quantity_available || 0),
            cost.toFixed(2), sell.toFixed(2), (qty * cost).toFixed(2), (qty * sell).toFixed(2),
          ];
        });
        return { headers, rows, count: rows.length };
      },
    },
    {
      id: 'low-stock',
      title: 'Low Stock Alert',
      description: 'Products at or below reorder level needing restock',
      color: 'text-red-600',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      icon: AlertTriangle,
      hasDateFilter: false,
      generate: async (_from, _to) => {
        const [lowRes, prodRes] = await Promise.all([getLowStockProducts(), getProducts(1000, 0, wh)]);
        const low = Array.isArray(lowRes.data) ? lowRes.data : [];
        const prodMap: Record<string, any> = {};
        if (Array.isArray(prodRes.data)) prodRes.data.forEach((p: any) => { prodMap[p.id] = p; });
        const headers = ['SKU', 'Product', 'On Hand', 'Reorder Level', 'Reorder Qty', 'Shortage', 'Cost Price', 'Est. Restock Cost'];
        const rows = low.map((s: any) => {
          const p = prodMap[s.product_id] || {};
          const onHand = Number(s.quantity_on_hand || s.quantity_available || 0);
          const reorderLvl = Number(p.reorder_level || s.reorder_level || 0);
          const reorderQty = Number(p.reorder_quantity || 0);
          const cost = Number(p.cost_price || 0);
          return [
            p.sku || '—', p.name || s.product_name || '—',
            onHand, reorderLvl, reorderQty, Math.max(0, reorderLvl - onHand),
            cost.toFixed(2), (reorderQty * cost).toFixed(2),
          ];
        });
        return { headers, rows, count: rows.length };
      },
    },
    {
      id: 'material-requests',
      title: 'Material Requests (MRF)',
      description: 'MRF line items with status, urgency, and estimated cost',
      color: 'text-amber-600',
      bgColor: 'bg-amber-50 dark:bg-amber-900/20',
      icon: ClipboardList,
      hasDateFilter: true,
      generate: async (from, to) => {
        const itemsRes = await getMaterialRequestItemsForReport();
        const items = Array.isArray(itemsRes.data) ? itemsRes.data : [];
        const filtered = items.filter((i: any) => inRange(i.material_request?.created_at, from, to));
        const headers = ['MRF Number', 'Status', 'Urgency', 'Product', 'SKU', 'Qty Requested', 'UOM', 'Est. Unit Cost', 'Est. Total', 'Requested Date', 'Approved Date'];
        const rows = filtered.map((i: any) => {
          const mrf = i.material_request || {};
          const p = i.product || {};
          const unitCost = Number(p.purchase_price || p.cost_price || 0);
          const qty = Number(i.quantity_requested || 0);
          return [
            mrf.mrf_number || '—', (mrf.status || '').replace(/_/g, ' '), (mrf.urgency_level || '').replace(/_/g, ' '),
            p.name || '—', p.sku || '—', qty, p.unit_of_measure || '—',
            unitCost.toFixed(2), (qty * unitCost).toFixed(2),
            mrf.created_at ? new Date(mrf.created_at).toLocaleDateString('en-PH') : '—',
            mrf.approved_at ? new Date(mrf.approved_at).toLocaleDateString('en-PH') : '—',
          ];
        });
        return { headers, rows, count: rows.length };
      },
    },
    {
      id: 'material-issue-slips',
      title: 'Material Issue Slips (MIS)',
      description: 'Materials issued to job orders with quantities and cost',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
      icon: ClipboardCheck,
      hasDateFilter: true,
      generate: async (from, to) => {
        const [itemsRes, joRes] = await Promise.all([getMaterialIssueSlipItemsForReport(), getJobOrders()]);
        const items = Array.isArray(itemsRes.data) ? itemsRes.data : [];
        const joMap: Record<string, string> = {};
        if (Array.isArray(joRes.data)) joRes.data.forEach((j: any) => { joMap[j.id] = j.jo_number; });
        const filtered = items.filter((i: any) => inRange(i.material_issue_slip?.issued_at || i.material_issue_slip?.created_at, from, to));
        const headers = ['MIS Number', 'Status', 'Job Order', 'Product', 'SKU', 'Qty Issued', 'UOM', 'Unit Cost', 'Total Cost', 'Issued Date'];
        const rows = filtered.map((i: any) => {
          const mis = i.material_issue_slip || {};
          const p = i.product || {};
          const cost = Number(p.cost_price || 0);
          const qty = Number(i.quantity_issued || 0);
          const dateStr = mis.issued_at || mis.created_at;
          return [
            mis.mis_number || '—', (mis.status || '').replace(/_/g, ' '),
            joMap[mis.job_order_id] || '—',
            p.name || '—', p.sku || '—', qty, p.unit_of_measure || '—',
            cost.toFixed(2), (qty * cost).toFixed(2),
            dateStr ? new Date(dateStr).toLocaleDateString('en-PH') : '—',
          ];
        });
        return { headers, rows, count: rows.length };
      },
    },
    {
      id: 'material-return-slips',
      title: 'Returned Items (MRS)',
      description: 'Materials returned from job orders with condition, quantity, and value',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
      icon: RotateCcw,
      hasDateFilter: true,
      generate: async (from, to) => {
        const [itemsRes, joRes] = await Promise.all([getMaterialReturnSlipItemsForReport(), getJobOrders()]);
        const items = Array.isArray(itemsRes.data) ? itemsRes.data : [];
        const joMap: Record<string, string> = {};
        if (Array.isArray(joRes.data)) joRes.data.forEach((j: any) => { joMap[j.id] = j.jo_number; });
        const filtered = items.filter((i: any) => inRange(i.material_return_slip?.returned_at || i.material_return_slip?.created_at, from, to));
        const headers = ['MRS Number', 'Status', 'Job Order', 'Product', 'SKU', 'Qty Returned', 'UOM', 'Condition', 'Unit Cost', 'Total Value', 'Returned Date'];
        const rows = filtered.map((i: any) => {
          const mrs = i.material_return_slip || {};
          const p = i.product || {};
          const cost = Number(p.cost_price || 0);
          const qty = Number(i.quantity_returned || 0);
          const dateStr = mrs.returned_at || mrs.created_at;
          return [
            mrs.mrs_number || '—', (mrs.status || '').replace(/_/g, ' '),
            joMap[mrs.job_order_id] || '—',
            p.name || '—', p.sku || '—', qty, p.unit_of_measure || '—',
            (i.condition || '').replace(/_/g, ' '),
            cost.toFixed(2), (qty * cost).toFixed(2),
            dateStr ? new Date(dateStr).toLocaleDateString('en-PH') : '—',
          ];
        });
        return { headers, rows, count: rows.length };
      },
    },
    {
      id: 'supplier-consumption',
      title: 'Supplier Consumption by Month',
      description: 'Materials consumed (issued to production) per supplier, grouped by month',
      color: 'text-rose-600',
      bgColor: 'bg-rose-50 dark:bg-rose-900/20',
      icon: Truck,
      hasDateFilter: true,
      generate: async (from, to) => {
        const [itemsRes, suppMapRes, suppRes] = await Promise.all([
          getMaterialIssueSlipItemsForReport(), getProductSupplierMap(), getSuppliers(500),
        ]);
        const items = Array.isArray(itemsRes.data) ? itemsRes.data : [];
        const prodSupplier: Record<string, string> = (suppMapRes.data as any) || {};
        const suppMap: Record<string, string> = {};
        if (Array.isArray(suppRes.data)) suppRes.data.forEach((s: any) => { suppMap[s.id] = s.name; });

        const filtered = items.filter((i: any) => inRange(i.material_issue_slip?.issued_at || i.material_issue_slip?.created_at, from, to));
        const groups: Record<string, { supplier: string; monthKey: string; monthLabel: string; qty: number; cost: number; lines: number }> = {};
        for (const i of filtered) {
          const mis = i.material_issue_slip || {};
          const p = i.product || {};
          const supplierId: string | undefined = prodSupplier[i.product_id];
          const supplierName = (supplierId && suppMap[supplierId]) || 'Unassigned';
          const dateStr = mis.issued_at || mis.created_at;
          const d = dateStr ? new Date(dateStr) : null;
          const monthKey = d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : '0000-00';
          const monthLabel = d ? d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short' }) : '—';
          const key = `${supplierName}__${monthKey}`;
          const qty = Number(i.quantity_issued || 0);
          const cost = qty * Number(p.cost_price || 0);
          if (!groups[key]) groups[key] = { supplier: supplierName, monthKey, monthLabel, qty: 0, cost: 0, lines: 0 };
          groups[key].qty += qty;
          groups[key].cost += cost;
          groups[key].lines += 1;
        }
        const headers = ['Supplier', 'Month', 'Qty Consumed', 'Est. Cost', 'Issue Lines'];
        const rows = Object.values(groups)
          .sort((a, b) => a.supplier.localeCompare(b.supplier) || a.monthKey.localeCompare(b.monthKey))
          .map(g => [g.supplier, g.monthLabel, g.qty, g.cost.toFixed(2), g.lines]);
        return { headers, rows, count: rows.length };
      },
    },
    {
      id: 'material-cost-per-jo',
      title: 'Material Cost per JO',
      description: 'Total materials issued and cost for each Job Order',
      color: 'text-teal-600',
      bgColor: 'bg-teal-50 dark:bg-teal-900/20',
      icon: Wrench,
      hasDateFilter: true,
      generate: async (from, to) => {
        const [itemsRes, joRes, custRes] = await Promise.all([
          getMaterialIssueSlipItemsForReport(), getJobOrders(), getCustomers(500),
        ]);
        const items = Array.isArray(itemsRes.data) ? itemsRes.data : [];
        const jos = Array.isArray(joRes.data) ? joRes.data : [];
        const joMap: Record<string, any> = {};
        jos.forEach((j: any) => { joMap[j.id] = j; });
        const custMap: Record<string, string> = {};
        if (Array.isArray(custRes.data)) custRes.data.forEach((c: any) => { custMap[c.id] = c.name; });

        const filtered = items.filter((i: any) => inRange(i.material_issue_slip?.issued_at || i.material_issue_slip?.created_at, from, to));
        const groups: Record<string, { jo: any; qty: number; cost: number; lines: number }> = {};
        for (const i of filtered) {
          const mis = i.material_issue_slip || {};
          const p = i.product || {};
          const joId = mis.job_order_id;
          if (!joId) continue;
          const qty = Number(i.quantity_issued || 0);
          const cost = qty * Number(p.cost_price || 0);
          if (!groups[joId]) groups[joId] = { jo: joMap[joId] || {}, qty: 0, cost: 0, lines: 0 };
          groups[joId].qty += qty;
          groups[joId].cost += cost;
          groups[joId].lines += 1;
        }
        const headers = ['JO Number', 'Title', 'Status', 'Customer', 'Total Qty Issued', 'Total Material Cost', 'Issue Lines', 'Target Completion'];
        const rows = Object.values(groups)
          .sort((a, b) => (a.jo.jo_number || '').localeCompare(b.jo.jo_number || ''))
          .map(g => [
            g.jo.jo_number || '—', g.jo.title || '—', (g.jo.status || '').replace(/_/g, ' '),
            custMap[g.jo.customer_id] || '—',
            g.qty, g.cost.toFixed(2), g.lines,
            g.jo.target_completion_date ? new Date(g.jo.target_completion_date).toLocaleDateString('en-PH') : '—',
          ]);
        return { headers, rows, count: rows.length };
      },
    },
    {
      id: 'material-consumption-per-jo-supplier',
      title: 'Material Consumption & Cost per JO by Supplier',
      description: 'Materials consumed per Job Order, grouped by supplier and item',
      color: 'text-fuchsia-600',
      bgColor: 'bg-fuchsia-50 dark:bg-fuchsia-900/20',
      icon: Layers,
      hasDateFilter: true,
      generate: async (from, to) => {
        const [itemsRes, joRes, suppMapRes, suppRes] = await Promise.all([
          getMaterialIssueSlipItemsForReport(), getJobOrders(), getProductSupplierMap(), getSuppliers(500),
        ]);
        const items = Array.isArray(itemsRes.data) ? itemsRes.data : [];
        const jos = Array.isArray(joRes.data) ? joRes.data : [];
        const joMap: Record<string, any> = {};
        jos.forEach((j: any) => { joMap[j.id] = j; });
        const prodSupplier: Record<string, string> = (suppMapRes.data as any) || {};
        const suppMap: Record<string, string> = {};
        if (Array.isArray(suppRes.data)) suppRes.data.forEach((s: any) => { suppMap[s.id] = s.name; });

        const filtered = items.filter((i: any) => inRange(i.material_issue_slip?.issued_at || i.material_issue_slip?.created_at, from, to));
        const groups: Record<string, { jo: any; supplier: string; product: any; qty: number; cost: number }> = {};
        for (const i of filtered) {
          const mis = i.material_issue_slip || {};
          const p = i.product || {};
          const joId = mis.job_order_id;
          if (!joId) continue;
          const supplierId: string | undefined = prodSupplier[i.product_id];
          const supplierName = (supplierId && suppMap[supplierId]) || 'Unassigned';
          const qty = Number(i.quantity_issued || 0);
          const cost = qty * Number(p.cost_price || 0);
          const key = `${joId}__${supplierName}__${i.product_id}`;
          if (!groups[key]) groups[key] = { jo: joMap[joId] || {}, supplier: supplierName, product: p, qty: 0, cost: 0 };
          groups[key].qty += qty;
          groups[key].cost += cost;
        }
        const headers = ['JO Number', 'Job Title', 'Supplier', 'Product', 'SKU', 'UOM', 'Qty Consumed', 'Unit Cost', 'Total Cost'];
        const rows = Object.values(groups)
          .sort((a, b) =>
            (a.jo.jo_number || '').localeCompare(b.jo.jo_number || '') ||
            a.supplier.localeCompare(b.supplier) ||
            (a.product.name || '').localeCompare(b.product.name || '')
          )
          .map(g => [
            g.jo.jo_number || '—', g.jo.title || '—', g.supplier,
            g.product.name || '—', g.product.sku || '—', g.product.unit_of_measure || '—',
            g.qty, Number(g.product.cost_price || 0).toFixed(2), g.cost.toFixed(2),
          ]);
        return { headers, rows, count: rows.length };
      },
    },
  ];
}

function makeCustomSources(wh?: string) {
  return [
    {
      id: 'sales_orders', label: 'Sales Orders',
      columns: ['SO Number', 'Customer', 'Order Date', 'Status', 'Subtotal', 'Tax Amount', 'Total Amount', 'Payment Terms', 'Notes'],
      statusOptions: ['draft', 'confirmed', 'picked', 'partially_shipped', 'delivered', 'cancelled'],
      fetch: async () => {
        const [soRes, custRes] = await Promise.all([getSalesOrders(1000, 0, wh), getCustomers(500)]);
        const orders = Array.isArray(soRes.data) ? soRes.data : [];
        const custMap: Record<string, string> = {};
        if (Array.isArray(custRes.data)) custRes.data.forEach((c: any) => { custMap[c.id] = c.name; });
        return orders.map((o: any) => ({
          'SO Number': o.so_number, 'Customer': custMap[o.customer_id] || '—',
          'Order Date': new Date(o.order_date).toLocaleDateString('en-PH'),
          'Status': (o.status || '').replace(/_/g, ' '),
          'Subtotal': Number(o.subtotal || 0).toFixed(2),
          'Tax Amount': Number(o.tax_amount || 0).toFixed(2),
          'Total Amount': Number(o.total_amount || 0).toFixed(2),
          'Payment Terms': o.payment_terms || '—', 'Notes': o.notes || '—',
          _date: o.order_date, _status: o.status,
        }));
      },
    },
    {
      id: 'purchase_orders', label: 'Purchase Orders',
      columns: ['PO Number', 'Supplier', 'Order Date', 'Status', 'Subtotal', 'Tax Amount', 'Total Amount', 'Payment Terms', 'Notes'],
      statusOptions: ['draft', 'confirmed', 'sent', 'partially_received', 'received', 'cancelled'],
      fetch: async () => {
        const [poRes, suppRes] = await Promise.all([getPurchaseOrders(1000, 0, wh), getSuppliers(500)]);
        const orders = Array.isArray(poRes.data) ? poRes.data : [];
        const suppMap: Record<string, string> = {};
        if (Array.isArray(suppRes.data)) suppRes.data.forEach((s: any) => { suppMap[s.id] = s.name; });
        return orders.map((o: any) => ({
          'PO Number': o.po_number, 'Supplier': suppMap[o.supplier_id] || '—',
          'Order Date': new Date(o.order_date).toLocaleDateString('en-PH'),
          'Status': (o.status || '').replace(/_/g, ' '),
          'Subtotal': Number(o.subtotal || 0).toFixed(2),
          'Tax Amount': Number(o.tax_amount || 0).toFixed(2),
          'Total Amount': Number(o.total_amount || 0).toFixed(2),
          'Payment Terms': o.payment_terms || '—', 'Notes': o.notes || '—',
          _date: o.order_date, _status: o.status,
        }));
      },
    },
    {
      id: 'invoices', label: 'Invoices',
      columns: ['Invoice #', 'Customer', 'Issue Date', 'Due Date', 'Total Amount', 'Amount Paid', 'Balance', 'Status'],
      statusOptions: ['draft', 'pending', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled'],
      fetch: async () => {
        const [invRes, custRes] = await Promise.all([getInvoices(1000, 0, wh), getCustomers(500)]);
        const invoices = (Array.isArray(invRes.data) ? invRes.data : []).filter((i: any) => i.order_type === 'sales_order' || (!i.order_type && !i.supplier_id));
        const custMap: Record<string, string> = {};
        if (Array.isArray(custRes.data)) custRes.data.forEach((c: any) => { custMap[c.id] = c.name; });
        return invoices.map((i: any) => {
          const total = Number(i.total_amount || 0); const paid = Number(i.amount_paid || 0);
          return {
            'Invoice #': i.invoice_number, 'Customer': custMap[i.customer_id] || '—',
            'Issue Date': i.issue_date || i.invoice_date ? new Date(i.issue_date || i.invoice_date).toLocaleDateString('en-PH') : '—',
            'Due Date': i.due_date ? new Date(i.due_date).toLocaleDateString('en-PH') : '—',
            'Total Amount': total.toFixed(2), 'Amount Paid': paid.toFixed(2),
            'Balance': Math.max(0, total - paid).toFixed(2),
            'Status': (i.status || '').replace(/_/g, ' '),
            _date: i.issue_date || i.invoice_date || i.created_at, _status: i.status,
          };
        });
      },
    },
    {
      id: 'products', label: 'Products',
      columns: ['SKU', 'Name', 'Category', 'Supplier', 'UOM', 'Cost Price', 'Selling Price', 'Reorder Level', 'Status', 'Description'],
      statusOptions: ['active', 'inactive'],
      fetch: async () => {
        const [prodRes, catRes, suppRes, prodSuppRes] = await Promise.all([getProducts(1000, 0, wh), getProductCategories(100), getSuppliers(500), getProductSupplierMap()]);
        const products = Array.isArray(prodRes.data) ? prodRes.data : [];
        const catMap: Record<string, string> = {};
        if (Array.isArray(catRes.data)) catRes.data.forEach((c: any) => { catMap[c.id] = c.name; });
        const suppMap: Record<string, string> = {};
        if (Array.isArray(suppRes.data)) suppRes.data.forEach((s: any) => { suppMap[s.id] = s.name; });
        const prodSupplier: Record<string, string> = (prodSuppRes.data as any) || {};
        return products.map((p: any) => ({
          'SKU': p.sku, 'Name': p.name, 'Category': catMap[p.category_id] || '—',
          'Supplier': (prodSupplier[p.id] && suppMap[prodSupplier[p.id] as string]) || '—',
          'UOM': p.unit_of_measure || '—',
          'Cost Price': Number(p.cost_price || 0).toFixed(2),
          'Selling Price': Number(p.selling_price || 0).toFixed(2),
          'Reorder Level': p.reorder_level ?? '—',
          'Status': p.status || '—', 'Description': p.description || '—',
          _date: p.created_at, _status: p.status,
        }));
      },
    },
    {
      id: 'inventory', label: 'Inventory / Stock Levels',
      columns: ['SKU', 'Product', 'Category', 'Supplier', 'On Hand', 'Reserved', 'Available', 'Cost Price', 'Stock Value'],
      statusOptions: [] as string[],
      fetch: async () => {
        const [stockRes, prodRes, catRes, suppRes, prodSuppRes] = await Promise.all([getStockLevels(1000, 0, wh), getProducts(1000, 0, wh), getProductCategories(100), getSuppliers(500), getProductSupplierMap()]);
        const stock = Array.isArray(stockRes.data) ? stockRes.data : [];
        const prodMap: Record<string, any> = {};
        if (Array.isArray(prodRes.data)) prodRes.data.forEach((p: any) => { prodMap[p.id] = p; });
        const catMap: Record<string, string> = {};
        if (Array.isArray(catRes.data)) catRes.data.forEach((c: any) => { catMap[c.id] = c.name; });
        const suppMap: Record<string, string> = {};
        if (Array.isArray(suppRes.data)) suppRes.data.forEach((s: any) => { suppMap[s.id] = s.name; });
        const prodSupplier: Record<string, string> = (prodSuppRes.data as any) || {};
        return stock.map((s: any) => {
          const p = prodMap[s.product_id] || {};
          const qty = Number(s.quantity_on_hand || 0);
          const cost = Number(p.cost_price || 0);
          return {
            'SKU': p.sku || '—', 'Product': p.name || '—', 'Category': catMap[p.category_id] || '—',
            'Supplier': (prodSupplier[p.id] && suppMap[prodSupplier[p.id] as string]) || '—',
            'On Hand': qty, 'Reserved': Number(s.quantity_allocated || 0),
            'Available': Number(s.quantity_available || 0),
            'Cost Price': cost.toFixed(2), 'Stock Value': (qty * cost).toFixed(2),
            _date: s.updated_at || s.created_at, _status: '',
          };
        });
      },
    },
  ];
}

// ── component ─────────────────────────────────────────────────────────────────

type PreviewResult = { id: string; headers: string[]; rows: (string | number)[][]; count: number };

export function ReportsClient({ warehouseId }: { warehouseId?: string }) {
  const PRESETS = useMemo(() => makePresets(warehouseId), [warehouseId]);
  const CUSTOM_SOURCES = useMemo(() => makeCustomSources(warehouseId), [warehouseId]);
  const [activeTab, setActiveTab] = useState<'preset' | 'custom'>('preset');

  // preset state
  const [presetDates, setPresetDates] = useState<Record<string, { from: string; to: string }>>({});
  const [generating, setGenerating] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);

  // custom state
  const [source, setSource] = useState('');
  const [columns, setColumns] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [building, setBuilding] = useState(false);
  const [customPreview, setCustomPreview] = useState<{ headers: string[]; rows: (string | number)[][] } | null>(null);

  const getDate = (id: string) => presetDates[id] || { from: '', to: '' };

  const handleGenerate = async (preset: PresetReport) => {
    const { from, to } = getDate(preset.id);
    setGenerating(preset.id);
    try {
      const result = await preset.generate(from, to);
      setPreview({ id: preset.id, ...result });
    } catch {
      toast.error('Failed to generate report');
    } finally {
      setGenerating(null);
    }
  };

  const handleDownloadPreset = (preset: PresetReport) => {
    if (!preview || preview.id !== preset.id) return;
    const { from, to } = getDate(preset.id);
    const suffix = (from || to) ? `_${from || 'start'}_to_${to || 'end'}` : '';
    dlCSV(buildCSV(preview.headers, preview.rows), `${preset.id}${suffix}_${new Date().toISOString().split('T')[0]}.csv`);
    toast.success(`Downloaded ${preview.count} rows`);
  };

  const handleSourceChange = (id: string) => {
    const src = CUSTOM_SOURCES.find(s => s.id === id);
    setSource(id);
    setColumns(src ? [...src.columns] : []);
    setStatusFilter('');
    setCustomPreview(null);
  };

  const toggleCol = (col: string) =>
    setColumns(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);

  const handleBuild = async () => {
    const src = CUSTOM_SOURCES.find(s => s.id === source);
    if (!src || columns.length === 0) return;
    setBuilding(true);
    try {
      const data = await src.fetch();
      const filtered = data.filter((row: any) => {
        if ((dateFrom || dateTo) && !inRange(row._date, dateFrom, dateTo)) return false;
        if (statusFilter && row._status !== statusFilter) return false;
        return true;
      });
      setCustomPreview({
        headers: columns,
        rows: filtered.map((row: any) => columns.map(col => row[col] ?? '')),
      });
    } catch {
      toast.error('Failed to fetch data');
    } finally {
      setBuilding(false);
    }
  };

  const handleDownloadCustom = () => {
    if (!customPreview) return;
    const src = CUSTOM_SOURCES.find(s => s.id === source);
    dlCSV(buildCSV(customPreview.headers, customPreview.rows),
      `custom_${src?.id || 'report'}_${new Date().toISOString().split('T')[0]}.csv`);
    toast.success(`Downloaded ${customPreview.rows.length} rows`);
  };

  const currentSrc = CUSTOM_SOURCES.find(s => s.id === source);

  return (
    <div className="space-y-6">
      {/* Section heading */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Generate Reports</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Run preset reports or build a custom export.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {([['preset', 'Preset Reports'], ['custom', 'Custom Builder']] as const).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── PRESET REPORTS ── */}
      {activeTab === 'preset' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {PRESETS.map((preset) => {
              const { from, to } = getDate(preset.id);
              const isActive = preview?.id === preset.id;
              const isGen = generating === preset.id;
              const Icon = preset.icon;
              return (
                <div key={preset.id} className={`card p-5 space-y-4 ${isActive ? 'ring-2 ring-primary-500 dark:ring-primary-400' : ''}`}>
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${preset.bgColor} shrink-0`}>
                      <Icon className={`h-5 w-5 ${preset.color}`} />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">{preset.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{preset.description}</p>
                    </div>
                  </div>

                  {preset.hasDateFilter && (
                    <div className="flex gap-2 items-center">
                      <input
                        type="date"
                        value={from}
                        onChange={e => setPresetDates(prev => ({ ...prev, [preset.id]: { ...getDate(preset.id), from: e.target.value } }))}
                        className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                      <span className="text-xs text-gray-400">–</span>
                      <input
                        type="date"
                        value={to}
                        onChange={e => setPresetDates(prev => ({ ...prev, [preset.id]: { ...getDate(preset.id), to: e.target.value } }))}
                        className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleGenerate(preset)}
                      disabled={isGen}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-50 transition-colors"
                    >
                      <Play className="h-3 w-3" />
                      {isGen ? 'Loading…' : 'Preview'}
                    </button>
                    <button
                      onClick={() => handleDownloadPreset(preset)}
                      disabled={!isActive}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-40 transition-colors"
                    >
                      <Download className="h-3 w-3" />
                      CSV
                    </button>
                  </div>
                  {isActive && (
                    <p className="text-xs text-primary-600 dark:text-primary-400">
                      {preview!.count} row{preview!.count !== 1 ? 's' : ''} ready
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Preview table */}
          {preview && (
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  {PRESETS.find(p => p.id === preview.id)?.title} — {preview.count} row{preview.count !== 1 ? 's' : ''}
                </span>
                <button onClick={() => setPreview(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                    <tr>
                      {preview.headers.map(h => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {preview.rows.slice(0, 20).map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        {row.map((cell, j) => (
                          <td key={j} className="px-3 py-1.5 text-gray-700 dark:text-gray-300 whitespace-nowrap">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.count > 20 && (
                <p className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100 dark:border-gray-700">
                  Showing first 20 of {preview.count} rows — download CSV for full data.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── CUSTOM BUILDER ── */}
      {activeTab === 'custom' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Step 1 */}
            <div className="card p-5 space-y-3">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">1 — Data Source</p>
              <div className="space-y-2">
                {CUSTOM_SOURCES.map(src => (
                  <label key={src.id} className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="radio"
                      name="custom-source"
                      value={src.id}
                      checked={source === src.id}
                      onChange={() => handleSourceChange(src.id)}
                      className="accent-primary-600"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{src.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Step 2 */}
            <div className="card p-5 space-y-3">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">2 — Columns</p>
              {!source ? (
                <p className="text-xs text-gray-400 italic">Select a data source first</p>
              ) : (
                <div className="space-y-1.5">
                  {currentSrc?.columns.map(col => (
                    <label key={col} className="flex items-center gap-2 cursor-pointer" onClick={() => toggleCol(col)}>
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                        columns.includes(col)
                          ? 'bg-primary-600 border-primary-600'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}>
                        {columns.includes(col) && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8">
                            <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      <span className="text-xs text-gray-700 dark:text-gray-300">{col}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Step 3 */}
            <div className="card p-5 space-y-3">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">3 — Filters & Run</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Date From</label>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Date To</label>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                {currentSrc && currentSrc.statusOptions.length > 0 && (
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Status</label>
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                      <option value="">All</option>
                      {currentSrc.statusOptions.map(s => (
                        <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <button
                onClick={handleBuild}
                disabled={!source || columns.length === 0 || building}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-40 transition-colors mt-1"
              >
                <Play className="h-3.5 w-3.5" />
                {building ? 'Building…' : 'Build Report'}
              </button>
            </div>
          </div>

          {/* Custom preview */}
          {customPreview && (
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  {customPreview.rows.length} row{customPreview.rows.length !== 1 ? 's' : ''}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadCustom}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
                  >
                    <Download className="h-3 w-3" />
                    Download CSV
                  </button>
                  <button onClick={() => setCustomPreview(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                    <tr>
                      {customPreview.headers.map(h => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {customPreview.rows.slice(0, 20).map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        {row.map((cell, j) => (
                          <td key={j} className="px-3 py-1.5 text-gray-700 dark:text-gray-300 whitespace-nowrap">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {customPreview.rows.length > 20 && (
                <p className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100 dark:border-gray-700">
                  Showing first 20 of {customPreview.rows.length} rows — download CSV for full data.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
