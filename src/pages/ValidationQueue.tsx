import React, { useState, useEffect, useMemo, useCallback } from 'react';

import { useForm } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';

import { z } from 'zod';

import {

  Calendar, Clock, Users, MapPin, Zap, CheckCircle, AlertCircle, Search, Grid, List, X, Send, RefreshCw, ChevronDown, Monitor, Wifi, Phone, User

} from 'lucide-react';

import { supabase } from '../lib/supabase';

import { useAuth } from '../hooks/useAuth';

import { Room, Department, StudyProgram, Equipment, LectureSchedule } from '../types';

import toast from 'react-hot-toast';

import { format, addMinutes, parse } from 'date-fns';

import { id as localeID } from 'date-fns/locale';



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



interface RoomWithDetails extends Room {

  department: Department | null;

  status: 'In Use' | 'Scheduled' | 'Available' | 'Loading';

}



interface StudyProgramWithDepartment extends StudyProgram {

  department?: Department;

}



interface ExistingUser {

  id: string;

  identity_number: string;

  full_name: string;

  email: string;

  phone_number?: string;

  study_program_id?: string;

  study_program?: StudyProgram & { department?: Department };

}



const BookRoom: React.FC = () => {

  const { profile } = useAuth();

  const [rooms, setRooms] = useState<RoomWithDetails[]>([]);

  const [studyPrograms, setStudyPrograms] = useState<StudyProgramWithDepartment[]>([]);

  const [equipment, setEquipment] = useState<Equipment[]>([]);

  const [existingUsers, setExistingUsers] = useState<ExistingUser[]>([]);

  const [loading, setLoading] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [searchTerm, setSearchTerm] = useState('');

  const [filterCapacity, setFilterCapacity] = useState<number | null>(null);

  const [selectedRoom, setSelectedRoom] = useState<RoomWithDetails | null>(null);

  const [currentTime, setCurrentTime] = useState(new Date());

  const [showIdentityDropdown, setShowIdentityDropdown] = useState(false);

  const [identitySearchTerm, setIdentitySearchTerm] = useState('');

  const [showStudyProgramDropdown, setShowStudyProgramDropdown] = useState(false);

  const [studyProgramSearchTerm, setStudyProgramSearchTerm] = useState('');

  const [showAllRooms, setShowAllRooms] = useState(false);



  const form = useForm<BookingForm>({

    resolver: zodResolver(bookingSchema),

    defaultValues: { class_type: 'theory', sks: 2, equipment_requested: [], },

  });



  const watchSks = form.watch('sks');

  const watchClassType = form.watch('class_type');

  const watchIdentityNumber = form.watch('identity_number');

  const watchStudyProgramId = form.watch('study_program_id');



  const normalizeRoomName = (name: string): string => name ? name.toLowerCase().replace(/[\s.&-]/g, '') : '';



  const updateRoomStatuses = useCallback(async (isInitialLoad = false) => {

    if (isInitialLoad) setLoading(true);

    try {

      const now = new Date();

      const todayDayName = format(now, 'EEEE', { locale: localeID });

      const { data: roomsData, error: roomsError } = await supabase.from('rooms').select(`*, department:departments(*)`);

      if (roomsError) throw roomsError;

      const { data: schedulesData, error: schedulesError } = await supabase.from('lecture_schedules').select('room, start_time, end_time, day').eq('day', todayDayName);

      if (schedulesError) throw schedulesError;

      const scheduleMap = new Map<string, LectureSchedule[]>();

      schedulesData.forEach(schedule => {

        if (schedule.room) {

          const normalizedName = normalizeRoomName(schedule.room);

          if (!scheduleMap.has(normalizedName)) scheduleMap.set(normalizedName, []);

          scheduleMap.get(normalizedName)?.push(schedule);

        }

      });

      const roomsWithStatus = roomsData.map(room => {

        const normalizedRoomName = normalizeRoomName(room.name);

        const roomSchedules = scheduleMap.get(normalizedRoomName) || [];

        let status: RoomWithDetails['status'] = 'Available';

        if (roomSchedules.length > 0) {

          const isCurrentlyInUse = roomSchedules.some(schedule => {

            if (!schedule.start_time || !schedule.end_time) return false;

            try {

              const startTime = parse(schedule.start_time, 'HH:mm:ss', new Date());

              const endTime = parse(schedule.end_time, 'HH:mm:ss', new Date());

              return now >= startTime && now <= endTime;

            } catch (e) { return false; }

          });

          status = isCurrentlyInUse ? 'In Use' : 'Scheduled';

        }

        return { ...room, department: room.department, status };

      });

      setRooms(roomsWithStatus as RoomWithDetails[]);

    } catch (error) {

      console.error('Error fetching room statuses:', error);

      toast.error('Failed to load room statuses.');

    } finally {

      if (isInitialLoad) setLoading(false);

    }

  }, []);



  const fetchStudyPrograms = async () => { try { const { data, error } = await supabase.from('study_programs').select(`*, department:departments(*)`).order('name'); if (error) throw error; setStudyPrograms(data || []); } catch (error: any) { console.error('Error fetching study programs:', error); toast.error('Failed to load study programs'); } };

  const fetchEquipment = async () => { try { const { data, error } = await supabase.from('equipment').select('*').eq('is_available', true); if (error) throw error; setEquipment(data || []); } catch (error: any) { console.error('Error fetching equipment:', error); toast.error('Failed to load equipment'); } };

  const fetchExistingUsers = async () => { try { const { data, error } = await supabase.from('users').select(`id, identity_number, full_name, email, phone_number, study_program_id, study_program:study_programs(*, department:departments(*))`).eq('role', 'student').order('full_name'); if (error) throw error; const usersWithPrograms = (data || []).map(user => ({...user, study_program: user.study_program})); setExistingUsers(usersWithPrograms); } catch (error) { console.error('Error fetching users:', error); } };

  

  useEffect(() => {

    updateRoomStatuses(true);

    fetchStudyPrograms();

    fetchEquipment();

    fetchExistingUsers();

    const timer = setInterval(() => setCurrentTime(new Date()), 60000);

    const refreshStatusInterval = setInterval(() => updateRoomStatuses(), 5 * 60 * 1000);

    return () => { clearInterval(timer); clearInterval(refreshStatusInterval); };

  }, [updateRoomStatuses]);



  useEffect(() => { if (watchIdentityNumber && watchIdentityNumber.length >= 5) { const existingUser = existingUsers.find(user => user.identity_number === watchIdentityNumber); if (existingUser) { form.setValue('full_name', existingUser.full_name); if (existingUser.phone_number) { form.setValue('phone_number', existingUser.phone_number); } if (existingUser.study_program_id) { form.setValue('study_program_id', existingUser.study_program_id); const selectedProgram = studyPrograms.find(sp => sp.id === existingUser.study_program_id); if (selectedProgram) { setStudyProgramSearchTerm(`${selectedProgram.name} (${selectedProgram.code}) - ${selectedProgram.department?.name}`); } } toast.success('Data automatically filled!'); } } }, [watchIdentityNumber, existingUsers, form, studyPrograms]);

  useEffect(() => { if (watchStudyProgramId) { const selectedProgram = studyPrograms.find(sp => sp.id === watchStudyProgramId); if (selectedProgram) { setStudyProgramSearchTerm(`${selectedProgram.name} (${selectedProgram.code}) - ${selectedProgram.department?.name}`); } } }, [watchStudyProgramId, studyPrograms]);



  const handleNowBooking = () => { const now = new Date(); const formattedNow = format(now, "yyyy-MM-dd'T'HH:mm"); form.setValue('start_time', formattedNow); };

  const calculateEndTime = (startTime: string, sks: number, classType: string) => { if (!startTime || !sks) return null; const duration = classType === 'theory' ? sks * 50 : sks * 170; const startDate = new Date(startTime); return addMinutes(startDate, duration); };

  

  const filteredRooms = useMemo(() => {

    return rooms.filter(room => {

      const matchesSearch = room.name.toLowerCase().includes(searchTerm.toLowerCase()) || room.code.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCapacity = !filterCapacity || room.capacity >= filterCapacity;

      const matchesAvailability = showAllRooms || room.status === 'Available' || room.status === 'Scheduled';

      return matchesSearch && matchesCapacity && matchesAvailability;

    });

  }, [rooms, searchTerm, filterCapacity, showAllRooms]);

  

  // --- FUNGSI HELPER YANG BENAR ---

  const getStatusColorAndIcon = (status: RoomWithDetails['status']) => {

    switch (status) {

      case 'In Use': return { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-500', icon: AlertCircle, iconColor: 'text-red-500' };

      case 'Scheduled': return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-500', icon: Clock, iconColor: 'text-yellow-600' };

      case 'Available': return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-500', icon: CheckCircle, iconColor: 'text-green-500' };

      default: return { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300', icon: AlertCircle, iconColor: 'text-gray-500' };

    }

  };



  const getEquipmentIcon = (category: string) => {

    switch (category?.toLowerCase()) {

      case 'audio visual': return Monitor;

      case 'connectivity': return Wifi;

      case 'power': return Zap;

      default: return Zap;

    }

  };



  const filteredIdentityNumbers = existingUsers.filter(user => user.identity_number.toLowerCase().includes(identitySearchTerm.toLowerCase()) || user.full_name.toLowerCase().includes(identitySearchTerm.toLowerCase()));

  const filteredStudyPrograms = studyPrograms.filter(program => program.name.toLowerCase().includes(studyProgramSearchTerm.toLowerCase()) || program.code.toLowerCase().includes(studyProgramSearchTerm.toLowerCase()) || program.department?.name.toLowerCase().includes(studyProgramSearchTerm.toLowerCase()));

  

  const onSubmit = async (data: BookingForm) => {

    if (!selectedRoom) { toast.error('Please select a room'); return; }

    setIsSubmitting(true);

    try {

      const duration = data.class_type === 'theory' ? data.sks * 50 : data.sks * 170;

      const startDate = new Date(data.start_time);

      const endDate = addMinutes(startDate, duration);

      const { data: existingBookings, error: conflictError } = await supabase.from('bookings').select('*').eq('room_id', data.room_id).eq('status', 'approved');

      if (conflictError) throw conflictError;

      if (existingBookings && existingBookings.length > 0) {

        for (const booking of existingBookings) {

          const { error: updateError } = await supabase.from('bookings').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', booking.id);

          if (updateError) console.error('Error updating existing booking:', updateError);

        }

      }

      const selectedStudyProgram = studyPrograms.find(sp => sp.id === data.study_program_id);

      const departmentId = selectedStudyProgram?.department_id;

      const bookingData = {

        room_id: data.room_id, start_time: data.start_time, end_time: endDate.toISOString(), sks: data.sks,

        class_type: data.class_type, equipment_requested: data.equipment_requested || [], notes: data.notes || null, status: 'pending',

        purpose: 'Class/Study Session',

        user_info: profile ? null : { full_name: data.full_name, identity_number: data.identity_number, study_program_id: data.study_program_id, phone_number: data.phone_number, email: `${data.identity_number}@student.edu`, department_id: departmentId },

        user_id: profile?.id || null,

      };

      const { error } = await supabase.from('bookings').insert(bookingData);

      if (error) throw error;

      toast.success('Room booking submitted successfully! Awaiting approval.');

      form.reset({ class_type: 'theory', sks: 2, equipment_requested: [] });

      setSelectedRoom(null); setIdentitySearchTerm(''); setStudyProgramSearchTerm('');

      updateRoomStatuses();

    } catch (error: any) {

      console.error('Error creating booking:', error);

      toast.error(error.message || 'Failed to create booking');

    } finally {

      setIsSubmitting(false);

    }

  };



  const mandatoryEquipment = equipment.filter(eq => eq.is_mandatory);

  const optionalEquipment = equipment.filter(eq => !eq.is_mandatory);



  return (

    <div className="max-w-7xl mx-auto space-y-6 p-4">

      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white"> <div className="flex items-center justify-between"> <div> <h1 className="text-3xl font-bold flex items-center space-x-3"> <Calendar className="h-8 w-8" /> <span>Book a Room</span> </h1> <p className="mt-2 opacity-90"> Reserve a room for your lecture, meeting, or study session </p> </div> <div className="hidden md:block text-right"> <div className="text-2xl font-bold">{format(currentTime, 'HH:mm')}</div> <div className="text-sm opacity-80">{format(currentTime, 'EEEE, MMMM d')}</div> </div> </div> </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <div className="lg:col-span-2 space-y-6">

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">

            <div className="flex flex-col sm:flex-row gap-4">

              <div className="flex-1 relative"> <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" /> <input type="text" placeholder="Search rooms by name or code..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg"/> </div>

              <div className="flex items-center space-x-2">

                <select value={filterCapacity || ''} onChange={(e) => setFilterCapacity(e.target.value ? Number(e.target.value) : null)} className="px-4 py-3 border border-gray-300 rounded-lg"> <option value="">All Capacities</option> <option value="20">20+ seats</option> <option value="40">40+ seats</option> <option value="60">60+ seats</option> <option value="100">100+ seats</option> </select>

                <div className="flex border border-gray-300 rounded-lg overflow-hidden"> <button onClick={() => setViewMode('grid')} className={`p-3 ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600'}`}><Grid className="h-5 w-5" /></button> <button onClick={() => setViewMode('list')} className={`p-3 ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600'}`}><List className="h-5 w-5" /></button> </div>

              </div>

            </div>

            <div className="mt-4 flex items-center">

              <div className="flex items-center">

                <input id="show-all-rooms" type="checkbox" checked={showAllRooms} onChange={() => setShowAllRooms(!showAllRooms)} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"/>

                <label htmlFor="show-all-rooms" className="ml-2 block text-sm text-gray-900">Show all rooms (including in use)</label>

              </div>

            </div>

          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">

            <h2 className="text-xl font-semibold text-gray-900 mb-4">Rooms</h2>

            {loading ? <div className="text-center py-8"><RefreshCw className="h-8 w-8 animate-spin text-gray-400 mx-auto"/></div>

            : viewMode === 'grid' ? (

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {filteredRooms.map((room) => {

                  const statusInfo = getStatusColorAndIcon(room.status);

                  return (

                    <div key={room.id} onClick={() => { setSelectedRoom(room); form.setValue('room_id', room.id); }} className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${selectedRoom?.id === room.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>

                      <div className="flex items-start justify-between mb-3">

                        <div><h3 className="font-semibold text-gray-900">{room.name}</h3><p className="text-sm text-gray-600">{room.code}</p></div>

                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.text}`}>{room.status}</span>

                      </div>

                      <div className="flex items-center space-x-2 mb-3"> <Users className="h-4 w-4 text-gray-400" /> <span className="text-sm text-gray-600">{room.capacity} seats</span> </div>

                      <div className="flex items-center space-x-2"> <MapPin className="h-4 w-4 text-gray-400" /> <span className="text-sm text-gray-600">{room.department?.name || 'General'}</span> </div>

                    </div>

                  );

                })}

              </div>

            ) : ( <div className="space-y-3"></div> )}

            {!loading && filteredRooms.length === 0 && (<div className="text-center py-8"><AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" /><h3 className="text-lg font-medium text-gray-900 mb-1">No Rooms Available</h3><p className="text-gray-500">Try adjusting your filters or check "Show all rooms".</p></div>)}

          </div>

        </div>

        {/* Booking Form */}



        <div className="space-y-6">



          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">



            <h2 className="text-xl font-semibold text-gray-900 mb-6">Booking Details</h2>







            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">



              {/* User Information */}



              {!profile && (



                <div className="space-y-4">



                  <h3 className="text-lg font-medium text-gray-900 flex items-center space-x-2">



                    <User className="h-5 w-5" />



                    <span>Personal Information</span>



                  </h3>



                  



                  {/* Identity Number Dropdown */}



                  <div>



                    <label className="block text-sm font-medium text-gray-700 mb-2">



                      Identity Number (NIM/NIP) *



                    </label>



                    <div className="relative">



                      <input



                        {...form.register('identity_number')}



                        type="text"



                        placeholder="Enter or select your student/staff ID"



                        value={identitySearchTerm}



                        onChange={(e) => {



                          setIdentitySearchTerm(e.target.value);



                          form.setValue('identity_number', e.target.value);



                          setShowIdentityDropdown(true);



                        }}



                        onFocus={() => setShowIdentityDropdown(true)}



                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"



                      />



                      <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />



                      



                      {showIdentityDropdown && filteredIdentityNumbers.length > 0 && (



                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">



                          {filteredIdentityNumbers.map((user) => (



                            <div



                              key={user.id}



                              onClick={() => {



                                setIdentitySearchTerm(user.identity_number);



                                form.setValue('identity_number', user.identity_number);



                                setShowIdentityDropdown(false);



                              }}



                              className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"



                            >



                              <div className="font-medium text-gray-900">{user.identity_number}</div>



                              <div className="text-sm text-gray-600">{user.full_name}</div>



                              {user.study_program && (



                                <div className="text-xs text-gray-500">{user.study_program.name}</div>



                              )}



                            </div>



                          ))}



                        </div>



                      )}



                    </div>



                    {form.formState.errors.identity_number && (



                      <p className="mt-1 text-sm text-red-600">



                        {form.formState.errors.identity_number.message}



                      </p>



                    )}



                  </div>







                  <div>



                    <label className="block text-sm font-medium text-gray-700 mb-2">



                      Full Name *



                    </label>



                    <input



                      {...form.register('full_name')}



                      type="text"



                      placeholder="Enter your full name"



                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"



                    />



                    {form.formState.errors.full_name && (



                      <p className="mt-1 text-sm text-red-600">



                        {form.formState.errors.full_name.message}



                      </p>



                    )}



                  </div>







                  {/* Study Program Dropdown */}



                  <div>



                    <label className="block text-sm font-medium text-gray-700 mb-2">



                      Study Program *



                    </label>



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



                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"



                      />



                      <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />



                      



                      {showStudyProgramDropdown && (



                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">



                          {filteredStudyPrograms.map((program) => (



                            <div



                              key={program.id}



                              onClick={() => {



                                const displayText = `${program.name} (${program.code}) - ${program.department?.name}`;



                                setStudyProgramSearchTerm(displayText);



                                form.setValue('study_program_id', program.id);



                                setShowStudyProgramDropdown(false);



                              }}



                              className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"



                            >



                              <div className="font-medium text-gray-900">{program.name} ({program.code})</div>



                              <div className="text-sm text-gray-600">{program.department?.name}</div>



                            </div>



                          ))}



                        </div>



                      )}



                    </div>



                    {form.formState.errors.study_program_id && (



                      <p className="mt-1 text-sm text-red-600">



                        {form.formState.errors.study_program_id.message}



                      </p>



                    )}



                  </div>







                  <div>



                    <label className="block text-sm font-medium text-gray-700 mb-2">



                      Phone Number *



                    </label>



                    <div className="relative">



                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />



                      <input



                        {...form.register('phone_number')}



                        type="tel"



                        placeholder="08xxxxxxxxxx"



                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"



                      />



                    </div>



                    {form.formState.errors.phone_number && (



                      <p className="mt-1 text-sm text-red-600">



                        {form.formState.errors.phone_number.message}



                      </p>



                    )}



                  </div>







                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">



                    <div className="flex items-start space-x-2">



                      <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />



                      <div className="text-sm text-blue-800">



                        <p className="font-medium">Physical ID Required</p>



                        <p>Please bring your physical student/staff ID when using the booked room.</p>



                      </div>



                    </div>



                  </div>



                </div>



              )}







              {/* Booking Details */}



              <div className="space-y-4">



                <h3 className="text-lg font-medium text-gray-900 flex items-center space-x-2">



                  <Calendar className="h-5 w-5" />



                  <span>Booking Details</span>



                </h3>







                <div>



                  <label className="block text-sm font-medium text-gray-700 mb-2">



                    Start Time *



                  </label>



                  <div className="flex space-x-2">



                    <input



                      {...form.register('start_time')}



                      type="datetime-local"



                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"



                    />



                    <button



                      type="button"



                      onClick={handleNowBooking}



                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium"



                    >



                      NOW



                    </button>



                  </div>



                  {form.formState.errors.start_time && (



                    <p className="mt-1 text-sm text-red-600">



                      {form.formState.errors.start_time.message}



                    </p>



                  )}



                </div>







                <div className="grid grid-cols-2 gap-4">



                  <div>



                    <label className="block text-sm font-medium text-gray-700 mb-2">



                      SKS (Credit Hours) *



                    </label>



                    <input



                      {...form.register('sks', { valueAsNumber: true })}



                      type="number"



                      min="1"



                      max="6"



                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"



                    />



                    {form.formState.errors.sks && (



                      <p className="mt-1 text-sm text-red-600">



                        {form.formState.errors.sks.message}



                      </p>



                    )}



                  </div>







                  <div>



                    <label className="block text-sm font-medium text-gray-700 mb-2">



                      Class Type *



                    </label>



                    <select



                      {...form.register('class_type')}



                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"



                    >



                      <option value="theory">Theory (50 min/SKS)</option>



                      <option value="practical">Practical (170 min/SKS)</option>



                    </select>



                  </div>



                </div>







                {/* Duration Display */}



                {form.watch('start_time') && watchSks && (



                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">



                    <div className="flex items-center space-x-2">



                      <Clock className="h-5 w-5 text-green-600" />



                      <div className="text-sm text-green-800">



                        <p className="font-medium">Calculated Duration: {watchClassType === 'theory' ? watchSks * 50 : watchSks * 170} minutes</p>



                        {calculateEndTime(form.watch('start_time'), watchSks, watchClassType) && (



                          <p>End Time: {format(calculateEndTime(form.watch('start_time'), watchSks, watchClassType)!, 'MMM d, yyyy at h:mm a')}</p>



                        )}



                      </div>



                    </div>



                  </div>



                )}



              </div>







              {/* Equipment Selection */}



              <div className="space-y-4">



                <h3 className="text-lg font-medium text-gray-900 flex items-center space-x-2">



                  <Zap className="h-5 w-5" />



                  <span>Equipment</span>



                </h3>







                {/* Mandatory Equipment */}



                {mandatoryEquipment.length > 0 && (



                  <div>



                    <h4 className="text-sm font-medium text-gray-700 mb-3">Mandatory Equipment (Auto-selected)</h4>



                    <div className="space-y-2">



                      {mandatoryEquipment.map((eq) => {



                        const IconComponent = getEquipmentIcon(eq.category);



                        return (



                          <div key={eq.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">



                            <input



                              type="checkbox"



                              checked={true}



                              disabled={true}



                              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"



                            />



                            <IconComponent className="h-5 w-5 text-gray-600" />



                            <div className="flex-1">



                              <p className="text-sm font-medium text-gray-900">{eq.name}</p>



                              <p className="text-xs text-gray-500">{eq.code} • {eq.category}</p>



                            </div>



                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">



                              Required



                            </span>



                          </div>



                        );



                      })}



                    </div>



                  </div>



                )}







                {/* Optional Equipment */}



                {optionalEquipment.length > 0 && (



                  <div>



                    <h4 className="text-sm font-medium text-gray-700 mb-3">Optional Equipment</h4>



                    <div className="space-y-2">



                      {optionalEquipment.map((eq) => {



                        const IconComponent = getEquipmentIcon(eq.category);



                        return (



                          <div key={eq.id} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50">



                            <input



                              type="checkbox"



                              value={eq.id}



                              {...form.register('equipment_requested')}



                              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"



                            />



                            <IconComponent className="h-5 w-5 text-gray-600" />



                            <div className="flex-1">



                              <p className="text-sm font-medium text-gray-900">{eq.name}</p>



                              <p className="text-xs text-gray-500">{eq.code} • {eq.category}</p>



                            </div>



                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">



                              Available



                            </span>



                          </div>



                        );



                      })}



                    </div>



                  </div>



                )}



              </div>







              {/* Notes */}



              <div>



                <label className="block text-sm font-medium text-gray-700 mb-2">



                  Additional Notes (Optional)



                </label>



                <textarea



                  {...form.register('notes')}



                  rows={3}



                  placeholder="Any special requirements, setup instructions, or additional information..."



                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"



                />



              </div>







              {/* Submit Button */}



              <div className="flex space-x-3">



                <button



                  type="submit"



                  disabled={loading || !selectedRoom}



                  className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"



                >



                  {loading ? (



                    <RefreshCw className="h-5 w-5 animate-spin" />



                  ) : (



                    <Send className="h-5 w-5" />



                  )}



                  <span>{loading ? 'Submitting...' : 'Submit Booking'}</span>



                </button>



              </div>



            </form>



          </div>







          {/* Selected Room Info */}



          {selectedRoom && (



            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">



              <h3 className="text-lg font-semibold text-gray-900 mb-4">Selected Room</h3>



              <div className="space-y-3">



                <div className="flex items-center justify-between">



                  <span className="text-sm font-medium text-gray-700">Room:</span>



                  <span className="text-sm text-gray-900">{selectedRoom.name} ({selectedRoom.code})</span>



                </div>



                <div className="flex items-center justify-between">



                  <span className="text-sm font-medium text-gray-700">Department:</span>



                  <span className="text-sm text-gray-900">{selectedRoom.department?.name}</span>



                </div>



                <div className="flex items-center justify-between">



                  <span className="text-sm font-medium text-gray-700">Capacity:</span>



                  <span className="text-sm text-gray-900">{selectedRoom.capacity} seats</span>



                </div>



                <div className="flex items-center justify-between">



                  <span className="text-sm font-medium text-gray-700">Status:</span>



                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${



                    selectedRoom.is_available 



                      ? 'bg-green-100 text-green-800' 



                      : 'bg-red-100 text-red-800'



                  }`}>



                    {selectedRoom.is_available ? 'Available' : 'In Use'}



                  </span>



                </div>



                {!selectedRoom.is_available && (



                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-2">



                    <div className="flex items-start space-x-2">



                      <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />



                      <div className="text-sm text-yellow-800">



                        <p className="font-medium">Room is currently in use</p>



                        <p>Booking this room will mark previous approved bookings as completed.</p>



                      </div>



                    </div>



                  </div>



                )}



              </div>



            </div>



          )}



        </div>



      </div>







      {/* Click outside to close dropdowns */}



      {(showIdentityDropdown || showStudyProgramDropdown) && (



        <div



          className="fixed inset-0 z-5"



          onClick={() => {



            setShowIdentityDropdown(false);



            setShowStudyProgramDropdown(false);



          }}



        />



      )}



    </div>

  );

};



export default BookRoom;
