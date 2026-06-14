'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ExportPayload {
  kpis?: Record<string, number>;
  monthlyRevenue?: { month: string; amount: number }[];
  topProducts?: { name: string; value: number; qty: number; sku: string }[];
  invoiceStatuses?: Record<string, number>;
  poStatuses?: Record<string, number>;
}

export function ExportReportButton({ data }: { data: ExportPayload }) {
  function handleExport() {
    const lines: string[] = [];

    lines.push('SZ Inventory — Reports & Analytics');
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push('');

    lines.push('=== KPIs ===');
    lines.push('Metric,Value');
    for (const [key, val] of Object.entries(data.kpis ?? {})) {
      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
      lines.push(`"${label}",${val}`);
    }
    lines.push('');

    lines.push('=== Monthly Revenue (last 6 months) ===');
    lines.push('Month,Amount (PHP)');
    for (const m of data.monthlyRevenue ?? []) {
      lines.push(`${m.month},${m.amount.toFixed(2)}`);
    }
    lines.push('');

    lines.push('=== Top Products by Stock Value ===');
    lines.push('Product,SKU,Qty on Hand,Stock Value (PHP)');
    for (const p of data.topProducts ?? []) {
      lines.push(`"${p.name}","${p.sku}",${p.qty},${p.value.toFixed(2)}`);
    }
    lines.push('');

    lines.push('=== Invoice Status Breakdown ===');
    lines.push('Status,Count');
    for (const [status, count] of Object.entries(data.invoiceStatuses ?? {})) {
      lines.push(`"${status.replace(/_/g, ' ')}",${count}`);
    }
    lines.push('');

    lines.push('=== Purchase Order Status Breakdown ===');
    lines.push('Status,Count');
    for (const [status, count] of Object.entries(data.poStatuses ?? {})) {
      lines.push(`"${status.replace(/_/g, ' ')}",${count}`);
    }

    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `szinventory-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="primary" icon={<Download className="h-4 w-4" />} onClick={handleExport}>
      Export CSV
    </Button>
  );
}
