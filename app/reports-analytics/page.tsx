'use client';

import { useState, useEffect } from 'react';
import { getLowStockProducts, getStockLevels } from '@/app/actions';
import { AlertTriangle } from 'lucide-react';
import { ExportReportButton } from './export-button';
import { ReportsClient } from './reports-client';
import { AnalyticsBuilder } from './analytics-builder';
import { useWarehouse } from '@/contexts/warehouse-context';
import { fmtWarehouse } from '@/lib/warehouse-utils';

export default function ReportsAnalyticsPage() {
  const { selectedWarehouseId, selectedWarehouse } = useWarehouse();
  const wh = selectedWarehouseId || undefined;

  const [lowStock, setLowStock] = useState<any[]>([]);
  const [outOfStock, setOutOfStock] = useState(0);

  useEffect(() => {
    const load = async () => {
      const [lowStockRes, stockLevelsRes] = await Promise.all([
        getLowStockProducts(),
        getStockLevels(500, 0, wh),
      ]);
      setLowStock(Array.isArray(lowStockRes.data) ? lowStockRes.data : []);
      const levels = Array.isArray(stockLevelsRes.data) ? stockLevelsRes.data : [];
      setOutOfStock(levels.filter((s) => (Number(s.quantity_on_hand) || 0) === 0).length);
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWarehouseId]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Reports & Analytics</h1>
          <p className="text-gray-600 dark:text-gray-400">
            {selectedWarehouse
              ? `📦 ${fmtWarehouse(selectedWarehouse)} · Generate reports or build custom analytics`
              : 'Generate preset reports or build custom analytics'}
          </p>
        </div>
        <ExportReportButton data={{}} />
      </div>

      {/* Inventory Health Alert */}
      {(lowStock.length > 0 || outOfStock > 0) && (
        <div className="card p-4 border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-500">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-900 dark:text-amber-300">Inventory Alerts</p>
              <p className="text-sm text-amber-800 dark:text-amber-400 mt-1">
                {outOfStock > 0 && <span><strong>{outOfStock}</strong> product{outOfStock !== 1 ? 's' : ''} out of stock. </span>}
                {lowStock.length > 0 && <span><strong>{lowStock.length}</strong> product{lowStock.length !== 1 ? 's' : ''} below reorder level.</span>}
              </p>
            </div>
          </div>
        </div>
      )}

      <ReportsClient warehouseId={wh} />
      <AnalyticsBuilder warehouseId={wh} />
    </div>
  );
}
