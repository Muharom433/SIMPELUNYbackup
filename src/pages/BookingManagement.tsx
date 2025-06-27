import React, { useState, useEffect } from 'react';
import {
    BookOpen, Search, Eye, Edit, Trash2, Check, X, Clock, Calendar, Users, AlertCircle, CheckCircle, XCircle, RefreshCw, Download, User, Building, Phone, Zap, Package, Hash, Wrench, Cpu, Wifi, FlaskConical, Armchair, Shield, Camera
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Booking, Room, User as UserType, Department, Equipment } from '../types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface BookingWithDetails extends Booking {
    user?: UserType;
    room?: Room & { department?: Department };
    equipment_details?: Equipment[];
}

const BookingManagement: React.FC = () => {
    const { profile } = useAuth();
    const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [dateFilter, setDateFilter] = useState<string>('all');
    const [selectedBooking, setSelectedBooking] = useState<BookingWithDetails | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        fetchBookings();
        
        const subscription = supabase
            .channel('booking-management')
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'bookings' }, 
                () => { fetchBookings(); }
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    // Function to fetch equipment details by IDs
    const fetchEquipmentDetails = async (equipmentIds: string[]): Promise<Equipment[]> => {
        if (!equipmentIds || equipmentIds.length === 0) return [];
        
        try {
            const { data: equipmentData, error } = await supabase
                .from('equipment')
                .select('*')
                .in('id', equipmentIds);

            if (error) {
                console.error('Error fetching equipment details:', error);
                return [];
            }

            return equipmentData || [];
        } catch (error) {
            console.error('Error fetching equipment details:', error);
            return [];
        }
    };

    const fetchBookings = async () => {
        try {
            setLoading(true);
            
            const { data: bookingsData, error: bookingsError } = await supabase
                .from('bookings')
                .select('*')
                .order('created_at', { ascending: false });

            if (bookingsError) throw bookingsError;
            if (!bookingsData) { setBookings([]); setLoading(false); return; }

            const bookingsWithDetails = await Promise.all(
                bookingsData.map(async (booking) => {
                    let user: UserType | null = null;
                    let room: (Room & { department?: Department }) | null = null;
                    let equipment_details: Equipment[] = [];

                    if (booking.user_id) {
                        const { data: userData } = await supabase
                            .from('users')
                            .select('id, full_name, identity_number, email, role, phone_number')
                            .eq('id', booking.user_id)
                            .maybeSingle();
                        if (userData) user = userData;
                    }

                    if (!user && booking.user_info) {
                        user = {
                            id: 'temp',
                            full_name: booking.user_info.full_name,
                            identity_number: booking.user_info.identity_number,
                            email: booking.user_info.email || null,
                            role: 'student',
                            phone_number: booking.user_info.phone_number || null,
                        };
                    }

                    if (booking.room_id) {
                        const { data: roomData } = await supabase
                            .from('rooms')
                            .select(`id, name, code, capacity, department_id, department:departments(id, name, code)`)
                            .eq('id', booking.room_id)
                            .maybeSingle();
                        if (roomData) room = roomData;
                    }

                    // Fetch equipment details by IDs
                    if (booking.equipment_requested && booking.equipment_requested.length > 0) {
                        equipment_details = await fetchEquipmentDetails(booking.equipment_requested);
                    }

                    return { ...booking, user, room, equipment_details };
                })
            );

            let filteredBookings = bookingsWithDetails;
            if (profile?.role === 'department_admin' && profile.department_id) {
                filteredBookings = bookingsWithDetails.filter(booking => 
                    booking.room?.department_id === profile.department_id
                );
            }

            setBookings(filteredBookings);

        } catch (error) {
            console.error('Error fetching bookings:', error);
            toast.error('Failed to load bookings');
        } finally {
            setLoading(false);
        }
    };

    const handleStatusUpdate = async (bookingId: string, newStatus: 'approved' | 'rejected') => {
        try {
            setProcessingIds(prev => new Set(prev).add(bookingId));
            
            const { data: updatedBooking, error } = await supabase
                .from('bookings')
                .update({ status: newStatus, updated_at: new Date().toISOString() })
                .eq('id', bookingId)
                .select()
                .single();

            if (error) throw error;
            if (!updatedBooking) throw new Error("Booking not found");

            if (updatedBooking.room_id) {
                const newAvailability = newStatus === 'approved' ? false : true;
                const { error: roomUpdateError } = await supabase
                    .from('rooms')
                    .update({ is_available: newAvailability })
                    .eq('id', updatedBooking.room_id);

                if (roomUpdateError) {
                    toast.error('Booking status updated, but failed to update room status.');
                }
            }
            
            toast.success(`Booking ${newStatus} successfully`);
            await fetchBookings();
            
        } catch (error: any) {
            console.error(`Error ${newStatus} booking:`, error);
            toast.error(error.message || `Failed to ${newStatus} booking`);
        } finally {
            setProcessingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(bookingId);
                return newSet;
            });
        }
    };

    const handleDelete = async (bookingId: string) => {
        try {
            setProcessingIds(prev => new Set(prev).add(bookingId));
            const bookingToDelete = bookings.find(b => b.id === bookingId);
            
            const { error } = await supabase
                .from('bookings')
                .delete()
                .eq('id', bookingId);

            if (error) throw error;

            if (bookingToDelete?.room_id) {
                const { error: roomUpdateError } = await supabase
                    .from('rooms')
                    .update({ is_available: true })
                    .eq('id', bookingToDelete.room_id);

                if (roomUpdateError) {
                    toast.error('Booking deleted, but failed to update room status.');
                }
            }
            
            toast.success('Booking deleted successfully');
            setShowDeleteConfirm(null);
            await fetchBookings();
            
        } catch (error: any) {
            console.error('Error deleting booking:', error);
            toast.error(error.message || 'Failed to delete booking');
        } finally {
            setProcessingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(bookingId);
                return newSet;
            });
        }
    };

    const filteredBookings = bookings.filter(booking => {
        const matchesSearch = 
            (booking.purpose && booking.purpose.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (booking.user?.full_name && booking.user.full_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (booking.room?.name && booking.room.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (booking.room?.code && booking.room.code.toLowerCase().includes(searchTerm.toLowerCase()));
        
        const matchesStatus = statusFilter === 'all' || booking.status === statusFilter;
        
        let matchesDate = true;
        if (dateFilter !== 'all') {
            const bookingDate = new Date(booking.start_time);
            const today = new Date();
            today.setHours(0,0,0,0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const nextWeek = new Date(today);
            nextWeek.setDate(nextWeek.getDate() + 7);

            switch (dateFilter) {
                case 'today': matchesDate = bookingDate.toDateString() === today.toDateString(); break;
                case 'tomorrow': matchesDate = bookingDate.toDateString() === tomorrow.toDateString(); break;
                case 'week': matchesDate = bookingDate >= today && bookingDate <= nextWeek; break;
                case 'past': matchesDate = bookingDate < today; break;
            }
        }
        
        return matchesSearch && matchesStatus && matchesDate;
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-yellow-100 text-yellow-800';
            case 'approved': return 'bg-green-100 text-green-800';
            case 'rejected': return 'bg-red-100 text-red-800';
            case 'completed': return 'bg-blue-100 text-blue-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'pending': return Clock;
            case 'approved': return CheckCircle;
            case 'rejected': return XCircle;
            case 'completed': return Check;
            default: return AlertCircle;
        }
    };

    // Helper function to get equipment category icon
    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'Audio Visual': return Camera;
            case 'Computing': return Cpu;
            case 'Connectivity': return Wifi;
            case 'Power': return Zap;
            case 'Laboratory': return FlaskConical;
            case 'Furniture': return Armchair;
            case 'Safety': return Shield;
            default: return Package;
        }
    };

    if (profile?.role !== 'super_admin' && profile?.role !== 'department_admin') {
        return <div className="flex items-center justify-center h-64"><div className="text-center"><AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" /><h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3><p className="text-gray-600">You don't have permission to access booking management.</p></div></div>;
    }

    return (
        <div className="space-y-6">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                    <div><h1 className="text-3xl font-bold flex items-center space-x-3"><BookOpen className="h-8 w-8" /><span>Booking Management</span></h1><p className="mt-2 opacity-90">Manage all room bookings and approvals{profile?.role === 'department_admin' && ' for your department'}</p></div>
                    <div className="hidden md:block text-right"><div className="text-2xl font-bold">{bookings.length}</div><div className="text-sm opacity-80">Total Bookings</div></div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[ { label: 'Pending', count: bookings.filter(b => b.status === 'pending').length, color: 'bg-yellow-500', icon: Clock }, { label: 'Approved', count: bookings.filter(b => b.status === 'approved').length, color: 'bg-green-500', icon: CheckCircle }, { label: 'Rejected', count: bookings.filter(b => b.status === 'rejected').length, color: 'bg-red-500', icon: XCircle }, { label: 'Completed', count: bookings.filter(b => b.status === 'completed').length, color: 'bg-blue-500', icon: Check } ].map((stat, index) => (
                    <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-gray-600">{stat.label}</p><p className="text-3xl font-bold text-gray-900">{stat.count}</p></div><div className={`${stat.color} p-3 rounded-xl`}><stat.icon className="h-6 w-6 text-white" /></div></div></div>
                ))}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                    <div className="flex flex-col sm:flex-row gap-4 flex-1">
                        <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" /><input type="text" placeholder="Search bookings..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" /></div>
                        <div className="flex gap-2">
                            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"><option value="all">All Status</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="completed">Completed</option></select>
                            <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"><option value="all">All Dates</option><option value="today">Today</option><option value="tomorrow">Tomorrow</option><option value="week">This Week</option><option value="past">Past Bookings</option></select>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button onClick={() => fetchBookings()} disabled={loading} className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors duration-200 disabled:opacity-50"><RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} /></button>
                        <button className="flex items-center space-x-2 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"><Download className="h-4 w-4" /><span>Export</span></button>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Booking Details</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Room</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Schedule</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th><th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th></tr></thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (<tr><td colSpan={6} className="px-6 py-12 text-center"><div className="flex items-center justify-center"><RefreshCw className="h-6 w-6 animate-spin text-indigo-600 mr-2" /><span className="text-gray-600">Loading bookings...</span></div></td></tr>)
                            : filteredBookings.length === 0 ? (<tr><td colSpan={6} className="px-6 py-12 text-center"><div className="text-gray-500"><BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" /><p className="text-lg font-medium mb-2">No bookings found</p><p>Try adjusting your search or filters</p>{bookings.length > 0 && (<p className="text-sm mt-2">Total bookings in database: {bookings.length}</p>)}</div></td></tr>)
                            : (filteredBookings.map((booking) => {
                                    const StatusIcon = getStatusIcon(booking.status);
                                    const isProcessing = processingIds.has(booking.id);
                                    return (<tr key={booking.id} className="hover:bg-gray-50 transition-colors duration-200"><td className="px-6 py-4 whitespace-nowrap"><div><div className="text-sm font-medium text-gray-900">{booking.purpose || 'Class/Study Session'}</div><div className="text-sm text-gray-500">{booking.sks} SKS • {booking.class_type}</div>{booking.equipment_details && booking.equipment_details.length > 0 && (<div className="flex items-center mt-1"><Zap className="h-3 w-3 text-gray-400 mr-1" /><span className="text-xs text-gray-500">{booking.equipment_details.length} equipment requested</span></div>)}</div></td><td className="px-6 py-4 whitespace-nowrap"><div className="flex items-center"><div className="h-8 w-8 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center"><User className="h-4 w-4 text-white" /></div><div className="ml-3"><div className="text-sm font-medium text-gray-900">{booking.user?.full_name || 'Unknown User'}</div><div className="text-sm text-gray-500">{booking.user?.phone_number || booking.user?.identity_number || 'No contact'}</div></div></div></td><td className="px-6 py-4 whitespace-nowrap"><div><div className="text-sm font-medium text-gray-900">{booking.room?.name || 'Unknown Room'}</div><div className="text-sm text-gray-500">{booking.room?.code || 'N/A'} • {booking.room?.department?.name || 'No Department'}</div></div></td><td className="px-6 py-4 whitespace-nowrap"><div><div className="text-sm font-medium text-gray-900">{format(new Date(booking.start_time), 'MMM d, yyyy')}</div><div className="text-sm text-gray-500">{format(new Date(booking.start_time), 'h:mm a')} - {format(new Date(booking.end_time), 'h:mm a')}</div></div></td><td className="px-6 py-4 whitespace-nowrap"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}><StatusIcon className="h-3 w-3 mr-1" />{booking.status.toUpperCase()}</span></td><td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"><div className="flex items-center justify-end space-x-2"><button onClick={() => { setSelectedBooking(booking); setShowDetailModal(true); }} className="text-gray-600 hover:text-gray-900 p-1 rounded transition-colors duration-200"><Eye className="h-4 w-4" /></button>{booking.status === 'pending' && (<> <button onClick={() => handleStatusUpdate(booking.id, 'approved')} disabled={isProcessing} className="text-green-600 hover:text-green-900 p-1 rounded transition-colors duration-200 disabled:opacity-50"><Check className="h-4 w-4" /></button> <button onClick={() => handleStatusUpdate(booking.id, 'rejected')} disabled={isProcessing} className="text-red-600 hover:text-red-900 p-1 rounded transition-colors duration-200 disabled:opacity-50"><X className="h-4 w-4" /></button></>)}<button onClick={() => setShowDeleteConfirm(booking.id)} disabled={isProcessing} className="text-red-600 hover:text-red-900 p-1 rounded transition-colors duration-200 disabled:opacity-50"><Trash2 className="h-4 w-4" /></button></div></td></tr>);
                            }))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Enhanced Detail Modal with Equipment Details */}
            {showDetailModal && selectedBooking && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-semibold text-gray-900">Booking Details</h3>
                                <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors duration-200">
                                    <X className="h-6 w-6" />
                                </button>
                            </div>
                            <div className="space-y-6">
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <h4 className="text-lg font-medium text-gray-900 mb-3">{selectedBooking.purpose || 'Class/Study Session'}</h4>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="text-gray-500">Status:</span>
                                            <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedBooking.status)}`}>
                                                {selectedBooking.status.toUpperCase()}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">Class Type:</span>
                                            <span className="ml-2 font-medium">{selectedBooking.class_type}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">SKS:</span>
                                            <span className="ml-2 font-medium">{selectedBooking.sks}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">Created:</span>
                                            <span className="ml-2">{format(new Date(selectedBooking.created_at), 'MMM d, yyyy h:mm a')}</span>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h5 className="font-medium text-gray-900 mb-3">User Information</h5>
                                    <div className="bg-blue-50 rounded-lg p-4">
                                        <div className="flex items-center space-x-3">
                                            <div className="h-10 w-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                                                <User className="h-5 w-5 text-white" />
                                            </div>
                                            <div>
                                                <div className="font-medium text-gray-900">{selectedBooking.user?.full_name || 'Unknown User'}</div>
                                                <div className="text-sm text-gray-600 flex items-center">
                                                    <Phone className="h-3 w-3 mr-1.5"/>
                                                    {selectedBooking.user?.phone_number || 'No phone number'}
                                                </div>
                                                <div className="text-sm text-gray-600">{selectedBooking.user?.identity_number || 'No identity number'}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h5 className="font-medium text-gray-900 mb-3">Room Information</h5>
                                    <div className="bg-green-50 rounded-lg p-4">
                                        <div className="flex items-center space-x-3">
                                            <div className="h-10 w-10 bg-gradient-to-r from-green-500 to-teal-500 rounded-full flex items-center justify-center">
                                                <Building className="h-5 w-5 text-white" />
                                            </div>
                                            <div>
                                                <div className="font-medium text-gray-900">{selectedBooking.room?.name || 'Unknown Room'}</div>
                                                <div className="text-sm text-gray-600">{selectedBooking.room?.code || 'N/A'}</div>
                                                <div className="text-sm text-gray-600">{selectedBooking.room?.department?.name || 'No Department'}</div>
                                                <div className="text-sm text-gray-600">Capacity: {selectedBooking.room?.capacity || 'N/A'} seats</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h5 className="font-medium text-gray-900 mb-3">Schedule</h5>
                                    <div className="bg-purple-50 rounded-lg p-4">
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <span className="text-gray-500">Start Time:</span>
                                                <div className="font-medium">{format(new Date(selectedBooking.start_time), 'MMM d, yyyy h:mm a')}</div>
                                            </div>
                                            <div>
                                                <span className="text-gray-500">End Time:</span>
                                                <div className="font-medium">{format(new Date(selectedBooking.end_time), 'MMM d, yyyy h:mm a')}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Equipment Details Section */}
                                <div>
                                    <h5 className="font-medium text-gray-900 mb-3 flex items-center">
                                        <Package className="h-5 w-5 mr-2 text-blue-600" />
                                        Requested Equipment
                                        {selectedBooking.equipment_details && selectedBooking.equipment_details.length > 0 && (
                                            <span className="ml-2 text-sm text-gray-500">({selectedBooking.equipment_details.length} items)</span>
                                        )}
                                    </h5>
                                    
                                    {selectedBooking.equipment_details && selectedBooking.equipment_details.length > 0 ? (
                                        <>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {selectedBooking.equipment_details.map((equipment, index) => {
                                                    const CategoryIcon = getCategoryIcon(equipment.category);
                                                    return (
                                                        <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                                            <div className="flex items-start space-x-3">
                                                                <div className="flex-shrink-0">
                                                                    <div className="h-10 w-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                                                                        <CategoryIcon className="h-5 w-5 text-white" />
                                                                    </div>
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center justify-between mb-2">
                                                                        <h6 className="text-sm font-semibold text-gray-900 truncate">
                                                                            {equipment.name}
                                                                        </h6>
                                                                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                                                                            <Hash className="h-3 w-3 mr-1" />
                                                                            {equipment.code}
                                                                        </span>
                                                                    </div>
                                                                    <div className="space-y-2">
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="text-xs text-gray-500">Category:</span>
                                                                            <span className="text-xs font-medium text-gray-700">{equipment.category}</span>
                                                                        </div>
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="text-xs text-gray-500">Condition:</span>
                                                                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                                                                                equipment.condition === 'GOOD' ? 'bg-green-100 text-green-700' :
                                                                                equipment.condition === 'BROKEN' ? 'bg-red-100 text-red-700' :
                                                                                'bg-yellow-100 text-yellow-700'
                                                                            }`}>
                                                                                {equipment.condition}
                                                                            </span>
                                                                        </div>
                                                                        {equipment.quantity && equipment.unit && (
                                                                            <div className="flex items-center justify-between">
                                                                                <span className="text-xs text-gray-500">Quantity:</span>
                                                                                <span className="text-xs font-medium text-gray-700">
                                                                                    {equipment.quantity} {equipment.unit}
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="text-xs text-gray-500">Available:</span>
                                                                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                                                                                equipment.is_available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                                            }`}>
                                                                                {equipment.is_available ? 'Yes' : 'No'}
                                                                            </span>
                                                                        </div>
                                                                        {equipment.is_mandatory && (
                                                                            <div className="flex items-center justify-between">
                                                                                <span className="text-xs text-gray-500">Type:</span>
                                                                                <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-100 text-amber-700">
                                                                                    Mandatory
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                        {equipment.Spesification && (
                                                                            <div className="mt-2 pt-2 border-t border-gray-200">
                                                                                <span className="text-xs text-gray-500">Specifications:</span>
                                                                                <p className="text-xs text-gray-700 mt-1 leading-relaxed">
                                                                                    {equipment.Spesification}
                                                                                </p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            
                                            {/* Equipment Summary */}
                                            <div className="mt-4 bg-blue-50 rounded-lg p-4 border border-blue-200">
                                                <h6 className="text-sm font-semibold text-blue-900 mb-2">Equipment Summary</h6>
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                                    <div className="text-center">
                                                        <div className="text-lg font-bold text-blue-700">
                                                            {selectedBooking.equipment_details.length}
                                                        </div>
                                                        <div className="text-blue-600">Total Items</div>
                                                    </div>
                                                    <div className="text-center">
                                                        <div className="text-lg font-bold text-green-700">
                                                            {selectedBooking.equipment_details.filter(eq => eq.is_available).length}
                                                        </div>
                                                        <div className="text-green-600">Available</div>
                                                    </div>
                                                    <div className="text-center">
                                                        <div className="text-lg font-bold text-amber-700">
                                                            {selectedBooking.equipment_details.filter(eq => eq.is_mandatory).length}
                                                        </div>
                                                        <div className="text-amber-600">Mandatory</div>
                                                    </div>
                                                    <div className="text-center">
                                                        <div className="text-lg font-bold text-purple-700">
                                                            {[...new Set(selectedBooking.equipment_details.map(eq => eq.category))].length}
                                                        </div>
                                                        <div className="text-purple-600">Categories</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    ) : selectedBooking.equipment_requested && selectedBooking.equipment_requested.length > 0 ? (
                                        <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                                            <div className="flex items-center">
                                                <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
                                                <div>
                                                    <h6 className="text-sm font-semibold text-yellow-800">Equipment Details Not Available</h6>
                                                    <p className="text-sm text-yellow-700">
                                                        Requested equipment IDs: {selectedBooking.equipment_requested.join(', ')}
                                                    </p>
                                                    <p className="text-xs text-yellow-600 mt-1">
                                                        Equipment details could not be loaded from the database. The equipment may have been deleted.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                            <div className="flex items-center justify-center text-gray-500">
                                                <Package className="h-8 w-8 mr-3 opacity-50" />
                                                <div className="text-center">
                                                    <p className="text-sm font-medium">No Equipment Requested</p>
                                                    <p className="text-xs">This booking does not require any additional equipment.</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {selectedBooking.notes && (
                                    <div>
                                        <h5 className="font-medium text-gray-900 mb-3">Notes</h5>
                                        <div className="bg-gray-50 rounded-lg p-4">
                                            <p className="text-sm text-gray-700">{selectedBooking.notes}</p>
                                        </div>
                                    </div>
                                )}

                                {selectedBooking.status === 'pending' && (
                                    <div className="flex space-x-3 pt-4 border-t">
                                        <button 
                                            onClick={() => { 
                                                handleStatusUpdate(selectedBooking.id, 'approved'); 
                                                setShowDetailModal(false); 
                                            }} 
                                            disabled={processingIds.has(selectedBooking.id)} 
                                            className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                                        >
                                            <Check className="h-4 w-4" />
                                            <span>Approve</span>
                                        </button>
                                        <button 
                                            onClick={() => { 
                                                handleStatusUpdate(selectedBooking.id, 'rejected'); 
                                                setShowDetailModal(false); 
                                            }} 
                                            disabled={processingIds.has(selectedBooking.id)} 
                                            className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                                        >
                                            <X className="h-4 w-4" />
                                            <span>Reject</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                        <div className="flex items-center mb-4">
                            <div className="flex-shrink-0">
                                <AlertCircle className="h-6 w-6 text-red-600" />
                            </div>
                            <div className="ml-3">
                                <h3 className="text-lg font-medium text-gray-900">Delete Booking</h3>
                            </div>
                        </div>
                        <p className="text-sm text-gray-500 mb-6">Are you sure you want to delete this booking? This action cannot be undone.</p>
                        <div className="flex space-x-3">
                            <button 
                                onClick={() => setShowDeleteConfirm(null)} 
                                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={() => handleDelete(showDeleteConfirm)} 
                                disabled={processingIds.has(showDeleteConfirm)} 
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                            >
                                {processingIds.has(showDeleteConfirm) ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BookingManagement;