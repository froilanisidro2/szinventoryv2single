'use client';

import { ArrowLeft, Shield, CheckCircle, XCircle, Info, Package, ShoppingCart, TrendingUp, FileText, CreditCard, ArrowRightLeft, BarChart3, Boxes, Users, Truck, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ─── Data ────────────────────────────────────────────────────────────────────

const ROLES = [
  {
    name: 'Admin',
    key: 'admin',
    color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800',
    dot: 'bg-red-500',
    description: 'Full unrestricted access to every module, action, and setting.',
    permissions: ['all'],
    workflowTitle: 'Approver & System Owner',
  },
  {
    name: 'Manager',
    key: 'manager',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    dot: 'bg-blue-500',
    description: 'Manages inventory, inbound/outbound workflows, invoices, and user visibility.',
    permissions: ['inventory:read', 'inventory:write', 'invoices:read', 'invoices:write', 'users:read'],
    workflowTitle: 'Receiver / Dispatcher / Approver',
  },
  {
    name: 'Sales',
    key: 'sales',
    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800',
    dot: 'bg-green-500',
    description: 'Creates and confirms sales orders and invoices; views inventory stock.',
    permissions: ['inventory:read', 'invoices:read', 'invoices:write'],
    workflowTitle: 'Sender / Order Creator',
  },
  {
    name: 'Accountant',
    key: 'accountant',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    dot: 'bg-purple-500',
    description: 'Handles payments, invoices, and financial reports.',
    permissions: ['invoices:read', 'payments:read', 'payments:write', 'reports:read'],
    workflowTitle: 'Invoice / Payment Processor',
  },
  {
    name: 'Viewer',
    key: 'viewer',
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700',
    dot: 'bg-gray-400',
    description: 'Read-only access to inventory and invoices. Cannot perform any write actions.',
    permissions: ['inventory:read', 'invoices:read'],
    workflowTitle: 'Observer',
  },
];

const PERMISSIONS = [
  { key: 'all',              label: 'Full Access',            description: 'Grants every permission — assigned only to Admin.' },
  { key: 'inventory:read',   label: 'View Inventory',         description: 'View stock levels, products, movements, and bin locations.' },
  { key: 'inventory:write',  label: 'Manage Inventory',       description: 'Create/edit products, receive inbound goods (PO), dispatch outbound (SO pick & ship), manage bin locations and stock transfers.' },
  { key: 'invoices:read',    label: 'View Invoices',          description: 'View sales orders, invoices, and customer records.' },
  { key: 'invoices:write',   label: 'Manage Invoices',        description: 'Create and confirm sales orders, create and edit invoices.' },
  { key: 'payments:read',    label: 'View Payments',          description: 'View payment records and payment history.' },
  { key: 'payments:write',   label: 'Manage Payments',        description: 'Record and manage payments.' },
  { key: 'reports:read',     label: 'View Reports',           description: 'Access reports and analytics dashboard.' },
  { key: 'users:read',       label: 'View Users',             description: 'View the user list for the company.' },
];

const MODULES = [
  { label: 'Dashboard',           icon: Boxes,           perm: null,               desc: 'Always visible' },
  { label: 'Inventory',           icon: Boxes,           perm: 'inventory:read',   desc: 'Stock levels & bin locations' },
  { label: 'Products',            icon: Package,         perm: 'inventory:read',   desc: 'Product catalogue' },
  { label: 'Purchase Orders',     icon: ShoppingCart,    perm: 'inventory:write',  desc: 'Inbound orders from suppliers' },
  { label: 'Sales Orders',        icon: TrendingUp,      perm: 'invoices:write',   desc: 'Outbound orders to customers' },
  { label: 'Sales Invoices',      icon: FileText,        perm: 'invoices:read',    desc: 'Customer invoices' },
  { label: 'Payments',            icon: CreditCard,      perm: 'payments:read',    desc: 'Payment records' },
  { label: 'Stock Transfers',     icon: ArrowRightLeft,  perm: 'inventory:write',  desc: 'Move stock between warehouses' },
  { label: 'Stock Movements',     icon: BarChart3,       perm: 'inventory:read',   desc: 'Transaction history' },
  { label: 'Customers',           icon: Users,           perm: 'invoices:read',    desc: 'Customer records' },
  { label: 'Suppliers',           icon: Truck,           perm: 'inventory:write',  desc: 'Supplier records' },
  { label: 'Reports & Analytics', icon: BarChart3,       perm: 'reports:read',     desc: 'Charts and summaries' },
  { label: 'Settings',            icon: Settings,        perm: '__admin__',        desc: 'Admin only' },
];

const PO_WORKFLOW = [
  { step: '1', status: 'Draft',              action: 'Approve',           next: 'Approved',         roles: ['admin', 'manager'],                    note: 'PO reviewed and approved internally' },
  { step: '2', status: 'Approved',           action: 'Mark as Sent',      next: 'Sent',             roles: ['admin', 'manager'],                    note: 'PO sent to supplier' },
  { step: '3', status: 'Sent',               action: 'Confirm Receipt',   next: 'Partially Received', roles: ['admin', 'manager'],                  note: 'Supplier acknowledged the PO' },
  { step: '4', status: 'Partially Received', action: 'Receive Goods',     next: 'Received',         roles: ['admin', 'manager'],                    note: 'Physical goods received at warehouse (GRN)' },
  { step: '–', status: 'Draft/Approved/Sent', action: 'Cancel PO',       next: 'Cancelled',        roles: ['admin', 'manager'],                    note: 'Only before goods are received' },
];

const SO_WORKFLOW = [
  { step: '1', status: 'Draft',             action: 'Confirm & Pick',      next: 'Confirmed',         roles: ['admin', 'manager', 'sales'],          note: 'Order confirmed, ready for picking' },
  { step: '2', status: 'Confirmed',         action: 'Pick Items',          next: 'Picked',            roles: ['admin', 'manager'],                   note: 'Warehouse picks items from shelves' },
  { step: '3', status: 'Picked',            action: 'Ship Items',          next: 'Shipped',           roles: ['admin', 'manager'],                   note: 'Items dispatched to customer' },
  { step: '4', status: 'Partially Shipped', action: 'Continue Shipping',   next: 'Shipped',           roles: ['admin', 'manager'],                   note: 'Complete remaining shipment' },
  { step: '5', status: 'Shipped',           action: 'Mark as Delivered',   next: 'Delivered',         roles: ['admin', 'manager'],                   note: 'Delivery confirmed' },
  { step: '–', status: 'Draft/Confirmed',   action: 'Cancel Order',        next: 'Cancelled',         roles: ['admin', 'manager', 'sales'],           note: 'Only before picking begins' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function roleHasPerm(roleKey: string, perm: string | null): boolean | 'admin-only' {
  if (perm === '__admin__') return roleKey === 'admin' ? true : false;
  if (perm === null) return true;
  const role = ROLES.find(r => r.key === roleKey);
  if (!role) return false;
  return role.permissions.includes('all') || role.permissions.includes(perm);
}

function RoleBadge({ roleKey }: { roleKey: string }) {
  const role = ROLES.find(r => r.key === roleKey);
  if (!role) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${role.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${role.dot}`} />
      {role.name}
    </span>
  );
}

function AccessCell({ allowed }: { allowed: boolean }) {
  return allowed
    ? <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
    : <XCircle className="h-4 w-4 text-gray-300 dark:text-gray-600 mx-auto" />;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DocumentationPage() {
  return (
    <div className="space-y-10 p-4 md:p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3">
        
          <Button href="/settings" variant="secondary" size="sm">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary-600" />
            Roles & Permissions — Documentation
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Complete reference for what each role can see and do across the system.
          </p>
        </div>
      </div>

      {/* 1. Role Definitions */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">1. Role Definitions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ROLES.map(role => (
            <div key={role.key} className={`rounded-xl border p-5 ${role.color}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-2.5 h-2.5 rounded-full ${role.dot}`} />
                <span className="font-bold text-base">{role.name}</span>
                <span className="ml-auto text-xs opacity-70 italic">{role.workflowTitle}</span>
              </div>
              <p className="text-sm mb-3 opacity-90">{role.description}</p>
              <div className="flex flex-wrap gap-1">
                {role.permissions.map(p => (
                  <span key={p} className="px-2 py-0.5 bg-white/50 dark:bg-black/20 text-xs rounded font-mono">{p}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Permission Keys */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">2. Permission Keys</h2>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300 w-48">Key</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300 w-40">Label</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">What it unlocks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {PERMISSIONS.map(p => (
                <tr key={p.key} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-4 py-3 font-mono text-xs text-primary-700 dark:text-primary-400">{p.key}</td>
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{p.label}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{p.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 3. Module Access Matrix */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">3. Module Access Matrix</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Which sidebar modules each role can see and access.</p>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Module</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300 hidden md:table-cell">Requires</th>
                {ROLES.map(r => (
                  <th key={r.key} className="px-3 py-3 text-center font-semibold text-gray-700 dark:text-gray-300 w-20">{r.name}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {MODULES.map(mod => {
                const Icon = mod.icon;
                return (
                  <tr key={mod.label} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-gray-400" />
                        <span className="font-medium text-gray-800 dark:text-gray-200">{mod.label}</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-500 ml-6">{mod.desc}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {mod.perm === null
                        ? <span className="text-xs text-gray-400">Always</span>
                        : mod.perm === '__admin__'
                        ? <span className="font-mono text-xs text-red-600 dark:text-red-400">Admin only</span>
                        : <span className="font-mono text-xs text-primary-700 dark:text-primary-400">{mod.perm}</span>
                      }
                    </td>
                    {ROLES.map(r => (
                      <td key={r.key} className="px-3 py-3 text-center">
                        <AccessCell allowed={!!roleHasPerm(r.key, mod.perm)} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 4. PO Workflow */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">4. Purchase Order Workflow (Inbound)</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Who can trigger each step of the Purchase Order lifecycle.</p>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[540px]">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300 w-8">#</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Current Status</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Action</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Next Status</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Allowed Roles</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300 hidden lg:table-cell">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {PO_WORKFLOW.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-4 py-3 text-gray-400 text-xs">{row.step}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs font-medium">{row.status}</span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{row.action}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded text-xs font-medium">{row.next}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {row.roles.map(r => <RoleBadge key={r} roleKey={r} />)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 hidden lg:table-cell">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 5. SO Workflow */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">5. Sales Order Workflow (Outbound)</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Who can trigger each step of the Sales Order lifecycle.</p>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[540px]">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300 w-8">#</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Current Status</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Action</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Next Status</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Allowed Roles</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300 hidden lg:table-cell">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {SO_WORKFLOW.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-4 py-3 text-gray-400 text-xs">{row.step}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs font-medium">{row.status}</span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{row.action}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded text-xs font-medium">{row.next}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {row.roles.map(r => <RoleBadge key={r} roleKey={r} />)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 hidden lg:table-cell">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 6. Summary card */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">6. Quick Reference — Role Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              role: 'admin',
              inbound:  ['Approve PO', 'Mark as Sent', 'Confirm Receipt', 'Receive Goods', 'Cancel PO'],
              outbound: ['Confirm & Pick', 'Pick Items', 'Ship Items', 'Mark Delivered', 'Cancel Order'],
            },
            {
              role: 'manager',
              inbound:  ['Approve PO', 'Mark as Sent', 'Confirm Receipt', 'Receive Goods', 'Cancel PO'],
              outbound: ['Confirm & Pick', 'Pick Items', 'Ship Items', 'Mark Delivered', 'Cancel Order'],
            },
            {
              role: 'sales',
              inbound:  ['View only'],
              outbound: ['Confirm & Pick', 'Cancel Order'],
            },
            {
              role: 'accountant',
              inbound:  ['View invoices only'],
              outbound: ['View invoices only'],
            },
            {
              role: 'viewer',
              inbound:  ['View only'],
              outbound: ['View only'],
            },
          ].map(item => {
            const roleDef = ROLES.find(r => r.key === item.role)!;
            return (
              <div key={item.role} className={`rounded-xl border p-4 ${roleDef.color}`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`w-2 h-2 rounded-full ${roleDef.dot}`} />
                  <span className="font-bold">{roleDef.name}</span>
                </div>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-1">Inbound (PO)</p>
                    <ul className="space-y-0.5">
                      {item.inbound.map(a => (
                        <li key={a} className="text-xs flex items-center gap-1.5">
                          <CheckCircle className="h-3 w-3 flex-shrink-0 opacity-70" />
                          {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-1">Outbound (SO)</p>
                    <ul className="space-y-0.5">
                      {item.outbound.map(a => (
                        <li key={a} className="text-xs flex items-center gap-1.5">
                          <CheckCircle className="h-3 w-3 flex-shrink-0 opacity-70" />
                          {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Notes */}
      <section className="card p-5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
        <div className="flex gap-3">
          <Info className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 text-sm text-amber-800 dark:text-amber-300">
            <p><strong>Role assignment:</strong> Roles are assigned when creating a user in Settings → Users. A user's role can be changed at any time from the same page.</p>
            <p><strong>Session refresh:</strong> Permission changes take effect on the user's next login.</p>
            <p><strong>Admin flag:</strong> Users marked as Company Admin automatically get full access regardless of their assigned role.</p>
            <p><strong>Custom roles:</strong> Additional roles can be created in Settings → Roles & Permissions and permissions assigned per key.</p>
          </div>
        </div>
      </section>

    </div>
  );
}
