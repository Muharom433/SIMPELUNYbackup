import React, { useState, useEffect } from 'react';
import {
    BookOpen, Search, Eye, Check, X, Clock, Calendar, Users, AlertCircle, CheckCircle, XCircle, RefreshCw, Download, User, Building, Phone
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Booking, Room, User as UserType, Department } from '../types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface BookingWithDetails extends Booking {
    user?: UserType;
    room?: Room & { department?: Department };
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

    const fetchBookings = async () => {
        try {
            setLoading(true);
            
            const { data: bookingsData, error: bookingsError } = await supabase
                .from('bookings')
                .select('*')
                .order('created_at', { ascending: false });

            if (bookingsError) throw bookingsError;
            if (!bookingsData) { setBookings([]); return; }

            const bookingsWithDetails = await Promise.all(
                bookingsData.map(async (booking) => {
                    let user: UserType | null = null;
                    let room: (Room & { department?: Department }) | null = null;

                    if (booking.user_id) {
                        const { data: userData } = await supabase
                            .from('users')
                            // --- MODIFIED: Added phone_number to select statement ---
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

                    return { ...booking, user, room };
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

            // --- NEW LOGIC: Update room availability based on status change ---
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

            // Find the booking in state to get its room_id before deleting
            const bookingToDelete = bookings.find(b => b.id === bookingId);
            
            const { error } = await supabase
                .from('bookings')
                .delete()
                .eq('id', bookingId);

            if (error) throw error;

            // --- NEW LOGIC: Set room to available after deleting the booking ---
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

    const getStatusColor = (status: string) => { /* ... No Change ... */ };
    const getStatusIcon = (status: string) => { /* ... No Change ... */ };

    if (profile?.role !== 'super_admin' && profile?.role !== 'department_admin') {
        return <div className="flex items-center justify-center h-64"><div className="text-center"><AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" /><h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3><p className="text-gray-600">You don't have permission to access booking management.</p></div></div>;
    }

    return (
        <div className="space-y-6">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center space-x-3"><BookOpen className="h-8 w-8" /><span>Booking Management</span></h1>
                        <p className="mt-2 opacity-90">Manage all room bookings and approvals{profile?.role === 'department_admin' && ' for your department'}</p>
                    </div>
                    <div className="hidden md:block text-right"><div className="text-2xl font-bold">{bookings.length}</div><div className="text-sm opacity-80">Total Bookings</div></div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[ { label: 'Pending', count: bookings.filter(b => b.status === 'pending').length, color: 'bg-yellow-500', icon: Clock }, { label: 'Approved', count: bookings.filter(b => b.status === 'approved').length, color: 'bg-green-500', icon: CheckCircle }, { label: 'Rejected', count: bookings.filter(b => b.status === 'rejected').length, color: 'bg-red-500', icon: XCircle }, { label: 'Completed', count: bookings.filter(b => b.status === 'completed').length, color: 'bg-blue-500', icon: Check } ].map((stat, index) => (
                    <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center justify-between">
                            <div><p className="text-sm font-medium text-gray-600">{stat.label}</p><p className="text-3xl font-bold text-gray-900">{stat.count}</p></div>
                            <div className={`${stat.color} p-3 rounded-xl`}><stat.icon className="h-6 w-6 text-white" /></div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                    <div className="flex flex-col sm:flex-row gap-4 flex-1">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input type="text" placeholder="Search bookings..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                        </div>
                        <div className="flex gap-2">
                            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                                <option value="all">All Status</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="completed">Completed</option>
                            </select>
                            <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                                <option value="all">All Dates</option><option value="today">Today</option><option value="tomorrow">Tomorrow</option><option value="week">This Week</option><option value="past">Past Bookings</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button onClick={() => fetchBookings()} disabled={loading} className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors duration-200 disabled:opacity-50">
                            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button className="flex items-center space-x-2 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"><Download className="h-4 w-4" /><span>Export</span></button>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Booking Details</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Room</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Schedule</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                <tr><td colSpan={6} className="px-6 py-12 text-center"><div className="flex items-center justify-center"><RefreshCw className="h-6 w-6 animate-spin text-indigo-600 mr-2" /><span className="text-gray-600">Loading bookings...</span></div></td></tr>
                            ) : filteredBookings.length === 0 ? (
                                <tr><td colSpan={6} className="px-6 py-12 text-center"><div className="text-gray-500"><BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" /><p className="text-lg font-medium mb-2">No bookings found</p><p>Try adjusting your search or filters</p>{bookings.length > 0 && (<p className="text-sm mt-2">Total bookings in database: {bookings.length}</p>)}</div></td></tr>
                            ) : (
                                filteredBookings.map((booking) => {
                                    const StatusIcon = getStatusIcon(booking.status);
                                    const isProcessing = processingIds.has(booking.id);
                                    return (
                                        <tr key={booking.id} className="hover:bg-gray-50 transition-colors duration-200">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900">{booking.purpose || 'Class/Study Session'}</div>
                                                    <div className="text-sm text-gray-500">{booking.sks} SKS • {booking.class_type}</div>
                                                    {booking.equipment_requested && booking.equipment_requested.length > 0 && (<div className="flex items-center mt-1"><Zap className="h-3 w-3 text-gray-400 mr-1" /><span className="text-xs text-gray-500">{booking.equipment_requested.length} equipment requested</span></div>)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="h-8 w-8 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center"><User className="h-4 w-4 text-white" /></div>
                                                    <div className="ml-3">
                                                        <div className="text-sm font-medium text-gray-900">{booking.user?.full_name || 'Unknown User'}</div>
                                                        {/* --- MODIFIED: Show phone_number with fallback to identity_number --- */}
                                                        <div className="text-sm text-gray-500">{booking.user?.phone_number || booking.user?.identity_number || 'No contact'}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900">{booking.room?.name || 'Unknown Room'}</div>
                                                    <div className="text-sm text-gray-500">{booking.room?.code || 'N/A'} • {booking.room?.department?.name || 'No Department'}</div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900">{format(new Date(booking.start_time), 'MMM d, yyyy')}</div>
                                                    <div className="text-sm text-gray-500">{format(new Date(booking.start_time), 'h:mm a')} - {format(new Date(booking.end_time), 'h:mm a')}</div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}><StatusIcon className="h-3 w-3 mr-1" />{booking.status.toUpperCase()}</span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex items-center justify-end space-x-2">
                                                    <button onClick={() => { setSelectedBooking(booking); setShowDetailModal(true); }} className="text-gray-600 hover:text-gray-900 p-1 rounded transition-colors duration-200"><Eye className="h-4 w-4" /></button>
                                                    {booking.status === 'pending' && (
                                                        <>
                                                            <button onClick={() => handleStatusUpdate(booking.id, 'approved')} disabled={isProcessing} className="text-green-600 hover:text-green-900 p-1 rounded transition-colors duration-200 disabled:opacity-50"><Check className="h-4 w-4" /></button>
                                                            <button onClick={() => handleStatusUpdate(booking.id, 'rejected')} disabled={isProcessing} className="text-red-600 hover:text-red-900 p-1 rounded transition-colors duration-200 disabled:opacity-50"><X className="h-4 w-4" /></button>
                                                        </>
                                                    )}
                                                    <button onClick={() => setShowDeleteConfirm(booking.id)} disabled={isProcessing} className="text-red-600 hover:text-red-900 p-1 rounded transition-colors duration-200 disabled:opacity-50"><Trash2 className="h-4 w-4" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showDetailModal && selectedBooking && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-semibold text-gray-900">Booking Details</h3>
                                <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors duration-200"><X className="h-6 w-6" /></button>
                            </div>
                            <div className="space-y-6">
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <h4 className="text-lg font-medium text-gray-900 mb-3">{selectedBooking.purpose || 'Class/Study Session'}</h4>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div><span className="text-gray-500">Status:</span><span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedBooking.status)}`}>{selectedBooking.status.toUpperCase()}</span></div>
                                        <div><span className="text-gray-500">Class Type:</span><span className="ml-2 font-medium">{selectedBooking.class_type}</span></div>
                                        <div><span className="text-gray-500">SKS:</span><span className="ml-2 font-medium">{selectedBooking.sks}</span></div>
                                        <div><span className="text-gray-500">Created:</span><span className="ml-2">{format(new Date(selectedBooking.created_at), 'MMM d, yyyy h:mm a')}</span></div>
                                    </div>
                                </div>
                                <div>
                                    <h5 className="font-medium text-gray-900 mb-3">User Information</h5>
                                    <div className="bg-blue-50 rounded-lg p-4">
                                        <div className="flex items-center space-x-3">
                                            <div className="h-10 w-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center"><User className="h-5 w-5 text-white" /></div>
                                            <div>
                                                <div className="font-medium text-gray-900">{selectedBooking.user?.full_name || 'Unknown User'}</div>
                                                {/* --- NEW: Added phone number --- */}
                                                <div className="text-sm text-gray-600 flex items-center"><Phone className="h-3 w-3 mr-1.5"/>{selectedBooking.user?.phone_number || 'No phone number'}</div>
                                                <div className="text-sm text-gray-600">{selectedBooking.user?.identity_number || 'No identity number'}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {/* ... Other modal sections (Room, Schedule, etc.) ... */}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                        <div className="flex items-center mb-4"><div className="flex-shrink-0"><AlertCircle className="h-6 w-6 text-red-600" /></div><div className="ml-3"><h3 className="text-lg font-medium text-gray-900">Delete Booking</h3></div></div>
                        <p className="text-sm text-gray-500 mb-6">Are you sure you want to delete this booking? This action cannot be undone.</p>
                        <div className="flex space-x-3">
                            <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200">Cancel</button>
                            <button onClick={() => handleDelete(showDeleteConfirm)} disabled={processingIds.has(showDeleteConfirm)} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200">{processingIds.has(showDeleteConfirm) ? 'Deleting...' : 'Delete'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BookingManagement;