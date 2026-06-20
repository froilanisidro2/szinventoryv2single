'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, ArrowLeft, Search, Upload, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BulkUploadModal } from '@/components/bulk-upload-modal';
import { toast } from 'sonner';
import { getCustomers, createCustomer, updateCustomer, deleteCustomer } from '@/app/actions';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const [formData, setFormData] = useState({
    customer_code: '',
    name: '',
    email: '',
    phone: '',
    billing_address: '',
    billing_city: '',
    billing_state: '',
    billing_country: '',
    billing_postal_code: '',
    contact_person: '',
    business_category: 'manufacturing',
    payment_terms: '',
    status: 'active' as 'active' | 'inactive',
  });

  const emptyForm = {
    customer_code: '',
    name: '',
    email: '',
    phone: '',
    billing_address: '',
    billing_city: '',
    billing_state: '',
    billing_country: '',
    billing_postal_code: '',
    contact_person: '',
    business_category: 'manufacturing',
    payment_terms: '',
    status: 'active' as 'active' | 'inactive',
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      setIsLoading(true);
      const result = await getCustomers();
      if (result && !result.error && Array.isArray(result.data)) {
        setCustomers(result.data);
      } else if (result && result.error) {
        console.error('Error loading customers:', result.error);
        toast.error('Failed to load customers');
      }
    } catch (error) {
      console.error('Exception loading customers:', error);
      toast.error('Failed to load customers');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast.error('Customer name is required'); return; }
    if (!formData.customer_code.trim()) { toast.error('Customer code is required'); return; }

    try {
      if (editingId) {
        const result = await updateCustomer(editingId, formData);
        if (result && !result.error) {
          toast.success('Customer updated');
          resetForm();
          await loadCustomers();
        } else {
          const msg = typeof (result as any)?.error === 'object' ? ((result as any).error)?.message : (result as any)?.error;
          toast.error(msg || 'Failed to update customer');
        }
      } else {
        const result = await createCustomer(formData);
        if (result && !result.error) {
          toast.success('Customer created');
          resetForm();
          await loadCustomers();
        } else {
          const msg = typeof (result as any)?.error === 'object' ? ((result as any).error)?.message : (result as any)?.error;
          toast.error(msg || 'Failed to create customer');
        }
      }
    } catch {
      toast.error('Failed to save customer');
    }
  };

  const handleEdit = (item: any) => {
    setFormData({
      customer_code: item.customer_code || '',
      name: item.name || '',
      email: item.email || '',
      phone: item.phone || '',
      billing_address: item.billing_address || '',
      billing_city: item.billing_city || '',
      billing_state: item.billing_state || '',
      billing_country: item.billing_country || '',
      billing_postal_code: item.billing_postal_code || '',
      contact_person: item.contact_person || '',
      business_category: item.business_category || 'manufacturing',
      payment_terms: item.payment_terms || '',
      status: (item.status as 'active' | 'inactive') || 'active',
    });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this customer? This cannot be undone.')) return;
    try {
      const result = await deleteCustomer(id);
      if (result && !result.error) {
        toast.success('Customer deleted');
        await loadCustomers();
      } else {
        const msg = typeof (result as any)?.error === 'object' ? ((result as any).error)?.message : (result as any)?.error;
        toast.error(msg || 'Failed to delete customer');
      }
    } catch {
      toast.error('Failed to delete customer');
    }
  };

  const filteredCustomers = customers.filter((c) =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
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
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Customers Management</h1>
            <p className="text-gray-600 dark:text-gray-400">Create and manage customer information</p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-2">
        <Search className="h-5 w-5 text-gray-400" />
        <Input
          placeholder="Search customers by name or email..."
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
              Add Customer
            </Button>
          </div>
        )}
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {editingId ? 'Edit Customer' : 'New Customer'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Customer Code"
                value={formData.customer_code}
                onChange={(e) => setFormData({ ...formData, customer_code: e.target.value })}
                placeholder="e.g., CUST-001"
                required
              />
              <Input
                label="Customer Name"
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
                value={formData.billing_address}
                onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })}
              />
              <Input
                label="City"
                value={formData.billing_city}
                onChange={(e) => setFormData({ ...formData, billing_city: e.target.value })}
              />
              <Input
                label="State"
                value={formData.billing_state}
                onChange={(e) => setFormData({ ...formData, billing_state: e.target.value })}
              />
              <Input
                label="Country"
                value={formData.billing_country}
                onChange={(e) => setFormData({ ...formData, billing_country: e.target.value })}
              />
              <Input
                label="Postal Code"
                value={formData.billing_postal_code}
                onChange={(e) => setFormData({ ...formData, billing_postal_code: e.target.value })}
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
                {editingId ? 'Update' : 'Create'} Customer
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Customers Table */}
      <div className="card overflow-x-auto">
        {isLoading ? (
          <div className="p-6 text-center text-gray-500">Loading customers...</div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            {searchTerm ? 'No customers found matching your search.' : 'No customers yet. Create your first customer to get started.'}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Customer Name
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
                  Status
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer) => (
                <tr key={customer.id} className="border-b border-gray-100 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                    {customer.name}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => copyCode(customer.id, customer.customer_code || '')}
                      title="Copy customer code"
                      className="flex items-center gap-1.5 group"
                    >
                      <span className="font-mono font-semibold text-sm text-gray-700 dark:text-gray-300">
                        {customer.customer_code || '—'}
                      </span>
                      {copiedId === customer.id
                        ? <Check className="h-3.5 w-3.5 text-green-500" />
                        : <Copy className="h-3.5 w-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                    {customer.email}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                    {customer.phone}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        customer.status === 'active'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                      }`}
                    >
                      {customer.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(customer)}
                        className="text-primary-600 hover:text-primary-700 dark:text-primary-400"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(customer.id)}
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
        entityType="customers"
        onUpload={async (data) => {
          let successCount = 0;
          let failCount = 0;
          for (const row of data) {
            const payload = {
              customer_code: row.customer_code || '',
              name: row.name || '',
              email: row.email || '',
              phone: row.phone || '',
              billing_address: row.billing_address || '',
              billing_city: row.billing_city || '',
              billing_state: row.billing_state || '',
              billing_country: row.billing_country || '',
              billing_postal_code: row.billing_postal_code || '',
              contact_person: row.contact_person || '',
              business_category: row.business_category || 'other',
              payment_terms: row.payment_terms || '',
              status: (row.status as 'active' | 'inactive') || 'active',
            };
            const result = await createCustomer(payload);
            if (result && !result.error) successCount++;
            else failCount++;
          }
          if (failCount > 0) toast.error(`${failCount} rows failed to import`);
          await loadCustomers();
        }}
      />
    </div>
  );
}
