'use client';

import { useState } from 'react';
import { Camera, Save, Mail, Phone, MapPin, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState({
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@company.com',
    phone: '+1 (555) 123-4567',
    company: 'Tech Innovators Inc',
    position: 'Owner',
    joinDate: '2023-01-15',
    location: 'San Francisco, CA',
  });

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
          Profile
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your personal information
        </p>
      </div>

      {/* Profile Card */}
      <div className="card overflow-hidden">
        {/* Header Background */}
        <div className="h-32 bg-gradient-to-r from-primary-500 to-primary-600" />

        {/* Content */}
        <div className="px-6 pb-6">
          {/* Avatar and Name */}
          <div className="flex flex-col md:flex-row md:items-end gap-6 -mt-16 mb-6 relative z-10">
            <div className="relative">
              <div className="h-32 w-32 rounded-lg bg-primary-600 flex items-center justify-center text-4xl font-bold text-white border-4 border-white dark:border-gray-900">
                JD
              </div>
              <button className="absolute bottom-0 right-0 p-2 bg-white rounded-lg shadow-lg hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600">
                <Camera className="h-5 w-5 text-gray-700 dark:text-gray-300" />
              </button>
            </div>

            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {profile.firstName} {profile.lastName}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {profile.position} at {profile.company}
              </p>
            </div>

            {isEditing ? (
              <Button variant="primary" icon={<Save className="h-4 w-4" />} onClick={() => setIsEditing(false)}>
                Save Changes
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => setIsEditing(true)}>
                Edit Profile
              </Button>
            )}
          </div>

          <hr className="border-gray-200 dark:border-gray-700 mb-6" />

          {/* Profile Information */}
          <div className="space-y-6">
            {/* Personal Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Personal Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    First Name
                  </label>
                  <Input
                    value={profile.firstName}
                    onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Last Name
                  </label>
                  <Input
                    value={profile.lastName}
                    onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Contact Information
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email Address
                  </label>
                  <Input
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Phone Number
                  </label>
                  <Input
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>
              </div>
            </div>

            {/* Company Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Company Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Company Name
                  </label>
                  <Input
                    value={profile.company}
                    onChange={(e) => setProfile({ ...profile, company: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Position
                  </label>
                  <Input
                    value={profile.position}
                    onChange={(e) => setProfile({ ...profile, position: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>
              </div>
            </div>

            {/* Work Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Work Information
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Location
                  </label>
                  <Input
                    value={profile.location}
                    onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Join Date
                  </label>
                  <Input
                    type="date"
                    value={profile.joinDate}
                    disabled
                    className="bg-gray-100 dark:bg-gray-700 cursor-not-allowed"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Account Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Account Status</p>
          <p className="inline-block px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm font-medium dark:bg-green-900 dark:text-green-200">
            Active
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Member Since</p>
          <p className="font-medium text-gray-900 dark:text-white">
            {new Date(profile.joinDate).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Subscription Plan</p>
          <p className="font-medium text-gray-900 dark:text-white">Professional</p>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Recent Activity
        </h3>
        <div className="space-y-3">
          {[
            { action: 'Created invoice INV-2024-001', date: '2 hours ago' },
            { action: 'Updated product pricing', date: '1 day ago' },
            { action: 'Added customer: Acme Corp', date: '3 days ago' },
            { action: 'Downloaded report', date: '1 week ago' },
          ].map((activity, idx) => (
            <div key={idx} className="flex justify-between py-2 border-b border-gray-200 last:border-0 dark:border-gray-700">
              <span className="text-gray-700 dark:text-gray-300">{activity.action}</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">{activity.date}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="card border border-red-200 dark:border-red-900 p-6">
        <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-4">
          Danger Zone
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          These actions are permanent and cannot be undone.
        </p>
        <Button variant="danger">Delete Account</Button>
      </div>
    </div>
  );
}
