'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Loader, Upload, Mail, Phone, MapPin, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormModal } from '@/components/forms/form-modal';
import { FormInput, FormSelect } from '@/components/forms/form-fields';
import { BulkUploadModal } from '@/components/bulk-upload-modal';
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier, getPurchaseOrderCountsBySupplier } from '@/app/actions';
import { Supplier } from '@/types';
import { toast } from 'sonner';

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [poCounts, setPoCounts] = useState<Record<string, number>>({});

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    toast.success('Supplier ID copied');
    setTimeout(() => setCopiedId(null), 2000);
  };
  const [formData, setFormData] = useState<{
    supplier_code: string;
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
    contact_person: string;
    tax_id: string;
    business_category: string;
    payment_terms: string;
    notes: string;
    status: 'active' | 'inactive' | 'archived';
  }>({
    supplier_code: '',
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
    contact_person: '',
    tax_id: '',
    business_category: 'manufacturing',
    payment_terms: '',
    notes: '',
    status: 'active' as 'active' | 'inactive' | 'archived',
  });

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    try {
      setIsLoading(true);
      const [response, poCountsResponse] = await Promise.all([
        getSuppliers(),
        getPurchaseOrderCountsBySupplier(),
      ]);
      if (response.error) {
        toast.error('Failed to load suppliers');
        return;
      }
      setSuppliers(Array.isArray(response.data) ? response.data : []);
      setPoCounts(poCountsResponse.data || {});
    } catch (error) {
      toast.error('Error loading suppliers');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (supplier?: Supplier) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setFormData({
        supplier_code: supplier.supplier_code || '',
        name: supplier.name,
        email: supplier.email || '',
        phone: supplier.phone || '',
        address: supplier.address || '',
        city: supplier.city || '',
        state: supplier.state || '',
        postal_code: supplier.postal_code || '',
        country: supplier.country || '',
        contact_person: supplier.contact_person || '',
        tax_id: supplier.tax_id || '',
        business_category: supplier.business_category || 'manufacturing',
        payment_terms: supplier.payment_terms || '',
        notes: supplier.notes || '',
        status: (supplier.status || 'active') as 'active' | 'inactive' | 'archived',
      });
    } else {
      setEditingSupplier(null);
      setFormData({
        supplier_code: '',
        name: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        postal_code: '',
        country: '',
        contact_person: '',
        tax_id: '',
        business_category: 'manufacturing',
        payment_terms: '',
        notes: '',
        status: 'active',
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingSupplier(null);
  };

  const handleSubmit = async () => {
    if (!formData.supplier_code || !formData.name) {
      toast.error('Please fill in all required fields (Supplier Code, Name)');
      return;
    }

    try {
      setIsSubmitting(true);
      const defaultCompanyId = process.env.NEXT_PUBLIC_DEFAULT_COMPANY_ID || 'f0185bde-94c5-4efd-9c62-249fa165d32a';

      const payload = {
        company_id: defaultCompanyId,
        supplier_code: formData.supplier_code,
        name: formData.name,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        address: formData.address || undefined,
        city: formData.city || undefined,
        state: formData.state || undefined,
        postal_code: formData.postal_code || undefined,
        country: formData.country || undefined,
        contact_person: formData.contact_person || undefined,
        tax_id: formData.tax_id || undefined,
        payment_terms: formData.payment_terms,
        notes: formData.notes || undefined,
        status: formData.status,
      };

      let response;
      if (editingSupplier) {
        response = await updateSupplier(editingSupplier.id, payload);
        if (!response.error) {
          toast.success('Supplier updated successfully');
        } else {
          toast.error(`Failed to update supplier: ${response.error.message}`);
          return;
        }
      } else {
        response = await createSupplier(payload);
        if (!response.error) {
          toast.success('Supplier created successfully');
        } else {
          toast.error(`Failed to create supplier: ${response.error.message}`);
          return;
        }
      }

      handleCloseModal();
      await loadSuppliers();
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (supplier: Supplier) => {
    if (!confirm(`Are you sure you want to delete "${supplier.name}"?`)) return;

    try {
      const response = await deleteSupplier(supplier.id);
      if (response.error) {
        toast.error(`Failed to delete supplier: ${response.error.message}`);
        return;
      }
      toast.success('Supplier deleted successfully');
      await loadSuppliers();
    } catch (error) {
      toast.error('Error deleting supplier');
    }
  };

  const handleBulkUpload = async (suppliers: Array<Record<string, unknown>>) => {
    try {

      const defaultCompanyId = process.env.NEXT_PUBLIC_DEFAULT_COMPANY_ID || 'f0185bde-94c5-4efd-9c62-249fa165d32a';

      let successCount = 0;
      let errorCount = 0;

      for (const supplier of suppliers) {
        const payload = {
          company_id: defaultCompanyId,
          supplier_code: String(supplier.supplier_code || ''),
          name: String(supplier.name || ''),
          status: (supplier.status || 'active') as 'active' | 'inactive' | 'archived',
          email: supplier.email ? String(supplier.email) : undefined,
          phone: supplier.phone ? String(supplier.phone) : undefined,
          address: supplier.address ? String(supplier.address) : undefined,
          city: supplier.city ? String(supplier.city) : undefined,
          state: supplier.state ? String(supplier.state) : undefined,
          postal_code: supplier.postal_code ? String(supplier.postal_code) : undefined,
          country: supplier.country ? String(supplier.country) : undefined,
          contact_person: supplier.contact_person ? String(supplier.contact_person) : undefined,
          tax_id: supplier.tax_id ? String(supplier.tax_id) : undefined,
          business_category: supplier.business_category ? String(supplier.business_category) : undefined,
          payment_terms: supplier.payment_terms ? String(supplier.payment_terms) : undefined,
          notes: supplier.notes ? String(supplier.notes) : undefined,
        };

        const response = await createSupplier(payload as any);
        if (response.error) {
          errorCount++;
          toast.error(`Failed to create supplier ${supplier.name}: ${response.error.message}`);
        } else {
          successCount++;
        }
      }

      toast.success(`Bulk upload complete: ${successCount} created, ${errorCount} failed`);
      await loadSuppliers();
      setIsBulkUploadOpen(false);
    } catch (error) {
      toast.error('Error uploading suppliers');
    } finally {

    }
  };

  const filteredSuppliers = suppliers.filter(
    (supplier) =>
      supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.contact_person?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Suppliers</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your supplier database ({filteredSuppliers.length}/{suppliers.length})
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            icon={<Upload className="h-4 w-4" />}
            onClick={() => setIsBulkUploadOpen(true)}
          >
            Bulk Upload
          </Button>
          <Button
            variant="primary"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => handleOpenModal()}
          >
            Add Supplier
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, email, or contact..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      ) : (
        <>
          {/* Suppliers Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSuppliers.map((supplier) => (
              <div
                key={supplier.id}
                className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 hover:shadow-lg hover:border-primary-300 dark:hover:border-primary-700 transition-all"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                      {supplier.name}
                    </h3>
                    {supplier.contact_person && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Contact: {supplier.contact_person}
                      </p>
                    )}
                  </div>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                      supplier.status === 'active'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                    }`}
                  >
                    {supplier.status === 'active' ? 'Active' : supplier.status}
                  </span>
                </div>

                {/* Contact Info */}
                <div className="space-y-2 mb-4">
                  {supplier.email && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Mail className="h-4 w-4" />
                      <a href={`mailto:${supplier.email}`} className="hover:text-primary-600">
                        {supplier.email}
                      </a>
                    </div>
                  )}
                  {supplier.phone && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Phone className="h-4 w-4" />
                      <a href={`tel:${supplier.phone}`} className="hover:text-primary-600">
                        {supplier.phone}
                      </a>
                    </div>
                  )}
                  {supplier.city && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <MapPin className="h-4 w-4" />
                      <span>
                        {supplier.city}
                        {supplier.state && `, ${supplier.state}`}
                        {supplier.country && ` (${supplier.country})`}
                      </span>
                    </div>
                  )}
                </div>

                {/* PO Count */}
                <div className="flex items-center justify-between mb-3 px-2.5 py-1.5 rounded-md bg-gray-100 dark:bg-gray-700/50">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Purchase Orders</span>
                  <span className="text-xs font-semibold text-gray-900 dark:text-white">
                    {poCounts[supplier.id] || 0}
                  </span>
                </div>

                {/* Supplier ID */}
                <button
                  onClick={() => copyId(supplier.id)}
                  title="Copy supplier ID"
                  className="w-full flex items-center justify-between gap-2 mb-3 px-2.5 py-1.5 rounded-md bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors group"
                >
                  <span className="font-mono text-xs text-gray-400 dark:text-gray-500 truncate">
                    {supplier.id}
                  </span>
                  {copiedId === supplier.id
                    ? <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                    : <Copy className="h-3.5 w-3.5 text-gray-400 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />}
                </button>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Edit2 className="h-4 w-4" />}
                    onClick={() => handleOpenModal(supplier)}
                    className="flex-1"
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 className="h-4 w-4" />}
                    onClick={() => handleDelete(supplier)}
                    className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Empty State */}
          {filteredSuppliers.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {searchTerm ? 'No suppliers found matching your search' : 'No suppliers yet'}
              </p>
              <Button variant="primary" onClick={() => handleOpenModal()}>
                Add Your First Supplier
              </Button>
            </div>
          )}
        </>
      )}

      {/* Form Modal */}
      {isModalOpen && (
        <FormModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          title={editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
          onSubmit={handleSubmit}
          isLoading={isSubmitting}
        >
          <div className="space-y-4">
            <FormInput
              name="supplier_code"
              label="Supplier Code *"
              value={formData.supplier_code}
              onChange={(e) => setFormData({ ...formData, supplier_code: e.target.value })}
              placeholder="SUPP-001"
            />
            <FormInput
              name="name"
              label="Supplier Name *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter supplier name"
            />
            <FormInput
              name="email"
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="supplier@example.com"
            />
            <FormInput
              name="phone"
              label="Phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+1 (555) 123-4567"
            />
            <FormInput
              name="contact_person"
              label="Contact Person"
              value={formData.contact_person}
              onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
              placeholder="John Doe"
            />
            <FormInput
              name="address"
              label="Address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="123 Business Ave"
            />
            <div className="grid grid-cols-2 gap-4">
              <FormInput
                name="city"
                label="City"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="New York"
              />
              <FormInput
                name="state"
                label="State"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                placeholder="NY"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormInput
                name="postal_code"
                label="Postal Code"
                value={formData.postal_code}
                onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                placeholder="10001"
              />
              <FormInput
                name="country"
                label="Country"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                placeholder="USA"
              />
            </div>
            <FormInput
              name="tax_id"
              label="Tax ID"
              value={formData.tax_id}
              onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
              placeholder="TAX-001"
            />
            <FormSelect
              name="business_category"
              label="Business Category"
              value={formData.business_category}
              onChange={(e) => setFormData({ ...formData, business_category: e.target.value })}
              options={[
                { value: 'manufacturing', label: 'Manufacturing' },
                { value: 'freelance', label: 'Freelance' },
                { value: 'financing', label: 'Financing' },
                { value: 'retail', label: 'Retail' },
                { value: 'wholesale', label: 'Wholesale' },
                { value: 'services', label: 'Services' },
                { value: 'trading', label: 'Trading' },
                { value: 'consulting', label: 'Consulting' },
                { value: 'technology', label: 'Technology' },
                { value: 'healthcare', label: 'Healthcare' },
                { value: 'education', label: 'Education' },
                { value: 'other', label: 'Other' },
              ]}
            />
            <FormInput
              name="payment_terms"
              label="Payment Terms"
              type="text"
              value={formData.payment_terms}
              onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
              placeholder="e.g., Net 30, Net 60, Prepaid"
            />
            <div className="text-xs text-gray-500 dark:text-gray-400 -mt-3 mb-4">e.g., Net 15, Net 30, Net 45, Net 60, COD, Prepaid</div>
            <FormInput
              name="notes"
              label="Notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes"
            />
            <FormSelect
              name="status"
              label="Status"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
                { value: 'archived', label: 'Archived' },
              ]}
            />
          </div>
        </FormModal>
      )}

      {/* Bulk Upload Modal */}
      {isBulkUploadOpen && (
        <BulkUploadModal
          isOpen={isBulkUploadOpen}
          onClose={() => setIsBulkUploadOpen(false)}
          entityType="suppliers"
          onUpload={handleBulkUpload}
        />
      )}
    </div>
  );
}
