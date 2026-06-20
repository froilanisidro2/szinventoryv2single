'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Edit, Check, X, ArrowLeft, Info, RotateCcw, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/lib/use-current-user';
import { getRoles, createRole, updateRole, deleteRole } from '@/app/actions';
import { toast } from 'sonner';

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
}

const ALL_PERMISSIONS = [
  { key: 'all',              label: 'Full Access (All Permissions)',       group: 'Admin' },
  { key: 'inventory:read',   label: 'View Inventory',                      group: 'Inventory' },
  { key: 'inventory:write',  label: 'Manage Inventory (Inbound/Outbound)', group: 'Inventory' },
  { key: 'po:create',        label: 'Create / Send Purchase Orders',       group: 'Purchase Orders' },
  { key: 'po:approve',       label: 'Approve Purchase Orders',             group: 'Purchase Orders' },
  { key: 'po:receive',       label: 'Receive Goods (GRN)',                 group: 'Purchase Orders' },
  { key: 'mrf:create',       label: 'Create / Send Material Requests',     group: 'Material Requests' },
  { key: 'mrf:approve',      label: 'Approve Material Requests',           group: 'Material Requests' },
  { key: 'jo:create',        label: 'Create / Send Job Orders',            group: 'Job Orders' },
  { key: 'jo:approve',       label: 'Approve Job Orders',                  group: 'Job Orders' },
  { key: 'jo:issue',         label: 'Issue Materials (BOM / MIS)',         group: 'Job Orders' },
  { key: 'jo:return',        label: 'Receive Material Returns (MRS)',      group: 'Job Orders' },
  { key: 'so:create',        label: 'Create / Send Sales Orders',          group: 'Sales Orders' },
  { key: 'so:approve',       label: 'Approve / Confirm Sales Orders',      group: 'Sales Orders' },
  { key: 'so:fulfill',       label: 'Pick & Ship Sales Orders',            group: 'Sales Orders' },
  { key: 'invoices:read',    label: 'View Invoices',                       group: 'Invoices' },
  { key: 'invoices:write',   label: 'Create & Edit Invoices',              group: 'Invoices' },
  { key: 'payments:read',    label: 'View Payments',                       group: 'Payments' },
  { key: 'payments:write',   label: 'Manage Payments',                     group: 'Payments' },
  { key: 'reports:read',     label: 'View Reports',                        group: 'Reports' },
  { key: 'users:read',       label: 'View Users',                          group: 'Users' },
  { key: 'users:write',      label: 'Manage Users',                        group: 'Users' },
  { key: 'settings:read',    label: 'View Settings',                       group: 'Settings' },
  { key: 'settings:write',   label: 'Manage Settings',                     group: 'Settings' },
];

const PERMISSION_GROUPS = [
  'Admin', 'Inventory', 'Purchase Orders', 'Material Requests',
  'Job Orders', 'Sales Orders', 'Invoices', 'Payments', 'Reports', 'Users', 'Settings',
];

// ── Preset role definitions ──────────────────────────────────────────────────
const PRESET_ROLES: Array<{ name: string; description: string; permissions: string[]; color: string }> = [
  {
    name: 'admin',
    description: 'Full system access — manage everything including users, roles, and settings',
    permissions: ['all'],
    color: 'red',
  },
  {
    name: 'backoffice',
    description: 'Process Purchase Orders, Job Orders, and manage inventory operations',
    permissions: [
      'inventory:read', 'inventory:write',
      'po:create', 'po:approve', 'po:receive',
      'mrf:create', 'mrf:approve',
      'jo:create', 'jo:approve', 'jo:issue', 'jo:return',
      'so:create', 'so:approve', 'so:fulfill',
      'invoices:read', 'invoices:write',
      'payments:read', 'payments:write',
      'reports:read',
      'users:read', 'settings:read',
    ],
    color: 'blue',
  },
  {
    name: 'user',
    description: 'Create and submit Job Orders and Material Requests for approval',
    permissions: [
      'inventory:read',
      'mrf:create',
      'jo:create',
    ],
    color: 'green',
  },
  {
    name: 'viewer',
    description: 'Read-only access — view inventory, reports, and invoices only',
    permissions: [
      'inventory:read',
      'reports:read',
      'invoices:read',
    ],
    color: 'gray',
  },
];

const PRESET_NAMES = PRESET_ROLES.map(r => r.name);

const ROLE_WORKFLOW_INFO: Record<string, { badge: string; inbound: string; outbound: string }> = {
  admin: {
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    inbound: 'Full access — approve & receive Purchase Orders, manage all inbound stock and MRFs',
    outbound: 'Full access — approve, pick & ship Sales Orders, manage all outbound operations',
  },
  backoffice: {
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    inbound: 'Processor — create/approve MRF & PO, receive goods (GRN), issue materials (MIS), process returns (MRS)',
    outbound: 'Processor — create, approve, and fulfill Sales Orders (pick & ship)',
  },
  user: {
    badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    inbound: 'Requestor — create Material Requests (MRF) and Job Orders; awaits BackOffice approval',
    outbound: 'View only — cannot create or process outbound orders',
  },
  viewer: {
    badge: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    inbound: 'Read only — can view inventory levels and reports',
    outbound: 'Read only — can view invoices and reports',
  },
};

export default function RolesPage() {
  const router = useRouter();
  const user = useCurrentUser();
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editingPermissions, setEditingPermissions] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  const isCompanyAdmin = user?.isCompanyAdmin === true;

  useEffect(() => {
    if (!isMounted) return;
    if (!user?.companyId) { toast.error('Company information not found'); router.push('/dashboard'); return; }
    const userPerms: string[] = user.permissions ?? [];
    const canManageRoles = user.isCompanyAdmin || userPerms.includes('all') || userPerms.includes('settings:write');
    if (!canManageRoles) { toast.error('You do not have permission to manage roles'); router.push('/dashboard'); return; }
    seedAndLoadRoles();
  }, [isMounted]);

  // Seed preset roles and remove any non-preset roles
  const seedAndLoadRoles = async () => {
    try {
      setIsLoading(true);
      setIsSeeding(true);

      const result = await getRoles();
      const existing: any[] = Array.isArray(result.data) ? result.data : [];

      // Delete non-preset roles
      for (const r of existing) {
        if (!PRESET_NAMES.includes(r.name.toLowerCase())) {
          await deleteRole(r.id);
        }
      }

      // Create missing preset roles
      for (const preset of PRESET_ROLES) {
        const exists = existing.find((r: any) => r.name.toLowerCase() === preset.name);
        if (!exists) {
          await createRole({ name: preset.name, description: preset.description, permissions: preset.permissions });
        }
      }

      // Reload clean list
      const fresh = await getRoles();
      const loaded = (fresh.data || [])
        .map((r: any) => ({
          id: r.id,
          name: r.name.toLowerCase(),
          description: r.description || '',
          permissions: Array.isArray(r.permissions) ? r.permissions : [],
        }))
        .sort((a: Role, b: Role) => PRESET_NAMES.indexOf(a.name) - PRESET_NAMES.indexOf(b.name));

      setRoles(loaded);
    } catch {
      toast.error('Error initialising roles');
    } finally {
      setIsLoading(false);
      setIsSeeding(false);
    }
  };

  const startEditing = (role: Role) => {
    setEditingRoleId(role.id);
    setEditingPermissions([...role.permissions]);
  };

  const toggleEditPerm = (perm: string) => {
    if (perm === 'all') { setEditingPermissions(['all']); return; }
    setEditingPermissions(prev => {
      const without = prev.filter(p => p !== 'all');
      return without.includes(perm) ? without.filter(p => p !== perm) : [...without, perm];
    });
  };

  const handleSaveRole = async (roleId: string) => {
    try {
      setIsSaving(true);
      const result = await updateRole(roleId, { permissions: editingPermissions });
      if (result.error) { toast.error('Failed to save role'); return; }
      toast.success('Permissions updated');
      setEditingRoleId(null);
      await reloadRoles();
    } catch {
      toast.error('Error saving role');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefault = async (role: Role) => {
    const preset = PRESET_ROLES.find(p => p.name === role.name);
    if (!preset) return;
    if (!confirm(`Reset "${role.name}" permissions back to defaults?`)) return;
    try {
      setIsSaving(true);
      await updateRole(role.id, { permissions: preset.permissions, description: preset.description });
      toast.success(`"${role.name}" reset to defaults`);
      await reloadRoles();
    } catch {
      toast.error('Error resetting role');
    } finally {
      setIsSaving(false);
    }
  };

  const reloadRoles = async () => {
    const fresh = await getRoles();
    const loaded = (fresh.data || [])
      .map((r: any) => ({
        id: r.id,
        name: r.name.toLowerCase(),
        description: r.description || '',
        permissions: Array.isArray(r.permissions) ? r.permissions : [],
      }))
      .sort((a: Role, b: Role) => PRESET_NAMES.indexOf(a.name) - PRESET_NAMES.indexOf(b.name));
    setRoles(loaded);
  };

  if (!isMounted || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader className="h-8 w-8 animate-spin text-primary-600" />
        {isSeeding && <p className="text-sm text-gray-500 dark:text-gray-400">Setting up preset roles…</p>}
      </div>
    );
  }

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
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary-600" />
              Roles & Permissions
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              4 preset roles — edit permissions per role or reset to defaults
            </p>
          </div>
        </div>
      </div>

      {/* Role summary banner */}
      <div className="card p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <div className="flex gap-2">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
            <p className="font-semibold">Preset Role Access Summary</p>
            <ul className="space-y-0.5 text-xs text-blue-700 dark:text-blue-400">
              <li><strong>Admin</strong> — Full system access (users, settings, all operations)</li>
              <li><strong>BackOffice</strong> — Process POs &amp; JOs: create/approve MRF, PO, JO, receive GRN, issue MIS, process MRS, fulfill SOs</li>
              <li><strong>User</strong> — Request only: create Material Requests (MRF) and Job Orders (JO) for BackOffice approval</li>
              <li><strong>Viewer</strong> — Read only: view inventory, reports, and invoices — no create or approve actions</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Roles Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {roles.map((role) => {
          const preset = PRESET_ROLES.find(p => p.name === role.name);
          const workflowInfo = ROLE_WORKFLOW_INFO[role.name];
          const isEditing = editingRoleId === role.id;
          const isModifiedFromDefault = preset
            ? JSON.stringify([...role.permissions].sort()) !== JSON.stringify([...preset.permissions].sort())
            : false;

          const badgeCls = workflowInfo?.badge ?? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
          // Only company admins can edit the Admin role; BackOffice can edit all other roles
          const canEditRole = role.name.toLowerCase() === 'admin' ? isCompanyAdmin : true;

          return (
            <div key={role.id} className="card p-6 border border-gray-200 dark:border-gray-700">
              {/* Role Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white capitalize">{role.name}</h3>
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${badgeCls}`}>
                      Preset
                    </span>
                    {isModifiedFromDefault && (
                      <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        Modified
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{role.description}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    {role.permissions.includes('all') ? 'All permissions' : `${role.permissions.length} permission${role.permissions.length !== 1 ? 's' : ''}`}
                  </p>
                </div>

                {/* Reset button — only when modified from default and user can edit this role */}
                {isModifiedFromDefault && !isEditing && canEditRole && (
                  <button
                    onClick={() => handleResetToDefault(role)}
                    title="Reset to default permissions"
                    className="p-2 text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-lg transition-colors"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Workflow info */}
              {workflowInfo && (
                <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg space-y-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">Workflow Access</p>
                  <p className="text-xs text-green-700 dark:text-green-400">
                    <span className="font-medium">Inbound:</span> {workflowInfo.inbound}
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-400">
                    <span className="font-medium">Outbound:</span> {workflowInfo.outbound}
                  </p>
                </div>
              )}

              {/* Permissions section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Permissions</h4>
                  {!isEditing && canEditRole && (
                    <button
                      onClick={() => startEditing(role)}
                      className="text-xs px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-lg hover:bg-primary-200 transition-colors flex items-center gap-1"
                    >
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
                                  checked={editingPermissions.includes('all') || editingPermissions.includes(p.key)}
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
                      <Button
                        onClick={() => handleSaveRole(role.id)}
                        disabled={isSaving}
                        className="flex-1 gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm"
                      >
                        <Check className="h-4 w-4" />
                        {isSaving ? 'Saving…' : 'Save'}
                      </Button>
                      <Button
                        onClick={() => setEditingRoleId(null)}
                        className="gap-2 bg-gray-300 hover:bg-gray-400 text-gray-900 text-sm"
                      >
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
          <strong>Note:</strong> Role changes take effect on the user's next login. Preset roles cannot be deleted — use <strong>Edit</strong> to adjust permissions or the <RotateCcw className="inline h-3 w-3 mx-0.5" /> button to restore defaults.
        </p>
      </div>
    </div>
  );
}
