
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    Building, Plus, Search, Edit, Trash2, Eye, Users, User, MapPin, CheckCircle, AlertCircle, Clock, RefreshCw, X, List, Grid, Zap, Tv2, Speaker, Presentation, Mic, AirVent, Loader2, Hash, DoorClosed, Calendar, Phone, Send, ChevronDown
} from 'lucide-react';

// Mock data for demonstration
const mockRooms = [
    {
        id: '1',
        name: 'Lab Anatomi & Fisiologi',
        code: 'LAB-001',
        capacity: 30,
        status: 'Available',
        department: { name: 'Teknik Elektro dan Elektronika' }
    },
    {
        id: '2', 
        name: 'GK.L.02',
        code: 'GK-L02',
        capacity: 45,
        status: 'Scheduled',
        department: { name: 'General' }
    },
    {
        id: '3',
        name: 'Ruang Multimedia',
        code: 'MM-001', 
        capacity: 25,
        status: 'In Use',
        department: { name: 'Multimedia' }
    }
];

const mockStudyPrograms = [
    { id: '1', name: 'Teknik Informatika', code: 'TI', department: { name: 'Teknik Informatika' } },
    { id: '2', name: 'Sistem Informasi', code: 'SI', department: { name: 'Sistem Informasi' } },
    { id: '3', name: 'Teknik Elektro', code: 'TE', department: { name: 'Teknik Elektro' } }
];

const mockUsers = [
    { id: '1', identity_number: '2021001', full_name: 'Ahmad Rizki', phone_number: '081234567890', study_program_id: '1' },
    { id: '2', identity_number: '2021002', full_name: 'Siti Aminah', phone_number: '081234567891', study_program_id: '2' }
];

const mockEquipment = [
    { id: '1', name: 'Projector', is_mandatory: true, rooms_id: '1', is_available: true },
    { id: '2', name: 'Whiteboard', is_mandatory: false, rooms_id: '1', is_available: true },
    { id: '3', name: 'Sound System', is_mandatory: false, rooms_id: null, is_available: true }
];

const bookingSchema = z.object({
    full_name: z.string().min(3, 'Full name must be at least 3 characters'),
    identity_number: z.string().min(5, 'Identity number must be at least 5 characters'),
    study_program_id: z.string().min(1, 'Please select a study program'),
    phone_number: z.string().min(10, 'Please enter a valid phone number'),
    room_id: z.string().min(1, 'Please select a room'),
    start_time: z.string().min(1, 'Please select start time'),
    sks: z.number().min(1, 'SKS must be at least 1').max(6, 'SKS cannot exceed 6'),
    class_type: z.enum(['theory', 'practical']),
    equipment_requested: z.array(z.string()).optional(),
    notes: z.string().optional(),
});

type BookingForm = z.infer<typeof bookingSchema>;

const BookRoom = () => {
    const [rooms, setRooms] = useState(mockRooms);
    const [loading, setLoading] = useState(false);
    const [showInUse, setShowInUse] = useState(false);
    const [viewingSchedulesFor, setViewingSchedulesFor] = useState(null);
    const [schedulesForModal, setSchedulesForModal] = useState([]);
    const [loadingSchedules, setLoadingSchedules] = useState(false);
    const [studyPrograms, setStudyPrograms] = useState(mockStudyPrograms);
    const [masterEquipmentList, setMasterEquipmentList] = useState(mockEquipment);
    const [existingUsers, setExistingUsers] = useState(mockUsers);
    const [viewMode, setViewMode] = useState('grid');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [showIdentityDropdown, setShowIdentityDropdown] = useState(false);
    const [identitySearchTerm, setIdentitySearchTerm] = useState('');
    const [showStudyProgramDropdown, setShowStudyProgramDropdown] = useState(false);
    const [studyProgramSearchTerm, setStudyProgramSearchTerm] = useState('');
    const [availableEquipment, setAvailableEquipment] = useState([]);
    const [checkedEquipment, setCheckedEquipment] = useState(new Set());

    const form = useForm({
        resolver: zodResolver(bookingSchema),
        defaultValues: { class_type: 'theory', sks: 2, equipment_requested: [] },
    });

    const watchSks = form.watch('sks');
    const watchClassType = form.watch('class_type');
    const watchIdentityNumber = form.watch('identity_number');
    const watchStudyProgramId = form.watch('study_program_id');

    useEffect(() => {
        if (selectedRoom) {
            const roomSpecificEquipment = masterEquipmentList.filter(eq => eq.rooms_id === selectedRoom.id);
            const generalEquipment = masterEquipmentList.filter(eq => eq.rooms_id === null);
            const combinedEquipment = [...roomSpecificEquipment, ...generalEquipment];
            setAvailableEquipment(combinedEquipment);
            const mandatoryIds = new Set(combinedEquipment.filter(eq => eq.is_mandatory).map(eq => eq.id));
            setCheckedEquipment(mandatoryIds);
        } else {
            setAvailableEquipment([]);
            setCheckedEquipment(new Set());
        }
    }, [selectedRoom, masterEquipmentList]);

    const handleNowBooking = () => {
        const now = new Date();
        const formattedNow = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        form.setValue('start_time', formattedNow);
    };

    const calculateEndTime = (startTime, sks, classType) => {
        if (!startTime || !sks) return null;
        const duration = classType === 'theory' ? sks * 50 : sks * 170;
        const startDate = new Date(startTime);
        const endDate = new Date(startDate.getTime() + (duration * 60000));
        return endDate;
    };

    const onSubmit = async (data) => {
        if (!selectedRoom) {
            alert('Please select a room');
            return;
        }
        
        setLoading(true);
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));
            alert('Room booking submitted for approval!');
            form.reset({ class_type: 'theory', sks: 2, equipment_requested: [] });
            setSelectedRoom(null);
            setIdentitySearchTerm('');
            setStudyProgramSearchTerm('');
        } catch (error) {
            alert('Failed to create booking');
        } finally {
            setLoading(false);
        }
    };

    const filteredIdentityNumbers = existingUsers.filter(user => 
        user.identity_number.toLowerCase().includes(identitySearchTerm.toLowerCase()) || 
        user.full_name.toLowerCase().includes(identitySearchTerm.toLowerCase())
    );

    const filteredRooms = useMemo(() => {
        return rooms.filter(room => {
            const matchesSearch = room.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                room.code.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = room.status !== 'In Use' || showInUse;
            return matchesSearch && matchesStatus;
        });
    }, [rooms, searchTerm, showInUse]);

    const getStatusColor = (status) => {
        switch (status) {
            case 'In Use': return 'bg-red-100 text-red-800';
            case 'Scheduled': return 'bg-yellow-100 text-yellow-800';
            case 'Available': return 'bg-green-100 text-green-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
            {/* Header Section */}
            <div className="bg-white/80 backdrop-blur-sm border-b border-white/20 sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center space-x-3 sm:space-x-4">
                            <div className="p-2 sm:p-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl sm:rounded-2xl shadow-lg">
                                <Calendar className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                                    Smart Room Booking
                                </h1>
                                <p className="text-sm sm:text-base text-gray-600 mt-1">Reserve your perfect study space</p>
                            </div>
                        </div>
                        <div className="hidden md:block">
                            <div className="text-right">
                                <div className="text-xl lg:text-2xl font-bold text-gray-800">
                                    {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                                <div className="text-xs lg:text-sm text-gray-500">
                                    {currentTime.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-4 sm:py-8">
                {/* Mobile-First Layout */}
                <div className="space-y-6">
                    {/* Booking Form - Show first on mobile */}
                    <div className="lg:hidden">
                        <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-4 sm:p-6">
                            <div className="flex items-center space-x-3 mb-6">
                                <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg">
                                    <Calendar className="h-5 w-5 text-white" />
                                </div>
                                <h2 className="text-xl font-bold text-gray-800">Book Your Room</h2>
                            </div>
                            
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                {/* Personal Information Section */}
                                <div className="space-y-4">
                                    <div className="flex items-center space-x-3 pb-3 border-b border-gray-200/50">
                                        <User className="h-4 w-4 text-blue-500" />
                                        <h3 className="text-base font-semibold text-gray-800">Personal Information</h3>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Identity Number (NIM/NIP) *
                                        </label>
                                        <div className="relative">
                                            <input 
                                                {...form.register('identity_number')} 
                                                type="text" 
                                                placeholder="Enter or select your ID" 
                                                value={identitySearchTerm} 
                                                onChange={(e) => { 
                                                    setIdentitySearchTerm(e.target.value); 
                                                    form.setValue('identity_number', e.target.value); 
                                                    setShowIdentityDropdown(true); 
                                                }} 
                                                onFocus={() => setShowIdentityDropdown(true)}
                                                onBlur={() => setTimeout(() => setShowIdentityDropdown(false), 200)}
                                                className="w-full px-3 py-3 pr-10 bg-white/50 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200 text-sm" 
                                            />
                                            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                            {showIdentityDropdown && filteredIdentityNumbers.length > 0 && (
                                                <div className="absolute z-50 w-full mt-1 bg-white/95 backdrop-blur-sm border border-gray-200/50 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                                    {filteredIdentityNumbers.map((user) => (
                                                        <div 
                                                            key={user.id} 
                                                            onClick={() => { 
                                                                setIdentitySearchTerm(user.identity_number); 
                                                                form.setValue('identity_number', user.identity_number); 
                                                                setShowIdentityDropdown(false); 
                                                            }} 
                                                            className="px-3 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100/50 last:border-b-0 transition-colors duration-150"
                                                        >
                                                            <div className="font-medium text-sm text-gray-800">{user.identity_number}</div>
                                                            <div className="text-xs text-gray-600">{user.full_name}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        {form.formState.errors.identity_number && (
                                            <p className="mt-1 text-xs text-red-600 font-medium">
                                                {form.formState.errors.identity_number.message}
                                            </p>
                                        )}
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name *</label>
                                        <input 
                                            {...form.register('full_name')} 
                                            type="text" 
                                            placeholder="Enter your full name" 
                                            className="w-full px-3 py-3 bg-white/50 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200 text-sm" 
                                        />
                                        {form.formState.errors.full_name && (
                                            <p className="mt-1 text-xs text-red-600 font-medium">
                                                {form.formState.errors.full_name.message}
                                            </p>
                                        )}
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Study Program *</label>
                                        <div className="relative">
                                            <input 
                                                type="text" 
                                                placeholder="Search and select your study program" 
                                                value={studyProgramSearchTerm} 
                                                onChange={(e) => { 
                                                    setStudyProgramSearchTerm(e.target.value); 
                                                    setShowStudyProgramDropdown(true); 
                                                }} 
                                                onFocus={() => setShowStudyProgramDropdown(true)}
                                                onBlur={() => setTimeout(() => setShowStudyProgramDropdown(false), 200)}
                                                className="w-full px-3 py-3 pr-10 bg-white/50 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200 text-sm" 
                                            />
                                            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                            {showStudyProgramDropdown && (
                                                <div className="absolute z-50 w-full mt-1 bg-white/95 backdrop-blur-sm border border-gray-200/50 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                                    {studyPrograms.filter(p => p.name.toLowerCase().includes(studyProgramSearchTerm.toLowerCase())).map((program) => (
                                                        <div 
                                                            key={program.id} 
                                                            onClick={() => { 
                                                                const displayText = `${program.name} (${program.code}) - ${program.department?.name}`; 
                                                                setStudyProgramSearchTerm(displayText); 
                                                                form.setValue('study_program_id', program.id); 
                                                                setShowStudyProgramDropdown(false); 
                                                            }} 
                                                            className="px-3 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100/50 last:border-b-0 transition-colors duration-150"
                                                        >
                                                            <div className="font-medium text-sm text-gray-800">{program.name} ({program.code})</div>
                                                            <div className="text-xs text-gray-600">{program.department?.name}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        {form.formState.errors.study_program_id && (
                                            <p className="mt-1 text-xs text-red-600 font-medium">
                                                {form.formState.errors.study_program_id.message}
                                            </p>
                                        )}
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number *</label>
                                        <div className="relative">
                                            <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                            <input 
                                                {...form.register('phone_number')} 
                                                type="tel" 
                                                placeholder="08xxxxxxxxxx" 
                                                className="w-full pl-10 pr-3 py-3 bg-white/50 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200 text-sm" 
                                            />
                                        </div>
                                        {form.formState.errors.phone_number && (
                                            <p className="mt-1 text-xs text-red-600 font-medium">
                                                {form.formState.errors.phone_number.message}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                
                                {/* Booking Details */}
                                <div className="space-y-4">
                                    <div className="flex items-center space-x-3 pb-3 border-b border-gray-200/50">
                                        <Calendar className="h-4 w-4 text-blue-500" />
                                        <h3 className="text-base font-semibold text-gray-800">Booking Details</h3>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Start Time *</label>
                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <input 
                                                {...form.register('start_time')} 
                                                type="datetime-local" 
                                                className="flex-1 px-3 py-3 bg-white/50 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200 text-sm" 
                                            />
                                            <button 
                                                type="button" 
                                                onClick={handleNowBooking} 
                                                className="px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 font-semibold transition-all duration-200 shadow-lg hover:shadow-xl text-sm whitespace-nowrap"
                                            >
                                                NOW
                                            </button>
                                        </div>
                                        {form.formState.errors.start_time && (
                                            <p className="mt-1 text-xs text-red-600 font-medium">
                                                {form.formState.errors.start_time.message}
                                            </p>
                                        )}
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">SKS *</label>
                                            <input 
                                                {...form.register('sks', { valueAsNumber: true })} 
                                                type="number" 
                                                min="1" 
                                                max="6" 
                                                className="w-full px-3 py-3 bg-white/50 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200 text-sm" 
                                            />
                                            {form.formState.errors.sks && (
                                                <p className="mt-1 text-xs text-red-600 font-medium">
                                                    {form.formState.errors.sks.message}
                                                </p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">Class Type *</label>
                                            <select 
                                                {...form.register('class_type')} 
                                                className="w-full px-3 py-3 bg-white/50 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200 text-sm"
                                            >
                                                <option value="theory">Theory</option>
                                                <option value="practical">Practical</option>
                                            </select>
                                        </div>
                                    </div>
                                    
                                    {form.watch('start_time') && watchSks > 0 && (
                                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200/50 rounded-xl p-3">
                                            <div className="flex items-start space-x-2">
                                                <Clock className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                                                <div className="text-sm text-green-800">
                                                    <p className="font-semibold">
                                                        Duration: {watchClassType === 'theory' ? watchSks * 50 : watchSks * 170} minutes
                                                    </p>
                                                    {calculateEndTime(form.watch('start_time'), watchSks, watchClassType) && (
                                                        <p className="mt-1 text-xs">
                                                            End: {calculateEndTime(form.watch('start_time'), watchSks, watchClassType).toLocaleString('id-ID')}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                
                                {/* Equipment Section */}
                                {selectedRoom && availableEquipment.length > 0 && (
                                    <div className="space-y-4">
                                        <div className="flex items-center space-x-3 pb-3 border-b border-gray-200/50">
                                            <Zap className="h-4 w-4 text-blue-500" />
                                            <h3 className="text-base font-semibold text-gray-800">Equipment</h3>
                                        </div>
                                        <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                                            {availableEquipment.map(eq => (
                                                <label 
                                                    key={eq.id} 
                                                    className="flex items-center p-3 bg-white/50 rounded-xl cursor-pointer hover:bg-white/70 border border-gray-200/50 transition-all duration-200"
                                                >
                                                    <input 
                                                        type="checkbox" 
                                                        checked={checkedEquipment.has(eq.id)} 
                                                        disabled={eq.is_mandatory} 
                                                        onChange={(e) => { 
                                                            setCheckedEquipment(prev => { 
                                                                const newSet = new Set(prev); 
                                                                if (e.target.checked) { 
                                                                    newSet.add(eq.id); 
                                                                } else { 
                                                                    newSet.delete(eq.id); 
                                                                } 
                                                                return newSet; 
                                                            }) 
                                                        }} 
                                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed" 
                                                    />
                                                    <span className={`ml-3 text-sm font-medium ${eq.is_mandatory ? 'text-gray-900' : 'text-gray-700'}`}>
                                                        {eq.name}
                                                    </span>
                                                    {eq.is_mandatory && (
                                                        <span className="ml-2 px-2 py-1 text-xs font-bold text-blue-600 bg-blue-100 rounded-full">
                                                            Required
                                                        </span>
                                                    )}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                
                                <div className="pt-4 border-t border-gray-200/50">
                                    <button 
                                        type="submit" 
                                        disabled={!selectedRoom || loading} 
                                        className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-indigo-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl disabled:hover:shadow-lg text-sm"
                                    >
                                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                        <span>{loading ? 'Submitting...' : 'Submit Booking'}</span>
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* Room Selection */}
                    <div>
                        {/* Search and Filter Controls */}
                        <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-4 sm:p-6 mb-6">
                            <div className="flex flex-col gap-4">
                                <div className="flex-1 relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input 
                                        type="text" 
                                        placeholder="Search rooms by name or code..." 
                                        value={searchTerm} 
                                        onChange={(e) => setSearchTerm(e.target.value)} 
                                        className="w-full pl-10 pr-4 py-3 bg-white/50 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200 placeholder-gray-400 text-sm" 
                                    />
                                </div>
                                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
                                    <div className="flex bg-white/50 border border-gray-200/50 rounded-xl overflow-hidden shadow-sm">
                                        <button 
                                            onClick={() => setViewMode('grid')} 
                                            className={`p-2 sm:p-3 transition-all duration-200 ${viewMode === 'grid' ? 'bg-blue-500 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100/50'}`}
                                        >
                                            <Grid className="h-4 w-4 sm:h-5 sm:w-5" />
                                        </button>
                                        <button 
                                            onClick={() => setViewMode('list')} 
                                            className={`p-2 sm:p-3 transition-all duration-200 ${viewMode === 'list' ? 'bg-blue-500 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100/50'}`}
                                        >
                                            <List className="h-4 w-4 sm:h-5 sm:w-5" />
                                        </button>
                                    </div>
                                    <div className="flex items-center space-x-3">
                                        <input 
                                            id="show-in-use" 
                                            type="checkbox" 
                                            checked={showInUse} 
                                            onChange={(e) => setShowInUse(e.target.checked)} 
                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded transition-all duration-200" 
                                        />
                                        <label htmlFor="show-in-use" className="text-sm font-medium text-gray-700">
                                            Show rooms in use
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Rooms Grid/List */}
                        <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-4 sm:p-6">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
                                <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Available Rooms</h2>
                                <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                                    {filteredRooms.length} rooms
                                </div>
                            </div>
                            
                            {viewMode === 'grid' ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {filteredRooms.map((room) => (
                                        <div 
                                            key={room.id} 
                                            onClick={() => { 
                                                setSelectedRoom(room); 
                                                form.setValue('room_id', room.id); 
                                            }} 
                                            className={`group relative p-4 sm:p-6 rounded-xl cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-[1.02] ${
                                                selectedRoom?.id === room.id 
                                                    ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg' 
                                                    : 'bg-white/80 hover:bg-white border border-gray-200/50'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="min-w-0 flex-1">
                                                    <h3 className={`font-bold text-base sm:text-lg truncate ${selectedRoom?.id === room.id ? 'text-white' : 'text-gray-800'}`}>
                                                        {room.name}
                                                    </h3>
                                                    <p className={`text-sm ${selectedRoom?.id === room.id ? 'text-blue-100' : 'text-gray-500'}`}>
                                                        {room.code}
                                                    </p>
                                                </div>
                                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold transition-all duration-200 whitespace-nowrap ml-2 ${
                                                    selectedRoom?.id === room.id 
                                                        ? 'bg-white/20 text-white' 
                                                        : getStatusColor(room.status)
                                                }`}>
                                                    {room.status}
                                                </span>
                                            </div>
                                            
                                            <div className="space-y-2 sm:space-y-3">
                                                <div className="flex items-center space-x-2">
                                                    <Users className={`h-4 w-4 flex-shrink-0 ${selectedRoom?.id === room.id ? 'text-blue-100' : 'text-gray-400'}`} />
                                                    <span className={`text-sm ${selectedRoom?.id === room.id ? 'text-blue-100' : 'text-gray-600'}`}>
                                                        {room.capacity} seats
                                                    </span>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <MapPin className={`h-4 w-4 flex-shrink-0 ${selectedRoom?.id === room.id ? 'text-blue-100' : 'text-gray-400'}`} />
                                                    <span className={`text-sm truncate ${selectedRoom?.id === room.id ? 'text-blue-100' : 'text-gray-600'}`}>
                                                        {room.department?.name || 'General'}
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            {room.status === 'Scheduled' && (
                                                <button 
                                                    title="View Schedule" 
                                                    onClick={(e) => { 
                                                        e.stopPropagation(); 
                                                        setViewingSchedulesFor(room); 
                                                    }} 
                                                    className={`absolute bottom-3 right-3 p-2 rounded-full transition-all duration-200 ${
                                                        selectedRoom?.id === room.id 
                                                            ? 'bg-white/20 text-white hover:bg-white/30' 
                                                            : 'bg-gray-100 text-gray-400 hover:bg-blue-500 hover:text-white'
                                                    } opacity-0 group-hover:opacity-100`}
                                                >
                                                    <Eye className="h-4 w-4"/>
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {filteredRooms.map((room) => (
                                        <div 
                                            key={room.id} 
                                            onClick={() => { 
                                                setSelectedRoom(room); 
                                                form.setValue('room_id', room.id); 
                                            }} 
                                            className={`group p-4 sm:p-5 rounded-xl cursor-pointer transition-all duration-300 hover:shadow-lg flex items-center justify-between ${
                                                selectedRoom?.id === room.id 
                                                    ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg' 
                                                    : 'bg-white/80 hover:bg-white border border-gray-200/50'
                                            }`}
                                        >
                                            <div className="flex items-center space-x-4 min-w-0 flex-1">
                                                <div className="min-w-0 flex-1">
                                                    <h3 className={`font-bold text-sm sm:text-base truncate ${selectedRoom?.id === room.id ? 'text-white' : 'text-gray-800'}`}>
                                                        {room.name}
                                                    </h3>
                                                    <p className={`text-xs sm:text-sm truncate ${selectedRoom?.id === room.id ? 'text-blue-100' : 'text-gray-500'}`}>
                                                        {room.code} • {room.department?.name || 'General'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-3 sm:space-x-4 flex-shrink-0">
                                                <div className="hidden sm:flex items-center space-x-2">
                                                    <Users className={`h-4 w-4 ${selectedRoom?.id === room.id ? 'text-blue-100' : 'text-gray-400'}`} />
                                                    <span className={`text-sm ${selectedRoom?.id === room.id ? 'text-blue-100' : 'text-gray-600'}`}>
                                                        {room.capacity}
                                                    </span>
                                                </div>
                                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap ${
                                                    selectedRoom?.id === room.id 
                                                        ? 'bg-white/20 text-white' 
                                                        : getStatusColor(room.status)
                                                }`}>
                                                    {room.status}
                                                </span>
                                                {room.status === 'Scheduled' && (
                                                    <button 
                                                        title="View Schedule" 
                                                        onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            setViewingSchedulesFor(room); 
                                                        }} 
                                                        className={`p-2 rounded-full transition-all duration-200 ${
                                                            selectedRoom?.id === room.id 
                                                                ? 'bg-white/20 text-white hover:bg-white/30' 
                                                                : 'bg-gray-100 text-gray-400 hover:bg-blue-500 hover:text-white'
                                                        }`}
                                                    >
                                                        <Eye className="h-4 w-4"/>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            
                            {filteredRooms.length === 0 && !loading && (
                                <div className="text-center py-12">
                                    <div className="p-4 bg-gray-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                                        <Building className="h-8 w-8 text-gray-400" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-800 mb-2">No Rooms Available</h3>
                                    <p className="text-gray-500 text-sm">Try adjusting your search or showing rooms in use.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Desktop Booking Form */}
                    <div className="hidden lg:block lg:fixed lg:top-24 lg:right-8 lg:w-80 xl:w-96 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
                        <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6">
                            <div className="flex items-center space-x-3 mb-8">
                                <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg">
                                    <Calendar className="h-5 w-5 text-white" />
                                </div>
                                <h2 className="text-xl font-bold text-gray-800">Book Your Room</h2>
                            </div>
                            
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                {/* Personal Information Section */}
                                <div className="space-y-4">
                                    <div className="flex items-center space-x-3 pb-3 border-b border-gray-200/50">
                                        <User className="h-4 w-4 text-blue-500" />
                                        <h3 className="text-base font-semibold text-gray-800">Personal Information</h3>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Identity Number (NIM/NIP) *
                                        </label>
                                        <div className="relative">
                                            <input 
                                                {...form.register('identity_number')} 
                                                type="text" 
                                                placeholder="Enter or select your ID" 
                                                value={identitySearchTerm} 
                                                onChange={(e) => { 
                                                    setIdentitySearchTerm(e.target.value); 
                                                    form.setValue('identity_number', e.target.value); 
                                                    setShowIdentityDropdown(true); 
                                                }} 
                                                onFocus={() => setShowIdentityDropdown(true)}
                                                onBlur={() => setTimeout(() => setShowIdentityDropdown(false), 200)}
                                                className="w-full px-3 py-3 pr-10 bg-white/50 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200 text-sm" 
                                            />
                                            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                            {showIdentityDropdown && filteredIdentityNumbers.length > 0 && (
                                                <div className="absolute z-50 w-full mt-1 bg-white/95 backdrop-blur-sm border border-gray-200/50 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                                    {filteredIdentityNumbers.map((user) => (
                                                        <div 
                                                            key={user.id} 
                                                            onClick={() => { 
                                                                setIdentitySearchTerm(user.identity_number); 
                                                                form.setValue('identity_number', user.identity_number); 
                                                                setShowIdentityDropdown(false); 
                                                            }} 
                                                            className="px-3 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100/50 last:border-b-0 transition-colors duration-150"
                                                        >
                                                            <div className="font-medium text-sm text-gray-800">{user.identity_number}</div>
                                                            <div className="text-xs text-gray-600">{user.full_name}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        {form.formState.errors.identity_number && (
                                            <p className="mt-1 text-xs text-red-600 font-medium">
                                                {form.formState.errors.identity_number.message}
                                            </p>
                                        )}
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name *</label>
                                        <input 
                                            {...form.register('full_name')} 
                                            type="text" 
                                            placeholder="Enter your full name" 
                                            className="w-full px-3 py-3 bg-white/50 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200 text-sm" 
                                        />
                                        {form.formState.errors.full_name && (
                                            <p className="mt-1 text-xs text-red-600 font-medium">
                                                {form.formState.errors.full_name.message}
                                            </p>
                                        )}
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Study Program *</label>
                                        <div className="relative">
                                            <input 
                                                type="text" 
                                                placeholder="Search and select your study program" 
                                                value={studyProgramSearchTerm} 
                                                onChange={(e) => { 
                                                    setStudyProgramSearchTerm(e.target.value); 
                                                    setShowStudyProgramDropdown(true); 
                                                }} 
                                                onFocus={() => setShowStudyProgramDropdown(true)}
                                                onBlur={() => setTimeout(() => setShowStudyProgramDropdown(false), 200)}
                                                className="w-full px-3 py-3 pr-10 bg-white/50 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200 text-sm" 
                                            />
                                            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                            {showStudyProgramDropdown && (
                                                <div className="absolute z-50 w-full mt-1 bg-white/95 backdrop-blur-sm border border-gray-200/50 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                                    {studyPrograms.filter(p => p.name.toLowerCase().includes(studyProgramSearchTerm.toLowerCase())).map((program) => (
                                                        <div 
                                                            key={program.id} 
                                                            onClick={() => { 
                                                                const displayText = `${program.name} (${program.code}) - ${program.department?.name}`; 
                                                                setStudyProgramSearchTerm(displayText); 
                                                                form.setValue('study_program_id', program.id); 
                                                                setShowStudyProgramDropdown(false); 
                                                            }} 
                                                            className="px-3 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100/50 last:border-b-0 transition-colors duration-150"
                                                        >
                                                            <div className="font-medium text-sm text-gray-800">{program.name} ({program.code})</div>
                                                            <div className="text-xs text-gray-600">{program.department?.name}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        {form.formState.errors.study_program_id && (
                                            <p className="mt-1 text-xs text-red-600 font-medium">
                                                {form.formState.errors.study_program_id.message}
                                            </p>
                                        )}
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number *</label>
                                        <div className="relative">
                                            <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                            <input 
                                                {...form.register('phone_number')} 
                                                type="tel" 
                                                placeholder="08xxxxxxxxxx" 
                                                className="w-full pl-10 pr-3 py-3 bg-white/50 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200 text-sm" 
                                            />
                                        </div>
                                        {form.formState.errors.phone_number && (
                                            <p className="mt-1 text-xs text-red-600 font-medium">
                                                {form.formState.errors.phone_number.message}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                
                                {/* Booking Details */}
                                <div className="space-y-4">
                                    <div className="flex items-center space-x-3 pb-3 border-b border-gray-200/50">
                                        <Calendar className="h-4 w-4 text-blue-500" />
                                        <h3 className="text-base font-semibold text-gray-800">Booking Details</h3>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Start Time *</label>
                                        <div className="flex gap-2">
                                            <input 
                                                {...form.register('start_time')} 
                                                type="datetime-local" 
                                                className="flex-1 px-3 py-3 bg-white/50 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200 text-sm" 
                                            />
                                            <button 
                                                type="button" 
                                                onClick={handleNowBooking} 
                                                className="px-3 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 font-semibold transition-all duration-200 shadow-lg hover:shadow-xl text-sm whitespace-nowrap"
                                            >
                                                NOW
                                            </button>
                                        </div>
                                        {form.formState.errors.start_time && (
                                            <p className="mt-1 text-xs text-red-600 font-medium">
                                                {form.formState.errors.start_time.message}
                                            </p>
                                        )}
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">SKS *</label>
                                            <input 
                                                {...form.register('sks', { valueAsNumber: true })} 
                                                type="number" 
                                                min="1" 
                                                max="6" 
                                                className="w-full px-3 py-3 bg-white/50 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200 text-sm" 
                                            />
                                            {form.formState.errors.sks && (
                                                <p className="mt-1 text-xs text-red-600 font-medium">
                                                    {form.formState.errors.sks.message}
                                                </p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">Class Type *</label>
                                            <select 
                                                {...form.register('class_type')} 
                                                className="w-full px-3 py-3 bg-white/50 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200 text-sm"
                                            >
                                                <option value="theory">Theory</option>
                                                <option value="practical">Practical</option>
                                            </select>
                                        </div>
                                    </div>
                                    
                                    {form.watch('start_time') && watchSks > 0 && (
                                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200/50 rounded-xl p-3">
                                            <div className="flex items-start space-x-2">
                                                <Clock className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                                                <div className="text-sm text-green-800">
                                                    <p className="font-semibold">
                                                        Duration: {watchClassType === 'theory' ? watchSks * 50 : watchSks * 170} minutes
                                                    </p>
                                                    {calculateEndTime(form.watch('start_time'), watchSks, watchClassType) && (
                                                        <p className="mt-1 text-xs">
                                                            End: {calculateEndTime(form.watch('start_time'), watchSks, watchClassType).toLocaleString('id-ID')}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                
                                {/* Equipment Section */}
                                {selectedRoom && availableEquipment.length > 0 && (
                                    <div className="space-y-4">
                                        <div className="flex items-center space-x-3 pb-3 border-b border-gray-200/50">
                                            <Zap className="h-4 w-4 text-blue-500" />
                                            <h3 className="text-base font-semibold text-gray-800">Equipment</h3>
                                        </div>
                                        <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                                            {availableEquipment.map(eq => (
                                                <label 
                                                    key={eq.id} 
                                                    className="flex items-center p-3 bg-white/50 rounded-xl cursor-pointer hover:bg-white/70 border border-gray-200/50 transition-all duration-200"
                                                >
                                                    <input 
                                                        type="checkbox" 
                                                        checked={checkedEquipment.has(eq.id)} 
                                                        disabled={eq.is_mandatory} 
                                                        onChange={(e) => { 
                                                            setCheckedEquipment(prev => { 
                                                                const newSet = new Set(prev); 
                                                                if (e.target.checked) { 
                                                                    newSet.add(eq.id); 
                                                                } else { 
                                                                    newSet.delete(eq.id); 
                                                                } 
                                                                return newSet; 
                                                            }) 
                                                        }} 
                                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed" 
                                                    />
                                                    <span className={`ml-3 text-sm font-medium ${eq.is_mandatory ? 'text-gray-900' : 'text-gray-700'}`}>
                                                        {eq.name}
                                                    </span>
                                                    {eq.is_mandatory && (
                                                        <span className="ml-2 px-2 py-1 text-xs font-bold text-blue-600 bg-blue-100 rounded-full">
                                                            Required
                                                        </span>
                                                    )}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                
                                <div className="pt-4 border-t border-gray-200/50">
                                    <button 
                                        type="submit" 
                                        disabled={!selectedRoom || loading} 
                                        className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-indigo-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl disabled:hover:shadow-lg text-sm"
                                    >
                                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                        <span>{loading ? 'Submitting...' : 'Submit Booking'}</span>
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>

            {/* Schedule Modal */}
            {viewingSchedulesFor && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col border border-white/20">
                        <div className="p-4 sm:p-6 border-b border-gray-200/50 flex justify-between items-center">
                            <div>
                                <h3 className="text-lg sm:text-xl font-bold text-gray-800">Today's Schedule</h3>
                                <p className="text-sm text-gray-600 mt-1">{viewingSchedulesFor.name}</p>
                            </div>
                            <button 
                                onClick={() => setViewingSchedulesFor(null)} 
                                className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-all duration-200"
                            >
                                <X className="h-5 w-5"/>
                            </button>
                        </div>
                        <div className="p-4 sm:p-6 overflow-y-auto">
                            {loadingSchedules ? (
                                <div className="flex justify-center items-center h-24">
                                    <Loader2 className="animate-spin h-6 w-6 text-gray-500"/>
                                </div>
                            ) : schedulesForModal.length > 0 ? (
                                <div className="space-y-4">
                                    {schedulesForModal.map((schedule, index) => (
                                        <div key={index} className="p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border border-gray-200/50">
                                            <p className="font-bold text-gray-800 mb-2">Sample Course {index + 1}</p>
                                            <div className="flex items-center space-x-2 text-sm text-gray-600 mb-1">
                                                <Clock className="h-4 w-4"/>
                                                <span>08:00 - 10:00</span>
                                            </div>
                                            <p className="text-xs text-gray-500">Study Program: Computer Science</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <div className="p-3 bg-gray-100 rounded-full w-12 h-12 mx-auto mb-3 flex items-center justify-center">
                                        <Calendar className="h-6 w-6 text-gray-400" />
                                    </div>
                                    <p className="text-sm text-gray-500">No schedule found for this room today.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BookRoom;