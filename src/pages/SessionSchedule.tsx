import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Select from 'react-select';
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
  <div className="max-w-4xl mx-auto space-y-6">
    <div className="text-center mb-8">
      <h3 className="text-2xl font-bold text-gray-900 mb-2">
        {getText('Student Information', 'Informasi Mahasiswa')}
      </h3>
      <p className="text-gray-600">
        {getText('Please select or enter student details for the examination', 'Silakan pilih atau masukkan detail mahasiswa untuk sidang')}
      </p>
    </div>
    
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {getText("Student NIM", "NIM Mahasiswa")} *
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder={getText("Enter or search NIM...", "Masukkan atau cari NIM...")}
              value={studentSearch}
              onChange={(e) => {
                setStudentSearch(e.target.value);
                setShowStudentDropdown(true);
                
                const foundStudent = students.find(s => s.identity_number === e.target.value);
                if (foundStudent) {
                  form.setValue('student_id', foundStudent.id);
                  setFormData(prev => ({
                    ...prev,
                    student_name: foundStudent.full_name,
                    student_nim: foundStudent.identity_number,
                    study_program_id: foundStudent.study_program_id || ''
                  }));
                  const program = studyPrograms.find(p => p.id === foundStudent.study_program_id);
                  if (program) setProgramSearch(program.name);
                } else {
                  form.setValue('student_id', '');
                  setFormData(prev => ({ ...prev, student_name: '', student_nim: e.target.value, study_program_id: '' }));
                  setProgramSearch('');
                }
              }}
              onFocus={() => setShowStudentDropdown(true)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
            />
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            
            {showStudentDropdown && studentSearch && (
              <div 
                className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-xl shadow-xl max-h-60 overflow-y-auto"
                onMouseLeave={() => setShowStudentDropdown(false)}
              >
                {students
                  .filter(student => 
                    student.identity_number.toLowerCase().includes(studentSearch.toLowerCase()) ||
                    student.full_name.toLowerCase().includes(studentSearch.toLowerCase())
                  )
                  .slice(0, 5)
                  .map(student => (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => {
                        setStudentSearch(student.identity_number);
                        form.setValue('student_id', student.id);
                        setFormData(prev => ({
                          ...prev,
                          student_name: student.full_name,
                          student_nim: student.identity_number,
                          study_program_id: student.study_program_id || ''
                        }));
                        const program = studyPrograms.find(p => p.id === student.study_program_id);
                        if (program) setProgramSearch(program.name);
                        setShowStudentDropdown(false);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition-colors duration-150"
                    >
                      <div className="font-medium text-gray-900">{student.full_name}</div>
                      <div className="text-sm text-gray-500">{student.identity_number}</div>
                    </button>
                  ))
                }
                {students.filter(student => 
                  student.identity_number.toLowerCase().includes(studentSearch.toLowerCase()) ||
                  student.full_name.toLowerCase().includes(studentSearch.toLowerCase())
                ).length === 0 && (
                  <div className="px-4 py-3 text-gray-500 text-sm text-center">
                    {getText('No students found - you can enter manually', 'Tidak ada mahasiswa ditemukan - Anda bisa input manual')}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {getText("Student Name", "Nama Mahasiswa")} *
          </label>
          <input
            type="text"
            value={formData.student_name}
            onChange={(e) => setFormData(prev => ({ ...prev, student_name: e.target.value }))}
            placeholder={getText("Enter student name...", "Masukkan nama mahasiswa...")}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {getText("Study Program", "Program Studi")} *
          </label>
          <div className="relative">
            <input
              type="text"
              value={programSearch}
              onChange={(e) => {
                setProgramSearch(e.target.value);
                setShowProgramDropdown(true);
              }}
              onFocus={() => setShowProgramDropdown(true)}
              placeholder={getText("Search study program...", "Cari program studi...")}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
            />
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            
            {showProgramDropdown && (
              <div 
                className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-xl shadow-xl max-h-60 overflow-y-auto"
                onMouseLeave={() => setShowProgramDropdown(false)}
              >
                {studyPrograms
                  .filter(program => 
                    program.name.toLowerCase().includes(programSearch.toLowerCase())
                  )
                  .slice(0, 5)
                  .map(program => (
                    <button
                      key={program.id}
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({ ...prev, study_program_id: program.id }));
                        setProgramSearch(program.name);
                        setShowProgramDropdown(false);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition-colors duration-150"
                    >
                      {program.name}
                    </button>
                  ))
                }
              </div>
            )}
          </div>
        </div>
      </div>
      
      {studentSearch && !form.getValues('student_id') && formData.student_nim && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start space-x-3">
            <User className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
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

  const ScheduleInformationStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">
          {getText('When will the examination be?', 'Kapan sidang akan dilaksanakan?')}
        </h3>
        <p className="text-gray-600">
          {getText('Please set the date and time for the examination', 'Silakan tentukan tanggal dan waktu sidang')}
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-2xl mx-auto">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {getText("Date", "Tanggal")} *
          </label>
          <input
            {...form.register('date')}
            type="date"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
          />
          {form.formState.errors.date && (
            <p className="mt-1 text-sm text-red-600">{form.formState.errors.date.message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {getText("Start Time", "Waktu Mulai")} *
          </label>
          <input
            {...form.register('start_time')}
            type="time"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
          />
          {form.formState.errors.start_time && (
            <p className="mt-1 text-sm text-red-600">{form.formState.errors.start_time.message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {getText("End Time", "Waktu Selesai")} *
          </label>
          <input
            {...form.register('end_time')}
            type="time"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
          />
          {form.formState.errors.end_time && (
            <p className="mt-1 text-sm text-red-600">{form.formState.errors.end_time.message}</p>
          )}
        </div>
      </div>

      {watchDate && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 max-w-md mx-auto">
          <div className="flex items-center space-x-3">
            <Calendar className="h-5 w-5 text-green-600" />
            <div className="text-sm text-green-800">
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

  const RoomAndDetailsStep = () => (
    <div className="space-y-8">
      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">
          {getText('Room & Examination Details', 'Ruangan & Detail Sidang')}
        </h3>
        <p className="text-gray-600">
          {getText('Complete the examination setup with room, title and committee', 'Lengkapi pengaturan sidang dengan ruangan, judul dan panitia')}
        </p>
      </div>
      
      {/* Room Selection */}
      <div className="space-y-4">
       // GANTI bagian Room Selection dengan dropdown search ini:
<div>
  <label className="block text-sm font-medium text-gray-700 mb-2">
    {getText("Room", "Ruangan")} *
  </label>
  <div className="relative">
    <button
      type="button"
      onClick={() => setShowRoomDropdown(!showRoomDropdown)}
      className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-white text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 flex items-center justify-between"
    >
      <span className={form.getValues('room_id') ? 'text-gray-900' : 'text-gray-500'}>
        {form.getValues('room_id') 
          ? availableRooms.find(r => r.id === form.getValues('room_id'))?.name + 
            ` - ${availableRooms.find(r => r.id === form.getValues('room_id'))?.code} (Capacity: ${availableRooms.find(r => r.id === form.getValues('room_id'))?.capacity})`
          : getText('Select room...', 'Pilih ruangan...')
        }
      </span>
      <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${showRoomDropdown ? 'rotate-180' : ''}`} />
    </button>
    
    {showRoomDropdown && (
      <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-xl shadow-xl overflow-hidden">
        {/* Search Input di dalam dropdown */}
        <div className="p-3 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder={getText('Search rooms...', 'Cari ruangan...')}
              value={roomSearch}
              onChange={(e) => setRoomSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              autoFocus
            />
          </div>
        </div>
        
        {/* Options List dengan scroll */}
        <div className="max-h-60 overflow-y-auto">
          {availableRooms
            .filter(room => 
              room.name.toLowerCase().includes(roomSearch.toLowerCase()) ||
              room.code.toLowerCase().includes(roomSearch.toLowerCase())
            )
            .map(room => (
              <button
                key={room.id}
                type="button"
                onClick={() => {
                  form.setValue('room_id', room.id);
                  setShowRoomDropdown(false);
                  setRoomSearch('');
                }}
                className="w-full px-4 py-3 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition-colors duration-150 focus:bg-blue-50 focus:outline-none"
              >
                <div className="font-medium text-gray-900">{room.name}</div>
                <div className="text-sm text-gray-500">{room.code} • Capacity: {room.capacity}</div>
              </button>
            ))
          }
          {availableRooms.filter(room => 
            room.name.toLowerCase().includes(roomSearch.toLowerCase()) ||
            room.code.toLowerCase().includes(roomSearch.toLowerCase())
          ).length === 0 && (
            <div className="px-4 py-6 text-center text-gray-500 text-sm">
              {getText('No rooms found', 'Tidak ada ruangan ditemukan')}
            </div>
          )}
        </div>
      </div>
    )}
    
    {/* Click outside to close */}
    {showRoomDropdown && (
      <div 
        className="fixed inset-0 z-10" 
        onClick={() => setShowRoomDropdown(false)}
      />
    )}
  </div>
  
  {form.formState.errors.room_id && (
    <p className="mt-1 text-sm text-red-600">{form.formState.errors.room_id.message}</p>
  )}
  
  {watchStartTime && watchEndTime && watchDate && (
    <p className="mt-2 text-sm text-gray-600 text-center">
      💡 {availableRooms.length} {getText('available rooms', 'ruangan tersedia')}
    </p>
  )}
</div>
      </div>

      {/* Thesis Title */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-gray-800 flex items-center space-x-2">
          <BookOpen className="h-5 w-5 text-blue-500" />
          <span>{getText('Thesis Title', 'Judul Skripsi/Tesis')}</span>
        </h4>
        <div className="max-w-4xl mx-auto">
          <textarea
            {...form.register('title')}
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
            placeholder={getText("Enter the complete thesis title...", "Masukkan judul lengkap skripsi/tesis...")}
          />
          {form.formState.errors.title && (
            <p className="mt-1 text-sm text-red-600">{form.formState.errors.title.message}</p>
          )}
        </div>
      </div>

      {/* Committee Members */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-gray-800 flex items-center space-x-2">
          <Users className="h-5 w-5 text-blue-500" />
          <span>{getText('Examination Committee', 'Panitia Sidang')}</span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {/* Supervisor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {getText("Supervisor", "Pembimbing")} *
            </label>
            <div className="relative">
              <input
                type="text"
                value={supervisorSearch}
                onChange={(e) => {
                  setSupervisorSearch(e.target.value);
                  setShowSupervisorDropdown(true);
                  form.setValue('supervisor', e.target.value);
                }}
                onFocus={() => setShowSupervisorDropdown(true)}
                placeholder={getText("Search supervisor...", "Cari pembimbing...")}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
              />
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              
              {showSupervisorDropdown && (
                <div 
                  className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-xl shadow-xl max-h-60 overflow-y-auto"
                  onMouseLeave={() => setShowSupervisorDropdown(false)}
                >
                  {lecturers
                    .filter(lecturer => 
                      lecturer.full_name.toLowerCase().includes(supervisorSearch.toLowerCase())
                    )
                    .slice(0, 10)
                    .map(lecturer => (
                      <button
                        key={lecturer.id}
                        type="button"
                        onClick={() => {
                          form.setValue('supervisor', lecturer.full_name);
                          setSupervisorSearch(lecturer.full_name);
                          setShowSupervisorDropdown(false);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition-colors duration-150"
                      >
                        {lecturer.full_name}
                      </button>
                    ))
                  }
                </div>
              )}
            </div>
            {form.formState.errors.supervisor && (
              <p className="mt-1 text-sm text-red-600">{form.formState.errors.supervisor.message}</p>
            )}
          </div>
          
          {/* Examiner */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {getText("Examiner", "Penguji")} *
            </label>
            <div className="relative">
              <input
                type="text"
                value={examinerSearch}
                onChange={(e) => {
                  setExaminerSearch(e.target.value);
                  setShowExaminerDropdown(true);
                  form.setValue('examiner', e.target.value);
                }}
                onFocus={() => setShowExaminerDropdown(true)}
                placeholder={getText("Search examiner...", "Cari penguji...")}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
              />
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              
              {showExaminerDropdown && (
                <div 
                  className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-xl shadow-xl max-h-60 overflow-y-auto"
                  onMouseLeave={() => setShowExaminerDropdown(false)}
                >
                  {lecturers
                    .filter(lecturer => 
                      lecturer.full_name.toLowerCase().includes(examinerSearch.toLowerCase())
                    )
                    .slice(0, 10)
                    .map(lecturer => (
                      <button
                        key={lecturer.id}
                        type="button"
                        onClick={() => {
                          form.setValue('examiner', lecturer.full_name);
                          setExaminerSearch(lecturer.full_name);
                          setShowExaminerDropdown(false);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition-colors duration-150"
                      >
                        {lecturer.full_name}
                      </button>
                    ))
                  }
                </div>
              )}
            </div>
            {form.formState.errors.examiner && (
              <p className="mt-1 text-sm text-red-600">{form.formState.errors.examiner.message}</p>
            )}
          </div>
          
          {/* Secretary */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {getText("Secretary", "Sekretaris")} *
            </label>
            <div className="relative">
              <input
                type="text"
                value={secretarySearch}
                onChange={(e) => {
                  setSecretarySearch(e.target.value);
                  setShowSecretaryDropdown(true);
                  form.setValue('secretary', e.target.value);
                }}
                onFocus={() => setShowSecretaryDropdown(true)}
                placeholder={getText("Search secretary...", "Cari sekretaris...")}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
              />
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              
              {showSecretaryDropdown && (
                <div 
                  className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-xl shadow-xl max-h-60 overflow-y-auto"
                  onMouseLeave={() => setShowSecretaryDropdown(false)}
                >
                  {lecturers
                    .filter(lecturer => 
                      lecturer.full_name.toLowerCase().includes(secretarySearch.toLowerCase())
                    )
                    .slice(0, 10)
                    .map(lecturer => (
                      <button
                        key={lecturer.id}
                        type="button"
                        onClick={() => {
                          form.setValue('secretary', lecturer.full_name);
                          setSecretarySearch(lecturer.full_name);
                          setShowSecretaryDropdown(false);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition-colors duration-150"
                      >
                        {lecturer.full_name}
                      </button>
                    ))
                  }
                </div>
              )}
            </div>
            {form.formState.errors.secretary && (
              <p className="mt-1 text-sm text-red-600">{form.formState.errors.secretary.message}</p>
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
      // Ganti bagian modal content dengan:
{showModal && profile?.role === 'department_admin' && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl h-[90vh] flex overflow-hidden">
      
      {/* Left Sidebar - Progress */}
      <ProgressSidebar />
      
      {/* Right Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-xl font-bold text-gray-900 flex items-center space-x-3">
            <UserCheck className="h-6 w-6 text-blue-600" />
            <span>{editingSession ? getText('Edit Session Schedule', 'Edit Jadwal Sidang') : getText('Create New Session', 'Buat Jadwal Sidang Baru')}</span>
          </h3>
          <button
            onClick={() => {
              setShowModal(false);
              resetForm();
            }}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-xl"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        {/* Form Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderCurrentStep()}
        </div>
        
        {/* Bottom Navigation - Fixed */}
        <div className="border-t border-gray-200 p-6">
          <div className="flex justify-end space-x-4">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={handleStepBack}
                className="flex items-center space-x-2 px-6 py-3 text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-50 transition-all duration-200"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>{getText('Back', 'Kembali')}</span>
              </button>
            )}

            {currentStep < 3 ? (
              <button
                type="button"
                onClick={() => handleStepComplete(currentStep)}
                disabled={!validateStep(currentStep)}
                className="flex items-center space-x-2 px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                <span>{getText('Continue', 'Lanjutkan')}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => form.handleSubmit(handleSubmit)()}
                disabled={!validateStep(currentStep) || submitting}
                className="flex items-center space-x-2 px-8 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>{getText('Saving...', 'Menyimpan...')}</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>{editingSession ? getText('Update Session', 'Perbarui Sidang') : getText('Create Session', 'Buat Sidang')}</span>
                  </>
                )}
              </button>
            )}
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