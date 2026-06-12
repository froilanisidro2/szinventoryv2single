'use client';

import { useState, useEffect } from 'react';
import { Save, Bell, Database, Warehouse, FolderTree, Users, Briefcase, Shield, FileText, Box, UserCheck, Upload, X, BookOpen, Mail } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getCompanyById, uploadCompanyLogo, updateCompany, getLowStockProducts, getInvoices } from '@/app/actions';
import { sendLowStockAlertEmail, sendPaymentReminderEmail } from '@/app/actions/email';
import { toast } from 'sonner';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('company-details');
  const [company, setCompany] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', currency_code: '' });
  const NOTIF_KEY = 'sz_notification_prefs';
  const [notifications, setNotifications] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(NOTIF_KEY);
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return { invoices: true, lowStock: true, payments: true, email: true };
  });
  const [notifSaved, setNotifSaved] = useState(false);

  useEffect(() => {
    const loadCompanyData = async () => {
      try {
        // Get user from sessionStorage first (no "remember me"), then localStorage ("remember me")
        const userStr = sessionStorage.getItem('user') ?? localStorage.getItem('user');
        
        if (userStr) {
          const userData = JSON.parse(userStr);
          console.log('[SETTINGS] User data loaded:', userData);
          setUser(userData);
          if (userData.companyId) {
            const result = await getCompanyById(userData.companyId);
            if (result.data) {
              const d = result.data as any;
              setCompany(d);
              setForm({ name: d.name || '', email: d.email || '', phone: d.phone || '', currency_code: d.currency_code || '' });
              localStorage.setItem('company', JSON.stringify(d));
              if (d.logo_url) setLogoPreview(d.logo_url);
            }
          }
        }
      } catch (error) {
        console.error('Error loading company data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCompanyData();
  }, []);

  const isAdmin = user?.isCompanyAdmin === true || user?.role === 'admin' || user?.role === 'super_admin';

  const handleSaveCompany = async () => {
    if (!company?.id) return;
    try {
      setIsSaving(true);
      const result = await updateCompany(company.id, {
        name: form.name,
        email: form.email,
        phone: form.phone,
        currency_code: form.currency_code,
      });
      if (result.error) {
        toast.error('Failed to save company details');
        return;
      }
      const updated = { ...company, ...form };
      setCompany(updated);
      localStorage.setItem('company', JSON.stringify(updated));
      toast.success('Company details saved');
    } catch {
      toast.error('Error saving company details');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    try {
      setIsUploadingLogo(true);
      
      // Create FormData
      const formData = new FormData();
      formData.append('file', file);
      formData.append('companyId', company?.id);

      // Call upload function
      const result = await uploadCompanyLogo(formData);

      if (result.error) {
        toast.error(result.error);
      } else {
        // Show preview
        const reader = new FileReader();
        reader.onloadend = () => {
          setLogoPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
        toast.success('Logo uploaded successfully');
        
        // Refresh company data
        if (user?.companyId) {
          const updatedCompany = await getCompanyById(user.companyId);
          if (updatedCompany.data) {
            setCompany(updatedCompany.data);
          }
        }
      }
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error('Failed to upload logo');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    try {
      setIsUploadingLogo(true);
      // For now, we'll just clear the preview
      // In a real scenario, you'd call an API to delete the logo
      setLogoPreview(null);
      toast.success('Logo removed');
    } catch (error) {
      console.error('Error removing logo:', error);
      toast.error('Failed to remove logo');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const tabs = [
    { id: 'company-details', label: 'Company', icon: Database },
    { id: 'users', label: 'Users', icon: UserCheck, href: '/settings/users' },
    { id: 'warehouses', label: 'Warehouses', icon: Warehouse, href: '/settings/warehouses' },
    { id: 'bin-locations', label: 'Bin Locations', icon: Box, href: '/settings/bin-locations' },
    { id: 'categories', label: 'Product Properties', icon: FolderTree, href: '/settings/categories' },
    { id: 'suppliers', label: 'Suppliers', icon: Briefcase, href: '/settings/suppliers' },
    { id: 'customers', label: 'Customers', icon: Users, href: '/settings/customers' },
    { id: 'roles', label: 'Roles & Permissions', icon: Shield, href: '/settings/roles' },
    { id: 'audit', label: 'Audit Logs', icon: FileText, href: '/settings/audit-logs' },
    { id: 'documentation', label: 'Roles Documentation', icon: BookOpen, href: '/settings/documentation' },
    { id: 'email', label: 'Email Settings', icon: Mail, href: '/settings/email' },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
          Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your account and application settings
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab: any) => {
          const Icon = tab.icon;
          
          // For tabs with href, render as Link
          if (tab.href && tab.href !== '#') {
            return (
              <Link
                key={tab.id}
                href={tab.href}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium transition-colors border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:border-primary-400`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </Link>
            );
          }
          
          // For regular tabs, render as button
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400'
                  : 'border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="card p-6">
        {/* Company Details */}
        {activeTab === 'company-details' && (
          <div className="space-y-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-gray-500 dark:text-gray-400">Loading company information...</p>
              </div>
            ) : company ? (
              <>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                    Company Information
                  </h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Company Name
                      </label>
                      <Input
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        disabled={!isAdmin}
                        className={!isAdmin ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed' : ''}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Email
                        </label>
                        <Input
                          value={form.email}
                          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                          disabled={!isAdmin}
                          className={!isAdmin ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed' : ''}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Phone
                        </label>
                        <Input
                          value={form.phone}
                          onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                          disabled={!isAdmin}
                          className={!isAdmin ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed' : ''}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Currency
                      </label>
                      <Input
                        value={form.currency_code}
                        onChange={e => setForm(f => ({ ...f, currency_code: e.target.value }))}
                        disabled={!isAdmin}
                        className={!isAdmin ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed' : ''}
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Company Logo
                        </label>
                        {!isAdmin && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                            Admin only
                          </span>
                        )}
                      </div>
                      <div className="flex gap-4">
                        {logoPreview ? (
                          <div className="relative">
                            <img
                              src={logoPreview}
                              alt="Company Logo"
                              className="h-32 w-32 object-contain rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 p-2"
                            />
                            {isAdmin && (
                              <button
                                onClick={handleRemoveLogo}
                                disabled={isUploadingLogo}
                                className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 disabled:opacity-50"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="h-32 w-32 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center bg-gray-50 dark:bg-gray-700">
                            <div className="text-center">
                              <Upload className="h-6 w-6 text-gray-400 mx-auto mb-1" />
                              <p className="text-xs text-gray-500 dark:text-gray-400">No logo</p>
                            </div>
                          </div>
                        )}
                        <div className="flex flex-col justify-between">
                          <div>
                            {isAdmin ? (
                              <label htmlFor="logo-upload" className="cursor-pointer">
                                <div className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium text-sm inline-block">
                                  {isUploadingLogo ? 'Uploading...' : 'Upload Logo'}
                                </div>
                              </label>
                            ) : (
                              <div className="px-4 py-2 bg-gray-300 text-gray-600 rounded-lg font-medium text-sm inline-block cursor-not-allowed">
                                Upload Logo
                              </div>
                            )}
                            <input
                              id="logo-upload"
                              type="file"
                              accept="image/*"
                              onChange={handleLogoUpload}
                              disabled={isUploadingLogo || !isAdmin}
                              className="hidden"
                            />
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            Max 5MB • PNG, JPG, GIF
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            Used for invoices & documents
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Plan Type
                        </label>
                        <Input value={company?.plan_type || 'Basic'} disabled className="bg-gray-100 dark:bg-gray-800 cursor-not-allowed" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          User Limit
                        </label>
                        <Input value={company?.user_limit || '0'} disabled className="bg-gray-100 dark:bg-gray-800 cursor-not-allowed" />
                      </div>
                    </div>
                  </div>
                </div>

                <hr className="border-gray-200 dark:border-gray-700" />

                <div className="flex justify-end items-center gap-4">
                  <Button
                    variant="primary"
                    icon={<Save className="h-4 w-4" />}
                    onClick={handleSaveCompany}
                    disabled={!isAdmin || isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </Button>
                  {!isAdmin && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Only admins can modify company details
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center py-8">
                <p className="text-red-500 dark:text-red-400">Failed to load company information</p>
              </div>
            )}
          </div>
        )}

        {/* Notifications */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Notification Preferences
            </h2>

            <div className="space-y-4">
              {[
                {
                  key: 'invoices',
                  title: 'Invoice Notifications',
                  description: 'Receive notifications when invoices are created, sent, or paid',
                },
                {
                  key: 'lowStock',
                  title: 'Low Stock Alerts',
                  description: 'Get notified when inventory falls below reorder levels',
                },
                {
                  key: 'payments',
                  title: 'Payment Reminders',
                  description: 'Receive payment reminders for overdue invoices',
                },
                {
                  key: 'email',
                  title: 'Email Notifications',
                  description: 'Receive all notifications via email',
                },
              ].map((setting) => (
                <div
                  key={setting.key}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg dark:border-gray-700"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{setting.title}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {setting.description}
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifications[setting.key as keyof typeof notifications]}
                      onChange={(e) =>
                        setNotifications({
                          ...notifications,
                          [setting.key]: e.target.checked,
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600" />
                  </label>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className={`text-sm transition-opacity ${notifSaved ? 'text-green-600 dark:text-green-400 opacity-100' : 'opacity-0'}`}>
                Preferences saved.
              </p>
              <Button
                variant="primary"
                icon={<Save className="h-4 w-4" />}
                onClick={async () => {
                  try {
                    localStorage.setItem(NOTIF_KEY, JSON.stringify(notifications));
                    setNotifSaved(true);
                    setTimeout(() => setNotifSaved(false), 2500);

                    // If email is enabled, trigger the active notification types now
                    if (notifications.email && company?.email) {
                      const companyName = company.name || 'Your Company';
                      const adminEmail = company.email;

                      if (notifications.lowStock) {
                        const res = await getLowStockProducts();
                        const items = Array.isArray(res.data) ? res.data as any[] : [];
                        if (items.length > 0) {
                          sendLowStockAlertEmail(adminEmail, companyName, items).then((r) => {
                            if (r.success) toast.success(`Low stock alert sent to ${adminEmail}`);
                            else toast.error(`Low stock email failed: ${r.error}`);
                          });
                        } else {
                          toast.info('No low-stock items to report right now.');
                        }
                      }

                      if (notifications.payments) {
                        const res = await getInvoices(200);
                        const invoices = Array.isArray(res.data) ? res.data as any[] : [];
                        const overdue = invoices
                          .filter((i: any) => i.status === 'overdue' && (i.order_type === 'sales_order' || !i.order_type))
                          .map((i: any) => ({
                            invoice_number: i.invoice_number,
                            customer_name: i.customer_name || '—',
                            total_amount: Number(i.total_amount) || 0,
                            amount_paid: Number(i.amount_paid ?? i.paid_amount) || 0,
                            due_date: i.due_date ? new Date(i.due_date).toLocaleDateString('en-PH') : '—',
                          }));
                        if (overdue.length > 0) {
                          sendPaymentReminderEmail(adminEmail, companyName, overdue).then((r) => {
                            if (r.success) toast.success(`Payment reminder sent to ${adminEmail}`);
                            else toast.error(`Payment reminder failed: ${r.error}`);
                          });
                        }
                      }
                    }
                  } catch (err) {
                    toast.error('Failed to save preferences');
                  }
                }}
              >
                Save & Send Now
              </Button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
