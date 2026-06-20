'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, ArrowLeft, Search, Upload, Copy, Check } from 'lucide-react';
import { fmtCode } from '@/lib/warehouse-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BulkUploadModal } from '@/components/bulk-upload-modal';
import { toast } from 'sonner';
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from '@/app/actions';

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };
  const [formData, setFormData] = useState({
    supplier_code: '',
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    country: '',
    postal_code: '',
    contact_person: '',
    business_category: 'manufacturing',
    payment_terms: '',
    vat_type: 'non_vat' as 'vat' | 'non_vat',
    vat_rate: '' as string,
    status: 'active' as 'active' | 'inactive',
  });

  const emptyForm = {
    supplier_code: '',
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    country: '',
    postal_code: '',
    contact_person: '',
    business_category: 'manufacturing',
    payment_terms: '',
    vat_type: 'non_vat' as 'vat' | 'non_vat',
    vat_rate: '' as string,
    status: 'active' as 'active' | 'inactive',
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    try {
      setIsLoading(true);
      const result = await getSuppliers();
      if (result && !result.error && Array.isArray(result.data)) {
        setSuppliers(result.data);
      } else if (result && result.error) {
        console.error('Error loading suppliers:', result.error);
        toast.error('Failed to load suppliers');
      }
    } catch (error) {
      console.error('Exception loading suppliers:', error);
      toast.error('Failed to load suppliers');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast.error('Supplier name is required'); return; }
    if (!formData.supplier_code.trim()) { toast.error('Supplier code is required'); return; }

    const payload = {
      ...formData,
      vat_rate: formData.vat_type === 'vat' && formData.vat_rate !== '' ? parseFloat(formData.vat_rate) : null,
    };

    try {
      if (editingId) {
        const result = await updateSupplier(editingId, payload);
        if (result && !result.error) {
          toast.success('Supplier updated');
          resetForm();
          await loadSuppliers();
        } else {
          const msg = typeof (result as any)?.error === 'object' ? ((result as any).error)?.message : (result as any)?.error;
          toast.error(msg || 'Failed to update supplier');
        }
      } else {
        const result = await createSupplier(payload as any);
        if (result && !result.error) {
          toast.success('Supplier created');
          resetForm();
          await loadSuppliers();
        } else {
          const msg = typeof (result as any)?.error === 'object' ? ((result as any).error)?.message : (result as any)?.error;
          toast.error(msg || 'Failed to create supplier');
        }
      }
    } catch (error) {
      toast.error('Failed to save supplier');
    }
  };

  const handleEdit = (item: any) => {
    setFormData({
      supplier_code: item.supplier_code || '',
      name: item.name || '',
      email: item.email || '',
      phone: item.phone || '',
      address: item.address || '',
      city: item.city || '',
      state: item.state || '',
      country: item.country || '',
      postal_code: item.postal_code || '',
      contact_person: item.contact_person || '',
      business_category: item.business_category || 'manufacturing',
      payment_terms: item.payment_terms || '',
      vat_type: (item.vat_type as 'vat' | 'non_vat') || 'non_vat',
      vat_rate: item.vat_rate != null ? String(item.vat_rate) : '',
      status: (item.status as 'active' | 'inactive') || 'active',
    });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this supplier? This cannot be undone.')) return;
    try {
      const result = await deleteSupplier(id);
      if (result && !result.error) {
        toast.success('Supplier deleted');
        await loadSuppliers();
      } else {
        const msg = typeof (result as any)?.error === 'object' ? ((result as any).error)?.message : (result as any)?.error;
        toast.error(msg || 'Failed to delete supplier');
      }
    } catch {
      toast.error('Failed to delete supplier');
    }
  };

  const filteredSuppliers = suppliers.filter((s) =>
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Suppliers Management</h1>
            <p className="text-gray-600 dark:text-gray-400">Create and manage supplier information</p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-2">
        <Search className="h-5 w-5 text-gray-400" />
        <Input
          placeholder="Search suppliers by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1"
        />
        {!showForm && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowBulkUpload(true)} icon={<Upload className="h-4 w-4" />}>
              Bulk Upload
            </Button>
            <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setShowForm(true)}>
              Add Supplier
            </Button>
          </div>
        )}
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {editingId ? 'Edit Supplier' : 'New Supplier'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Supplier Code"
                value={formData.supplier_code}
                onChange={(e) => setFormData({ ...formData, supplier_code: e.target.value })}
                placeholder="e.g., SUP-001"
                required
              />
              <Input
                label="Supplier Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
              <Input
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
              <Input
                label="Phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
              <Input
                label="Contact Person"
                value={formData.contact_person}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
              />
              <Input
                label="Address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
              <Input
                label="City"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
              <Input
                label="State"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              />
              <Input
                label="Country"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              />
              <Input
                label="Postal Code"
                value={formData.postal_code}
                onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Business Category
                </label>
                <select
                  value={formData.business_category}
                  onChange={(e) => setFormData({ ...formData, business_category: e.target.value })}
                  className="input-base"
                >
                  <option value="manufacturing">Manufacturing</option>
                  <option value="freelance">Freelance</option>
                  <option value="financing">Financing</option>
                  <option value="retail">Retail</option>
                  <option value="wholesale">Wholesale</option>
                  <option value="services">Services</option>
                  <option value="trading">Trading</option>
                  <option value="consulting">Consulting</option>
                  <option value="technology">Technology</option>
                  <option value="healthcare">Healthcare</option>
                  <option value="education">Education</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Payment Terms
                </label>
                <input
                  type="text"
                  value={formData.payment_terms}
                  onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                  placeholder="e.g., Net 30, Net 60, Prepaid"
                  className="input-base"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">e.g., Net 15, Net 30, Net 45, Net 60, COD, Prepaid</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  VAT Type
                </label>
                <select
                  value={formData.vat_type}
                  onChange={(e) => setFormData({ ...formData, vat_type: e.target.value as 'vat' | 'non_vat', vat_rate: e.target.value === 'non_vat' ? '' : formData.vat_rate })}
                  className="input-base"
                >
                  <option value="vat">VAT</option>
                  <option value="non_vat">Non-VAT</option>
                </select>
              </div>
              {formData.vat_type === 'vat' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    VAT Rate (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formData.vat_rate}
                    onChange={(e) => setFormData({ ...formData, vat_rate: e.target.value })}
                    placeholder="e.g., 12"
                    className="input-base"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Enter the VAT percentage (e.g., 12 for 12%)</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                  className="input-base"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button variant="secondary" onClick={resetForm}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                {editingId ? 'Update' : 'Create'} Supplier
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Suppliers Table */}
      <div className="card overflow-x-auto">
        {isLoading ? (
          <div className="p-6 text-center text-gray-500">Loading suppliers...</div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            {searchTerm ? 'No suppliers found matching your search.' : 'No suppliers yet. Create your first supplier to get started.'}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Supplier Name
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Code
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  VAT Type
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredSuppliers.map((supplier) => (
                <tr key={supplier.id} className="border-b border-gray-100 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                    {supplier.name}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => copyId(supplier.id)}
                      title={`Copy UUID · ${supplier.id}`}
                      className="flex items-center gap-1.5 group"
                    >
                      <span className="font-mono font-semibold text-sm text-gray-700 dark:text-gray-300">
                        {fmtCode(supplier.code) ?? '—'}
                      </span>
                      {copiedId === supplier.id
                        ? <Check className="h-3.5 w-3.5 text-green-500" />
                        : <Copy className="h-3.5 w-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                    {supplier.email}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                    {supplier.phone}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        supplier.vat_type === 'vat'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                      }`}
                    >
                      {supplier.vat_type === 'vat'
                        ? `VAT${supplier.vat_rate != null ? ` (${supplier.vat_rate}%)` : ''}`
                        : 'Non-VAT'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        supplier.status === 'active'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                      }`}
                    >
                      {supplier.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(supplier)}
                        className="text-primary-600 hover:text-primary-700 dark:text-primary-400"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(supplier.id)}
                        className="text-red-600 hover:text-red-700 dark:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <BulkUploadModal
        isOpen={showBulkUpload}
        onClose={() => setShowBulkUpload(false)}
        entityType="suppliers"
        onUpload={async (data) => {
          for (const row of data) {
            await createSupplier(row as any);
          }
          await loadSuppliers();
        }}
      />
    </div>
  );
}
