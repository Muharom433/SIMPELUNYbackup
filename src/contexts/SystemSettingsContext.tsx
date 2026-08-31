import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

// Types for System Settings
export interface SystemBranding {
    system_name: string;
    system_description: string;
    system_logo: string | null;
    system_version: string;
    developer_name: string;
    developer_logo: string | null;
    favicon_url: string | null;
    dashboard_video_url: string | null;
}

export interface SystemSettings extends SystemBranding {
    id?: string;
    timezone: string;
    date_format: string;
    time_format: string;
    max_booking_duration: number;
    advance_booking_days: number;
    auto_approval: boolean;
    require_approval_for_equipment: boolean;
    booking_reminder_hours: number;
    email_notifications: boolean;
    sms_notifications: boolean;
    push_notifications: boolean;
    notification_email?: string;
    session_timeout: number;
    password_min_length: number;
    require_2fa: boolean;
    login_attempts_limit: number;
    maintenance_mode: boolean;
    maintenance_message?: string;
    backup_frequency: string;
    auto_cleanup_days: number;
    updated_at?: string;
    updated_by?: string;
}

// Default values
const defaultBranding: SystemBranding = {
    system_name: 'SIMPEL Kuliah',
    system_description: 'Sistem Manajemen Kampus Cerdas',
    system_logo: null,
    system_version: '2.0',
    developer_name: 'Swarna Works Agency',
    developer_logo: null,
    favicon_url: null,
    dashboard_video_url: null,
};

const defaultSettings: SystemSettings = {
    ...defaultBranding,
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
    maintenance_message: 'System is under maintenance. Please try again later.',
    backup_frequency: 'daily',
    auto_cleanup_days: 90,
};

// Context interface
interface SystemSettingsContextType {
    settings: SystemSettings;
    branding: SystemBranding;
    loading: boolean;
    error: string | null;
    refreshSettings: () => Promise<void>;
    updateBranding: (branding: Partial<SystemBranding>) => void;
}

// Create context
const SystemSettingsContext = createContext<SystemSettingsContextType | undefined>(undefined);

// Provider component
interface SystemSettingsProviderProps {
    children: ReactNode;
}

export const SystemSettingsProvider: React.FC<SystemSettingsProviderProps> = ({ children }) => {
    const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Extract branding from settings
    const branding: SystemBranding = {
        system_name: settings.system_name,
        system_description: settings.system_description,
        system_logo: settings.system_logo,
        system_version: settings.system_version,
        developer_name: settings.developer_name,
        developer_logo: settings.developer_logo,
        favicon_url: settings.favicon_url,
        dashboard_video_url: settings.dashboard_video_url,
    };

    // Fetch settings from database (key-value format)
    const fetchSettings = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // Fetch all key-value pairs from system_settings table
            const { data, error: fetchError } = await supabase
                .from('system_settings')
                .select('setting_key, setting_value');

            if (fetchError) {
                setError(fetchError.message);
                return;
            }

            if (data && data.length > 0) {
                // Convert key-value array to object
                const settingsObj: Partial<SystemSettings> = {};
                data.forEach((row: { setting_key: string; setting_value: any }) => {
                    if (row.setting_key && row.setting_value !== undefined) {
                        // setting_value is JSONB, so it can be any type
                        (settingsObj as any)[row.setting_key] = row.setting_value;
                    }
                });

                const mergedSettings = {
                    ...defaultSettings,
                    ...settingsObj,
                };

                setSettings(mergedSettings);

                // Update document title
                if (mergedSettings.system_name) {
                    document.title = mergedSettings.system_name;
                }

                // Update favicon if provided
                if (mergedSettings.favicon_url || mergedSettings.system_logo) {
                    updateFavicon(mergedSettings.favicon_url || mergedSettings.system_logo || '');
                }
            }
        } catch (err) {
            setError('Failed to load system settings');
        } finally {
            setLoading(false);
        }
    }, []);

    // Update favicon dynamically
    const updateFavicon = (iconUrl: string) => {
        try {
            // Remove existing favicons
            const existingFavicons = document.querySelectorAll("link[rel*='icon']");
            existingFavicons.forEach(favicon => favicon.remove());

            // Create new favicon link
            const link = document.createElement('link');
            link.rel = 'icon';
            link.type = iconUrl.startsWith('data:image') ? iconUrl.split(';')[0].replace('data:', '') : 'image/x-icon';
            link.href = iconUrl;
            document.head.appendChild(link);
        } catch (err) {
        }
    };

    // Update branding (local state update - for optimistic UI)
    const updateBranding = useCallback((newBranding: Partial<SystemBranding>) => {
        setSettings(prev => ({
            ...prev,
            ...newBranding,
        }));

        // Update document title if system_name changed
        if (newBranding.system_name) {
            document.title = newBranding.system_name;
        }

        // Update favicon if logo changed
        if (newBranding.favicon_url || newBranding.system_logo) {
            updateFavicon(newBranding.favicon_url || newBranding.system_logo || '');
        }
    }, []);

    // Listen for settings update events
    useEffect(() => {
        const handleSettingsUpdate = () => {
            fetchSettings();
        };

        window.addEventListener('system-settings-updated', handleSettingsUpdate);

        // Real-time subscription
        const channel = supabase
            .channel('system-settings-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'system_settings',
                },
                () => {
                    fetchSettings();
                }
            )
            .subscribe();

        return () => {
            window.removeEventListener('system-settings-updated', handleSettingsUpdate);
            channel.unsubscribe();
        };
    }, [fetchSettings]);

    // Initial fetch
    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    const value: SystemSettingsContextType = {
        settings,
        branding,
        loading,
        error,
        refreshSettings: fetchSettings,
        updateBranding,
    };

    return (
        <SystemSettingsContext.Provider value={value}>
            {children}
        </SystemSettingsContext.Provider>
    );
};

// Custom hook for using system settings
export const useSystemSettings = (): SystemSettingsContextType => {
    const context = useContext(SystemSettingsContext);
    if (context === undefined) {
        throw new Error('useSystemSettings must be used within a SystemSettingsProvider');
    }
    return context;
};

// Custom hook for just branding (lighter)
export const useSystemBranding = (): SystemBranding & { loading: boolean } => {
    const { branding, loading } = useSystemSettings();
    return { ...branding, loading };
};

export default SystemSettingsContext;
