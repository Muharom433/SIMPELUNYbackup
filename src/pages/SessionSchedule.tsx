import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Calendar,
  Search,
  Edit,
  Trash2,
  RefreshCw,
  X,
  AlertCircle,
  Plus,
  User,
  Users,
  Printer,
  Building,
  BookOpen,
  Clock,
  MapPin,
  GraduationCap,
  UserCheck,
  ChevronDown,
  Check,
  CheckCircle2,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { alert } from '../components/Alert/AlertHelper';
import { useLanguage } from '../contexts/LanguageContext';
import { Controller } from 'react-hook-form';
import Select from 'react-select';

// Schema for validating the session form data
const sessionSchema = z.object({
  student_id: z.string().optional(),
  date: z.string().min(1, 'Date is required'),
  start_time: z.string().min(1, 'Start time is required'),
  end_time: z.string().min(1, 'End time is required'),
  room_id: z.string().min(1, 'Room is required'),
  title: z.string().min(1, 'Title is required'),
  supervisor: z.string().min(1, 'Supervisor is required'),
  examiner: z.string().min(1, 'Examiner is required'),
  secretary: z.string().min(1, 'Secretary is required'),
}).superRefine((data, ctx) => {
  if (data.start_time && data.end_time && data.start_time >= data.end_time) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['end_time'],
      message: 'End time must be after start time.',
    });
  }
});

type SessionFormData = z.infer<typeof sessionSchema>;

const SessionScheduleProgressive = () => {
  const { profile } = useAuth();
  const { getText } = useLanguage();

  // Backend data states
  const [sessions, setSessions] = useState([]);
  const [students, setStudents] = useState([]);
  const [lecturers, setLecturers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [studyPrograms, setStudyPrograms] = useState([]);
  const [availableRooms, setAvailableRooms] = useState([]);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingSession, setEditingSession] = useState(null);

  // Progressive form states
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState(new Set());

  // Form data states
  const [formData, setFormData] = useState({
    student_name: '',
    student_nim: '',
    study_program_id: ''
  });

  // Search states
  const [studentSearch, setStudentSearch] = useState('');
  const [supervisorSearch, setSupervisorSearch] = useState('');
  const [examinerSearch, setExaminerSearch] = useState('');
  const [secretarySearch, setSecretarySearch] = useState('');
  const [roomSearch, setRoomSearch] = useState('');
  const [programSearch, setProgramSearch] = useState('');

  // Dropdown visibility states
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const [showSupervisorDropdown, setShowSupervisorDropdown] = useState(false);
  const [showExaminerDropdown, setShowExaminerDropdown] = useState(false);
  const [showSecretaryDropdown, setShowSecretaryDropdown] = useState(false);
  const [showRoomDropdown, setShowRoomDropdown] = useState(false);
  const [showProgramDropdown, setShowProgramDropdown] = useState(false);

  // Initialize react-hook-form
  const form = useForm({
    resolver: zodResolver(sessionSchema),
    defaultValues: {
      student_id: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      start_time: '',
      end_time: '',
      room_id: '',
      title: '',
      supervisor: '',
      examiner: '',
      secretary: '',
    },
  });

  // Watch form fields for room availability check
  const watchDate = form.watch('date');
  const watchStartTime = form.watch('start_time');
  const watchEndTime = form.watch('end_time');

  // Progress steps configuration
  const steps = [
    {
      id: 1,
      title: getText('Student Information', 'Informasi Mahasiswa'),
      subtitle: getText('Select student', 'Pilih mahasiswa'),
      icon: User,
      description: getText('Choose or input student data', 'Pilih atau input data mahasiswa')
    },
    {
      id: 2,
      title: getText('Schedule Information', 'Informasi Jadwal'),
      subtitle: getText('Set date & time', 'Tentukan tanggal & waktu'),
      icon: Calendar,
      description: getText('Set examination date and time', 'Tentukan tanggal dan waktu sidang')
    },
    {
      id: 3,
      title: getText('Room & Details', 'Ruangan & Detail'),
      subtitle: getText('Room, title & committee', 'Ruangan, judul & panitia'),
      icon: Building,
      description: getText('Select room, title, and examination committee', 'Pilih ruangan, judul, dan tim penguji')
    }
  ];

  // Fetch data on component mount
  useEffect(() => {
    if (profile) {
      fetchSessions();
      fetchStudents();
      fetchLecturers();
      fetchRooms();
      fetchStudyPrograms();
    }
  }, [profile]);

  // Check room availability when date/time changes
  useEffect(() => {
    if (watchDate && watchStartTime && watchEndTime) {
      checkAvailableRooms(watchDate, watchStartTime, watchEndTime);
    } else {
      setAvailableRooms(rooms);
    }
  }, [watchDate, watchStartTime, watchEndTime, rooms]);

  // Backend fetch functions
  const fetchSessions = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('final_sessions')
        .select(`
          *,
          student:users!student_id(
            id,
            full_name,
            identity_number,
            study_program:study_programs(
              id,
              name,
              department_id,
              department:departments(name)
            )
          ),
          room:rooms(
            id,
            name,
            code,
            department_id
          )
        `)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

      if (profile?.role === 'department_admin' && profile?.department_id) {
        const { data } = await query;
        const filtered = data?.filter(session => 
          session.student?.study_program?.department_id === profile.department_id
        );
        setSessions(filtered || []);
      } else {
        const { data } = await query;
        setSessions(data || []);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
      alert.error(getText('Failed to load sessions.', 'Gagal memuat jadwal sidang.'));
    } finally {
      setLoading(false);
    }
  };
  const fetchStudents = async () => {
    try {
      let query = supabase
        .from('users')
        .select(`*, study_program:study_programs(id, name, department_id)`)
        .eq('role', 'student')
        .order('full_name');

      const { data } = await query;
      let filtered = data || [];

      if (profile?.role === 'department_admin' && profile?.department_id) {
        filtered = (data || []).filter(student => 
          student.study_program?.department_id === profile.department_id
        );
      }
      setStudents(filtered);
    } catch (error) {
      console.error('Error fetching students:', error);
      alert.error(getText('Failed to load students.', 'Gagal memuat mahasiswa.'));
    }
  };

  const fetchLecturers = async () => {
    try {
      let query = supabase
        .from('users')
        .select(`*, study_program:study_programs(id, name, department_id)`)
        .eq('role', 'lecturer')
        .order('full_name');

      const { data } = await query;
      let filtered = data || [];

      if (profile?.role === 'department_admin' && profile?.department_id) {
        filtered = (data || []).filter(lecturer => 
          lecturer.study_program?.department_id === profile.department_id
        );
      }
      setLecturers(filtered);
    } catch (error) {
      console.error('Error fetching lecturers:', error);
      alert.error(getText('Failed to load lecturers.', 'Gagal memuat dosen.'));
    }
  };

  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase.from('rooms').select('*').order('name');
      if (error) throw error;
      setRooms(data || []);
      setAvailableRooms(data || []);
    } catch (error) {
      console.error('Error fetching rooms:', error);
      alert.error(getText('Failed to load rooms.', 'Gagal memuat ruangan.'));
    }
  };

  const fetchStudyPrograms = async () => {
    try {
      let query = supabase.from('study_programs').select('*').order('name');
      if (profile?.role === 'department_admin' && profile?.department_id) {
        query = query.eq('department_id', profile.department_id);
      }
      const { data } = await query;
      setStudyPrograms(data || []);
    } catch (error) {
      console.error('Error fetching study programs:', error);
      alert.error(getText('Failed to load study programs.', 'Gagal memuat program studi.'));
    }
  };

  const checkAvailableRooms = async (date, startTime, endTime) => {
    try {
      const dateObj = new Date(date);
      const dayNamesIndonesian = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const dayName = dayNamesIndonesian[dateObj.getDay()];
      
      const [finalSessionsResponse, lectureSchedulesResponse] = await Promise.all([
        supabase
          .from('final_sessions')
          .select('room_id, start_time, end_time, id')
          .eq('date', date)
          .not('room_id', 'is', null),
        supabase
          .from('lecture_schedules')
          .select('room, start_time, end_time')
          .eq('day', dayName)
      ]);

      if (finalSessionsResponse.error) throw finalSessionsResponse.error;
      if (lectureSchedulesResponse.error) throw lectureSchedulesResponse.error;
      
      const finalSessionConflicts = (finalSessionsResponse.data || [])
        .filter(session => {
          if (editingSession && session.id === editingSession.id) return false;
          const hasOverlap = startTime < session.end_time && endTime > session.start_time;
          return hasOverlap;
        })
        .map(session => session.room_id)
        .filter(Boolean);

      const lectureScheduleConflicts = (lectureSchedulesResponse.data || [])
        .filter(schedule => {
          const hasOverlap = startTime < schedule.end_time && endTime > schedule.start_time;
          return hasOverlap;
        });

      const lectureRoomIds = [];
      for (const conflictSchedule of lectureScheduleConflicts) {
        const matchingRoom = rooms.find(room => room.name.toLowerCase() === conflictSchedule.room.toLowerCase());
        if (matchingRoom) {
          lectureRoomIds.push(matchingRoom.id);
        }
      }
      
      const allConflictingRoomIds = [...finalSessionConflicts, ...lectureRoomIds];
      const available = rooms.filter(room => !allConflictingRoomIds.includes(room.id));
      setAvailableRooms(available);

    } catch (error) {
      console.error('Error checking available rooms:', error);
      setAvailableRooms(rooms);
    }
  };
  const MobileProgressIndicator = () => (
  <div className="flex items-center justify-between">
    {steps.map((step, index) => {
      const isCompleted = completedSteps.has(step.id);
      const isCurrent = currentStep === step.id;
      
      return (
        <React.Fragment key={step.id}>
          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
              isCompleted
                ? 'bg-blue-500 text-white'
                : isCurrent
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-400'
            }`}>
              {isCompleted ? <Check className="h-4 w-4" /> : step.id}
            </div>
            <div className={`text-xs mt-1 text-center max-w-16 ${
              isCurrent || isCompleted ? 'text-blue-600 font-medium' : 'text-gray-400'
            }`}>
              {step.title.split(' ')[0]} {/* Hanya kata pertama */}
            </div>
          </div>
          {index < steps.length - 1 && (
            <div className={`flex-1 h-0.5 mx-2 ${
              isCompleted ? 'bg-blue-500' : 'bg-gray-200'
            }`} />
          )}
        </React.Fragment>
      );
    })}
  </div>
);

  // Progress validation functions
  const validateStep = (step) => {
    switch (step) {
      case 1:
        return !!(formData.student_name && formData.student_nim && formData.study_program_id);
      case 2:
        return !!(form.getValues('date') && form.getValues('start_time') && form.getValues('end_time'));
      case 3:
        return !!(
          form.getValues('room_id') && 
          form.getValues('title') && 
          form.getValues('supervisor') && 
          form.getValues('examiner') && 
          form.getValues('secretary')
        );
      default:
        return false;
    }
  };

  const handleStepComplete = (step) => {
    if (validateStep(step)) {
      setCompletedSteps(prev => new Set([...prev, step]));
      if (step < 3) {
        setCurrentStep(step + 1);
      }
    }
  };

  const handleStepBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Form submission
  const handleSubmit = async (data) => {
    try {
      setSubmitting(true);

      let finalStudentId = data.student_id;
      
      if (!finalStudentId && formData.student_nim && formData.student_name) {
        const { data: existingUser, error: findError } = await supabase
          .from('users')
          .select('id')
          .eq('identity_number', formData.student_nim)
          .single();
        
        if (findError && findError.code !== 'PGRST116') {
            throw findError;
        }

        if (existingUser) {
          finalStudentId = existingUser.id;
        } else {
          const selectedProgram = studyPrograms.find(p => p.id === formData.study_program_id);
          
          const newUserData = {
            identity_number: formData.student_nim,
            full_name: formData.student_name,
            username: formData.student_nim,
            role: 'student',
            password: formData.student_nim,
            study_program_id: formData.study_program_id,
            department_id: selectedProgram?.department_id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          const { data: newUser, error: createError } = await supabase
            .from('users')
            .insert([newUserData])
            .select('id')
            .single();

          if (createError) {
            throw new Error(`Failed to create user: ${createError.message}`);
          }

          finalStudentId = newUser.id;
          alert.success(getText('New student registered successfully!', 'Mahasiswa baru berhasil didaftarkan!'));
        }
      }

      if (!finalStudentId) {
        throw new Error(getText('Student information is required. Please select or enter student details.', 'Informasi mahasiswa diperlukan. Silakan pilih atau masukkan detail mahasiswa.'));
      }

      const sessionData = {
        student_id: finalStudentId,
        date: data.date,
        start_time: data.start_time,
        end_time: data.end_time,
        room_id: data.room_id,
        title: data.title,
        supervisor: data.supervisor,
        examiner: data.examiner,
        secretary: data.secretary,
      };

      if (editingSession) {
        const { error } = await supabase.from('final_sessions').update(sessionData).eq('id', editingSession.id);
        if (error) throw error;
        alert.success(getText('Session updated successfully', 'Jadwal sidang berhasil diperbarui'));
      } else {
        const { error } = await supabase.from('final_sessions').insert([sessionData]);
        if (error) throw error;
        alert.success(getText('Session created successfully', 'Jadwal sidang berhasil dibuat'));
      }

      setShowModal(false);
      setEditingSession(null);
      resetForm();
      fetchSessions();
    } catch (error) {
      console.error('Error saving session:', error);
      alert.error(error.message || getText('Failed to save session', 'Gagal menyimpan jadwal sidang'));
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    form.reset({
      student_id: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      start_time: '',
      end_time: '',
      room_id: '',
      title: '',
      supervisor: '',
      examiner: '',
      secretary: '',
    });
    setFormData({ student_name: '', student_nim: '', study_program_id: '' });
    setCurrentStep(1);
    setCompletedSteps(new Set());
    setStudentSearch('');
    setSupervisorSearch('');
    setExaminerSearch('');
    setSecretarySearch('');
    setRoomSearch('');
    setProgramSearch('');
  };

  // Enhanced Progress Indicator like the image
  // Ganti ProgressIndicator yang ada dengan ini:
const ProgressSidebar = () => (
  <div className="w-72 bg-white border-r-2 border-blue-100 p-6">
    <div className="mb-8">
      <h3 className="text-lg font-bold text-gray-900">Session Creation</h3>
      <p className="text-sm text-gray-500 mt-1">Follow the steps below</p>
    </div>

    <div className="space-y-6">
      {steps.map((step, index) => {
        const isCompleted = completedSteps.has(step.id);
        const isCurrent = currentStep === step.id;
        
        return (
          <div key={step.id} className="relative flex items-start">
            {/* Vertical Line */}
            {index < steps.length - 1 && (
              <div className={`absolute left-6 top-12 w-0.5 h-16 ${
                isCompleted ? 'bg-blue-500' : 'bg-gray-200'
              }`} />
            )}
            
            {/* Circle */}
            <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 relative z-10 ${
              isCompleted
                ? 'bg-blue-500 border-blue-500 text-white'
                : isCurrent
                ? 'bg-white border-blue-500 text-blue-500 ring-4 ring-blue-100'
                : 'bg-white border-gray-300 text-gray-400'
            }`}>
              {isCompleted ? <Check className="h-5 w-5" /> : <step.icon className="h-5 w-5" />}
            </div>
            
            {/* Content */}
            <div className="ml-4">
              <div className={`text-sm font-medium ${isCurrent || isCompleted ? 'text-blue-600' : 'text-gray-400'}`}>
                Step {step.id}
              </div>
              <div className={`font-semibold ${isCurrent || isCompleted ? 'text-gray-900' : 'text-gray-500'}`}>
                {step.title}
              </div>
              <div className="text-sm text-gray-500 mt-1">{step.description}</div>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

const StudentInformationStep = () => (
  <div className="space-y-4 md:space-y-6">
    <div className="text-center mb-4 md:mb-8">
      <h3 className="text-lg md:text-2xl font-bold text-gray-900 mb-2">
        {getText('Student Information', 'Informasi Mahasiswa')}
      </h3>
      <p className="text-sm md:text-base text-gray-600">
        {getText('Please select or enter student details for the examination', 'Silakan pilih atau masukkan detail mahasiswa untuk sidang')}
      </p>
    </div>
    
    <div className="space-y-4 md:grid md:grid-cols-1 lg:grid-cols-3 md:gap-6 md:space-y-0">
      {/* Student NIM - HYBRID: React-Select + Manual Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {getText("Student NIM", "NIM Mahasiswa")} *
        </label>
        <Controller
          name="student_id"
          control={form.control}
          render={({ field }) => {
            const studentOptions = students.map(student => ({
              value: student.id,
              label: `${student.identity_number} - ${student.full_name}`,
              student: student
            }));
            
            const currentValue = studentOptions.find(option => option.value === field.value);
            
            return (
              <Select
                {...field}
                options={studentOptions}
                value={currentValue}
                onChange={(option) => {
                  if (option) {
                    field.onChange(option.value);
                    // Auto-fill data mahasiswa
                    setFormData(prev => ({
                      ...prev,
                      student_name: option.student.full_name,
                      student_nim: option.student.identity_number,
                      study_program_id: option.student.study_program_id || ''
                    }));
                  } else {
                    field.onChange('');
                    // Clear semua data tapi biarkan user input manual
                    setFormData(prev => ({ ...prev, student_name: '', study_program_id: '' }));
                  }
                }}
                placeholder={getText("Search student by NIM or name...", "Cari mahasiswa berdasarkan NIM atau nama...")}
                isClearable
                isSearchable
                styles={{
                  control: (provided) => ({
                    ...provided,
                    minHeight: '42px',
                    borderColor: '#d1d5db',
                  }),
                }}
                noOptionsMessage={() => getText('Student not found - you can enter manually below', 'Mahasiswa tidak ditemukan - Anda bisa input manual di bawah')}
              />
            );
          }}
        />
        
        {/* Manual NIM Input - Muncul jika tidak ada student yang dipilih */}
        {!form.getValues('student_id') && (
          <div className="mt-2">
            <input
              type="text"
              value={formData.student_nim}
              onChange={(e) => setFormData(prev => ({ ...prev, student_nim: e.target.value }))}
              placeholder={getText("Or enter NIM manually...", "Atau masukkan NIM manual...")}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-blue-50"
            />
          </div>
        )}
      </div>

      {/* Student Name - Manual Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {getText("Student Name", "Nama Mahasiswa")} *
        </label>
        <input
          type="text"
          value={formData.student_name}
          onChange={(e) => setFormData(prev => ({ ...prev, student_name: e.target.value }))}
          placeholder={getText("Enter student name...", "Masukkan nama mahasiswa...")}
          className="w-full px-3 md:px-4 py-2 md:py-3 border border-gray-300 rounded-lg md:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-sm md:text-base"
          required
        />
      </div>

      {/* Study Program - React-Select */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {getText("Study Program", "Program Studi")} *
        </label>
        <Controller
          control={form.control}
          render={() => {
            const programOptions = studyPrograms.map(program => ({
              value: program.id,
              label: program.name
            }));
            
            const currentValue = programOptions.find(option => option.value === formData.study_program_id);
            
            return (
              <Select
                options={programOptions}
                value={currentValue}
                onChange={(option) => {
                  setFormData(prev => ({ 
                    ...prev, 
                    study_program_id: option ? option.value : '' 
                  }));
                }}
                placeholder={getText("Search study program...", "Cari program studi...")}
                isClearable
                isSearchable
                styles={{
                  control: (provided) => ({
                    ...provided,
                    minHeight: '42px',
                    borderColor: '#d1d5db',
                  }),
                }}
                noOptionsMessage={() => getText('No programs found', 'Tidak ada program ditemukan')}
              />
            );
          }}
        />
      </div>
    </div>
    
    {/* Info box for manual entry */}
    {formData.student_nim && !form.getValues('student_id') && (
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg md:rounded-xl p-3 md:p-4">
        <div className="flex items-start space-x-2 md:space-x-3">
          <User className="h-4 w-4 md:h-5 md:w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs md:text-sm text-blue-800">
            <p className="font-semibold">
              {getText('New Student Registration', 'Pendaftaran Mahasiswa Baru')}
            </p>
            <p className="mt-1">
              {getText('Student not found in database. A new student account will be automatically created when you save this session.', 'Mahasiswa tidak ditemukan di database. Akun mahasiswa baru akan otomatis dibuat saat Anda menyimpan jadwal sidang ini.')}
            </p>
          </div>
        </div>
      </div>
    )}
  </div>
);
// 2. ScheduleInformationStep - NO CHANGES NEEDED (tidak ada dropdown)
const ScheduleInformationStep = () => (
  <div className="space-y-4 md:space-y-6">
    <div className="text-center mb-4 md:mb-6">
      <h3 className="text-lg md:text-2xl font-bold text-gray-900 mb-2">
        {getText('When will the examination be?', 'Kapan sidang akan dilaksanakan?')}
      </h3>
      <p className="text-sm md:text-base text-gray-600">
        {getText('Please set the date and time for the examination', 'Silakan tentukan tanggal dan waktu sidang')}
      </p>
    </div>
    
    <div className="space-y-4 md:grid md:grid-cols-3 md:gap-6 md:space-y-0 max-w-2xl mx-auto">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {getText("Date", "Tanggal")} *
        </label>
        <input
          {...form.register('date')}
          type="date"
          className="w-full px-3 md:px-4 py-2 md:py-3 border border-gray-300 rounded-lg md:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-sm md:text-base"
        />
        {form.formState.errors.date && (
          <p className="mt-1 text-xs md:text-sm text-red-600">{form.formState.errors.date.message}</p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {getText("Start Time", "Waktu Mulai")} *
        </label>
        <input
          {...form.register('start_time')}
          type="time"
          className="w-full px-3 md:px-4 py-2 md:py-3 border border-gray-300 rounded-lg md:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-sm md:text-base"
        />
        {form.formState.errors.start_time && (
          <p className="mt-1 text-xs md:text-sm text-red-600">{form.formState.errors.start_time.message}</p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {getText("End Time", "Waktu Selesai")} *
        </label>
        <input
          {...form.register('end_time')}
          type="time"
          className="w-full px-3 md:px-4 py-2 md:py-3 border border-gray-300 rounded-lg md:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-sm md:text-base"
        />
        {form.formState.errors.end_time && (
          <p className="mt-1 text-xs md:text-sm text-red-600">{form.formState.errors.end_time.message}</p>
        )}
      </div>
    </div>

    {watchDate && (
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg md:rounded-xl p-3 md:p-4 max-w-md mx-auto">
        <div className="flex items-center space-x-2 md:space-x-3">
          <Calendar className="h-4 w-4 md:h-5 md:w-5 text-green-600" />
          <div className="text-xs md:text-sm text-green-800">
            <p className="font-semibold">
              {getText('Selected Date', 'Tanggal Terpilih')}
            </p>
            <p className="mt-1">
              {format(new Date(watchDate), 'EEEE, MMMM d, yyyy')}
            </p>
          </div>
        </div>
      </div>
    )}
  </div>
);
// VERSI LENGKAP RoomAndDetailsStep dengan React-Select

const RoomAndDetailsStep = () => (
  <div className="space-y-6">
    <div className="text-center mb-6">
      <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
        {getText('Room & Examination Details', 'Ruangan & Detail Sidang')}
      </h3>
      <p className="text-sm md:text-base text-gray-600">
        {getText('Complete the examination setup with room, title and committee', 'Lengkapi pengaturan sidang dengan ruangan, judul dan panitia')}
      </p>
    </div>

    {/* Room Selection - MENGGUNAKAN REACT-SELECT */}
    <div className="space-y-3">
      <h4 className="text-base font-semibold text-gray-800 flex items-center space-x-2">
        <Building className="h-4 w-4 text-blue-500" />
        <span>{getText('Room', 'Ruangan')}</span>
      </h4>
      <div>
        <Controller
          name="room_id"
          control={form.control}
          render={({ field }) => {
            const roomOptions = availableRooms.map(room => ({
              value: room.id,
              label: `${room.name} - ${room.code} (Kapasitas: ${room.capacity})`
            }));
            
            const currentValue = roomOptions.find(option => option.value === field.value);
            
            return (
              <Select
                {...field}
                options={roomOptions}
                value={currentValue}
                onChange={(option) => field.onChange(option ? option.value : '')}
                placeholder={getText('Search and select room...', 'Cari dan pilih ruangan...')}
                isClearable
                isSearchable
                styles={{
                  control: (provided) => ({
                    ...provided,
                    minHeight: '42px',
                    borderColor: '#d1d5db',
                  }),
                }}
                noOptionsMessage={() => getText('No rooms available', 'Tidak ada ruangan tersedia')}
              />
            );
          }}
        />
        {form.formState.errors.room_id && (
          <p className="mt-1 text-xs text-red-600">{form.formState.errors.room_id.message}</p>
        )}
        
        {watchStartTime && watchEndTime && watchDate && (
          <p className="mt-2 text-xs text-gray-600 text-center">
            💡 {availableRooms.length} {getText('available rooms', 'ruangan tersedia')}
          </p>
        )}
      </div>
    </div>

    {/* Thesis Title */}
    <div className="space-y-3">
      <h4 className="text-base font-semibold text-gray-800 flex items-center space-x-2">
        <BookOpen className="h-4 w-4 text-blue-500" />
        <span>{getText('Thesis Title', 'Judul Skripsi/Tesis')}</span>
      </h4>
      <textarea
        {...form.register('title')}
        rows={3}
        className="w-full px-3 md:px-4 py-2.5 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-sm resize-none"
        placeholder={getText("Enter the complete thesis title...", "Masukkan judul lengkap skripsi/tesis...")}
      />
      {form.formState.errors.title && (
        <p className="mt-1 text-xs text-red-600">{form.formState.errors.title.message}</p>
      )}
    </div>

    {/* Committee Members - MENGGUNAKAN REACT-SELECT */}
    <div className="space-y-3">
      <h4 className="text-base font-semibold text-gray-800 flex items-center space-x-2">
        <Users className="h-4 w-4 text-blue-500" />
        <span>{getText('Examination Committee', 'Panitia Sidang')}</span>
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Supervisor - MENGGUNAKAN REACT-SELECT */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {getText("Supervisor", "Pembimbing")} *
          </label>
          <Controller
            name="supervisor"
            control={form.control}
            render={({ field }) => {
              const lecturerOptions = lecturers.map(lecturer => ({
                value: lecturer.full_name,
                label: lecturer.full_name
              }));
              
              const currentValue = lecturerOptions.find(option => option.value === field.value);
              
              return (
                <Select
                  {...field}
                  options={lecturerOptions}
                  value={currentValue}
                  onChange={(option) => field.onChange(option ? option.value : '')}
                  placeholder={getText("Search supervisor...", "Cari pembimbing...")}
                  isClearable
                  isSearchable
                  styles={{
                    control: (provided) => ({
                      ...provided,
                      minHeight: '42px',
                      borderColor: '#d1d5db',
                    }),
                  }}
                  noOptionsMessage={() => getText('No lecturers found', 'Tidak ada dosen ditemukan')}
                />
              );
            }}
          />
          {form.formState.errors.supervisor && (
            <p className="mt-1 text-xs text-red-600">{form.formState.errors.supervisor.message}</p>
          )}
        </div>
        
        {/* Examiner - MENGGUNAKAN REACT-SELECT */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {getText("Examiner", "Penguji")} *
          </label>
          <Controller
            name="examiner"
            control={form.control}
            render={({ field }) => {
              const lecturerOptions = lecturers.map(lecturer => ({
                value: lecturer.full_name,
                label: lecturer.full_name
              }));
              
              const currentValue = lecturerOptions.find(option => option.value === field.value);
              
              return (
                <Select
                  {...field}
                  options={lecturerOptions}
                  value={currentValue}
                  onChange={(option) => field.onChange(option ? option.value : '')}
                  placeholder={getText("Search examiner...", "Cari penguji...")}
                  isClearable
                  isSearchable
                  styles={{
                    control: (provided) => ({
                      ...provided,
                      minHeight: '42px',
                      borderColor: '#d1d5db',
                    }),
                  }}
                  noOptionsMessage={() => getText('No lecturers found', 'Tidak ada dosen ditemukan')}
                />
              );
            }}
          />
          {form.formState.errors.examiner && (
            <p className="mt-1 text-xs text-red-600">{form.formState.errors.examiner.message}</p>
          )}
        </div>
        
        {/* Secretary - MENGGUNAKAN REACT-SELECT */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {getText("Secretary", "Sekretaris")} *
          </label>
          <Controller
            name="secretary"
            control={form.control}
            render={({ field }) => {
              const lecturerOptions = lecturers.map(lecturer => ({
                value: lecturer.full_name,
                label: lecturer.full_name
              }));
              
              const currentValue = lecturerOptions.find(option => option.value === field.value);
              
              return (
                <Select
                  {...field}
                  options={lecturerOptions}
                  value={currentValue}
                  onChange={(option) => field.onChange(option ? option.value : '')}
                  placeholder={getText("Search secretary...", "Cari sekretaris...")}
                  isClearable
                  isSearchable
                  styles={{
                    control: (provided) => ({
                      ...provided,
                      minHeight: '42px',
                      borderColor: '#d1d5db',
                    }),
                  }}
                  noOptionsMessage={() => getText('No lecturers found', 'Tidak ada dosen ditemukan')}
                />
              );
            }}
          />
          {form.formState.errors.secretary && (
            <p className="mt-1 text-xs text-red-600">{form.formState.errors.secretary.message}</p>
          )}
        </div>
      </div>
    </div>
  </div>
);
  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return <StudentInformationStep />;
      case 2:
        return <ScheduleInformationStep />;
      case 3:
        return <RoomAndDetailsStep />;
      default:
        return null;
    }
  };

  const handleEdit = (session) => {
    setEditingSession(session);
    
    form.reset({
      student_id: session.student_id,
      date: session.date,
      start_time: session.start_time,
      end_time: session.end_time,
      room_id: session.room_id,
      title: session.title,
      supervisor: session.supervisor,
      examiner: session.examiner,
      secretary: session.secretary,
    });
    
    setStudentSearch(session.student?.identity_number || '');
    setFormData({
      student_name: session.student?.full_name || '',
      student_nim: session.student?.identity_number || '',
      study_program_id: session.student?.study_program?.id || ''
    });
    setProgramSearch(session.student?.study_program?.name || '');
    setRoomSearch(session.room?.name || '');
    setSupervisorSearch(session.supervisor);
    setExaminerSearch(session.examiner);
    setSecretarySearch(session.secretary);
    
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    try {
      setSubmitting(true);
      const { error } = await supabase.from('final_sessions').delete().eq('id', id);
      if (error) throw error;
      alert.success(getText('Session deleted successfully', 'Jadwal sidang berhasil dihapus'));
      fetchSessions();
    } catch (error) {
      console.error('Error deleting session:', error);
      alert.error(error.message || getText('Failed to delete session', 'Gagal menghapus jadwal sidang'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <RefreshCw className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center space-x-3">
              <UserCheck className="h-8 w-8" />
              <span>{getText("Session Schedule", "Jadwal Sidang")}</span>
            </h1>
            <p className="mt-2 opacity-90">{getText("Manage final examination sessions with progressive workflow", "Kelola jadwal sidang akhir dengan alur kerja progresif")}</p>
          </div>
          <div className="hidden md:block text-right">
            <div className="text-2xl font-bold">{sessions.length}</div>
            <div className="text-sm opacity-80">{getText("Total Sessions", "Total Sidang")}</div>
          </div>
        </div>
      </div>

      {/* Action Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{getText("Session Management", "Manajemen Jadwal Sidang")}</h2>
            <p className="text-sm text-gray-600">{getText("Create new examination sessions with step-by-step guidance", "Buat jadwal sidang baru dengan panduan langkah demi langkah")}</p>
          </div>
          {profile?.role === 'department_admin' && (
            <button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <Plus className="h-5 w-5" />
              <span>{getText("Create Session", "Buat Sidang")}</span>
            </button>
          )}
        </div>
      </div>

      {/* Sessions Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">{getText("Registered Sessions", "Jadwal Sidang Terdaftar")}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getText("Student", "Mahasiswa")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getText("Schedule", "Jadwal")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getText("Room", "Ruangan")}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getText("Committee", "Panitia")}
                </th>
                {profile?.role === 'department_admin' && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {getText("Actions", "Aksi")}
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={profile?.role === 'department_admin' ? 5 : 4} className="px-6 py-12 text-center">
                    <div className="text-gray-500">
                      <UserCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium mb-2">{getText("No sessions found", "Tidak ada jadwal sidang ditemukan")}</p>
                      <p>{getText("Create your first examination session", "Buat jadwal sidang pertama Anda")}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-gray-50 transition-colors duration-200">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                          <User className="h-5 w-5 text-white" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-semibold text-gray-900">{session.student?.full_name}</div>
                          <div className="text-sm text-gray-600 font-mono">{session.student?.identity_number}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{format(parseISO(session.date), 'MMM d, yyyy')}</div>
                        <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full inline-block mt-1">
                          {session.start_time} - {session.end_time}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-8 w-8 bg-gradient-to-r from-green-500 to-teal-500 rounded-lg flex items-center justify-center">
                          <MapPin className="h-4 w-4 text-white" />
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">{session.room?.name || 'N/A'}</div>
                          <div className="text-sm text-gray-600">{session.room?.code || 'N/A'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs space-y-1">
                        <div><span className="font-medium text-blue-600">{getText('Supervisor', 'Pembimbing')}:</span> {session.supervisor}</div>
                        <div><span className="font-medium text-green-600">{getText('Examiner', 'Penguji')}:</span> {session.examiner}</div>
                        <div><span className="font-medium text-purple-600">{getText('Secretary', 'Sekretaris')}:</span> {session.secretary}</div>
                      </div>
                    </td>
                    {profile?.role === 'department_admin' && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleEdit(session)}
                            className="text-blue-600 hover:text-blue-900 p-2 rounded-lg hover:bg-blue-50 transition-all duration-200"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(session.id)}
                            className="text-red-600 hover:text-red-900 p-2 rounded-lg hover:bg-red-50 transition-all duration-200"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Progressive Form Modal */}
      {showModal && profile?.role === 'department_admin' && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 md:p-4">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl flex flex-col overflow-hidden" 
         style={{ 
           height: 'calc(100vh - 16px)',
           maxHeight: '95vh'
         }}>
      
      {/* Mobile: Progress di top, Desktop: Progress di sidebar */}
      <div className="md:hidden bg-white border-b border-gray-200 p-3 flex-shrink-0">
        <MobileProgressIndicator />
      </div>
      
      <div className="flex flex-1 min-h-0">
        {/* Desktop Sidebar */}
        <div className="hidden md:block flex-shrink-0">
          <ProgressSidebar />
        </div>
        
        {/* Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between p-3 md:p-6 border-b border-gray-200 bg-white flex-shrink-0">
            <h3 className="text-base md:text-xl font-bold text-gray-900 flex items-center space-x-2">
              <UserCheck className="h-4 w-4 md:h-6 md:w-6 text-blue-600" />
              <span className="hidden sm:inline">
                {editingSession ? getText('Edit Session', 'Edit Sidang') : getText('Create Session', 'Buat Sidang')}
              </span>
              <span className="sm:hidden text-sm">
                {editingSession ? getText('Edit', 'Edit') : getText('Create', 'Buat')}
              </span>
            </h3>
            <button
              onClick={() => {
                setShowModal(false);
                resetForm();
              }}
              className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-xl flex-shrink-0"
            >
              <X className="h-4 w-4 md:h-5 md:w-5" />
            </button>
          </div>
          
          {/* Content - Scrollable dengan padding yang disesuaikan */}
          <div className="flex-1 overflow-y-auto p-3 md:p-8 bg-gray-50 min-h-0">
            <div className="max-w-4xl mx-auto">
              {renderCurrentStep()}
            </div>
          </div>
          
          {/* Footer Navigation - Fixed di bottom */}
          <div className="border-t border-gray-200 p-3 md:p-6 bg-white flex-shrink-0">
            <div className="flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0 sm:space-x-4 max-w-4xl mx-auto">
              {/* Navigation buttons */}
              <div className="flex w-full sm:w-auto space-x-3 sm:space-x-0">
                {currentStep > 1 && (
                  <button
                    type="button"
                    onClick={handleStepBack}
                    className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-3 md:px-4 py-2 md:py-3 text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-50 transition-all duration-200 text-sm"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">{getText('Back', 'Kembali')}</span>
                    <span className="sm:hidden">Back</span>
                  </button>
                )}
              </div>

              <div className="w-full sm:w-auto">
                {currentStep < 3 ? (
                  <button
                    type="button"
                    onClick={() => handleStepComplete(currentStep)}
                    disabled={!validateStep(currentStep)}
                    className="w-full flex items-center justify-center space-x-2 px-4 md:px-6 py-2 md:py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-sm"
                  >
                    <span>{getText('Continue', 'Lanjutkan')}</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => form.handleSubmit(handleSubmit)()}
                    disabled={!validateStep(currentStep) || submitting}
                    className="w-full flex items-center justify-center space-x-2 px-4 md:px-6 py-2 md:py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-sm"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>{getText('Saving...', 'Menyimpan...')}</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        <span className="hidden sm:inline">
                          {editingSession ? getText('Update Session', 'Perbarui') : getText('Create Session', 'Buat Sidang')}
                        </span>
                        <span className="sm:hidden">
                          {editingSession ? getText('Update', 'Perbarui') : getText('Create', 'Buat')}
                        </span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
)}
    </div>
  );
};

export default SessionScheduleProgressive;