import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Settings,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Bell,
  Mail,
  Shield,
  Database,
  Clock,
  Calendar,
  Users,
  Building,
  Package,
  Globe,
  Smartphone,
  Monitor,
  Palette,
  Key,
  Lock,
  Eye,
  EyeOff,
  Upload,
  Download,
  Trash2,
  Plus,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

const systemSettingsSchema = z.object({
  // General Settings
  system_name: z.string().min(1, 'System name is required'),
  system_description: z.string().optional(),
  timezone: z.string().min(1, 'Timezone is required'),
  date_format: z.string().min(1, 'Date format is required'),
  time_format: z.string().min(1, 'Time format is required'),
  
  // Booking Settings
  max_booking_duration: z.number().min(1, 'Max booking duration must be at least 1 hour'),
  advance_booking_days: z.number().min(1, 'Advance booking days must be at least 1'),
  auto_approval: z.boolean(),
  require_approval_for_equipment: z.boolean(),
  booking_reminder_hours: z.number().min(0, 'Reminder hours cannot be negative'),
  
  // Notification Settings
  email_notifications: z.boolean(),
  sms_notifications: z.boolean(),
  push_notifications: z.boolean(),
  notification_email: z.string().email('Invalid email address').optional(),
  
  // Security Settings
  session_timeout: z.number().min(15, 'Session timeout must be at least 15 minutes'),
  password_min_length: z.number().min(6, 'Password minimum length must be at least 6'),
  require_2fa: z.boolean(),
  login_attempts_limit: z.number().min(3, 'Login attempts limit must be at least 3'),
  
  // Maintenance Settings
  maintenance_mode: z.boolean(),
  maintenance_message: z.string().optional(),
  backup_frequency: z.string().min(1, 'Backup frequency is required'),
  auto_cleanup_days: z.number().min(30, 'Auto cleanup must be at least 30 days'),
});

type SystemSettingsForm = z.infer<typeof systemSettingsSchema>;

interface SystemSettings extends SystemSettingsForm {
  id: string;
  updated_at: string;
  updated_by: string;
}

const SystemSettings: React.FC = () => {
  const { profile } = useAuth();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('general');
  const [showMaintenanceConfirm, setShowMaintenanceConfirm] = useState(false);
  const [backupInProgress, setBackupInProgress] = useState(false);

  const form = useForm<SystemSettingsForm>({
    resolver: zodResolver(systemSettingsSchema),
    defaultValues: {
      system_name: 'Faculty Room Booking System',
      timezone: 'Asia/Jakarta',
      date_format: 'DD/MM/YYYY',
      time_format: '24h',
      max_booking_duration: 8,
      advance_booking_days: 30,
      auto_approval: false,
      require_approval_for_equipment: true,
      booking_reminder_hours: 2,
      email_notifications: true,
      sms_notifications: false,
      push_notifications: true,
      session_timeout: 60,
      password_min_length: 8,
      require_2fa: false,
      login_attempts_limit: 5,
      maintenance_mode: false,
      backup_frequency: 'daily',
      auto_cleanup_days: 90,
    },
  });

  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'booking', label: 'Booking', icon: Calendar },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'maintenance', label: 'Maintenance', icon: Database },
  ];

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      // Mock settings data since we don't have a settings table yet
      const mockSettings: SystemSettings = {
        id: '1',
        system_name: 'Faculty Room Booking System',
        system_description: 'Comprehensive room booking and resource management system for academic institutions',
        timezone: 'Asia/Jakarta',
        date_format: 'DD/MM/YYYY',
        time_format: '24h',
        max_booking_duration: 8,
        advance_booking_days: 30,
        auto_approval: false,
        require_approval_for_equipment: true,
        booking_reminder_hours: 2,
        email_notifications: true,
        sms_notifications: false,
        push_notifications: true,
        notification_email: 'admin@faculty.edu',
        session_timeout: 60,
        password_min_length: 8,
        require_2fa: false,
        login_attempts_limit: 5,
        maintenance_mode: false,
        maintenance_message: 'System is under maintenance. Please try again later.',
        backup_frequency: 'daily',
        auto_cleanup_days: 90,
        updated_at: new Date().toISOString(),
        updated_by: 'System Administrator',
      };

      setSettings(mockSettings);
      form.reset(mockSettings);
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load system settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data: SystemSettingsForm) => {
    try {
      setSaving(true);
      
      // Mock save operation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast.success('System settings updated successfully');
      fetchSettings();
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast.error(error.message || 'Failed to save system settings');
    } finally {
      setSaving(false);
    }
  };

  const handleBackup = async () => {
    try {
      setBackupInProgress(true);
      
      // Mock backup operation
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      toast.success('System backup completed successfully');
    } catch (error) {
      console.error('Error creating backup:', error);
      toast.error('Failed to create system backup');
    } finally {
      setBackupInProgress(false);
    }
  };

  const handleMaintenanceToggle = () => {
    if (!form.watch('maintenance_mode')) {
      setShowMaintenanceConfirm(true);
    } else {
      form.setValue('maintenance_mode', false);
    }
  };

  const confirmMaintenanceMode = () => {
    form.setValue('maintenance_mode', true);
    setShowMaintenanceConfirm(false);
    toast.warning('Maintenance mode will be enabled after saving settings');
  };

  if (profile?.role !== 'super_admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
          <p className="text-gray-600">You don't have permission to access system settings.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center">
          <RefreshCw className="h-6 w-6 animate-spin text-blue-600 mr-2" />
          <span className="text-gray-600">Loading system settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-600 to-gray-800 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center space-x-3">
              <Settings className="h-8 w-8" />
              <span>System Settings</span>
            </h1>
            <p className="mt-2 opacity-90">
              Configure system behavior and preferences
            </p>
          </div>
          <div className="hidden md:block text-right">
            <div className="text-sm opacity-80">Last Updated</div>
            <div className="text-lg font-semibold">
              {settings ? new Date(settings.updated_at).toLocaleDateString() : 'Never'}
            </div>
          </div>
        </div>
      </div>

      {/* Settings Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-5 w-5" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="p-6">
          {/* General Settings */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">General Configuration</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      System Name *
                    </label>
                    <input
                      {...form.register('system_name')}
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {form.formState.errors.system_name && (
                      <p className="mt-1 text-sm text-red-600">
                        {form.formState.errors.system_name.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Timezone *
                    </label>
                    <select
                      {...form.register('timezone')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="Asia/Jakarta">Asia/Jakarta (WIB)</option>
                      <option value="Asia/Makassar">Asia/Makassar (WITA)</option>
                      <option value="Asia/Jayapura">Asia/Jayapura (WIT)</option>
                      <option value="UTC">UTC</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date Format *
                    </label>
                    <select
                      {...form.register('date_format')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Time Format *
                    </label>
                    <select
                      {...form.register('time_format')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="24h">24 Hour (14:30)</option>
                      <option value="12h">12 Hour (2:30 PM)</option>
                    </select>
                  </div>
                </div>

                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    System Description
                  </label>
                  <textarea
                    {...form.register('system_description')}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Brief description of the system..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Booking Settings */}
          {activeTab === 'booking' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Booking Configuration</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Maximum Booking Duration (hours) *
                    </label>
                    <input
                      {...form.register('max_booking_duration', { valueAsNumber: true })}
                      type="number"
                      min="1"
                      max="24"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {form.formState.errors.max_booking_duration && (
                      <p className="mt-1 text-sm text-red-600">
                        {form.formState.errors.max_booking_duration.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Advance Booking Days *
                    </label>
                    <input
                      {...form.register('advance_booking_days', { valueAsNumber: true })}
                      type="number"
                      min="1"
                      max="365"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {form.formState.errors.advance_booking_days && (
                      <p className="mt-1 text-sm text-red-600">
                        {form.formState.errors.advance_booking_days.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Booking Reminder (hours before) *
                    </label>
                    <input
                      {...form.register('booking_reminder_hours', { valueAsNumber: true })}
                      type="number"
                      min="0"
                      max="72"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {form.formState.errors.booking_reminder_hours && (
                      <p className="mt-1 text-sm text-red-600">
                        {form.formState.errors.booking_reminder_hours.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  <div className="flex items-center">
                    <input
                      {...form.register('auto_approval')}
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-900">
                      Enable automatic approval for room bookings
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      {...form.register('require_approval_for_equipment')}
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-900">
                      Require approval for equipment requests
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notification Settings */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Notification Configuration</h3>
                
                <div className="space-y-4 mb-6">
                  <div className="flex items-center">
                    <input
                      {...form.register('email_notifications')}
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-900">
                      Enable email notifications
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      {...form.register('sms_notifications')}
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-900">
                      Enable SMS notifications
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      {...form.register('push_notifications')}
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-900">
                      Enable push notifications
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notification Email
                  </label>
                  <input
                    {...form.register('notification_email')}
                    type="email"
                    placeholder="admin@faculty.edu"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {form.formState.errors.notification_email && (
                    <p className="mt-1 text-sm text-red-600">
                      {form.formState.errors.notification_email.message}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Security Settings */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Security Configuration</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Session Timeout (minutes) *
                    </label>
                    <input
                      {...form.register('session_timeout', { valueAsNumber: true })}
                      type="number"
                      min="15"
                      max="480"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {form.formState.errors.session_timeout && (
                      <p className="mt-1 text-sm text-red-600">
                        {form.formState.errors.session_timeout.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Password Minimum Length *
                    </label>
                    <input
                      {...form.register('password_min_length', { valueAsNumber: true })}
                      type="number"
                      min="6"
                      max="32"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {form.formState.errors.password_min_length && (
                      <p className="mt-1 text-sm text-red-600">
                        {form.formState.errors.password_min_length.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Login Attempts Limit *
                    </label>
                    <input
                      {...form.register('login_attempts_limit', { valueAsNumber: true })}
                      type="number"
                      min="3"
                      max="10"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {form.formState.errors.login_attempts_limit && (
                      <p className="mt-1 text-sm text-red-600">
                        {form.formState.errors.login_attempts_limit.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-6">
                  <div className="flex items-center">
                    <input
                      {...form.register('require_2fa')}
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-900">
                      Require two-factor authentication for administrators
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Maintenance Settings */}
          {activeTab === 'maintenance' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Maintenance Configuration</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Backup Frequency *
                    </label>
                    <select
                      {...form.register('backup_frequency')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Auto Cleanup (days) *
                    </label>
                    <input
                      {...form.register('auto_cleanup_days', { valueAsNumber: true })}
                      type="number"
                      min="30"
                      max="365"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {form.formState.errors.auto_cleanup_days && (
                      <p className="mt-1 text-sm text-red-600">
                        {form.formState.errors.auto_cleanup_days.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                  <div className="flex items-center justify-between p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center">
                      <input
                        {...form.register('maintenance_mode')}
                        type="checkbox"
                        className="h-4 w-4 text-yellow-600 focus:ring-yellow-500 border-gray-300 rounded"
                        onChange={handleMaintenanceToggle}
                      />
                      <label className="ml-2 block text-sm text-gray-900">
                        Enable maintenance mode
                      </label>
                    </div>
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                  </div>

                  {form.watch('maintenance_mode') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Maintenance Message
                      </label>
                      <textarea
                        {...form.register('maintenance_message')}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Message to display during maintenance..."
                      />
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-md font-medium text-gray-900 mb-3">System Backup</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Create a backup of the system database and configuration files.
                  </p>
                  <button
                    type="button"
                    onClick={handleBackup}
                    disabled={backupInProgress}
                    className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    {backupInProgress ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    <span>{backupInProgress ? 'Creating Backup...' : 'Create Backup'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="flex justify-end pt-6 border-t border-gray-200">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {saving ? (
                <RefreshCw className="h-5 w-5 animate-spin" />
              ) : (
                <Save className="h-5 w-5" />
              )}
              <span>{saving ? 'Saving...' : 'Save Settings'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Maintenance Mode Confirmation */}
      {showMaintenanceConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <AlertCircle className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900">Enable Maintenance Mode</h3>
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Enabling maintenance mode will prevent users from accessing the system. Only administrators will be able to log in. Are you sure you want to continue?
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowMaintenanceConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={confirmMaintenanceMode}
                className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors duration-200"
              >
                Enable Maintenance
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemSettings;