'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Loader, Upload, Mail, Phone, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormModal } from '@/components/forms/form-modal';
import { FormInput, FormSelect } from '@/components/forms/form-fields';
import { BulkUploadModal } from '@/components/bulk-upload-modal';
import { getCustomers, createCustomer, updateCustomer, deleteCustomer } from '@/app/actions';
import { Customer } from '@/types';
import { toast } from 'sonner';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<{
    customer_code: string;
    name: string;
    email: string;
    phone: string;
    billing_address: string;
    billing_city: string;
    billing_state: string;
    billing_postal_code: string;
    billing_country: string;
    tax_id: string;
    credit_limit: string;
    contact_person: string;
    status: 'active' | 'inactive' | 'archived';
  }>({
    customer_code: '',
    name: '',
    email: '',
    phone: '',
    billing_address: '',
    billing_city: '',
    billing_state: '',
    billing_postal_code: '',
    billing_country: '',
    tax_id: '',
    credit_limit: '',
    contact_person: '',
    status: 'active',
  });

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      setIsLoading(true);
      const response = await getCustomers();
      if (response.error) {
        toast.error('Failed to load customers');
        return;
      }
      setCustomers(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      toast.error('Error loading customers');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({
        customer_code: customer.customer_code || '',
        name: customer.name,
        email: customer.email || '',
        phone: customer.phone || '',
        billing_address: customer.billing_address || '',
        billing_city: customer.billing_city || '',
        billing_state: customer.billing_state || '',
        billing_postal_code: customer.billing_postal_code || '',
        billing_country: customer.billing_country || '',
        tax_id: customer.tax_id || '',
        credit_limit: customer.credit_limit ? String(customer.credit_limit) : '',
        contact_person: customer.contact_person || '',
        status: (customer.status || 'active') as 'active' | 'inactive' | 'archived',
      });
    } else {
      setEditingCustomer(null);
      setFormData({
        customer_code: '',
        name: '',
        email: '',
        phone: '',
        billing_address: '',
        billing_city: '',
        billing_state: '',
        billing_postal_code: '',
        billing_country: '',
        tax_id: '',
        credit_limit: '',
        contact_person: '',
        status: 'active',
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCustomer(null);
  };

  const handleSubmit = async () => {
    if (!formData.customer_code || !formData.name || !formData.email) {
      toast.error('Please fill in all required fields (Customer Code, Name, Email)');
      return;
    }

    try {
      setIsSubmitting(true);
      const defaultCompanyId = process.env.NEXT_PUBLIC_DEFAULT_COMPANY_ID || 'f0185bde-94c5-4efd-9c62-249fa165d32a';

      const payload = {
        company_id: defaultCompanyId,
        customer_code: formData.customer_code,
        name: formData.name,
        email: formData.email,
        phone: formData.phone || undefined,
        billing_address: formData.billing_address || undefined,
        billing_city: formData.billing_city || undefined,
        billing_state: formData.billing_state || undefined,
        billing_postal_code: formData.billing_postal_code || undefined,
        billing_country: formData.billing_country || undefined,
        tax_id: formData.tax_id || undefined,
        credit_limit: formData.credit_limit ? parseFloat(formData.credit_limit) : undefined,
        contact_person: formData.contact_person || undefined,
        status: formData.status,
      };

      let response;
      if (editingCustomer) {
        response = await updateCustomer(editingCustomer.id, payload);
        if (!response.error) {
          toast.success('Customer updated successfully');
        } else {
          toast.error(`Failed to update customer: ${response.error.message}`);
          return;
        }
      } else {
        response = await createCustomer(payload);
        if (!response.error) {
          toast.success('Customer created successfully');
        } else {
          toast.error(`Failed to create customer: ${response.error.message}`);
          return;
        }
      }

      handleCloseModal();
      await loadCustomers();
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (customer: Customer) => {
    if (!confirm(`Are you sure you want to delete "${customer.name}"?`)) return;

    try {
      const response = await deleteCustomer(customer.id);
      if (response.error) {
        toast.error(`Failed to delete customer: ${response.error.message}`);
        return;
      }
      toast.success('Customer deleted successfully');
      await loadCustomers();
    } catch (error) {
      toast.error('Error deleting customer');
    }
  };

  const handleBulkUpload = async (customers: Array<Record<string, unknown>>) => {
    try {

      const defaultCompanyId = process.env.NEXT_PUBLIC_DEFAULT_COMPANY_ID || 'f0185bde-94c5-4efd-9c62-249fa165d32a';

      let successCount = 0;
      let errorCount = 0;

      for (const customer of customers) {
        const payload = {
          company_id: defaultCompanyId,
          customer_code: String(customer.customer_code || ''),
          name: String(customer.name || ''),
          email: String(customer.email || ''),
          status: (customer.status || 'active') as 'active' | 'inactive' | 'archived',
          phone: customer.phone ? String(customer.phone) : undefined,
          billing_address: customer.billing_address ? String(customer.billing_address) : undefined,
          billing_city: customer.billing_city ? String(customer.billing_city) : undefined,
          billing_state: customer.billing_state ? String(customer.billing_state) : undefined,
          billing_postal_code: customer.billing_postal_code ? String(customer.billing_postal_code) : undefined,
          billing_country: customer.billing_country ? String(customer.billing_country) : undefined,
          tax_id: customer.tax_id ? String(customer.tax_id) : undefined,
          credit_limit: customer.credit_limit ? parseFloat(String(customer.credit_limit)) : undefined,
          contact_person: customer.contact_person ? String(customer.contact_person) : undefined,
        };

        const response = await createCustomer(payload as any);
        if (response.error) {
          errorCount++;
          toast.error(`Failed to create customer ${customer.name}: ${response.error.message}`);
        } else {
          successCount++;
        }
      }

      toast.success(`Bulk upload complete: ${successCount} created, ${errorCount} failed`);
      await loadCustomers();
      setIsBulkUploadOpen(false);
    } catch (error) {
      toast.error('Error uploading customers');
    } finally {

    }
  };

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Customers</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your customer database ({filteredCustomers.length}/{customers.length})
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
            Add Customer
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name or email..."
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
          {/* Customers Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCustomers.map((customer) => (
              <div
                key={customer.id}
                className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 hover:shadow-lg hover:border-primary-300 dark:hover:border-primary-700 transition-all"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                      {customer.name}
                    </h3>
                  </div>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                      customer.status === 'active'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                    }`}
                  >
                    {customer.status === 'active' ? 'Active' : customer.status}
                  </span>
                </div>

                {/* Contact Info */}
                <div className="space-y-2 mb-4">
                  {customer.email && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Mail className="h-4 w-4" />
                      <a href={`mailto:${customer.email}`} className="hover:text-primary-600">
                        {customer.email}
                      </a>
                    </div>
                  )}
                  {customer.phone && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Phone className="h-4 w-4" />
                      <a href={`tel:${customer.phone}`} className="hover:text-primary-600">
                        {customer.phone}
                      </a>
                    </div>
                  )}
                  {customer.billing_city && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <MapPin className="h-4 w-4" />
                      <span>
                        {customer.billing_city}
                        {customer.billing_state && `, ${customer.billing_state}`}
                        {customer.billing_country && ` (${customer.billing_country})`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Credit Limit */}
                {customer.credit_limit && (
                  <div className="mb-4 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                    <p className="text-sm text-primary-600 dark:text-primary-400 font-medium">
                      Credit Limit: ${customer.credit_limit.toLocaleString()}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Edit2 className="h-4 w-4" />}
                    onClick={() => handleOpenModal(customer)}
                    className="flex-1"
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 className="h-4 w-4" />}
                    onClick={() => handleDelete(customer)}
                    className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Empty State */}
          {filteredCustomers.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {searchTerm ? 'No customers found matching your search' : 'No customers yet'}
              </p>
              <Button variant="primary" onClick={() => handleOpenModal()}>
                Add Your First Customer
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
          title={editingCustomer ? 'Edit Customer' : 'Add New Customer'}
          onSubmit={handleSubmit}
          isLoading={isSubmitting}
        >
          <div className="space-y-4">
            <FormInput
              name="customer_code"
              label="Customer Code *"
              value={formData.customer_code}
              onChange={(e) => setFormData({ ...formData, customer_code: e.target.value })}
              placeholder="CUST-001"
            />
            <FormInput
              name="name"
              label="Customer Name *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter customer name"
            />
            <FormInput
              name="email"
              label="Email *"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="customer@example.com"
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

            {/* Billing Address Section */}
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Billing Address</h3>
              <FormInput
                name="billing_address"
                label="Street Address"
                value={formData.billing_address}
                onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })}
                placeholder="123 Business Ave"
              />
              <div className="grid grid-cols-2 gap-4 mt-3">
                <FormInput
                  name="billing_city"
                  label="City"
                  value={formData.billing_city}
                  onChange={(e) => setFormData({ ...formData, billing_city: e.target.value })}
                  placeholder="New York"
                />
                <FormInput
                  name="billing_state"
                  label="State"
                  value={formData.billing_state}
                  onChange={(e) => setFormData({ ...formData, billing_state: e.target.value })}
                  placeholder="NY"
                />
              </div>
              <div className="grid grid-cols-2 gap-4 mt-3">
                <FormInput
                  name="billing_postal_code"
                  label="Postal Code"
                  value={formData.billing_postal_code}
                  onChange={(e) => setFormData({ ...formData, billing_postal_code: e.target.value })}
                  placeholder="10001"
                />
                <FormInput
                  name="billing_country"
                  label="Country"
                  value={formData.billing_country}
                  onChange={(e) => setFormData({ ...formData, billing_country: e.target.value })}
                  placeholder="USA"
                />
              </div>
            </div>

            <FormInput
              name="tax_id"
              label="Tax ID"
              value={formData.tax_id}
              onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
              placeholder="TAX-001"
            />
            <FormInput
              name="credit_limit"
              label="Credit Limit"
              type="number"
              value={formData.credit_limit}
              onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
              placeholder="50000"
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
          entityType="customers"
          onUpload={handleBulkUpload}
        />
      )}
    </div>
  );
}
