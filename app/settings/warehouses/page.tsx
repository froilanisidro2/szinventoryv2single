'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, ArrowLeft, Upload, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BulkUploadModal } from '@/components/bulk-upload-modal';
import { toast } from 'sonner';
import { getWarehouses, createWarehouse, updateWarehouse, deleteWarehouse, canAddWarehouse } from '@/app/actions';
import { getCurrentUser } from '@/lib/auth-utils';
import { formatLimit } from '@/lib/plans';

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [warehouseLimit, setWarehouseLimit] = useState<{ current: number; limit: number; allowed: boolean }>({
    current: 0, limit: 999, allowed: true,
  });
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    country: '',
    postal_code: '',
    phone: '',
    manager_name: '',
    notes: '',
    status: 'active' as 'active' | 'inactive',
  });

  useEffect(() => {
    loadWarehouses();
    checkWarehouseLimit();
  }, []);

  const loadWarehouses = async () => {
    try {
      setIsLoading(true);
      const result = await getWarehouses();
      if (result && !result.error && Array.isArray(result.data)) {
        setWarehouses(result.data);
      } else if (result && result.error) {
        toast.error('Failed to load warehouses');
      }
    } catch {
      toast.error('Failed to load warehouses');
    } finally {
      setIsLoading(false);
    }
  };

  const checkWarehouseLimit = async () => {
    const user = getCurrentUser();
    if (!user?.companyId) return;
    const check = await canAddWarehouse(user.companyId);
    setWarehouseLimit({ current: check.current, limit: check.limit, allowed: check.allowed });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Warehouse name is required');
      return;
    }

    try {
      const user = getCurrentUser();
      const companyId = user?.companyId;
      if (!companyId) {
        toast.error('Company information not found. Please log in again.');
        return;
      }

      // Enforce warehouse limit for new warehouses
      if (!editingId) {
        const check = await canAddWarehouse(companyId);
        setWarehouseLimit({ current: check.current, limit: check.limit, allowed: check.allowed });
        if (!check.allowed) {
          toast.error(check.reason ?? 'Warehouse limit reached. Upgrade your plan to add more.');
          return;
        }
      }

      const dataWithCompany = { ...formData, company_id: companyId };
      
      if (editingId) {
        const result = await updateWarehouse(editingId, dataWithCompany);
        if (result.error) {
          toast.error('Failed to update warehouse');
          return;
        }
        toast.success('Warehouse updated successfully');
      } else {
        const result = await createWarehouse(dataWithCompany);
        if (result.error) {
          toast.error('Failed to create warehouse');
          return;
        }
        toast.success('Warehouse created successfully');
      }
      setFormData({
        name: '',
        address: '',
        city: '',
        state: '',
        country: '',
        postal_code: '',
        phone: '',
        manager_name: '',
        notes: '',
        status: 'active',
      });
      setEditingId(null);
      setShowForm(false);
      loadWarehouses();
    } catch (error) {
      toast.error('An error occurred');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this warehouse? Stock levels and bin locations linked to it will also be removed.')) return;
    try {
      const result = await deleteWarehouse(id);
      if (result.error) {
        const msg = result.error.message || '';
        if (msg.includes('foreign key')) {
          toast.error('Cannot delete: this warehouse still has linked records. Remove them first.');
        } else {
          toast.error(`Failed to delete warehouse: ${msg}`);
        }
        return;
      }
      toast.success('Warehouse deleted successfully');
      loadWarehouses();
    } catch (error) {
      toast.error('An error occurred while deleting the warehouse');
    }
  };

  const handleEdit = (warehouse: any) => {
    setFormData({
      name: warehouse.name,
      address: warehouse.address || '',
      city: warehouse.city || '',
      state: warehouse.state || '',
      country: warehouse.country || '',
      postal_code: warehouse.postal_code || '',
      phone: warehouse.phone || '',
      manager_name: warehouse.manager_name || '',
      notes: warehouse.notes || '',
      status: warehouse.status || 'active',
    });
    setEditingId(warehouse.id);
    setShowForm(true);
  };

  const fmtCode = (code: number | null | undefined) =>
    code != null ? String(code).padStart(4, '0') : '—';

  const columns = [
    {
      key: 'code',
      label: 'Code',
      render: (value: number) => (
        <span className="font-mono font-semibold text-gray-700 dark:text-gray-300">
          {fmtCode(value)}
        </span>
      ),
    },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'city', label: 'City', sortable: true },
    { key: 'manager_name', label: 'Manager', sortable: true },
    { key: 'phone', label: 'Phone' },
    {
      key: 'status',
      label: 'Status',
      render: (value: string) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          value === 'active'
            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
        }`}>
          {value}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          
            <Button href="/settings" variant="secondary" size="sm">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Warehouses</h1>
            <p className="text-gray-600 dark:text-gray-400">Manage your warehouse locations</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Warehouse usage badge */}
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
            !warehouseLimit.allowed
              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
          }`}>
            {warehouseLimit.current} / {formatLimit(warehouseLimit.limit)} warehouses
          </span>
          <Button variant="secondary" onClick={() => setShowBulkUpload(true)} icon={<Upload className="h-4 w-4" />}>
            Bulk Upload
          </Button>
          <Button
            onClick={() => setShowForm(!showForm)}
            disabled={!warehouseLimit.allowed && !showForm}
            title={!warehouseLimit.allowed ? `Warehouse limit reached (${warehouseLimit.current}/${formatLimit(warehouseLimit.limit)}). Upgrade your plan.` : undefined}
          >
            <Plus className="h-4 w-4 mr-2" />
            {showForm ? 'Cancel' : 'Add Warehouse'}
          </Button>
        </div>
      </div>

      {/* Limit reached alert */}
      {!warehouseLimit.allowed && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-900 dark:text-red-200">Warehouse Limit Reached</p>
            <p className="text-sm text-red-800 dark:text-red-300 mt-1">
              Your plan allows <strong>{formatLimit(warehouseLimit.limit)}</strong> warehouse{warehouseLimit.limit !== 1 ? 's' : ''}.
              You currently have <strong>{warehouseLimit.current}</strong>.
              Contact your administrator to upgrade your plan and unlock more warehouses.
            </p>
          </div>
        </div>
      )}

      <BulkUploadModal
        isOpen={showBulkUpload}
        onClose={() => setShowBulkUpload(false)}
        entityType="warehouses"
        onUpload={async (data) => {
          const user = getCurrentUser();
          const companyId = user?.companyId;
          if (!companyId) { toast.error('Company not found'); return; }
          for (const row of data) {
            await createWarehouse({ ...row, company_id: companyId });
          }
          await loadWarehouses();
        }}
      />

      {/* Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">
            {editingId ? 'Edit Warehouse' : 'Add New Warehouse'}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Manager Name</label>
              <input
                type="text"
                value={formData.manager_name}
                onChange={(e) => setFormData({ ...formData, manager_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Address</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">City</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                rows={3}
              />
            </div>
            <div className="md:col-span-2 flex gap-2">
              <Button type="submit" variant="primary">
                {editingId ? 'Update' : 'Create'} Warehouse
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">Loading...</div>
        ) : warehouses.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No warehouses found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  {columns.map((col) => (
                    <th key={col.key} className="px-6 py-3 text-left text-sm font-semibold">
                      {col.label}
                    </th>
                  ))}
                  <th className="px-6 py-3 text-right text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {warehouses.map((warehouse) => (
                  <tr key={warehouse.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    {columns.map((col) => (
                      <td key={col.key} className="px-6 py-4 text-sm">
                        {col.render
                          ? (col.render as (v: any) => React.ReactNode)(warehouse[col.key])
                          : warehouse[col.key] || '-'}
                      </td>
                    ))}
                    <td className="px-6 py-4 text-right space-x-1">
                      <button
                        onClick={() => handleEdit(warehouse)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(warehouse.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
