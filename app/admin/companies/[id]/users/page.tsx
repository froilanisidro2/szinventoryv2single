'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Plus, Shield, Trash2, AlertCircle, Mail } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  getCompanyById,
  getUsersByCompany,
  canAddUser,
  setCompanyAdmin,
  softDeleteUser,
} from '@/app/actions';

export default function CompanyUsersPage() {
  const params = useParams();
  const companyId = params.id as string;

  const [company, setCompany] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [canAddMoreUsers, setCanAddMoreUsers] = useState(false);

  useEffect(() => {
    loadData();
  }, [companyId]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [companyResult, usersResult] = await Promise.all([
        getCompanyById(companyId),
        getUsersByCompany(companyId),
      ]);

      if (companyResult.data) {
        setCompany(companyResult.data);
      }

      if (!usersResult.error && usersResult.data) {
        setUsers(Array.isArray(usersResult.data) ? usersResult.data : []);
      }

      // Check if can add more users
      const canAdd = await canAddUser(companyId);
      setCanAddMoreUsers(canAdd.allowed);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load company data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleAdmin = async (userId: string, currentAdmin: boolean) => {
    try {
      await setCompanyAdmin(userId, !currentAdmin);
      await loadData();
      toast.success(`User ${!currentAdmin ? 'promoted to' : 'removed from'} admin`);
    } catch (error) {
      toast.error('Failed to update user role');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this user?')) return;

    try {
      await softDeleteUser(userId);
      await loadData();
      toast.success('User removed');
    } catch (error) {
      toast.error('Failed to remove user');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block animate-spin">
            <div className="h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full"></div>
          </div>
          <p className="mt-3 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">Company not found</p>
      </div>
    );
  }

  const planLimits = {
    starter: 5,
    professional: 50,
    enterprise: 999,
  };

  const limit = planLimits[company.plan_type as keyof typeof planLimits] || 999;
  const usagePercent = (company.active_users / limit) * 100;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{company.name}</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage company users</p>
        </div>
      </div>

      {/* User Limit Status */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">User Limit</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Plan: {company.plan_type.charAt(0).toUpperCase() + company.plan_type.slice(1)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {company.active_users}/{limit}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">users</p>
          </div>
        </div>

        <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              usagePercent > 80 ? 'bg-red-500' : usagePercent > 50 ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(usagePercent, 100)}%` }}
          ></div>
        </div>

        {usagePercent > 80 && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">
            ⚠️ Near user limit. Consider upgrading to {company.plan_type === 'starter' ? 'Professional' : 'Enterprise'} plan.
          </p>
        )}
      </div>

      {/* Add User Button */}
      <div className="flex gap-2">
        {canAddMoreUsers ? (
          <Link href={`/admin/companies/${companyId}/users/add`}>
            <Button variant="primary" icon={<Plus className="h-4 w-4" />}>
              Add User
            </Button>
          </Link>
        ) : (
          <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
            <AlertCircle className="h-4 w-4" />
            User limit reached. Upgrade plan to add more users.
          </div>
        )}
      </div>

      {/* Users Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900 dark:text-white">
                      {user.first_name} {user.last_name}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400 flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    {user.email}
                  </td>
                  <td className="px-6 py-4">
                    {user.is_company_admin ? (
                      <span className="inline-block px-3 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 rounded-full text-xs font-semibold flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        Company Admin
                      </span>
                    ) : (
                      <span className="inline-block px-3 py-1 bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 rounded-full text-xs font-semibold">
                        Member
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                        user.status === 'active'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={user.is_company_admin ? 'text-red-600' : 'text-blue-600'}
                      onClick={() => handleToggleAdmin(user.id, user.is_company_admin)}
                    >
                      <Shield className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600"
                      onClick={() => handleDeleteUser(user.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {users.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400">No users in this company yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
