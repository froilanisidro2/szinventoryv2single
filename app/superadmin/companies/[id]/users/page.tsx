'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, AlertCircle, Users, Plus, MoreVertical, Edit2, Shield, Trash2, CheckCircle, XCircle, AlertTriangle, Eye, EyeOff, Copy as CopyIcon, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { deleteUserPermanently, changeUserRole, toggleUserStatus, createCompanyAdmin, updateUserDetails, resetUserPassword, getCompanyUsersByCompanyId, getRoles } from '@/app/actions';

interface CompanyUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  status: string;
  is_company_admin: boolean;
  role_id?: string;
  role: string;
  created_at: string;
}

interface Role {
  id: string;
  name: string;
}

// Generate a random password
function generatePassword(length = 12) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export default function CompanyUsersPage() {
  const params = useParams();
  const companyId = params.id as string;

  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);
  
  // Modal states
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<CompanyUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<'active' | 'inactive' | 'suspended'>('active');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  
  // Add User form states
  const [addUserForm, setAddUserForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    roleId: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [createdUserData, setCreatedUserData] = useState<any>(null);
  
  // Edit User form states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editUserForm, setEditUserForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
  });
  
  // Reset Password states
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [resetPasswordData, setResetPasswordData] = useState<any>(null);

  useEffect(() => {
    loadUsers();
    loadRoles();
  }, [companyId]);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const result = await getCompanyUsersByCompanyId(companyId);

      if (result.error) {
        setError('Failed to load users');
        toast.error('Failed to load users');
        return;
      }

      setUsers(result.data || []);
    } catch (err) {
      console.error('Error loading users:', err);
      setError('Failed to load users');
      toast.error('Error loading users');
    } finally {
      setIsLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      const result = await getRoles();
      if (!result.error && result.data) {
        setRoles(result.data);
      }
    } catch (err) {
      console.error('Error loading roles:', err);
    }
  };

  const handleAddUserModalOpen = () => {
    // Generate a default password
    const defaultPassword = generatePassword();
    setAddUserForm({
      firstName: '',
      lastName: '',
      email: '',
      password: defaultPassword,
      roleId: roles.length > 0 ? roles[0]?.id || '' : '',
    });
    setShowAddUserModal(true);
    setCreatedUserData(null);
  };

  const handleAddUser = async () => {
    if (!addUserForm.firstName || !addUserForm.lastName || !addUserForm.email || !addUserForm.password || !addUserForm.roleId) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      setIsActionLoading(true);
      const newUserData = {
        company_id: companyId,
        first_name: addUserForm.firstName,
        last_name: addUserForm.lastName,
        email: addUserForm.email,
        password: addUserForm.password,
        role_id: addUserForm.roleId,
      };

      const result = await createCompanyAdmin(newUserData);

      if (result.error) {
        console.error('Error creating user:', result.error);
        const errorMsg = typeof result.error === 'string' ? result.error : 'Failed to create user';
        if (errorMsg.includes('duplicate') || errorMsg.includes('unique')) {
          toast.error('Email already exists');
        } else {
          toast.error(errorMsg);
        }
        return;
      }

      toast.success('User created successfully');
      setCreatedUserData({
        ...result.data,
        email: addUserForm.email,
        password: addUserForm.password,
      });
      
      // Reload users list
      loadUsers();
    } catch (err) {
      console.error('Error creating user:', err);
      toast.error('Failed to create user');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleChangeRole = async () => {
    if (!selectedUser || !selectedRole) return;
    
    try {
      setIsActionLoading(true);
      const result = await changeUserRole(selectedUser.id, selectedRole);
      
      if (result.error) {
        toast.error('Failed to change role');
        return;
      }
      
      toast.success('Role updated successfully');
      setShowRoleModal(false);
      setSelectedUser(null);
      loadUsers();
    } catch (err) {
      console.error('Error changing role:', err);
      toast.error('Failed to change role');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleToggleAdmin = async (user: CompanyUser) => {
    try {
      setIsActionLoading(true);
      const result = await changeUserRole(user.id, user.role_id || '', !user.is_company_admin);
      
      if (result.error) {
        toast.error('Failed to update admin status');
        return;
      }
      
      toast.success(user.is_company_admin ? 'User downgraded to regular user' : 'User upgraded to admin');
      loadUsers();
    } catch (err) {
      console.error('Error toggling admin:', err);
      toast.error('Failed to update admin status');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleChangeStatus = async () => {
    if (!selectedUser) return;
    
    try {
      setIsActionLoading(true);
      const result = await toggleUserStatus(selectedUser.id, selectedStatus);
      
      if (result.error) {
        toast.error('Failed to change status');
        return;
      }
      
      toast.success(`User ${selectedStatus} successfully`);
      setShowStatusModal(false);
      setSelectedUser(null);
      loadUsers();
    } catch (err) {
      console.error('Error changing status:', err);
      toast.error('Failed to change status');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    
    try {
      setIsActionLoading(true);
      const result = await deleteUserPermanently(selectedUser.id);
      
      if (result.error) {
        toast.error('Failed to delete user');
        return;
      }
      
      toast.success('User deleted successfully');
      setShowDeleteModal(false);
      setSelectedUser(null);
      loadUsers();
    } catch (err) {
      console.error('Error deleting user:', err);
      toast.error('Failed to delete user');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;
    
    try {
      setIsActionLoading(true);
      const updates = {
        first_name: editUserForm.firstName,
        last_name: editUserForm.lastName,
        email: editUserForm.email,
      };
      
      const result = await updateUserDetails(selectedUser.id, updates);
      
      if (result.error) {
        toast.error('Failed to update user');
        return;
      }
      
      toast.success('User updated successfully');
      setShowEditModal(false);
      setSelectedUser(null);
      loadUsers();
    } catch (err) {
      console.error('Error updating user:', err);
      toast.error('Failed to update user');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser) return;
    
    try {
      setIsActionLoading(true);
      const result = await resetUserPassword(selectedUser.id);
      
      if (result.error) {
        toast.error('Failed to reset password');
        return;
      }
      
      toast.success('Password reset successfully');
      setResetPasswordData(result.data);
    } catch (err) {
      console.error('Error resetting password:', err);
      toast.error('Failed to reset password');
    } finally {
      setIsActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin inline-block">
            <div className="h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full"></div>
          </div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="px-4 py-4 md:px-6">
          <Button href={`/superadmin/companies/${companyId}`} variant="ghost" size="sm" className="gap-2 mb-4">
              <ArrowLeft className="h-4 w-4" />
              Back to Company
            </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Users className="h-6 w-6" />
                Company Users
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{users.length} user{users.length !== 1 ? 's' : ''}</p>
            </div>
            <Button onClick={handleAddUserModalOpen} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add User
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-6 md:px-6 max-w-7xl mx-auto">
        {error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900 dark:text-red-100">Failed to Load Users</h3>
              <p className="text-sm text-red-800 dark:text-red-200 mt-1">{error}</p>
            </div>
          </div>
        ) : users.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400 mb-4">No users have been added to this company yet</p>
            <Button variant="primary" onClick={handleAddUserModalOpen}>
              Add First User
            </Button>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                    <th className="px-6 py-3 text-left font-semibold text-gray-900 dark:text-white">Name</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900 dark:text-white">Email</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900 dark:text-white">Role</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900 dark:text-white">Type</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900 dark:text-white">Status</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900 dark:text-white">Joined</th>
                    <th className="px-6 py-3 text-center font-semibold text-gray-900 dark:text-white">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {user.first_name} {user.last_name}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400 text-xs break-all">{user.email}</td>
                      <td className="px-6 py-4">
                        <span className="text-xs text-gray-600 dark:text-gray-400 capitalize bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                          {user.role || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {user.is_company_admin ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200">
                            <Shield className="h-3 w-3 mr-1" />
                            Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                            User
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            user.status === 'active'
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                              : user.status === 'suspended'
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                              : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
                          }`}
                        >
                          {user.status === 'active' && <CheckCircle className="h-3 w-3 mr-1" />}
                          {user.status === 'suspended' && <XCircle className="h-3 w-3 mr-1" />}
                          {user.status === 'inactive' && <AlertTriangle className="h-3 w-3 mr-1" />}
                          {user.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-600 dark:text-gray-400">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="relative">
                          <button
                            onClick={() => setOpenDropdown(openDropdown === user.id ? null : user.id)}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          >
                            <MoreVertical className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                          </button>
                          
                          {openDropdown === user.id && (
                            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-10">
                              <button
                                onClick={() => {
                                  setSelectedUser(user);
                                  setEditUserForm({
                                    firstName: user.first_name,
                                    lastName: user.last_name,
                                    email: user.email,
                                  });
                                  setShowEditModal(true);
                                  setOpenDropdown(null);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                              >
                                <Edit2 className="h-4 w-4" />
                                Edit User Info
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedUser(user);
                                  setShowResetPasswordModal(true);
                                  setResetPasswordData(null);
                                  setOpenDropdown(null);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                              >
                                <Key className="h-4 w-4" />
                                Reset Password
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedUser(user);
                                  setSelectedRole(user.role_id || '');
                                  setShowRoleModal(true);
                                  setOpenDropdown(null);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                              >
                                <Edit2 className="h-4 w-4" />
                                Change Role
                              </button>
                              <button
                                onClick={() => {
                                  handleToggleAdmin(user);
                                  setOpenDropdown(null);
                                }}
                                disabled={isActionLoading}
                                className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 disabled:opacity-50"
                              >
                                <Shield className="h-4 w-4" />
                                {user.is_company_admin ? 'Remove Admin Access' : 'Make Admin'}
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedUser(user);
                                  setSelectedStatus(user.status as 'active' | 'inactive' | 'suspended');
                                  setShowStatusModal(true);
                                  setOpenDropdown(null);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                              >
                                <AlertTriangle className="h-4 w-4" />
                                Change Status
                              </button>
                              <div className="border-t border-gray-200 dark:border-gray-600"></div>
                              <button
                                onClick={() => {
                                  setSelectedUser(user);
                                  setShowDeleteModal(true);
                                  setOpenDropdown(null);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 text-sm text-red-600 dark:text-red-400"
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete User
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Back Button */}
        <div className="mt-6">
          <Button href={`/superadmin/companies/${companyId}`} variant="ghost">
              ← Back
            </Button>
        </div>
      </main>

      {/* Role Modal */}
      {showRoleModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Change Role</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Changing role for: <strong>{selectedUser.first_name} {selectedUser.last_name}</strong>
            </p>
            
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-6"
            >
              <option value="">Select a role</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRoleModal(false);
                  setSelectedUser(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleChangeRole}
                disabled={isActionLoading || !selectedRole}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {isActionLoading ? 'Updating...' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Modal */}
      {showStatusModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Change Status</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Changing status for: <strong>{selectedUser.first_name} {selectedUser.last_name}</strong>
            </p>
            
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as 'active' | 'inactive' | 'suspended')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-6"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowStatusModal(false);
                  setSelectedUser(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleChangeStatus}
                disabled={isActionLoading}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {isActionLoading ? 'Updating...' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete User</h2>
            <p className="text-sm text-red-600 dark:text-red-400 mb-4 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              This action cannot be undone
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Are you sure you want to permanently delete <strong>{selectedUser.first_name} {selectedUser.last_name}</strong> ({selectedUser.email})?
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedUser(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={isActionLoading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {isActionLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
            {createdUserData ? (
              <>
                <div className="flex items-start gap-3 mb-4">
                  <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">User Created Successfully!</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Share these credentials with the user</p>
                  </div>
                </div>
                
                <div className="space-y-3 mb-6 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-400 mb-1">Email</label>
                    <div className="flex items-center justify-between">
                      <code className="text-sm text-gray-900 dark:text-white break-all">{createdUserData.email}</code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(createdUserData.email);
                          toast.success('Email copied');
                        }}
                        className="ml-2 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                      >
                        <CopyIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-400 mb-1">Password</label>
                    <div className="flex items-center justify-between">
                      <code className="text-sm text-gray-900 dark:text-white">{showPassword ? createdUserData.password : '••••••••'}</code>
                      <div className="flex gap-2 ml-2">
                        <button
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(createdUserData.password);
                            toast.success('Password copied');
                          }}
                          className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                        >
                          <CopyIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowAddUserModal(false);
                    setCreatedUserData(null);
                  }}
                  className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Done
                </button>
              </>
            ) : (
              <>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Add New User</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={addUserForm.firstName}
                      onChange={(e) => setAddUserForm({...addUserForm, firstName: e.target.value})}
                      placeholder="John"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={addUserForm.lastName}
                      onChange={(e) => setAddUserForm({...addUserForm, lastName: e.target.value})}
                      placeholder="Doe"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={addUserForm.email}
                      onChange={(e) => setAddUserForm({...addUserForm, email: e.target.value})}
                      placeholder="user@example.com"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Role
                    </label>
                    <select
                      value={addUserForm.roleId}
                      onChange={(e) => setAddUserForm({...addUserForm, roleId: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Select a role</option>
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={addUserForm.password}
                        onChange={(e) => setAddUserForm({...addUserForm, password: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowAddUserModal(false);
                      setCreatedUserData(null);
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddUser}
                    disabled={isActionLoading || !addUserForm.firstName || !addUserForm.lastName || !addUserForm.email || !addUserForm.password || !addUserForm.roleId}
                    className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                  >
                    {isActionLoading ? 'Creating...' : 'Create User'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Edit User Information</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Updating: <strong>{selectedUser.first_name} {selectedUser.last_name}</strong>
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  value={editUserForm.firstName}
                  onChange={(e) => setEditUserForm({...editUserForm, firstName: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  value={editUserForm.lastName}
                  onChange={(e) => setEditUserForm({...editUserForm, lastName: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={editUserForm.email}
                  onChange={(e) => setEditUserForm({...editUserForm, email: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedUser(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleEditUser}
                disabled={isActionLoading || !editUserForm.firstName || !editUserForm.lastName || !editUserForm.email}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {isActionLoading ? 'Updating...' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetPasswordModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
            {resetPasswordData ? (
              <>
                <div className="flex items-start gap-3 mb-4">
                  <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Password Reset Successfully!</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Share this temporary password with the user</p>
                  </div>
                </div>
                
                <div className="space-y-3 mb-6 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-400 mb-1">New Password</label>
                    <div className="flex items-center justify-between">
                      <code className="text-sm text-gray-900 dark:text-white font-mono">{showPassword ? resetPasswordData.newPassword : '••••••••'}</code>
                      <div className="flex gap-2 ml-2">
                        <button
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(resetPasswordData.newPassword);
                            toast.success('Password copied');
                          }}
                          className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                        >
                          <CopyIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowResetPasswordModal(false);
                    setSelectedUser(null);
                    setResetPasswordData(null);
                  }}
                  className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Done
                </button>
              </>
            ) : (
              <>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Reset Password</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Generate a new temporary password for <strong>{selectedUser.first_name} {selectedUser.last_name}</strong>?
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  The user will receive this password and should change it on their first login.
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowResetPasswordModal(false);
                      setSelectedUser(null);
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleResetPassword}
                    disabled={isActionLoading}
                    className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                  >
                    {isActionLoading ? 'Resetting...' : 'Reset Password'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
