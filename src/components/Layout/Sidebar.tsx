import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { NavLink } from 'react-router-dom';
import {
    Calendar, Package, CheckCircle, Users, Building, Settings, User, FileText,
    BarChart3, Clock, GraduationCap, Wrench, ClipboardCheck, MapPin, CalendarCheck, CheckSquare, X,
    ChevronRight, Sparkles, Home, PieChart, Zap, HandHelping, UserCheck, Map, ZoomIn, ZoomOut, AlertTriangle, Camera, HardDrive
} from 'lucide-react';
import { User as UserType } from '../../types';
import { supabase } from '../../lib/supabase';
import { useLanguage } from '../../contexts/LanguageContext';
import { useSystemSettings } from '../../contexts/SystemSettingsContext';

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
    const [pendingToolLendingCount, setPendingToolLendingCount] = useState(0);
    const [pendingTodosCount, setPendingTodosCount] = useState(0);
    const [showProfileModal, setShowProfileModal] = useState(false);

    // Use system settings from global context (no more local fetch needed)
    const { branding } = useSystemSettings();
    const { system_name, system_logo, system_description, developer_name, system_version } = branding;

    // Image Viewer State
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });

    const handleZoomIn = () => setScale(prev => Math.min(prev + 0.5, 4));
    const handleZoomOut = () => {
        setScale(prev => {
            const newScale = Math.max(prev - 0.5, 1);
            if (newScale === 1) setPosition({ x: 0, y: 0 });
            return newScale;
        });
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (scale > 1) {
            setIsDragging(true);
            setStartPos({ x: e.clientX - position.x, y: e.clientY - position.y });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging && scale > 1) {
            setPosition({
                x: e.clientX - startPos.x,
                y: e.clientY - startPos.y
            });
        }
    };

    const handleMouseUp = () => setIsDragging(false);

    const handleWheel = (e: React.WheelEvent) => {
        e.stopPropagation();
        if (e.deltaY < 0) {
            handleZoomIn();
        } else {
            handleZoomOut();
        }
    };

    const resetZoom = () => {
        setScale(1);
        setPosition({ x: 0, y: 0 });
        setShowProfileModal(false);
    };

    // Fetch notification counts function
    const fetchNotificationCounts = async () => {
        if (!supabase) return;

        try {
            // Fetch for technician's pending todos
            if (user?.role === 'technician') {
                const { count: todosCount } = await supabase
                    .from('technician_tasks')
                    .select('id', { count: 'exact', head: true })
                    .eq('technician_id', user?.id)
                    .eq('status', 'pending');
                setPendingTodosCount(todosCount || 0);
                return; // Return early for technicians
            }

            // Fetch for super_admin and laboratory
            if (user?.role !== 'super_admin' && user?.role !== 'laboratory') {
                return;
            }

            // Fetch for reports (only for super_admin)
            if (user?.role === 'super_admin') {
                const { count: reportsCount } = await supabase
                    .from('reports')
                    .select('id', { count: 'exact', head: true })
                    .eq('status', 'new');
                setNewReportsCount(reportsCount || 0);
            }

            // Fetch for bookings (filter by room's study_program_ids for laboratory)
            let bookingsQuery = supabase
                .from('bookings')
                .select('id, room:rooms!inner(study_program_ids)', { count: 'exact', head: true })
                .eq('status', 'pending');

            if (user?.role === 'laboratory' && user?.study_program_id) {
                // Use contains filter for array - room.study_program_ids should contain user's study_program_id
                bookingsQuery = bookingsQuery.contains('room.study_program_ids', [user.study_program_id]);
            }

            const { count: bookingsCount } = await bookingsQuery;
            setPendingBookingsCount(bookingsCount || 0);

            // Fetch for checkouts
            let checkoutsQuery = supabase
                .from('checkouts')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'pending');

            const { count: checkoutsCount } = await checkoutsQuery;
            setPendingCheckoutsCount(checkoutsCount || 0);

            // Fetch for tool lending (pending requests)
            const { count: toolLendingCount } = await supabase
                .from('lending_tool')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'pending');
            setPendingToolLendingCount(toolLendingCount || 0);

        } catch (error) {
            console.error("Error fetching notification counts:", error);
        }
    };

    useEffect(() => {
        // Initial fetch
        fetchNotificationCounts();

        // Set up interval to refresh every minute (60000ms) for super_admin, laboratory, and technician
        let intervalId: NodeJS.Timeout;
        if (user?.role === 'super_admin' || user?.role === 'laboratory' || user?.role === 'technician') {
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
        // Base public items untuk semua user (termasuk yang belum login)
        const publicItems = [
            { icon: Home, label: getText('About SIMPEL', 'Tutorial SIMPEL'), path: '/' },
            { icon: Calendar, label: getText('Book Room', 'Pesan Ruangan'), path: '/book' },
            { icon: Package, label: getText('Tool Lending', 'Peminjaman Alat'), path: '/tools' },
            { icon: CheckCircle, label: getText('Check Out', 'Pengembalian'), path: '/checkout' },
            { icon: FileText, label: getText('Permit Letter', 'Surat Izin'), path: '/permit-letter' },
        ];

        // Jika tidak ada user (belum login), return public items
        if (!user) return publicItems;

        // Jika user adalah department_admin
        if (user.role === 'department_admin') {
            return [
                { icon: PieChart, label: getText('Dashboard', 'Dasbor'), path: '/' },
                { icon: CalendarCheck, label: getText('Exam Management', 'Jadwal UAS'), path: '/exams' },
                { icon: UserCheck, label: getText('Session Schedule', 'Jadwal Sidang'), path: '/session-schedule' },
                { icon: Clock, label: getText('Lecture Schedules', 'Jadwal Kuliah'), path: '/schedules' },
                { icon: FileText, label: getText('Form Builder', 'Pembuat Formulir'), path: '/forms' },
                { icon: User, label: getText('Profile', 'Profil'), path: '/Profile' },
            ];
        }

        // Jika user adalah super_admin
        if (user.role === 'super_admin') {
            return [
                { icon: BarChart3, label: getText('About SIMPEL', 'Tutor SIMPEL'), path: '/' },
                { icon: Building, label: getText('Room Management', 'Manajemen Ruangan'), path: '/rooms' },
                { icon: Map, label: getText('Location Management', 'Manajemen Lokasi'), path: '/locations' },
                { icon: Users, label: getText('User Management', 'Manajemen Pengguna'), path: '/users' },
                { icon: MapPin, label: getText('Departments', 'Departemen'), path: '/departments' },
                { icon: GraduationCap, label: getText('Study Programs', 'Program Studi'), path: '/study-programs' },
                { icon: Calendar, label: getText('Booking Management', 'Manajemen Pemesanan'), path: '/bookings', badge: pendingBookingsCount > 0 ? pendingBookingsCount : null },
                { icon: HandHelping, label: getText('Tool Lending Administration', 'Administrasi Peminjaman Alat'), path: '/tool-lending-management', badge: pendingToolLendingCount > 0 ? pendingToolLendingCount : null },
                { icon: ClipboardCheck, label: getText('Validation Queue', 'Antrian Validasi'), path: '/validation', badge: pendingCheckoutsCount > 0 ? pendingCheckoutsCount : null },
                { icon: Clock, label: getText('Lecture Schedules', 'Jadwal Kuliah'), path: '/schedules' },
                { icon: CalendarCheck, label: getText('Exam Management', 'Manajemen Ujian'), path: '/exams' },
                { icon: UserCheck, label: getText('Session Schedule', 'Jadwal Sidang'), path: '/session-schedule' },
                { icon: Wrench, label: getText('Tool Administration', 'Administrasi Alat'), path: '/tool-admin' },
                { icon: AlertTriangle, label: getText('Reports', 'Laporan'), path: '/reports', badge: newReportsCount > 0 ? newReportsCount : null },
                { icon: Camera, label: getText('Attendance Verification', 'Validasi Presensi'), path: '/attendance-verification' },
                { icon: FileText, label: getText('Form Builder', 'Pembuat Formulir'), path: '/forms' },
                { icon: Settings, label: getText('System Settings', 'Pengaturan Sistem'), path: '/settings' },
                { icon: HardDrive, label: getText('Data Cleanup', 'Pembersihan Data'), path: '/storage-management' },
                { icon: User, label: getText('Profile', 'Profil'), path: '/Profile' },
            ];
        }

        // Jika user adalah laboratory (Laboran per program studi)
        if (user.role === 'laboratory') {
            return [
                { icon: Wrench, label: getText('Tool Administration', 'Administrasi Alat'), path: '/tool-admin' },
                { icon: HandHelping, label: getText('Tool Lending Management', 'Manajemen Peminjaman Alat'), path: '/tool-lending-management', badge: pendingToolLendingCount > 0 ? pendingToolLendingCount : null },
                { icon: Building, label: getText('Room Management', 'Manajemen Ruangan'), path: '/rooms' },
                { icon: Map, label: getText('Location Management', 'Manajemen Lokasi'), path: '/laboratory-locations' },
                { icon: Calendar, label: getText('Booking Management', 'Manajemen Pemesanan'), path: '/bookings', badge: pendingBookingsCount > 0 ? pendingBookingsCount : null },
                { icon: ClipboardCheck, label: getText('Validation Queue', 'Antrian Validasi'), path: '/validation', badge: pendingCheckoutsCount > 0 ? pendingCheckoutsCount : null },
                { icon: User, label: getText('Profile', 'Profil'), path: '/Profile' },
            ];
        }

        // Jika user adalah staffing (Kepegawaian)
        if (user.role === 'staffing') {
            return [
                { icon: Users, label: getText('User Management', 'Manajemen Pengguna'), path: '/users' },
                { icon: Building, label: getText('Room Management', 'Manajemen Ruangan'), path: '/rooms' },
                { icon: User, label: getText('Profile', 'Profil'), path: '/Profile' },
            ];
        }

        // Jika user adalah purchasing (Pengadaan)
        if (user.role === 'purchasing') {
            return [
                { icon: Wrench, label: getText('Tool Administration', 'Administrasi Alat'), path: '/tool-admin' },
                { icon: Map, label: getText('Location Management', 'Manajemen Lokasi'), path: '/locations' },
                { icon: User, label: getText('Profile', 'Profil'), path: '/Profile' },
            ];
        }

        // Jika user adalah technician (Teknisi)
        if (user.role === 'technician') {
            return [
                { icon: CheckSquare, label: getText('To-Do List', 'Daftar Tugas'), path: '/technician-todo', badge: pendingTodosCount > 0 ? pendingTodosCount : null },
                { icon: Wrench, label: getText('Tool Administration', 'Administrasi Alat'), path: '/tool-admin' },
                { icon: User, label: getText('Profile', 'Profil'), path: '/Profile' },
            ];
        }

        // Jika user adalah frontdesk (Resepsionis/Front Office)
        if (user.role === 'frontdesk') {
            return [
                { icon: CalendarCheck, label: getText('Schedule Calendar', 'Kalender Jadwal'), path: '/schedule-calendar' },
                { icon: Calendar, label: getText('Book Room', 'Pesan Ruangan'), path: '/book' },
                { icon: User, label: getText('Profile', 'Profil'), path: '/Profile' },
            ];
        }

        // Jika user adalah staff (Tenaga Kependidikan) - hanya akses Profile
        if (user.role === 'staff') {
            return [
                { icon: User, label: getText('Profile', 'Profil'), path: '/Profile' },
            ];
        }

        // Jika user adalah finance (Keuangan)
        if (user.role === 'finance') {
            return [
                { icon: Users, label: getText('User Management', 'Manajemen Pengguna'), path: '/users' },
                { icon: ClipboardCheck, label: getText('Attendance Verification', 'Verifikasi Presensi'), path: '/attendance-verification' },
                { icon: Camera, label: getText('Attendance', 'Presensi'), path: '/presensi-dosen' },
                { icon: User, label: getText('Profile', 'Profil'), path: '/Profile' },
            ];
        }

        // Jika user adalah student atau lecturer (atau role lainnya)
        return [
            ...publicItems, // Semua public items
            { icon: User, label: getText('Profile', 'Profil'), path: '/Profile' },
        ];
    };

    const menuItems = getMenuItems();

    return (
        <div id="mobile-sidebar" className={`h-full w-80 bg-white border-r border-gray-200 flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-0 lg:translate-x-0'} transition-transform duration-300 ease-in-out`}>
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200/50 flex-shrink-0">
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div className="flex-shrink-0 flex items-center justify-center overflow-hidden">
                        {system_logo ? (
                            <img src={system_logo} alt="Logo" className="h-10 w-10 sm:h-12 sm:w-12 object-contain" />
                        ) : (
                            <div className="p-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg">
                                <Sparkles className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                            </div>
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent truncate">
                            {system_name}
                        </h2>
                        <p className="text-xs sm:text-sm text-gray-600 font-medium truncate">
                            {system_description || getText('Smart Campus Management', 'Sistem Manajemen Kampus Cerdas')}
                        </p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 rounded-xl text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors duration-200 lg:hidden flex-shrink-0" aria-label="Close sidebar"><X className="h-5 w-5" /></button>
            </div>

            {user && (
                <div className="p-4 sm:p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200/50 flex-shrink-0">
                    <div className="flex items-center space-x-3 sm:space-x-4">
                        <div className="relative flex-shrink-0 cursor-pointer group" onClick={() => setShowProfileModal(true)}>
                            {user.attachments ? (
                                <img
                                    src={user.attachments}
                                    alt={user.full_name}
                                    className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl object-cover shadow-lg border-2 border-white transition-transform duration-200 group-hover:scale-105"
                                />
                            ) : (
                                <div className="h-12 w-12 sm:h-14 sm:w-14 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg transition-transform duration-200 group-hover:scale-105">
                                    <User className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
                                </div>
                            )}
                            <div className="absolute -bottom-1 -right-1 h-4 w-4 sm:h-5 sm:w-5 bg-emerald-400 border-2 border-white rounded-full">
                                <div className="h-full w-full bg-emerald-400 rounded-full animate-pulse"></div>
                            </div>
                        </div>
                        <div className="flex-1 min-w-0"><p className="text-base sm:text-lg font-bold text-gray-900 truncate">{user.full_name}</p><p className="text-xs sm:text-sm text-gray-600 capitalize truncate">{getText(user.role === 'super_admin' ? 'Super Admin' : user.role === 'department_admin' ? 'Department Admin' : user.role === 'student' ? 'Student' : user.role === 'lecturer' ? 'Lecturer' : user.role === 'laboratory' ? 'Laboratory' : user.role === 'staffing' ? 'Staffing' : user.role === 'purchasing' ? 'Purchasing' : user.role === 'technician' ? 'Technician' : user.role === 'frontdesk' ? 'Front Desk' : user.role === 'staff' ? 'Staff' : user.role === 'finance' ? 'Finance' : user.role, user.role === 'super_admin' ? 'Super Admin' : user.role === 'department_admin' ? 'Admin Departemen' : user.role === 'student' ? 'Mahasiswa' : user.role === 'lecturer' ? 'Dosen' : user.role === 'laboratory' ? 'Laboran' : user.role === 'staffing' ? 'Kepegawaian' : user.role === 'purchasing' ? 'Pengadaan' : user.role === 'technician' ? 'Teknisi' : user.role === 'frontdesk' ? 'Front Desk' : user.role === 'staff' ? 'Tenaga Kependidikan' : user.role === 'finance' ? 'Keuangan' : user.role)}</p><div className="flex items-center mt-1"><div className="h-2 w-2 bg-emerald-400 rounded-full mr-2 flex-shrink-0"></div><span className="text-xs text-emerald-600 font-medium">{getText('Online', 'Online')}</span></div></div>
                    </div>
                    {user.attachments && showProfileModal && createPortal(
                        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-90 transition-opacity duration-300">
                            <div className="absolute top-4 right-4 z-[110] flex items-center space-x-4">
                                <div className="flex items-center space-x-2 bg-white/10 rounded-lg p-1 backdrop-blur-sm">
                                    <button
                                        onClick={handleZoomOut}
                                        className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
                                        title="Zoom Out"
                                    >
                                        <ZoomOut className="h-6 w-6" />
                                    </button>
                                    <span className="text-white font-medium min-w-[3rem] text-center">
                                        {Math.round(scale * 100)}%
                                    </span>
                                    <button
                                        onClick={handleZoomIn}
                                        className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
                                        title="Zoom In"
                                    >
                                        <ZoomIn className="h-6 w-6" />
                                    </button>
                                </div>
                                <button
                                    onClick={resetZoom}
                                    className="p-3 text-white hover:bg-white/20 rounded-full transition-colors"
                                >
                                    <X className="h-8 w-8" />
                                </button>
                            </div>

                            <div
                                className="relative w-full h-full flex items-center justify-center overflow-hidden p-4"
                                onMouseUp={handleMouseUp}
                                onMouseLeave={handleMouseUp}
                                onWheel={handleWheel}
                            >
                                <img
                                    src={user.attachments}
                                    alt={user.full_name}
                                    draggable={false}
                                    onMouseDown={handleMouseDown}
                                    onMouseMove={handleMouseMove}
                                    style={{
                                        transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                                        cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
                                        transition: isDragging ? 'none' : 'transform 0.2s ease-out'
                                    }}
                                    className="max-w-full max-h-full object-contain select-none"
                                />
                            </div>
                        </div>,
                        document.body
                    )}
                </div>
            )}

            <nav className="flex-1 overflow-y-auto py-4 sm:py-6">
                <div className="px-3 sm:px-4 space-y-1 sm:space-y-2">
                    {menuItems.map((item, index) => {
                        const Icon = item.icon;
                        return (
                            <NavLink key={index} to={item.path} onClick={onClose} className={({ isActive }) => `group flex items-center justify-between px-3 sm:px-4 py-3 sm:py-3.5 rounded-xl font-medium transition-all duration-200 ${isActive ? `bg-gradient-to-r text-white shadow-lg transform scale-[1.02] from-blue-500 to-indigo-500` : 'text-gray-700 hover:bg-white/60 hover:text-gray-900 hover:shadow-md hover:scale-[1.01]'}`}>
                                {({ isActive }) => (
                                    <><div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1"><div className={`p-2 sm:p-2.5 rounded-xl transition-all duration-200 flex-shrink-0 ${isActive ? 'bg-white/20 shadow-lg' : 'bg-gray-100/50 group-hover:bg-white/80'}`}><Icon className={`h-4 w-4 sm:h-5 sm:w-5 transition-colors duration-200 ${isActive ? 'text-white' : 'text-gray-600 group-hover:text-gray-800'}`} /></div><span className="text-sm font-semibold truncate">{item.label}</span></div>
                                        <div className="flex items-center space-x-2 flex-shrink-0">{item.badge && (<span className={`inline-flex items-center justify-center px-2 sm:px-2.5 py-1 rounded-full text-xs font-bold transition-all duration-200 ${isActive ? 'bg-white/20 text-white' : 'bg-red-100 text-red-600 group-hover:bg-red-200'}`}>{item.badge > 99 ? '99+' : item.badge}</span>)}<ChevronRight className={`h-4 w-4 transition-all duration-200 ${isActive ? 'text-white/70 transform translate-x-1' : 'text-gray-400 group-hover:text-gray-600 group-hover:transform group-hover:translate-x-1'}`} /></div></>
                                )}
                            </NavLink>
                        );
                    })}
                </div>
            </nav>

            <div className="p-4 sm:p-6 border-t border-gray-200/50 bg-gradient-to-r from-gray-50 to-blue-50 flex-shrink-0">
                <div className="text-center">
                    <p className="text-xs text-gray-500 mb-2">{getText('Develop by', 'Dikembangkan oleh')}</p>
                    <div className="flex items-center justify-center space-x-2"><Zap className="h-4 w-4 text-blue-500 flex-shrink-0" /><span className="text-sm font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{developer_name}</span></div>
                    <p className="text-xs text-gray-400 mt-1">{getText('Version', 'Versi')} {system_version}</p>
                </div>
            </div>
        </div>
    );
};

export default Sidebar;