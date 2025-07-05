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
  // Mock data for demo
  const [students, setStudents] = useState([
    { id: '1', full_name: 'Ahmad Rizki Pratama', identity_number: '20210001', study_program: { id: '1', name: 'Teknik Informatika' } },
    { id: '2', full_name: 'Siti Nurhaliza', identity_number: '20210002', study_program: { id: '2', name: 'Sistem Informasi' } },
    { id: '3', full_name: 'Budi Santoso', identity_number: '20210003', study_program: { id: '1', name: 'Teknik Informatika' } }
  ]);

  const [lecturers, setLecturers] = useState([
    { id: '1', full_name: 'Dr. Muhammad Iqbal, S.T., M.T.' },
    { id: '2', full_name: 'Prof. Dr. Sari Wijayanti, S.Kom., M.Kom.' },
    { id: '3', full_name: 'Dr. Eng. Bambang Suryanto, S.T., M.T.' },
    { id: '4', full_name: 'Ir. Dewi Sartika, M.Kom.' }
  ]);

  const [rooms, setRooms] = useState([
    { id: '1', name: 'Ruang Sidang 1', code: 'RS-01', capacity: 20 },
    { id: '2', name: 'Ruang Sidang 2', code: 'RS-02', capacity: 15 },
    { id: '3', name: 'Laboratorium Komputer 1', code: 'LAB-01', capacity: 30 },
    { id: '4', name: 'Ruang Rapat Dekan', code: 'RRD-01', capacity: 12 }
  ]);

  const [studyPrograms, setStudyPrograms] = useState([
    { id: '1', name: 'Teknik Informatika', code: 'TI' },
    { id: '2', name: 'Sistem Informasi', code: 'SI' },
    { id: '3', name: 'Teknik Komputer', code: 'TK' }
  ]);

  // Progressive form states
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [showModal, setShowModal] = useState(false);

  // Form data states
  const [formData, setFormData] = useState({
    student_name: '',
    student_nim: '',
    study_program_id: '',
    date: new Date().toISOString().split('T')[0],
    start_time: '',
    end_time: '',
    room_id: '',
    title: '',
    supervisor: '',
    examiner: '',
    secretary: ''
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

  // Progress steps configuration
  const steps = [
    {
      id: 1,
      title: 'Informasi Mahasiswa',
      icon: User,
      description: 'Pilih atau input data mahasiswa'
    },
    {
      id: 2,
      title: 'Informasi Jadwal',
      icon: Calendar,
      description: 'Tentukan tanggal dan waktu sidang'
    },
    {
      id: 3,
      title: 'Ruangan & Detail',
      icon: Building,
      description: 'Pilih ruangan, judul, dan tim penguji'
    }
  ];

  // Validation for each step
  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!(formData.student_name && formData.student_nim && formData.study_program_id);
      case 2:
        return !!(formData.date && formData.start_time && formData.end_time);
      case 3:
        return !!(
          formData.room_id && 
          formData.title && 
          formData.supervisor && 
          formData.examiner && 
          formData.secretary
        );
      default:
        return false;
    }
  };

  const handleStepComplete = (step: number) => {
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

  const handleSubmit = () => {
    console.log('Submitting session data:', formData);
    alert('Jadwal sidang berhasil dibuat!');
    setShowModal(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      student_name: '',
      student_nim: '',
      study_program_id: '',
      date: new Date().toISOString().split('T')[0],
      start_time: '',
      end_time: '',
      room_id: '',
      title: '',
      supervisor: '',
      examiner: '',
      secretary: ''
    });
    setCurrentStep(1);
    setCompletedSteps(new Set());
    setStudentSearch('');
    setSupervisorSearch('');
    setExaminerSearch('');
    setSecretarySearch('');
    setRoomSearch('');
    setProgramSearch('');
  };

  const ProgressIndicator = () => (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = completedSteps.has(step.id);
          const isCurrent = currentStep === step.id;
          const isAccessible = step.id === 1 || completedSteps.has(step.id - 1);
          
          return (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center">
                <button
                  onClick={() => isAccessible && setCurrentStep(step.id)}
                  disabled={!isAccessible}
                  className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-all duration-200 ${
                    isCompleted
                      ? 'bg-green-500 text-white'
                      : isCurrent
                      ? 'bg-blue-500 text-white'
                      : isAccessible
                      ? 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-6 w-6" />
                  ) : (
                    <step.icon className="h-6 w-6" />
                  )}
                </button>
                <div className="text-center">
                  <div className={`text-sm font-medium ${isCurrent ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-500'}`}>
                    {step.title}
                  </div>
                  <div className="text-xs text-gray-400 max-w-24">
                    {step.description}
                  </div>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-4 ${
                  completedSteps.has(step.id) ? 'bg-green-500' : 'bg-gray-200'
                }`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );

  const StudentInformationStep = () => (
    <div className="space-y-6">
      <div className="flex items-center space-x-3 pb-4 border-b border-gray-200">
        <User className="h-5 w-5 text-blue-500" />
        <h4 className="text-lg font-semibold text-gray-800">Informasi Mahasiswa</h4>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">NIM Mahasiswa *</label>
          <div className="relative">
            <input
              type="text"
              placeholder="Masukkan atau cari NIM..."
              value={studentSearch}
              onChange={(e) => {
                setStudentSearch(e.target.value);
                setShowStudentDropdown(true);
                
                const foundStudent = students.find(s => s.identity_number === e.target.value);
                if (foundStudent) {
                  setFormData(prev => ({
                    ...prev,
                    student_name: foundStudent.full_name,
                    student_nim: foundStudent.identity_number,
                    study_program_id: foundStudent.study_program.id || ''
                  }));
                  const program = studyPrograms.find(p => p.id === foundStudent.study_program.id);
                  if (program) setProgramSearch(program.name);
                } else {
                  setFormData(prev => ({ ...prev, student_name: '', student_nim: e.target.value, study_program_id: '' }));
                  setProgramSearch('');
                }
              }}
              onFocus={() => setShowStudentDropdown(true)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            
            {showStudentDropdown && studentSearch && (
              <div 
                className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto"
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
                        setFormData(prev => ({
                          ...prev,
                          student_name: student.full_name,
                          student_nim: student.identity_number,
                          study_program_id: student.study_program.id || ''
                        }));
                        const program = studyPrograms.find(p => p.id === student.study_program.id);
                        if (program) setProgramSearch(program.name);
                        setShowStudentDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                    >
                      <div className="font-medium">{student.full_name}</div>
                      <div className="text-sm text-gray-500">{student.identity_number}</div>
                    </button>
                  ))
                }
                {students.filter(student => 
                  student.identity_number.toLowerCase().includes(studentSearch.toLowerCase()) ||
                  student.full_name.toLowerCase().includes(studentSearch.toLowerCase())
                ).length === 0 && (
                  <div className="px-3 py-2 text-gray-500 text-sm">
                    Mahasiswa tidak ditemukan - Anda bisa input manual
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Nama Mahasiswa *</label>
          <input
            type="text"
            value={formData.student_name}
            onChange={(e) => setFormData(prev => ({ ...prev, student_name: e.target.value }))}
            placeholder="Masukkan nama mahasiswa..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Program Studi *</label>
          <div className="relative">
            <input
              type="text"
              value={programSearch}
              onChange={(e) => {
                setProgramSearch(e.target.value);
                setShowProgramDropdown(true);
              }}
              onFocus={() => setShowProgramDropdown(true)}
              placeholder="Cari program studi..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            
            {showProgramDropdown && (
              <div 
                className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto"
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
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
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
      
      {studentSearch && !formData.student_name && formData.student_nim && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <User className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold">Pendaftaran Mahasiswa Baru</p>
              <p className="mt-1">
                Mahasiswa tidak ditemukan di database. Akun mahasiswa baru akan otomatis dibuat saat Anda menyimpan jadwal sidang ini.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );const ScheduleInformationStep = () => (
    <div className="space-y-6">
      <div className="flex items-center space-x-3 pb-4 border-b border-gray-200">
        <Calendar className="h-5 w-5 text-blue-500" />
        <h4 className="text-lg font-semibold text-gray-800">Informasi Jadwal</h4>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tanggal *</label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Waktu Mulai *</label>
          <input
            type="time"
            value={formData.start_time}
            onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Waktu Selesai *</label>
          <input
            type="time"
            value={formData.end_time}
            onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>
    </div>
  );

  const RoomAndDetailsStep = () => (
    <div className="space-y-6">
      <div className="flex items-center space-x-3 pb-4 border-b border-gray-200">
        <Building className="h-5 w-5 text-blue-500" />
        <h4 className="text-lg font-semibold text-gray-800">Ruangan & Detail Sidang</h4>
      </div>
      
      {/* Room Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Ruangan *</label>
        <div className="relative">
          <input
            type="text"
            value={roomSearch}
            onChange={(e) => {
              setRoomSearch(e.target.value);
              setShowRoomDropdown(true);
            }}
            onFocus={() => setShowRoomDropdown(true)}
            placeholder="Cari dan pilih ruangan..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          
          {showRoomDropdown && (
            <div 
              className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto"
              onMouseLeave={() => setShowRoomDropdown(false)}
            >
              {rooms
                .filter(room => room.name.toLowerCase().includes(roomSearch.toLowerCase()))
                .slice(0, 10)
                .map(room => (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, room_id: room.id }));
                      setRoomSearch(room.name);
                      setShowRoomDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="font-medium">{room.name}</div>
                    <div className="text-sm text-gray-500">{room.code} • Kapasitas: {room.capacity}</div>
                  </button>
                ))
              }
            </div>
          )}
        </div>
      </div>

      {/* Thesis Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Judul Skripsi/Tesis *</label>
        <textarea
          rows={3}
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Masukkan judul lengkap skripsi/tesis..."
        />
      </div>

      {/* Committee Members */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Pembimbing *</label>
          <div className="relative">
            <input
              type="text"
              value={supervisorSearch}
              onChange={(e) => {
                setSupervisorSearch(e.target.value);
                setShowSupervisorDropdown(true);
                setFormData(prev => ({ ...prev, supervisor: e.target.value }));
              }}
              onFocus={() => setShowSupervisorDropdown(true)}
              placeholder="Cari pembimbing..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            
            {showSupervisorDropdown && (
              <div 
                className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto"
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
                        setFormData(prev => ({ ...prev, supervisor: lecturer.full_name }));
                        setSupervisorSearch(lecturer.full_name);
                        setShowSupervisorDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                    >
                      {lecturer.full_name}
                    </button>
                  ))
                }
              </div>
            )}
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Penguji *</label>
          <div className="relative">
            <input
              type="text"
              value={examinerSearch}
              onChange={(e) => {
                setExaminerSearch(e.target.value);
                setShowExaminerDropdown(true);
                setFormData(prev => ({ ...prev, examiner: e.target.value }));
              }}
              onFocus={() => setShowExaminerDropdown(true)}
              placeholder="Cari penguji..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            
            {showExaminerDropdown && (
              <div 
                className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto"
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
                        setFormData(prev => ({ ...prev, examiner: lecturer.full_name }));
                        setExaminerSearch(lecturer.full_name);
                        setShowExaminerDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                    >
                      {lecturer.full_name}
                    </button>
                  ))
                }
              </div>
            )}
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Sekretaris *</label>
          <div className="relative">
            <input
              type="text"
              value={secretarySearch}
              onChange={(e) => {
                setSecretarySearch(e.target.value);
                setShowSecretaryDropdown(true);
                setFormData(prev => ({ ...prev, secretary: e.target.value }));
              }}
              onFocus={() => setShowSecretaryDropdown(true)}
              placeholder="Cari sekretaris..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            
            {showSecretaryDropdown && (
              <div 
                className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto"
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
                        setFormData(prev => ({ ...prev, secretary: lecturer.full_name }));
                        setSecretarySearch(lecturer.full_name);
                        setShowSecretaryDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                    >
                      {lecturer.full_name}
                    </button>
                  ))
                }
              </div>
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center space-x-3">
              <UserCheck className="h-8 w-8" />
              <span>Jadwal Sidang</span>
            </h1>
            <p className="mt-2 opacity-90">Kelola jadwal sidang akhir dengan sistem progresif</p>
          </div>
          <div className="hidden md:block text-right">
            <div className="text-2xl font-bold">15</div>
            <div className="text-sm opacity-80">Total Sidang</div>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Manajemen Jadwal Sidang</h2>
            <p className="text-sm text-gray-600">Buat jadwal sidang baru dengan panduan langkah demi langkah</p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Sidang</span>
          </button>
        </div>
      </div>

      {/* Sample Data Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Jadwal Sidang Terdaftar</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Mahasiswa
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Jadwal
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ruangan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tim Penguji
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <tr className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-10 w-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                      <User className="h-5 w-5 text-white" />
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-semibold text-gray-900">Ahmad Rizki Pratama</div>
                      <div className="text-sm text-gray-600 font-mono">20210001</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">15 Januari 2025</div>
                    <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full inline-block mt-1">
                      09:00 - 11:00
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-8 w-8 bg-gradient-to-r from-green-500 to-teal-500 rounded-lg flex items-center justify-center">
                      <MapPin className="h-4 w-4 text-white" />
                    </div>
                    <div className="ml-3">
                      <div className="text-sm font-medium text-gray-900">Ruang Sidang 1</div>
                      <div className="text-sm text-gray-600">RS-01</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-xs space-y-1">
                    <div><span className="font-medium text-blue-600">Pembimbing:</span> Dr. Muhammad Iqbal</div>
                    <div><span className="font-medium text-green-600">Penguji:</span> Prof. Dr. Sari Wijayanti</div>
                    <div><span className="font-medium text-purple-600">Sekretaris:</span> Dr. Eng. Bambang Suryanto</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end space-x-2">
                    <button className="text-blue-600 hover:text-blue-900 p-2 rounded-lg hover:bg-blue-50 transition-all duration-200">
                      <Edit className="h-4 w-4" />
                    </button>
                    <button className="text-red-600 hover:text-red-900 p-2 rounded-lg hover:bg-red-50 transition-all duration-200">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Progressive Form Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
                  <UserCheck className="h-6 w-6 text-blue-600" />
                  <span>Tambah Jadwal Sidang Baru</span>
                </h3>
                <button
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Progress Indicator */}
              <ProgressIndicator />

              {/* Form Content */}
              <div className="space-y-6">
                {renderCurrentStep()}

                {/* Navigation Buttons */}
                <div className="flex justify-between items-center pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={handleStepBack}
                    disabled={currentStep === 1}
                    className="flex items-center space-x-2 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Kembali</span>
                  </button>

                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowModal(false);
                        resetForm();
                      }}
                      className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all duration-200"
                    >
                      Batal
                    </button>

                    {currentStep < 3 ? (
                      <button
                        type="button"
                        onClick={() => handleStepComplete(currentStep)}
                        disabled={!validateStep(currentStep)}
                        className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                      >
                        <span>Lanjutkan</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!validateStep(currentStep)}
                        className="flex items-center space-x-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                      >
                        <Check className="h-4 w-4" />
                        <span>Simpan Jadwal</span>
                      </button>
                    )}
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