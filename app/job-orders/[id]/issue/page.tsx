'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, PackageOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { fmtUser } from '@/lib/warehouse-utils';
import {
  getJobOrderById,
  getJobOrderBOM,
  getBinLocationsByWarehouse,
  createMaterialIssueSlip,
  issueMaterials,
  getCompanyUsers,
  getStockLevelsForProducts,
} from '@/app/actions';

interface IssueRow {
  bomId: string;
  productId: string;
  productName: string;
  productSku: string;
  quantityRequired: number;
  quantityIssued: number;
  alreadyIssued: number;
  binLocationId: string;
  notes: string;
  issuedAt: string;
  receivedByUserId: string;
  receivedBySearch: string;
  fullyIssued: boolean;
  availableQty: number;
}

export default function IssueMaterialsPage() {
  const params = useParams();
  const router = useRouter();
  const joId = params.id as string;

  const [jobTitle, setJobTitle] = useState('');
  const [joNumber, setJoNumber] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [rows, setRows] = useState<IssueRow[]>([]);
  const [bins, setBins] = useState<any[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openReceiverRow, setOpenReceiverRow] = useState<string | null>(null);
  const [bulkReceiverId, setBulkReceiverId] = useState('');
  const [bulkReceiverSearch, setBulkReceiverSearch] = useState('');
  const [bulkReceiverOpen, setBulkReceiverOpen] = useState(false);
  const [bulkDate, setBulkDate] = useState(new Date().toISOString().split('T')[0] as string);

  useEffect(() => {
    loadData();
  }, [joId]);

  async function loadData() {
    setIsLoading(true);
    try {
      const [jobRes, bomRes, usersRes] = await Promise.all([
        getJobOrderById(joId),
        getJobOrderBOM(joId),
        getCompanyUsers(),
      ]);
      if (jobRes.error || !jobRes.data) {
        toast.error('Job order not found');
        router.push('/job-orders');
        return;
      }
      const job = jobRes.data;
      setJobTitle(job.title);
      setJoNumber(job.jo_number);
      setWarehouseId(job.warehouse_id || '');

      let availableBins: any[] = [];
      if (job.warehouse_id) {
        const binsRes = await getBinLocationsByWarehouse(job.warehouse_id);
        availableBins = Array.isArray(binsRes.data) ? binsRes.data : [];
        setBins(availableBins);
      }

      if (!usersRes.error) {
        const map = usersRes.data ?? {};
        setUsers(Object.entries(map).map(([id, name]) => ({ id, name: name as string })));
      }

      const bomItems: any[] = Array.isArray(bomRes.data) ? bomRes.data : [];

      let stockMap: Record<string, number> = {};
      if (job.warehouse_id) {
        const productIds = bomItems.map(item => item.product_id).filter(Boolean);
        const stockRes = await getStockLevelsForProducts(productIds, job.warehouse_id);
        const levels: any[] = Array.isArray(stockRes.data) ? stockRes.data : [];
        stockMap = levels.reduce((acc: Record<string, number>, lvl: any) => {
          acc[lvl.product_id] = Number(lvl.quantity_available ?? 0);
          return acc;
        }, {});
      }

      setRows(bomItems.map(item => {
        const productBinId = item.product?.bin_location_id || '';
        const defaultBinId = availableBins.some((b: any) => b.id === productBinId) ? productBinId : '';
        return {
          bomId: item.id,
          productId: item.product_id || '',
          productName: item.product?.name || item.product_name || item.product_id || '—',
          productSku: item.product?.sku || item.product_sku || '',
          quantityRequired: Number(item.quantity_required || 0),
          alreadyIssued: Number(item.quantity_issued || 0),
          fullyIssued: Number(item.quantity_issued || 0) >= Number(item.quantity_required || 0),
          quantityIssued: Math.max(0, Number(item.quantity_required || 0) - Number(item.quantity_issued || 0)),
          binLocationId: defaultBinId,
          notes: '',
          issuedAt: new Date().toISOString().split('T')[0] as string,
          receivedByUserId: '',
          receivedBySearch: '',
          availableQty: stockMap[item.product_id] ?? 0,
        };
      }));
    } catch {
      toast.error('Error loading data');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleIssue() {
    const itemsToIssue = rows.filter(r => r.productId && r.quantityIssued > 0 && !r.fullyIssued);
    if (itemsToIssue.length === 0) {
      toast.error('Enter quantities to issue for at least one material');
      return;
    }
    const missingReceiver = itemsToIssue.find(r => !r.receivedByUserId);
    if (missingReceiver) {
      toast.error(`Select "Received By" for ${missingReceiver.productName}`);
      return;
    }

    setIsSubmitting(true);
    try {
      // Group items by date — each date gets its own MIS
      const today = new Date().toISOString().split('T')[0];
      // Group by date + receiver — each unique combo gets its own MIS slip
      const byGroup: Record<string, IssueRow[]> = {};
      itemsToIssue.forEach(r => {
        const key: string = `${(r.issuedAt ?? today)}__${r.receivedByUserId}`;
        if (!byGroup[key]) byGroup[key] = [];
        (byGroup[key] as IssueRow[]).push(r);
      });

      let created = 0;

      for (const [key, items] of Object.entries(byGroup)) {
        const parts = key.split('__');
        const date = parts[0] ?? today;
        const receiverId = parts[1] ?? '';
        const createRes = await createMaterialIssueSlip(
          joId,
          warehouseId || undefined,
          items.map(r => ({
            product_id: r.productId,
            job_order_bom_id: r.bomId,
            quantity_issued: r.quantityIssued,
            bin_location_id: r.binLocationId || undefined,
            notes: r.notes || undefined,
          })),
          date ? new Date(date).toISOString() : undefined
        );
        if (createRes.error) {
          toast.error(`Failed to create MIS: ` + createRes.error.message);
          continue;
        }
        const issueRes = await issueMaterials(createRes.data.id, receiverId);
        if (issueRes.error) {
          toast.error(`MIS created but stock deduction failed: ` + issueRes.error.message);
          continue;
        }
        created++;
      }

      if (created > 0) {
        toast.success(`${created} Issue Slip${created > 1 ? 's' : ''} created and stock updated`);
        router.push(`/job-orders/${joId}`);
      }
    } catch {
      toast.error('Unexpected error issuing materials');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-20 text-gray-500">Loading…</div>;
  }

  return (
    <div className="flex-1 space-y-6 p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href={`/job-orders/${joId}`}>
          <Button variant="secondary" size="sm" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to JO
          </Button>
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <PackageOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Issue Materials</h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {joNumber} — {jobTitle}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20 p-4 text-sm text-blue-700 dark:text-blue-300">
        Stock will be deducted immediately when you click <strong>Issue Materials</strong>. Each row can have its own issue date — items with different dates will generate separate Issue Slips.
      </div>

      {/* Bulk receiver / date — applies to all rows */}
      <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 p-4 flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
          Date Received (apply to all):
        </label>
        <input
          type="date"
          value={bulkDate}
          onChange={e => {
            setBulkDate(e.target.value);
            setRows(prev => prev.map(r => r.fullyIssued ? r : { ...r, issuedAt: e.target.value }));
          }}
          className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
          Received By (apply to all):
        </label>
        <div className="relative w-64">
          <input
            type="text"
            placeholder="Search user…"
            value={bulkReceiverId
              ? (users.find(u => u.id === bulkReceiverId) ? fmtUser(users.find(u => u.id === bulkReceiverId)!) : bulkReceiverSearch)
              : bulkReceiverSearch}
            onChange={e => { setBulkReceiverSearch(e.target.value); setBulkReceiverId(''); }}
            onFocus={() => setBulkReceiverOpen(true)}
            onBlur={() => setTimeout(() => setBulkReceiverOpen(false), 150)}
            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {bulkReceiverOpen && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl max-h-48 overflow-y-auto">
              {users.filter(u => fmtUser(u).toLowerCase().includes(bulkReceiverSearch.toLowerCase())).length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500">No users found</div>
              ) : (
                users
                  .filter(u => fmtUser(u).toLowerCase().includes(bulkReceiverSearch.toLowerCase()))
                  .map(u => (
                    <button
                      key={u.id}
                      onMouseDown={() => {
                        setBulkReceiverId(u.id);
                        setBulkReceiverSearch(fmtUser(u));
                        setRows(prev => prev.map(r => r.fullyIssued ? r : { ...r, receivedByUserId: u.id, receivedBySearch: fmtUser(u) }));
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50 dark:hover:bg-primary-900/20 border-b border-gray-100 dark:border-gray-700 last:border-0 text-gray-900 dark:text-white"
                    >
                      {fmtUser(u)}
                    </button>
                  ))
              )}
            </div>
          )}
        </div>
        <span className="text-xs text-gray-400">Fills in &quot;Received By&quot; for every row below (you can still change individual rows)</span>
      </div>


      {/* Materials table */}
      <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 rounded-t-lg">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Materials from BOM</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Adjust quantities if issuing partial amounts</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Material</th>
              <th className="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">BOM Qty</th>
              <th className="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Available</th>
              <th className="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400 w-24">Issue Now</th>
              <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Date</th>
              <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Received By <span className="text-red-400">*</span></th>
              <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Bin</th>
              <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map(row => (
              <tr key={row.bomId} className={row.fullyIssued ? 'opacity-40 bg-gray-50 dark:bg-gray-900/40' : ''}>
                <td className="px-4 py-2">
                  <p className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                    {row.productName}
                    {row.fullyIssued && (
                      <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-1.5 py-0.5 rounded font-normal">
                        Fully Issued
                      </span>
                    )}
                  </p>
                  {row.productSku && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{row.productSku}</p>
                  )}
                </td>
                <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-400">
                  {row.quantityRequired.toLocaleString()}
                </td>
                <td className={`px-4 py-2 text-right font-medium ${row.availableQty < row.quantityIssued ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`}>
                  {row.availableQty.toLocaleString()}
                  {row.availableQty < row.quantityIssued && (
                    <div>
                      <Link
                        href={`/material-requests/create?product_id=${row.productId}&qty=${Math.ceil(row.quantityIssued - row.availableQty)}&job_order_id=${joId}&jo_number=${encodeURIComponent(joNumber)}`}
                        className="text-xs font-normal text-amber-600 dark:text-amber-400 hover:underline whitespace-nowrap"
                      >
                        Short {Math.ceil(row.quantityIssued - row.availableQty).toLocaleString()} — Create MRF
                      </Link>
                    </div>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={row.quantityIssued}
                    disabled={row.fullyIssued}
                    onChange={e => setRows(prev =>
                      prev.map(r => r.bomId === row.bomId ? { ...r, quantityIssued: Number(e.target.value) } : r)
                    )}
                    className="w-20 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-right text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="date"
                    value={row.issuedAt}
                    disabled={row.fullyIssued}
                    onChange={e => setRows(prev =>
                      prev.map(r => r.bomId === row.bomId ? { ...r, issuedAt: e.target.value } : r)
                    )}
                    className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </td>
                <td className="px-4 py-2 relative">
                  <input
                    type="text"
                    placeholder="Search user…"
                    value={row.receivedByUserId
                      ? (users.find(u => u.id === row.receivedByUserId) ? fmtUser(users.find(u => u.id === row.receivedByUserId)!) : row.receivedBySearch)
                      : row.receivedBySearch}
                    disabled={row.fullyIssued}
                    onChange={e => setRows(prev =>
                      prev.map(r => r.bomId === row.bomId ? { ...r, receivedBySearch: e.target.value, receivedByUserId: '' } : r)
                    )}
                    onFocus={() => setOpenReceiverRow(row.bomId)}
                    onBlur={() => setTimeout(() => setOpenReceiverRow(prev => prev === row.bomId ? null : prev), 150)}
                    className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  {openReceiverRow === row.bomId && !row.fullyIssued && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl max-h-48 overflow-y-auto min-w-[160px]">
                      {users.filter(u => fmtUser(u).toLowerCase().includes(row.receivedBySearch.toLowerCase())).length === 0 ? (
                        <div className="px-3 py-2 text-sm text-gray-500">No users found</div>
                      ) : (
                        users
                          .filter(u => fmtUser(u).toLowerCase().includes(row.receivedBySearch.toLowerCase()))
                          .map(u => (
                            <button
                              key={u.id}
                              onMouseDown={() => setRows(prev =>
                                prev.map(r => r.bomId === row.bomId ? { ...r, receivedByUserId: u.id, receivedBySearch: fmtUser(u) } : r)
                              )}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50 dark:hover:bg-primary-900/20 border-b border-gray-100 dark:border-gray-700 last:border-0 text-gray-900 dark:text-white"
                            >
                              {fmtUser(u)}
                            </button>
                          ))
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2">
                  {bins.length > 0 ? (
                    <select
                      value={row.binLocationId}
                      disabled={row.fullyIssued}
                      onChange={e => setRows(prev =>
                        prev.map(r => r.bomId === row.bomId ? { ...r, binLocationId: e.target.value } : r)
                      )}
                      className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">— Any —</option>
                      {bins.map((b: any) => (
                        <option key={b.id} value={b.id}>
                          {b.location_name || `${b.zone}-${b.aisle}-${b.shelf}-${b.bin_number}`}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs text-gray-400">No bins configured</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <input
                    type="text"
                    placeholder="Optional"
                    value={row.notes}
                    disabled={row.fullyIssued}
                    onChange={e => setRows(prev =>
                      prev.map(r => r.bomId === row.bomId ? { ...r, notes: e.target.value } : r)
                    )}
                    className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end gap-3">
        <Link href={`/job-orders/${joId}`}>
          <Button variant="secondary">Cancel</Button>
        </Link>
        <Button
          onClick={handleIssue}
          disabled={isSubmitting}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <PackageOpen className="h-4 w-4 mr-1" />
          {isSubmitting ? 'Issuing…' : 'Issue Materials'}
        </Button>
      </div>
    </div>
  );
}
