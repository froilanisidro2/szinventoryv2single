'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Edit, Trash2, Plus, Check, X, ArrowLeft, Info } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getCurrentUser } from '@/lib/auth-utils';
import { getRoles, createRole, updateRole, deleteRole } from '@/app/actions';
import { toast } from 'sonner';

interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
}

const ALL_PERMISSIONS = [
  { key: 'all', label: 'Full Access (All Permissions)', group: 'Admin' },
  { key: 'inventory:read', label: 'View Inventory', group: 'Inventory' },
  { key: 'inventory:write', label: 'Manage Inventory (Inbound/Outbound)', group: 'Inventory' },
  { key: 'invoices:read', label: 'View Invoices', group: 'Invoices' },
  { key: 'invoices:write', label: 'Create & Edit Invoices', group: 'Invoices' },
  { key: 'payments:read', label: 'View Payments', group: 'Payments' },
  { key: 'payments:write', label: 'Manage Payments', group: 'Payments' },
  { key: 'reports:read', label: 'View Reports', group: 'Reports' },
  { key: 'users:read', label: 'View Users', group: 'Users' },
  { key: 'users:write', label: 'Manage Users', group: 'Users' },
  { key: 'settings:read', label: 'View Settings', group: 'Settings' },
  { key: 'settings:write', label: 'Manage Settings', group: 'Settings' },
  // Purchase Orders
  { key: 'po:create', label: 'Create / Send Purchase Orders', group: 'Purchase Orders' },
  { key: 'po:approve', label: 'Approve Purchase Orders', group: 'Purchase Orders' },
  { key: 'po:receive', label: 'Receive Goods (GRN)', group: 'Purchase Orders' },
  // Material Requests (MRF)
  { key: 'mrf:create', label: 'Create / Send Material Requests', group: 'Material Requests' },
  { key: 'mrf:approve', label: 'Approve Material Requests', group: 'Material Requests' },
  // Job Orders (JO / BOM)
  { key: 'jo:create', label: 'Create / Send Job Orders', group: 'Job Orders' },
  { key: 'jo:approve', label: 'Approve Job Orders', group: 'Job Orders' },
  { key: 'jo:issue', label: 'Issue Materials (BOM / MIS)', group: 'Job Orders' },
  { key: 'jo:return', label: 'Receive Material Returns (MRS)', group: 'Job Orders' },
  // Sales Orders
  { key: 'so:create', label: 'Create / Send Sales Orders', group: 'Sales Orders' },
  { key: 'so:approve', label: 'Approve / Confirm Sales Orders', group: 'Sales Orders' },
  { key: 'so:fulfill', label: 'Pick & Ship Sales Orders', group: 'Sales Orders' },
];

const ROLE_WORKFLOW_INFO: Record<string, { inbound: string; outbound: string }> = {
  admin: {
    inbound: 'Approver — can approve & receive Purchase Orders (GRN)',
    outbound: 'Approver — can approve & finalize Sales Order dispatches',
  },
  processor: {
    inbound: 'Receiver / Approver — approves MRF & JO, receives POs (GRN), issues materials (MIS) and processes returns (MRS)',
    outbound: 'Dispatcher / Approver — confirms and picks/ships Sales Orders',
  },
  requestor: {
    inbound: 'Sender — creates Purchase Orders, Material Requests, and Job Orders for approval',
    outbound: 'Sender — creates Sales Orders for fulfillment',
  },
  manager: {
    inbound: 'Receiver / Approver — receives inbound goods, approves POs',
    outbound: 'Dispatcher / Approver — approves and dispatches outbound orders',
  },
  sales: {
    inbound: 'View only — can view inbound stock levels',
    outbound: 'Sender — creates Sales Orders, initiates dispatch requests',
  },
  accountant: {
    inbound: 'Invoice processor — handles supplier invoices for inbound POs',
    outbound: 'Invoice processor — handles customer invoices for outbound SOs',
  },
  viewer: {
    inbound: 'Read only — can view inbound transactions',
    outbound: 'Read only — can view outbound transactions',
  },
};

const PERMISSION_GROUPS = ['Admin', 'Inventory', 'Purchase Orders', 'Material Requests', 'Job Orders', 'Sales Orders', 'Invoices', 'Payments', 'Reports', 'Users', 'Settings'];

export default function RolesPage() {
  const router = useRouter();
  const user = getCurrentUser();
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editingPermissions, setEditingPermissions] = useState<string[]>([]);
  const [showNewRoleForm, setShowNewRoleForm] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [newRolePerms, setNewRolePerms] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    if (!user?.companyId) {
      toast.error('Company information not found');
      router.push('/dashboard');
      return;
    }
    if (!user.isCompanyAdmin) {
      toast.error('You do not have permission to manage roles');
      router.push('/dashboard');
      return;
    }
    loadRoles();
  }, [isMounted]);

  const loadRoles = async () => {
    try {
      setIsLoading(true);
      const result = await getRoles();
      if (result.error) {
        toast.error('Failed to load roles');
        return;
      }
      const loaded = (result.data || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        description: r.description || '',
        permissions: Array.isArray(r.permissions) ? r.permissions : [],
      }));
      setRoles(loaded);
    } catch {
      toast.error('Error loading roles');
    } finally {
      setIsLoading(false);
    }
  };

  const startEditing = (role: Role) => {
    setEditingRoleId(role.id);
    setEditingPermissions([...role.permissions]);
  };

  const toggleEditPerm = (perm: string) => {
    if (perm === 'all') {
      setEditingPermissions(['all']);
      return;
    }
    setEditingPermissions(prev => {
      const without = prev.filter(p => p !== 'all');
      return without.includes(perm) ? without.filter(p => p !== perm) : [...without, perm];
    });
  };

  const handleSaveRole = async (roleId: string) => {
    try {
      setIsSaving(true);
      const result = await updateRole(roleId, { permissions: editingPermissions });
      if (result.error) {
        toast.error('Failed to save role');
        return;
      }
      toast.success('Role permissions updated');
      setEditingRoleId(null);
      loadRoles();
    } catch {
      toast.error('Error saving role');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRole = async (roleId: string, roleName: string) => {
    if (roleName === 'admin') {
      toast.error('Cannot delete the Admin role');
      return;
    }
    if (!confirm(`Delete role "${roleName}"? Users with this role will lose access.`)) return;
    try {
      const result = await deleteRole(roleId);
      if (result.error) {
        toast.error('Failed to delete role — it may be assigned to users');
        return;
      }
      toast.success('Role deleted');
      loadRoles();
    } catch {
      toast.error('Error deleting role');
    }
  };

  const handleAddNewRole = async () => {
    if (!newRoleName.trim()) {
      toast.error('Role name is required');
      return;
    }
    try {
      setIsSaving(true);
      const result = await createRole({
        name: newRoleName,
        description: newRoleDesc,
        permissions: newRolePerms,
      });
      if (result.error) {
        toast.error('Failed to create role');
        return;
      }
      toast.success('Role created');
      setNewRoleName('');
      setNewRoleDesc('');
      setNewRolePerms([]);
      setShowNewRoleForm(false);
      loadRoles();
    } catch {
      toast.error('Error creating role');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleNewPerm = (perm: string) => {
    if (perm === 'all') {
      setNewRolePerms(['all']);
      return;
    }
    setNewRolePerms(prev => {
      const without = prev.filter(p => p !== 'all');
      return without.includes(perm) ? without.filter(p => p !== perm) : [...without, perm];
    });
  };

  if (!isMounted || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/settings">
            <Button variant="secondary" size="sm">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary-600" />
              Roles & Permissions
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage user roles, permissions, and workflow positions
            </p>
          </div>
        </div>
        <Button onClick={() => setShowNewRoleForm(true)} className="gap-2 bg-primary-600 hover:bg-primary-700 text-white">
          <Plus className="h-4 w-4" />
          New Role
        </Button>
      </div>

      {/* Workflow info banner */}
      <div className="card p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <div className="flex gap-2">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">Inbound & Outbound Workflow Roles</p>
            <p className="text-xs text-blue-700 dark:text-blue-400">
              Each role maps to a position in the document workflow (PO, MRF, Job Order/BOM, Sales Order).{' '}
              <strong>Requestor</strong> = Sender — creates and submits POs, MRFs, Job Orders, and Sales Orders for approval.{' '}
              <strong>Processor</strong> = Approver / Receiver / Issuer — approves MRFs &amp; Job Orders, receives POs (GRN),
              issues materials (MIS) and processes returns (MRS), and confirms / picks &amp; ships Sales Orders.{' '}
              <strong>Admin</strong> = Full access — can do everything Processor can, plus manage users, roles, and settings.
            </p>
          </div>
        </div>
      </div>

      {/* New Role Form */}
      {showNewRoleForm && (
        <div className="card p-6 border border-primary-200 dark:border-primary-900 bg-primary-50 dark:bg-primary-950/30">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Create New Role</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Role Name *</label>
              <Input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder="e.g., Supervisor" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
              <Input value={newRoleDesc} onChange={(e) => setNewRoleDesc(e.target.value)} placeholder="Role description" />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Permissions</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
              {ALL_PERMISSIONS.map((p) => (
                <label key={p.key} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300 hover:text-primary-600">
                  <input
                    type="checkbox"
                    checked={newRolePerms.includes(p.key)}
                    onChange={() => toggleNewPerm(p.key)}
                    className="w-4 h-4 rounded border-gray-300 text-primary-600"
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleAddNewRole} disabled={isSaving} className="gap-2 bg-primary-600 hover:bg-primary-700 text-white">
              <Check className="h-4 w-4" />
              {isSaving ? 'Creating...' : 'Create Role'}
            </Button>
            <Button onClick={() => { setShowNewRoleForm(false); setNewRoleName(''); setNewRoleDesc(''); setNewRolePerms([]); }} className="gap-2 bg-gray-300 hover:bg-gray-400 text-gray-900">
              <X className="h-4 w-4" />
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Roles Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {roles.map((role) => {
          const workflowInfo = ROLE_WORKFLOW_INFO[role.name.toLowerCase()];
          const isEditing = editingRoleId === role.id;

          return (
            <div key={role.id} className="card p-6 border border-gray-200 dark:border-gray-700">
              {/* Role Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white capitalize">{role.name}</h3>
                    {role.name === 'admin' && (
                      <span className="px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full font-medium">Protected</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{role.description}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    {role.permissions.length} permission{role.permissions.length !== 1 ? 's' : ''}
                  </p>
                </div>
                {role.name !== 'admin' && !isEditing && (
                  <button onClick={() => handleDeleteRole(role.id, role.name)} className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Workflow info */}
              {workflowInfo && (
                <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg space-y-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">Workflow Position</p>
                  <p className="text-xs text-green-700 dark:text-green-400"><span className="font-medium">Inbound:</span> {workflowInfo.inbound}</p>
                  <p className="text-xs text-blue-700 dark:text-blue-400"><span className="font-medium">Outbound:</span> {workflowInfo.outbound}</p>
                </div>
              )}

              {/* Permissions */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Permissions</h4>
                  {!isEditing && (
                    <button onClick={() => startEditing(role)} className="text-xs px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-lg hover:bg-primary-200 transition-colors flex items-center gap-1">
                      <Edit className="h-3 w-3" />
                      Edit
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <>
                    <div className="space-y-1 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg max-h-64 overflow-y-auto">
                      {PERMISSION_GROUPS.map(group => {
                        const groupPerms = ALL_PERMISSIONS.filter(p => p.group === group);
                        return (
                          <div key={group} className="mb-2">
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{group}</p>
                            {groupPerms.map(p => (
                              <label key={p.key} className="flex items-center gap-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 p-1.5 rounded transition-colors">
                                <input
                                  type="checkbox"
                                  checked={editingPermissions.includes(p.key)}
                                  onChange={() => toggleEditPerm(p.key)}
                                  className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300">{p.label}</span>
                              </label>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => handleSaveRole(role.id)} disabled={isSaving} className="flex-1 gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm">
                        <Check className="h-4 w-4" />
                        {isSaving ? 'Saving...' : 'Save'}
                      </Button>
                      <Button onClick={() => setEditingRoleId(null)} className="gap-2 bg-gray-300 hover:bg-gray-400 text-gray-900 text-sm">
                        <X className="h-4 w-4" />
                        Cancel
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {role.permissions.length > 0 ? (
                      role.permissions.map(perm => {
                        const info = ALL_PERMISSIONS.find(p => p.key === perm);
                        return (
                          <span key={perm} className="px-2 py-1 text-xs bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded border border-green-200 dark:border-green-800">
                            {info?.label || perm}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-xs text-amber-600 dark:text-amber-400">No permissions assigned</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="card p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
        <p className="text-sm text-amber-800 dark:text-amber-300">
          <strong>Note:</strong> Role changes take effect on the next user login. The <strong>Admin</strong> role cannot be deleted.
        </p>
      </div>
    </div>
  );
}
