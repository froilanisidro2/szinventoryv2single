'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Mail, Save, Send, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getCompanyEmailSettings, saveCompanyEmailSettings, markEmailSettingsVerified } from '@/app/actions';
import { testSmtpConnection } from '@/app/actions/test-smtp';

const INPUT_CLASS =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm';

export default function EmailSettingsPage() {
  const [companyId, setCompanyId] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [lastTested, setLastTested] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    smtp_host: 'smtp.gmail.com',
    smtp_port: 587,
    smtp_secure: false,
    smtp_user: '',
    smtp_password: '',
    from_name: '',
    from_email: '',
    is_enabled: true,
  });

  useEffect(() => {
    const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
    if (!userStr) { setIsLoading(false); return; }
    const user = JSON.parse(userStr);
    const cid = user.companyId || '';
    setCompanyId(cid);

    const companyStr = localStorage.getItem('company');
    if (companyStr) {
      const company = JSON.parse(companyStr);
      setCompanyEmail(company.email || '');
      setForm(f => ({ ...f, from_name: company.name || '', from_email: company.email || '' }));
    }

    if (cid) {
      getCompanyEmailSettings(cid).then(res => {
        if (res.data) {
          const d = res.data as any;
          setForm({
            smtp_host: d.smtp_host || 'smtp.gmail.com',
            smtp_port: d.smtp_port || 587,
            smtp_secure: d.smtp_secure || false,
            smtp_user: d.smtp_user || '',
            smtp_password: d.smtp_password || '',
            from_name: d.from_name || '',
            from_email: d.from_email || '',
            is_enabled: d.is_enabled ?? true,
          });
          setIsVerified(d.is_verified || false);
          setLastTested(d.last_tested_at || null);
        }
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, []);

  const handleSave = async () => {
    if (!companyId) { toast.error('Company not found'); return; }
    if (!form.smtp_host || !form.smtp_user || !form.smtp_password) {
      toast.error('SMTP host, user, and password are required');
      return;
    }
    try {
      setIsSaving(true);
      const result = await saveCompanyEmailSettings(companyId, form);
      if (result.error) {
        toast.error('Failed to save email settings');
      } else {
        setIsVerified(false);
        toast.success('Email settings saved. Send a test email to verify.');
      }
    } catch {
      toast.error('Error saving email settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!form.smtp_host || !form.smtp_user || !form.smtp_password) {
      toast.error('Fill in SMTP settings before testing');
      return;
    }
    const testTo = companyEmail || form.from_email || form.smtp_user;
    try {
      setIsTesting(true);
      toast.info(`Sending test email to ${testTo}...`);
      const result = await testSmtpConnection(
        {
          smtp_host: form.smtp_host,
          smtp_port: form.smtp_port,
          smtp_secure: form.smtp_secure,
          smtp_user: form.smtp_user,
          smtp_password: form.smtp_password,
          from_name: form.from_name,
          from_email: form.from_email,
        },
        testTo
      );
      if (result.success) {
        toast.success(`Test email sent to ${testTo}!`);
        if (companyId) {
          await markEmailSettingsVerified(companyId);
          setIsVerified(true);
          setLastTested(new Date().toISOString());
        }
      } else {
        toast.error(`Test failed: ${result.error}`);
      }
    } catch {
      toast.error('Error testing SMTP connection');
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <p className="text-gray-500 dark:text-gray-400">Loading email settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        
          <Button href="/settings" variant="secondary" size="sm">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Mail className="h-6 w-6 text-primary-600" />
            Email / SMTP Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Configure your company's outgoing email server
          </p>
        </div>
      </div>

      {/* Verified badge */}
      {isVerified && (
        <div className="flex items-center gap-2 px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
          <p className="text-sm text-green-800 dark:text-green-200">
            SMTP verified
            {lastTested && ` — last tested ${new Date(lastTested).toLocaleString()}`}
          </p>
        </div>
      )}

      {/* SMTP Configuration */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">SMTP Configuration</h2>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">SMTP Host *</label>
            <input
              value={form.smtp_host}
              onChange={e => setForm(f => ({ ...f, smtp_host: e.target.value }))}
              placeholder="smtp.gmail.com"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Port *</label>
            <input
              type="number"
              value={form.smtp_port}
              onChange={e => setForm(f => ({ ...f, smtp_port: parseInt(e.target.value) || 587 }))}
              className={INPUT_CLASS}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            id="smtp_secure"
            type="checkbox"
            checked={form.smtp_secure}
            onChange={e => setForm(f => ({ ...f, smtp_secure: e.target.checked }))}
            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <label htmlFor="smtp_secure" className="text-sm text-gray-700 dark:text-gray-300">
            Use SSL/TLS (port 465) — leave unchecked for STARTTLS (port 587)
          </label>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">SMTP Username / Email *</label>
          <input
            value={form.smtp_user}
            onChange={e => setForm(f => ({ ...f, smtp_user: e.target.value }))}
            placeholder="yourname@gmail.com"
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">SMTP Password / App Password *</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={form.smtp_password}
              onChange={e => setForm(f => ({ ...f, smtp_password: e.target.value }))}
              placeholder="••••••••••••••••"
              className={INPUT_CLASS + ' pr-10'}
            />
            <button
              type="button"
              onClick={() => setShowPassword(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            For Gmail, use an <strong>App Password</strong> (not your account password).
            Enable 2FA → Google Account → Security → App Passwords.
          </p>
        </div>
      </div>

      {/* Sender Identity */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">Sender Identity</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">From Name</label>
            <input
              value={form.from_name}
              onChange={e => setForm(f => ({ ...f, from_name: e.target.value }))}
              placeholder="Acme Corporation"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">From Email</label>
            <input
              value={form.from_email}
              onChange={e => setForm(f => ({ ...f, from_email: e.target.value }))}
              placeholder="noreply@yourcompany.com"
              className={INPUT_CLASS}
            />
          </div>
        </div>
      </div>

      {/* Enable toggle */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">Enable outgoing email</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">POs, SOs, GRN, low-stock alerts will be sent via this SMTP</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_enabled}
              onChange={e => setForm(f => ({ ...f, is_enabled: e.target.checked }))}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600" />
          </label>
        </div>
      </div>

      {/* Gmail tip */}
      <div className="flex gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
          <p><strong>Using Gmail?</strong> You must use an App Password, not your Gmail password.</p>
          <p>Go to: <strong>Google Account → Security → 2-Step Verification → App passwords</strong></p>
          <p>Select "Mail" + "Other (custom name)" → generate → paste the 16-char code above.</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          variant="secondary"
          onClick={handleTest}
          disabled={isTesting || isSaving}
          className="gap-2"
        >
          <Send className="h-4 w-4" />
          {isTesting ? 'Sending test...' : 'Test & Verify'}
        </Button>
        <Button
          onClick={handleSave}
          disabled={isSaving || isTesting}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          {isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
