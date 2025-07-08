import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard, Calendar, Package, CheckCircle, BookOpen, Users, Building, Settings, User, FileText,
    BarChart3, Clock, GraduationCap, Wrench, ClipboardCheck, MapPin, CalendarCheck, CheckSquare, X,
    ChevronRight, Sparkles, Home, PieChart, Zap, HandHelping, UserCheck
} from 'lucide-react';
import { User as UserType } from '../../types';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../contexts/LanguageContext';

interface SidebarProps {
    user: UserType | null;
    isOpen: boolean;
    onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ user, isOpen, onClose }) => {
    const { getText } = useLanguage();
    const [pendingBookingsCount, setPendingBookingsCount] = useState(0);
    const [pendingCheckoutsCount, setPendingCheckoutsCount] = useState(0);
    const [newReportsCount, setNewReportsCount] = useState(0);

    // Fetch notification counts function
    const fetchNotificationCounts = async () => {
        // Only fetch for super_admin
        if (user?.role !== 'super_admin') {
            return;
        }

        try {
            // Fetch for reports
            const { count: reportsCount } = await supabase
                .from('reports')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'new');
            setNewReportsCount(reportsCount || 0);

            // Fetch for bookings
            const { count: bookingsCount } = await supabase
                .from('bookings')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'pending');
            setPendingBookingsCount(bookingsCount || 0);

            // Fetch for checkouts
            const { count: checkoutsCount } = await supabase
                .from('checkouts')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'pending');
            setPendingCheckoutsCount(checkoutsCount || 0);

        } catch (error) {
            console.error("Error fetching notification counts:", error);
        }
    };

    useEffect(() => {
        // Initial fetch
        fetchNotificationCounts();

        // Set up interval to refresh every minute (60000ms) only for super_admin
        let intervalId: NodeJS.Timeout;
        if (user?.role === 'super_admin') {
            intervalId = setInterval(fetchNotificationCounts, 60000);
        }

        // Cleanup interval on unmount or user change
        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [user]);

    const getMenuItems = () => {
        const publicItems = [
            { icon: Home, label: getText('About SIMPEL', 'Tutorial SIMPEL'), path: '/'},
            { icon: Calendar, label: getText('Book Room', 'Pesan Ruangan'), path: '/book'},
            { icon: Package, label: getText('Tool Lending', 'Peminjaman Alat'), path: '/tools'},
            { icon: CheckCircle, label: getText('Check Out', 'Pengembalian'), path: '/checkout'},
            { icon: FileText, label: getText('Permit Letter', 'Surat Izin'), path: '/permit-letter', color: 'from-magenta-500 to-pink-500' }, // TAMBAH: Menu Surat Izin dengan warna magenta
        ];

        if (!user) return publicItems;

        const baseItems = [ ...publicItems, { icon: User, label: getText('Profile', 'Profil'), path: '/Profile' } ];

        if (user.role === 'department_admin') {
            return [
                { icon: PieChart, label: getText('Dashboard', 'Dasbor'), path: '/' },
                { icon: CalendarCheck, label: getText('Exam Management', 'Jadwal UAS'), path: '/exams' },
                { icon: UserCheck, label: getText('Session Schedule', 'Jadwal Sidang'), path: '/session-schedule' },
                { icon: Users, label: getText('User Management', 'Data Dosen/Mahasiswa'), path: '/users' },
                { icon: Clock, label: getText('Lecture Schedules', 'Jadwal Kuliah'), path: '/schedules' },
                { icon: Wrench, label: getText('Tool Administration', 'Administrasi Alat'), path: '/tool-admin' }, // Added tool administration for department admin
                { icon: User, label: getText('Profile', 'Profil'), path: '/Profile' },
            ];
        }

        if (user.role === 'super_admin') {
            return [
                { icon: BarChart3, label: getText('About SIMPEL', 'Tutor SIMPEL'), path: '/' },
                { icon: Building, label: getText('Room Management', 'Manajemen Ruangan'), path: '/rooms' },
                { icon: Users, label: getText('User Management', 'Manajemen Pengguna'), path: '/users' },
                { icon: MapPin, label: getText('Departments', 'Departemen'), path: '/departments' },
                { icon: GraduationCap, label: getText('Study Programs', 'Program Studi'), path: '/study-programs' },
                { icon: Calendar, label: getText('Booking Management', 'Manajemen Pemesanan'), path: '/bookings', badge: pendingBookingsCount > 0 ? pendingBookingsCount : null },
                { icon: HandHelping, label: getText('Tool Lending Administration', 'Administrasi Peminjaman Alat'), path: '/tool-lending-management' },
                { icon: ClipboardCheck, label: getText('Validation Queue', 'Antrian Validasi'), path: '/validation', badge: pendingCheckoutsCount > 0 ? pendingCheckoutsCount : null },
                { icon: Clock, label: getText('Lecture Schedules', 'Jadwal Kuliah'), path: '/schedules' },
                { icon: CalendarCheck, label: getText('Exam Management', 'Manajemen Ujian'), path: '/exams' },
                { icon: UserCheck, label: getText('Session Schedule', 'Jadwal Sidang'), path: '/session-schedule' },
                { icon: Wrench, label: getText('Tool Administration', 'Administrasi Alat'), path: '/tool-admin' },
                { icon: FileText, label: getText('Reports', 'Laporan'), path: '/reports', badge: newReportsCount > 0 ? newReportsCount : null },
                { icon: Settings, label: getText('System Settings', 'Pengaturan Sistem'), path: '/settings' },
                { icon: User, label: getText('Profile', 'Profil'), path: '/Profile' },
            ];
        }
        return baseItems;
    };

    const menuItems = getMenuItems();

    return (
        <div id="mobile-sidebar" className={`h-full w-80 bg-white border-r border-gray-200 flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-0 lg:translate-x-0'} transition-transform duration-300 ease-in-out`}>
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200/50 flex-shrink-0">
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div className="p-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg flex-shrink-0"><Sparkles className="h-6 w-6 sm:h-8 sm:w-8 text-white" /></div>
                    <div className="min-w-0 flex-1"><h2 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent truncate">SIMPEL Kuliah</h2><p className="text-xs sm:text-sm text-gray-600 font-medium truncate">{getText('Smart Campus Management', 'Sistem Manajemen Kampus Cerdas')}</p></div>
                </div>
                <button onClick={onClose} className="p-2 rounded-xl text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors duration-200 lg:hidden flex-shrink-0" aria-label="Close sidebar"><X className="h-5 w-5" /></button>
            </div>

            {user && (
                <div className="p-4 sm:p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200/50 flex-shrink-0">
                    <div className="flex items-center space-x-3 sm:space-x-4">
                        <div className="relative flex-shrink-0"><div className="h-12 w-12 sm:h-14 sm:w-14 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg"><User className="h-6 w-6 sm:h-7 sm:w-7 text-white" /></div><div className="absolute -bottom-1 -right-1 h-4 w-4 sm:h-5 sm:w-5 bg-emerald-400 border-2 border-white rounded-full"><div className="h-full w-full bg-emerald-400 rounded-full animate-pulse"></div></div></div>
                        <div className="flex-1 min-w-0"><p className="text-base sm:text-lg font-bold text-gray-900 truncate">{user.full_name}</p><p className="text-xs sm:text-sm text-gray-600 capitalize truncate">{getText(user.role === 'super_admin' ? 'Super Admin' : user.role === 'department_admin' ? 'Admin Departemen' : user.role === 'student' ? 'Mahasiswa' : user.role === 'lecturer' ? 'Dosen' : user.role)}</p><div className="flex items-center mt-1"><div className="h-2 w-2 bg-emerald-400 rounded-full mr-2 flex-shrink-0"></div><span className="text-xs text-emerald-600 font-medium">{getText('Online', 'Online')}</span></div></div>
                    </div>
                </div>
            )}

            <nav className="flex-1 overflow-y-auto py-4 sm:py-6">
                <div className="px-3 sm:px-4 space-y-1 sm:space-y-2">
                    {menuItems.map((item, index) => {
                        const Icon = item.icon;
                        return (
                            <NavLink key={index} to={item.path} onClick={onClose} className={({ isActive }) => `group flex items-center justify-between px-3 sm:px-4 py-3 sm:py-3.5 rounded-xl font-medium transition-all duration-200 ${ isActive ? `bg-gradient-to-r text-white shadow-lg transform scale-[1.02] ${item.color || 'from-blue-500 to-indigo-500'}` : 'text-gray-700 hover:bg-white/60 hover:text-gray-900 hover:shadow-md hover:scale-[1.01]' }`}>
                                {({ isActive }) => (
                                    <><div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1"><div className={`p-2 sm:p-2.5 rounded-xl transition-all duration-200 flex-shrink-0 ${ isActive ? 'bg-white/20 shadow-lg' : 'bg-gray-100/50 group-hover:bg-white/80'}`}><Icon className={`h-4 w-4 sm:h-5 sm:w-5 transition-colors duration-200 ${ isActive ? 'text-white' : 'text-gray-600 group-hover:text-gray-800'}`} /></div><span className="text-sm font-semibold truncate">{item.label}</span></div>
                                    <div className="flex items-center space-x-2 flex-shrink-0">{item.badge && (<span className={`inline-flex items-center justify-center px-2 sm:px-2.5 py-1 rounded-full text-xs font-bold transition-all duration-200 ${ isActive ? 'bg-white/20 text-white' : 'bg-red-100 text-red-600 group-hover:bg-red-200'}`}>{item.badge > 99 ? '99+' : item.badge}</span>)}<ChevronRight className={`h-4 w-4 transition-all duration-200 ${ isActive ? 'text-white/70 transform translate-x-1' : 'text-gray-400 group-hover:text-gray-600 group-hover:transform group-hover:translate-x-1'}`} /></div></>
                                )}
                            </NavLink>
                        );
                    })}
                </div>
            </nav>

            <div className="p-4 sm:p-6 border-t border-gray-200/50 bg-gradient-to-r from-gray-50 to-blue-50 flex-shrink-0">
                <div className="text-center">
                    <p className="text-xs text-gray-500 mb-2">{getText('Developer', 'Dibuat oleh')}</p>
                    <div className="flex items-center justify-center space-x-2"><Zap className="h-4 w-4 text-blue-500 flex-shrink-0" /><span className="text-sm font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Muharom Eko S</span></div>
                    <p className="text-xs text-gray-400 mt-1">{getText('Version 1.0', 'Versi 1.0')}</p>
                </div>
            </div>
        </div>
    );
};

export default Sidebar;