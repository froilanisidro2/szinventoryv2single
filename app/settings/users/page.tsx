'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users, Plus, Mail, Phone, MoreVertical, AlertTriangle,
  Trash2, AlertCircle, AlertOctagon, ArrowLeft, Warehouse, X, Check,
  Pencil, KeyRound, Eye, EyeOff, Copy,
} from 'lucide-react';
import { fmtCode } from '@/lib/warehouse-utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getCurrentUser, logout } from '@/lib/auth-utils';
import { fmtWarehouse } from '@/lib/warehouse-utils';
import {
  getUsersByCompany, createCompanyAdmin, toggleUserStatus, deleteUserPermanently,
  getCompanyById, getRoles, getWarehouses,
  getUsersWithWarehouseAssignments, setUserWarehouseAssignments,
  updateUser, changePassword,
} from '@/app/actions';

interface CompanyUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role?: string;
  role_id?: string;
  status: string;
  is_company_admin: boolean;
  created_at: string;
}

interface Role { id: string; name: string; description?: string; }
interface WarehouseItem { id: string; name: string; }

export default function UsersPage() {
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.isCompanyAdmin || currentUser?.role === 'admin';

  const [users, setUsers]         = useState<CompanyUser[]>([]);
  const [roles, setRoles]         = useState<Role[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [userWarehouseMap, setUserWarehouseMap] = useState<Record<string, string[]>>({});

  const [isLoading, setIsLoading]     = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSaving, setIsSaving]       = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // modals
  const [showSuspendModal, setShowSuspendModal]   = useState(false);
  const [showDeleteModal, setShowDeleteModal]     = useState(false);
  const [showWhModal, setShowWhModal]             = useState(false);
  const [showEditModal, setShowEditModal]         = useState(false);
  const [showResetModal, setShowResetModal]       = useState(false);

  const [selectedUser, setSelectedUser] = useState<CompanyUser | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };
  const [editingWhIds, setEditingWhIds] = useState<string[]>([]);

  // edit form
  const [editForm, setEditForm] = useState({
    first_name: '', last_name: '', email: '', phone: '', role_id: '',
  });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  // reset password form
  const [newPassword, setNewPassword]         = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPw, setShowNewPw]             = useState(false);
  const [showConfirmPw, setShowConfirmPw]     = useState(false);
  const [pwErrors, setPwErrors]               = useState<Record<string, string>>({});

  const [company, setCompany]               = useState<any>(null);
  const [isLimitReached, setIsLimitReached] = useState(false);

  const [formData, setFormData] = useState({
    first_name: '', last_name: '', email: '',
    phone: '', password: '', confirmPassword: '',
    role_id: '', warehouse_ids: [] as string[],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  /* ---- loaders ---- */
  const loadAll = useCallback(async () => {
    if (!currentUser?.companyId) return;
    setIsLoading(true);
    try {
      const [usersRes, rolesRes, whRes, whAssignRes, companyRes] = await Promise.all([
        getUsersByCompany(currentUser.companyId, 100, 0),
        getRoles(),
        getWarehouses(),
        getUsersWithWarehouseAssignments(),
        getCompanyById(currentUser.companyId),
      ]);
      if (!usersRes.error)  setUsers(usersRes.data || []);
      if (!rolesRes.error && rolesRes.data) setRoles(rolesRes.data);
      if (!whRes.error && Array.isArray(whRes.data)) setWarehouses(whRes.data);
      if (!whAssignRes.error) {
        const map: Record<string, string[]> = {};
        for (const r of whAssignRes.data) {
          if (!map[r.user_id]) map[r.user_id] = [];
          map[r.user_id]!.push(r.warehouse_id);
        }
        setUserWarehouseMap(map);
      }
      if (!companyRes.error && companyRes.data) {
        const c = companyRes.data as any;
        setCompany(c);
        setIsLimitReached(c.active_users >= c.user_limit);
      }
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.companyId]);

  useEffect(() => {
    if (!currentUser?.companyId) { toast.error('Company information not found'); logout(); return; }
    loadAll();
  }, [loadAll, currentUser?.companyId]);

  /* ---- helpers ---- */
  const whName = (id: string) => warehouses.find((w) => w.id === id)?.name ?? id;

  const openDropdownMenu = (userId: string) =>
    setOpenDropdown(openDropdown === userId ? null : userId);

  /* ---- warehouse modal ---- */
  const openWhModal = (u: CompanyUser) => {
    setSelectedUser(u);
    setEditingWhIds(userWarehouseMap[u.id] ?? []);
    setShowWhModal(true);
    setOpenDropdown(null);
  };
  const toggleWh = (id: string) =>
    setEditingWhIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const handleSaveWarehouses = async () => {
    if (!selectedUser) return;
    setIsActionLoading(true);
    try {
      const { error } = await setUserWarehouseAssignments(selectedUser.id, editingWhIds);
      if (error) { toast.error('Failed to save warehouse assignments'); return; }
      toast.success('Warehouse assignments updated');
      setUserWarehouseMap((p) => ({ ...p, [selectedUser.id]: editingWhIds }));
      setShowWhModal(false);
    } finally { setIsActionLoading(false); }
  };

  /* ---- edit user modal ---- */
  const openEditModal = (u: CompanyUser) => {
    setSelectedUser(u);
    setEditForm({
      first_name: u.first_name,
      last_name:  u.last_name,
      email:      u.email,
      phone:      u.phone ?? '',
      role_id:    u.role_id ?? '',
    });
    setEditingWhIds(userWarehouseMap[u.id] ?? []);
    setEditErrors({});
    setShowEditModal(true);
    setOpenDropdown(null);
  };

  const handleSaveEdit = async () => {
    if (!selectedUser) return;
    const errs: Record<string, string> = {};
    if (!editForm.first_name.trim()) errs.first_name = 'Required';
    if (!editForm.last_name.trim())  errs.last_name  = 'Required';
    if (!editForm.email.trim())      errs.email      = 'Required';
    if (Object.keys(errs).length) { setEditErrors(errs); return; }

    setIsActionLoading(true);
    try {
      const result = await updateUser(selectedUser.id, {
        first_name: editForm.first_name.trim(),
        last_name:  editForm.last_name.trim(),
        email:      editForm.email.trim(),
        phone:      editForm.phone.trim() || null,
        ...(editForm.role_id ? { role_id: editForm.role_id } : {}),
      });
      if (result.error) { toast.error('Failed to update user'); return; }

      const { error: whError } = await setUserWarehouseAssignments(selectedUser.id, editingWhIds);
      if (whError) { toast.error('User updated, but failed to save warehouse assignments'); return; }
      setUserWarehouseMap((p) => ({ ...p, [selectedUser.id]: editingWhIds }));

      toast.success('User updated successfully');
      setShowEditModal(false);
      loadAll();
    } finally { setIsActionLoading(false); }
  };

  /* ---- reset password modal ---- */
  const openResetModal = (u: CompanyUser) => {
    setSelectedUser(u);
    setNewPassword('');
    setConfirmNewPassword('');
    setShowNewPw(false);
    setShowConfirmPw(false);
    setPwErrors({});
    setShowResetModal(true);
    setOpenDropdown(null);
  };

  const handleResetPassword = async () => {
    if (!selectedUser) return;
    const errs: Record<string, string> = {};
    if (!newPassword)               errs.newPassword = 'Password is required';
    else if (newPassword.length < 8) errs.newPassword = 'At least 8 characters';
    if (newPassword !== confirmNewPassword) errs.confirmNewPassword = 'Passwords do not match';
    if (Object.keys(errs).length) { setPwErrors(errs); return; }

    setIsActionLoading(true);
    try {
      const result = await changePassword(newPassword, selectedUser.id);
      if (result.error) { toast.error(typeof result.error === 'string' ? result.error : 'Failed to reset password'); return; }
      toast.success(`Password reset for ${selectedUser.first_name} ${selectedUser.last_name}`);
      setShowResetModal(false);
    } finally { setIsActionLoading(false); }
  };

  /* ---- suspend / delete ---- */
  const handleSuspendUser = async () => {
    if (!selectedUser) return;
    setIsActionLoading(true);
    try {
      const newStatus = selectedUser.status === 'active' ? 'suspended' : 'active';
      const result = await toggleUserStatus(selectedUser.id, newStatus);
      if (result.error) { toast.error('Failed to update user status'); return; }
      toast.success(`User ${newStatus === 'suspended' ? 'suspended' : 'reactivated'}`);
      setShowSuspendModal(false);
      setSelectedUser(null);
      loadAll();
    } finally { setIsActionLoading(false); }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    setIsActionLoading(true);
    try {
      const result = await deleteUserPermanently(selectedUser.id);
      if (result.error) { toast.error('Failed to delete user'); return; }
      toast.success('User deleted successfully');
      setShowDeleteModal(false);
      setSelectedUser(null);
      loadAll();
    } finally { setIsActionLoading(false); }
  };

  /* ---- create user ---- */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
    if (errors[name]) setErrors((p) => ({ ...p, [name]: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const errs: Record<string, string> = {};
    if (!formData.first_name?.trim()) errs.first_name = 'First name is required';
    if (!formData.last_name?.trim())  errs.last_name  = 'Last name is required';
    if (!formData.email?.trim())      errs.email      = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errs.email = 'Invalid email address';
    if (!formData.password)           errs.password   = 'Password is required';
    else if (formData.password.length < 8) errs.password = 'At least 8 characters';
    if (formData.password !== formData.confirmPassword) errs.confirmPassword = 'Passwords do not match';
    if (Object.keys(errs).length) { setErrors(errs); toast.error('Please fix the errors below'); return; }

    setIsSaving(true);
    try {
      const result = await createCompanyAdmin({
        company_id:  currentUser?.companyId,
        first_name:  formData.first_name,
        last_name:   formData.last_name,
        email:       formData.email,
        phone:       formData.phone || null,
        password:    formData.password,
        role_id:     formData.role_id || undefined,
      });
      if (result.error) {
        const msg = typeof result.error === 'string' ? result.error : 'Failed to create user';
        if (msg.includes('duplicate') || msg.includes('unique')) {
          setErrors({ email: 'A user with this email already exists' });
          toast.error('Email already exists');
        } else { toast.error(msg); }
        return;
      }
      if (formData.warehouse_ids.length > 0 && result.data?.id) {
        await setUserWarehouseAssignments(result.data.id, formData.warehouse_ids);
      }
      toast.success('User created successfully!');
      setFormData({ first_name: '', last_name: '', email: '', phone: '', password: '', confirmPassword: '', role_id: '', warehouse_ids: [] });
      setShowAddForm(false);
      loadAll();
    } finally { setIsSaving(false); }
  };

  if (isLoading) return (
    <div className="flex justify-center py-12">
      <div className="text-center">
        <div className="inline-flex h-12 w-12 animate-spin rounded-full border-4 border-primary-600 border-t-transparent mb-4" />
        <p className="text-gray-600 dark:text-gray-400">Loading users…</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/settings">
          <Button variant="secondary" size="sm"><ArrowLeft className="h-4 w-4" />Back</Button>
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="h-6 w-6 text-primary-600" />Users Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400">Manage users and their warehouse access</p>
        </div>
      </div>

      {/* User Limit Alert */}
      {isLimitReached && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
          <AlertOctagon className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900 dark:text-red-100">User Limit Reached</h3>
            <p className="text-sm text-red-800 dark:text-red-200 mt-1">
              Your account has reached the maximum user limit ({company?.active_users}/{company?.user_limit}).
              Please <strong>upgrade your plan</strong> to add more users.
            </p>
          </div>
        </div>
      )}

      {/* Add User Button */}
      <div>
        {!showAddForm && (
          <Button onClick={() => setShowAddForm(true)} disabled={isLimitReached} className="flex items-center gap-2">
            <Plus className="h-5 w-5" />Add User
          </Button>
        )}
      </div>

      {/* ---- Create User Form ---- */}
      {showAddForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Create New User</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(['first_name', 'last_name'] as const).map((field) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 capitalize">
                    {field.replace('_', ' ')} *
                  </label>
                  <input type="text" name={field} value={formData[field]} onChange={handleChange}
                    className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors[field] ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
                    placeholder={field === 'first_name' ? 'John' : 'Doe'} />
                  {errors[field] && <p className="text-red-600 text-sm mt-1">{errors[field]}</p>}
                </div>
              ))}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email *</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.email ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
                placeholder="john@example.com" />
              {errors.email && <p className="text-red-600 text-sm mt-1">{errors.email}</p>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Phone (Optional)</label>
                <input type="tel" name="phone" value={formData.phone} onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="+1 (555) 000-0000" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Role</label>
                <select value={formData.role_id} onChange={(e) => setFormData((p) => ({ ...p, role_id: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="">Select a role (defaults to Viewer)</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name.charAt(0).toUpperCase() + r.name.slice(1)}{r.description ? ` — ${r.description}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {warehouses.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <span className="flex items-center gap-1.5">
                    <Warehouse className="h-4 w-4 text-gray-400" />
                    Warehouse Access
                    <span className="text-xs text-gray-500 font-normal">(blank = all warehouses)</span>
                  </span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {warehouses.map((wh) => {
                    const checked = formData.warehouse_ids.includes(wh.id);
                    return (
                      <label key={wh.id} className={`flex items-center gap-2 p-2.5 rounded-lg border-2 cursor-pointer transition-colors ${checked ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}>
                        <div className={`h-4 w-4 rounded flex items-center justify-center flex-shrink-0 ${checked ? 'bg-primary-600' : 'border border-gray-400 dark:border-gray-500'}`}>
                          {checked && <Check className="h-3 w-3 text-white" />}
                        </div>
                        <span className="text-sm text-gray-900 dark:text-white truncate">{fmtWarehouse(wh)}</span>
                        <input type="checkbox" className="sr-only" checked={checked}
                          onChange={() => setFormData((p) => ({ ...p, warehouse_ids: checked ? p.warehouse_ids.filter((x) => x !== wh.id) : [...p.warehouse_ids, wh.id] }))} />
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(['password', 'confirmPassword'] as const).map((field) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {field === 'password' ? 'Password *' : 'Confirm Password *'}
                  </label>
                  <input type="password" name={field} value={formData[field]} onChange={handleChange}
                    className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors[field] ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
                    placeholder="••••••••" />
                  {errors[field] && <p className="text-red-600 text-sm mt-1">{errors[field]}</p>}
                </div>
              ))}
            </div>
            <div className="flex gap-4 pt-2">
              <Button type="button" variant="ghost" onClick={() => { setShowAddForm(false); setErrors({}); }}>Cancel</Button>
              <button type="submit" disabled={isSaving} className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg disabled:opacity-50">
                {isSaving ? 'Creating…' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ---- Users Table ---- */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {users.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Code</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Warehouses</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Created</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {users.map((u) => {
                  const assignedIds = userWarehouseMap[u.id] ?? [];
                  return (
                    <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-6 py-4">
                        <button
                          onClick={() => copyId(u.id)}
                          title={`Copy UUID · ${u.id}`}
                          className="flex items-center gap-1.5 group"
                        >
                          <span className="font-mono font-semibold text-sm text-gray-700 dark:text-gray-300">
                            {fmtCode((u as any).code) ?? '—'}
                          </span>
                          {copiedId === u.id
                            ? <Check className="h-3.5 w-3.5 text-green-500" />
                            : <Copy className="h-3.5 w-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />}
                        </button>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                        {u.first_name} {u.last_name}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          <span className="text-sm text-gray-600 dark:text-gray-400">{u.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {u.phone
                          ? <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-gray-400" /><span className="text-sm text-gray-600 dark:text-gray-400">{u.phone}</span></div>
                          : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${u.is_company_admin ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400'}`}>
                          {u.is_company_admin ? 'Admin' : (u.role ? u.role.charAt(0).toUpperCase() + u.role.slice(1) : 'User')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {assignedIds.length === 0
                          ? <span className="text-xs text-gray-400 italic">All warehouses</span>
                          : <div className="flex flex-wrap gap-1">
                              {assignedIds.slice(0, 2).map((wid) => (
                                <span key={wid} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                                  <Warehouse className="h-3 w-3" />{whName(wid)}
                                </span>
                              ))}
                              {assignedIds.length > 2 && <span className="text-xs text-gray-500">+{assignedIds.length - 2} more</span>}
                            </div>}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          u.status === 'active' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : u.status === 'suspended' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                          {u.status.charAt(0).toUpperCase() + u.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="relative flex justify-center">
                          <button onClick={() => openDropdownMenu(u.id)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                            <MoreVertical className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                          </button>
                          {openDropdown === u.id && (
                            <div className="absolute right-0 mt-8 w-52 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg z-20 overflow-hidden">
                              {/* Admin-only actions */}
                              {isAdmin && (
                                <>
                                  <button onClick={() => openEditModal(u)}
                                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                    <Pencil className="h-4 w-4 text-blue-500" />Edit User
                                  </button>
                                  <button onClick={() => openResetModal(u)}
                                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                    <KeyRound className="h-4 w-4 text-amber-500" />Reset Password
                                  </button>
                                  <div className="border-t border-gray-200 dark:border-gray-600" />
                                </>
                              )}
                              <button onClick={() => openWhModal(u)}
                                className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                <Warehouse className="h-4 w-4 text-primary-500" />Assign Warehouses
                              </button>
                              <button onClick={() => { setSelectedUser(u); setShowSuspendModal(true); setOpenDropdown(null); }}
                                className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                <AlertTriangle className="h-4 w-4" />{u.status === 'active' ? 'Suspend User' : 'Reactivate User'}
                              </button>
                              {isAdmin && (
                                <>
                                  <div className="border-t border-gray-200 dark:border-gray-600" />
                                  <button onClick={() => { setSelectedUser(u); setShowDeleteModal(true); setOpenDropdown(null); }}
                                    className="w-full text-left px-4 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                                    <Trash2 className="h-4 w-4" />Delete User
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---- Edit User Modal ---- */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Pencil className="h-5 w-5 text-blue-500" />Edit User
              </h2>
              <button onClick={() => setShowEditModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {(['first_name', 'last_name'] as const).map((f) => (
                  <div key={f}>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 capitalize">{f.replace('_', ' ')} *</label>
                    <input type="text" value={editForm[f]} onChange={(e) => setEditForm((p) => ({ ...p, [f]: e.target.value }))}
                      className={`w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 ${editErrors[f] ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`} />
                    {editErrors[f] && <p className="text-red-500 text-xs mt-1">{editErrors[f]}</p>}
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Email *</label>
                <input type="email" value={editForm.email} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 ${editErrors.email ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`} />
                {editErrors.email && <p className="text-red-500 text-xs mt-1">{editErrors.email}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                  <input type="tel" value={editForm.phone} onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                  <select value={editForm.role_id} onChange={(e) => setEditForm((p) => ({ ...p, role_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500">
                    <option value="">Keep current</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>{r.name.charAt(0).toUpperCase() + r.name.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
              {warehouses.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    <span className="flex items-center gap-1.5">
                      <Warehouse className="h-4 w-4 text-gray-400" />
                      Warehouse Access
                      <span className="text-xs text-gray-500 font-normal">(blank = all warehouses)</span>
                    </span>
                  </label>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                    {warehouses.map((wh) => {
                      const checked = editingWhIds.includes(wh.id);
                      return (
                        <label key={wh.id} onClick={() => toggleWh(wh.id)}
                          className={`flex items-center gap-2 p-2 rounded-lg border-2 cursor-pointer transition-colors ${checked ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}>
                          <div className={`h-4 w-4 rounded flex items-center justify-center flex-shrink-0 ${checked ? 'bg-primary-600' : 'border border-gray-400 dark:border-gray-500'}`}>
                            {checked && <Check className="h-3 w-3 text-white" />}
                          </div>
                          <span className="text-sm text-gray-900 dark:text-white truncate">{fmtWarehouse(wh)}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowEditModal(false)} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">Cancel</button>
              <button onClick={handleSaveEdit} disabled={isActionLoading} className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium text-sm disabled:opacity-50">
                {isActionLoading ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Reset Password Modal ---- */}
      {showResetModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700 shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-amber-500" />Reset Password
              </h2>
              <button onClick={() => setShowResetModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              Set a new password for <span className="font-semibold text-gray-900 dark:text-white">{selectedUser.first_name} {selectedUser.last_name}</span>
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">New Password *</label>
                <div className="relative">
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setPwErrors((p) => ({ ...p, newPassword: '' })); }}
                    className={`w-full px-3 py-2 pr-10 border rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 ${pwErrors.newPassword ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowNewPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {pwErrors.newPassword && <p className="text-red-500 text-xs mt-1">{pwErrors.newPassword}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm New Password *</label>
                <div className="relative">
                  <input
                    type={showConfirmPw ? 'text' : 'password'}
                    value={confirmNewPassword}
                    onChange={(e) => { setConfirmNewPassword(e.target.value); setPwErrors((p) => ({ ...p, confirmNewPassword: '' })); }}
                    className={`w-full px-3 py-2 pr-10 border rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 ${pwErrors.confirmNewPassword ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowConfirmPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {pwErrors.confirmNewPassword && <p className="text-red-500 text-xs mt-1">{pwErrors.confirmNewPassword}</p>}
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowResetModal(false)} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">Cancel</button>
              <button onClick={handleResetPassword} disabled={isActionLoading} className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium text-sm disabled:opacity-50">
                {isActionLoading ? 'Resetting…' : 'Reset Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Warehouse Assignment Modal ---- */}
      {showWhModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Warehouse className="h-5 w-5 text-primary-500" />Assign Warehouses
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{selectedUser.first_name} {selectedUser.last_name}</p>
              </div>
              <button onClick={() => setShowWhModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              Select which warehouses this user can access. Leave all unchecked to grant access to <strong>all warehouses</strong>.
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto mb-6">
              {warehouses.map((wh) => {
                const checked = editingWhIds.includes(wh.id);
                return (
                  <label key={wh.id} onClick={() => toggleWh(wh.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${checked ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}>
                    <div className={`h-5 w-5 rounded flex items-center justify-center flex-shrink-0 ${checked ? 'bg-primary-600' : 'border-2 border-gray-300 dark:border-gray-500'}`}>
                      {checked && <Check className="h-3.5 w-3.5 text-white" />}
                    </div>
                    <Warehouse className={`h-4 w-4 flex-shrink-0 ${checked ? 'text-primary-500' : 'text-gray-400'}`} />
                    <span className={`text-sm font-medium ${checked ? 'text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-300'}`}>{fmtWarehouse(wh)}</span>
                  </label>
                );
              })}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowWhModal(false)} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">Cancel</button>
              <button onClick={handleSaveWarehouses} disabled={isActionLoading} className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium text-sm disabled:opacity-50">
                {isActionLoading ? 'Saving…' : 'Save Assignments'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Suspend Modal ---- */}
      {showSuspendModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              {selectedUser.status === 'active' ? 'Suspend User' : 'Reactivate User'}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {selectedUser.status === 'active'
                ? `Suspend ${selectedUser.first_name} ${selectedUser.last_name}? They will not be able to access the system.`
                : `Reactivate ${selectedUser.first_name} ${selectedUser.last_name}? They will regain access.`}
            </p>
            <div className="flex gap-3">
              <button onClick={() => { setShowSuspendModal(false); setSelectedUser(null); }} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">Cancel</button>
              <button onClick={handleSuspendUser} disabled={isActionLoading} className={`flex-1 px-4 py-2 rounded-lg text-white text-sm disabled:opacity-50 ${selectedUser.status === 'active' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}>
                {isActionLoading ? 'Updating…' : selectedUser.status === 'active' ? 'Suspend' : 'Reactivate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Delete Modal ---- */}
      {showDeleteModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete User</h2>
            <p className="text-sm text-red-600 dark:text-red-400 mb-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />This action cannot be undone
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Permanently delete <strong>{selectedUser.first_name} {selectedUser.last_name}</strong> ({selectedUser.email})?
            </p>
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteModal(false); setSelectedUser(null); }} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">Cancel</button>
              <button onClick={handleDeleteUser} disabled={isActionLoading} className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm disabled:opacity-50">
                {isActionLoading ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
