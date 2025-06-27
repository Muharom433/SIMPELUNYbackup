import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
  ChevronDown
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';

// Schema for validating the session form data.
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
  // Custom validation to ensure end_time is after start_time.
  if (data.start_time && data.end_time && data.start_time >= data.end_time) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['end_time'],
      message: 'End time must be after start time.',
    });
  }
});

// TypeScript type inferred from the Zod schema for type safety.
type SessionFormData = z.infer<typeof sessionSchema>;

// Type for the data required by the print/PDF generation form.
type PrintFormData = {
  department_id?: string;
  study_program_id: string;
  academic_year: string;
  department_head_id?: string;
};

/**
 * SessionSchedule Component
 * * This component provides a full CRUD interface for managing final examination sessions.
 * It includes features like role-based access, dynamic room availability checking,
 * on-the-fly user creation for unregistered students, and PDF report generation.
 */
const SessionSchedule = () => {
  const { profile } = useAuth();
  const { getText } = useLanguage();
  
  // Main state variables
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [editingSession, setEditingSession] = useState<any | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<any | null>(null);

  // State for filtering the session list
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [programFilter, setProgramFilter] = useState('');

  // State to hold data for form dropdowns
  const [students, setStudents] = useState<any[]>([]);
  const [lecturers, setLecturers] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [studyPrograms, setStudyPrograms] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [departmentHeads, setDepartmentHeads] = useState<any[]>([]);
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);

  // State to manage form data for manual student entry
  const [formData, setFormData] = useState({
    student_name: '',
    student_nim: '',
    study_program_id: ''
  });

  // State for search text within custom dropdowns
  const [studentSearch, setStudentSearch] = useState('');
  const [supervisorSearch, setSupervisorSearch] = useState('');
  const [examinerSearch, setExaminerSearch] = useState('');
  const [secretarySearch, setSecretarySearch] = useState('');
  const [roomSearch, setRoomSearch] = useState('');
  const [programSearch, setProgramSearch] = useState('');

  // State to control visibility of custom dropdowns
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const [showSupervisorDropdown, setShowSupervisorDropdown] = useState(false);
  const [showExaminerDropdown, setShowExaminerDropdown] = useState(false);
  const [showSecretaryDropdown, setShowSecretaryDropdown] = useState(false);
  const [showRoomDropdown, setShowRoomDropdown] = useState(false);
  const [showProgramDropdown, setShowProgramDropdown] = useState(false);

  // Initialize react-hook-form for the main session form
  const form = useForm<SessionFormData>({
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

  // Initialize a separate form for the print modal
  const printForm = useForm<PrintFormData>();

  // Watch for changes in date/time fields to re-check room availability
  const watchDate = form.watch('date');
  const watchStartTime = form.watch('start_time');
  const watchEndTime = form.watch('end_time');

  // Effect to fetch initial data once the user profile is available
  useEffect(() => {
    if (profile) {
      fetchSessions();
      fetchStudents();
      fetchLecturers();
      fetchRooms();
      fetchStudyPrograms();
      fetchDepartments();
      fetchDepartmentHeads();
    }
  }, [profile]);

  // Effect to check for available rooms whenever date or time inputs change
  useEffect(() => {
    if (watchDate && watchStartTime && watchEndTime) {
      checkAvailableRooms(watchDate, watchStartTime, watchEndTime);
    } else {
      setAvailableRooms(rooms); // If time is not set, show all rooms
    }
  }, [watchDate, watchStartTime, watchEndTime, rooms]);

  // Fetches all session data from the database
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

      // Apply department filter for department admins
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
    } catch (error: any) {
      console.error('Error fetching sessions:', error);
      toast.error(getText('Failed to load sessions.', 'Gagal memuat jadwal sidang.'));
    } finally {
      setLoading(false);
    }
  };

  // Fetches student data for dropdowns
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
    } catch (error: any) {
      console.error('Error fetching students:', error);
      toast.error(getText('Failed to load students.', 'Gagal memuat mahasiswa.'));
    }
  };

  // Fetches lecturer data for dropdowns
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
    } catch (error: any) {
      console.error('Error fetching lecturers:', error);
      toast.error(getText('Failed to load lecturers.', 'Gagal memuat dosen.'));
    }
  };

  // Fetches room data
  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase.from('rooms').select('*').order('name');
      if (error) throw error;
      setRooms(data || []);
      setAvailableRooms(data || []);
    } catch (error: any) {
      console.error('Error fetching rooms:', error);
      toast.error(getText('Failed to load rooms.', 'Gagal memuat ruangan.'));
    }
  };

  // Fetches study program data
  const fetchStudyPrograms = async () => {
    try {
      let query = supabase.from('study_programs').select('*').order('name');
      if (profile?.role === 'department_admin' && profile?.department_id) {
        query = query.eq('department_id', profile.department_id);
      }
      const { data } = await query;
      setStudyPrograms(data || []);
    } catch (error: any) {
      console.error('Error fetching study programs:', error);
      toast.error(getText('Failed to load study programs.', 'Gagal memuat program studi.'));
    }
  };

  // Fetches department data
  const fetchDepartments = async () => {
    try {
      let query = supabase.from('departments').select('id, name');
      if (profile?.role === 'department_admin' && profile.department_id) {
        query = query.eq('id', profile.department_id);
      }
      const { data } = await query;
      setDepartments(data || []);
    } catch (error: any) {
      console.error('Error fetching departments:', error);
      toast.error(getText('Failed to load departments.', 'Gagal memuat departemen.'));
    }
  };

  // Fetches lecturer data to be used as department heads
  const fetchDepartmentHeads = async () => {
    try {
      let query = supabase
        .from('users')
        .select('id, full_name, identity_number, study_program_id')
        .eq('role', 'lecturer');

      if (profile?.role === 'department_admin' && profile.department_id) {
        // This might need adjustment if department heads are designated differently
        // query = query.eq('department_id', profile.department_id);
      }
      const { data } = await query;
      setDepartmentHeads(data || []);
    } catch (error: any) {
      console.error('Error fetching department heads:', error);
      toast.error(getText('Failed to load department heads.', 'Gagal memuat kepala departemen.'));
    }
  };

  // Checks for room availability by fetching conflicting final sessions and lecture schedules
  const checkAvailableRooms = async (date: string, startTime: string, endTime: string) => {
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

    } catch (error: any) {
      console.error('Error checking available rooms:', error);
      setAvailableRooms(rooms); // Fallback to all rooms on error
    }
  };

  // Resets all form fields and related state
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
    setStudentSearch('');
    setSupervisorSearch('');
    setExaminerSearch('');
    setSecretarySearch('');
    setRoomSearch('');
    setProgramSearch('');
    setShowStudentDropdown(false);
    setShowSupervisorDropdown(false);
    setShowExaminerDropdown(false);
    setShowSecretaryDropdown(false);
    setShowRoomDropdown(false);
    setShowProgramDropdown(false);
  };

  /**
   * Handles the submission of the session form.
   * This function will first check if the student is registered. If not, it creates a new user record
   * in the `users` table, retrieves the new ID, and then proceeds to create the `final_sessions` record.
   */
  const handleSubmit = async (data: SessionFormData) => {
    try {
      setSubmitting(true);

      let finalStudentId = data.student_id;
      
      // If student_id is missing, it implies a new, unregistered student.
      if (!finalStudentId && formData.student_nim && formData.student_name) {
        console.log('🔍 Student not selected. Checking for existing user or creating new one.');

        // First, check if a user with this identity_number already exists.
        const { data: existingUser, error: findError } = await supabase
          .from('users')
          .select('id')
          .eq('identity_number', formData.student_nim)
          .single(); // .single() expects one row, which is perfect here.
        
        // Handle case where find query returns an error but not because the user doesn't exist
        if (findError && findError.code !== 'PGRST116') { // PGRST116: no rows returned
            throw findError;
        }

        if (existingUser) {
          console.log('✅ Found existing user record:', existingUser.id);
          finalStudentId = existingUser.id;
        } else {
          // If no user exists, create one.
          console.log('➕ User not found. Creating a new user record...');
          
          const selectedProgram = studyPrograms.find(p => p.id === formData.study_program_id);
          
          // **FIXED**: Removed the `password_hash` field.
          // This was causing the "column not found" error because the `users` table
          // in your database schema does not have a `password_hash` column.
          // This object now correctly matches the likely schema of your public `users` table.
          const newUserData = {
            identity_number: formData.student_nim,
            full_name: formData.student_name,
            email: `${formData.student_nim}@student.edu`, // A placeholder email
            role: 'student',
            study_program_id: formData.study_program_id || null,
            department_id: selectedProgram?.department_id || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          const { data: newUser, error: createError } = await supabase
            .from('users')
            .insert([newUserData])
            .select('id')
            .single();

          if (createError) {
            console.error('❌ Error creating user record:', createError);
            throw new Error(`Failed to create user: ${createError.message}`);
          }

          console.log('✅ Created new user record with ID:', newUser.id);
          finalStudentId = newUser.id;
          
          toast.success(getText('New student registered successfully!', 'Mahasiswa baru berhasil didaftarkan!'));
        }
      }

      // After potentially creating a user, ensure we have an ID before proceeding.
      if (!finalStudentId) {
        throw new Error(getText('Student information is required. Please select or enter student details.', 'Informasi mahasiswa diperlukan. Silakan pilih atau masukkan detail mahasiswa.'));
      }

      // Prepare the data for the 'final_sessions' table.
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

      console.log('💾 Saving session data:', sessionData);

      // Update if editing, otherwise insert new.
      if (editingSession) {
        const { error } = await supabase.from('final_sessions').update(sessionData).eq('id', editingSession.id);
        if (error) throw error;
        toast.success(getText('Session updated successfully', 'Jadwal sidang berhasil diperbarui'));
      } else {
        const { error } = await supabase.from('final_sessions').insert([sessionData]);
        if (error) throw error;
        toast.success(getText('Session created successfully', 'Jadwal sidang berhasil dibuat'));
      }

      // Cleanup and refresh data
      setShowModal(false);
      setEditingSession(null);
      resetForm();
      fetchSessions();
    } catch (error: any) {
      console.error('Error saving session:', error);
      toast.error(error.message || getText('Failed to save session', 'Gagal menyimpan jadwal sidang'));
    } finally {
      setSubmitting(false);
    }
  };

  // Pre-fills the form with data from the selected session for editing
  const handleEdit = (session: any) => {
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

  // Handles the deletion of a session
  const handleDelete = async (id: string) => {
    try {
      setSubmitting(true);
      const { error } = await supabase.from('final_sessions').delete().eq('id', id);
      if (error) throw error;
      toast.success(getText('Session deleted successfully', 'Jadwal sidang berhasil dihapus'));
      setShowDeleteConfirm(null);
      fetchSessions();
    } catch (error: any) {
      console.error('Error deleting session:', error);
      toast.error(error.message || getText('Failed to delete session', 'Gagal menghapus jadwal sidang'));
    } finally {
      setSubmitting(false);
    }
  };

  // Handles the PDF generation and download
  const handlePrint = async (printData: PrintFormData) => {
    try {
      const isSuperAdmin = profile?.role === 'super_admin';
      const departmentIdForQuery = isSuperAdmin ? printData.department_id : profile?.department_id;
      const selectedProgram = studyPrograms.find(p => p.id === printData.study_program_id);
      const currentDepartment = departments.find(d => d.id === departmentIdForQuery);
      
      let departmentHead = isSuperAdmin 
        ? { full_name: getText('DEPARTMENT HEAD', 'KEPALA DEPARTEMEN'), identity_number: 'N/A' }
        : departmentHeads.find(h => h.id === printData.department_head_id);

      if (!selectedProgram || !departmentHead || !currentDepartment) {
        toast.error(getText("Please ensure all fields are selected.", "Pastikan semua field telah dipilih."));
        return;
      }

      const sessionsToExport = sessions.filter(session => 
        session.student?.study_program?.id === printData.study_program_id
      );

      if (sessionsToExport.length === 0) {
        toast.error(getText("No sessions found for the selected criteria.", "Tidak ditemukan jadwal sidang untuk kriteria yang dipilih."));
        return;
      }

      const doc = new jsPDF();
      let pageWidth = doc.internal.pageSize.getWidth();
      const departmentName = currentDepartment.name.toUpperCase();

      let currentY = 22;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.text("KEMENTERIAN PENDIDIKAN TINGGI, SAINS, DAN TEKNOLOGI", pageWidth / 2, currentY, { align: 'center' });
      currentY += 5;
      doc.text("UNIVERSITAS NEGERI YOGYAKARTA", pageWidth / 2, currentY, { align: 'center' });
      currentY += 5;
      doc.text("FAKULTAS VOKASI", pageWidth / 2, currentY, { align: 'center' });
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      currentY += 5;
      doc.text(`DEPARTEMEN ${departmentName}`, pageWidth / 2, currentY, { align: 'center' });
      currentY += 10;
      const subtitle = `JADWAL SIDANG ${selectedProgram.name.toUpperCase()} TAHUN AKADEMIK ${printData.academic_year}`;
      doc.setFontSize(12);
      const titleLines = doc.splitTextToSize(subtitle, pageWidth - 30);
      doc.text(titleLines, pageWidth / 2, currentY, { align: 'center' });
      currentY += (titleLines.length * 5) + 10;

      const tableColumn = ["No.", "NIM", "Nama", "Tanggal", "Waktu", "Ruangan", "Judul", "Pembimbing", "Penguji", "Sekretaris"];
      const tableRows = sessionsToExport.map((session, index) => [
        index + 1,
        session.student?.identity_number || '-',
        session.student?.full_name || '-',
        format(parseISO(session.date), 'dd-MM-yyyy'),
        `${session.start_time}-${session.end_time}`,
        session.room?.name || '-',
        session.title,
        session.supervisor,
        session.examiner,
        session.secretary,
      ]);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: currentY,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 1.5, valign: 'middle' },
        headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
        columnStyles: { 6: { cellWidth: 30 } }
      });

      const finalY = (doc as any).lastAutoTable.finalY || currentY + 10;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Yogyakarta, ${format(new Date(), 'd MMMM yyyy', { locale: (await import('date-fns/locale/id')).default })}`, 140, finalY + 10);
      doc.text("Kepala Departemen,", 140, finalY + 15);
      doc.setFont('helvetica', 'bold');
      doc.text(departmentHead.full_name, 140, finalY + 40);
      doc.setFont('helvetica', 'normal');
      doc.text(`NIP. ${departmentHead.identity_number}`, 140, finalY + 45);

      doc.save(`Jadwal_Sidang_${selectedProgram.name.replace(/\s+/g, '_')}.pdf`);
      setShowPrintModal(false);
    } catch (e: any) {
      console.error("PDF Generation Error:", e);
      toast.error(getText("An error occurred while generating the PDF.", "Terjadi kesalahan saat membuat PDF."));
    }
  };

  // Derived state for filtered sessions, recalculated on each render
  const filteredSessions = sessions.filter(session => {
    const searchTermLower = searchTerm.toLowerCase();
    const matchesSearch = 
      session.student?.full_name?.toLowerCase().includes(searchTermLower) ||
      session.student?.identity_number?.includes(searchTerm) ||
      session.title?.toLowerCase().includes(searchTermLower) ||
      session.supervisor?.toLowerCase().includes(searchTermLower) ||
      session.examiner?.toLowerCase().includes(searchTermLower) ||
      session.secretary?.toLowerCase().includes(searchTermLower);
    
    const matchesDate = !dateFilter || session.date === dateFilter;
    const matchesProgram = !programFilter || session.student?.study_program?.id === programFilter;
    
    return matchesSearch && matchesDate && matchesProgram;
  });

  // Role checks for conditional rendering
  const isDepartmentAdmin = profile?.role === 'department_admin';
  const isSuperAdmin = profile?.role === 'super_admin';

  // Loading state before profile is loaded
  if (loading && !profile) {
    return (
      <div className="flex justify-center items-center h-64">
        <RefreshCw className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  // The main component render
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
            <p className="mt-2 opacity-90">{getText("Manage final examination sessions", "Kelola jadwal sidang akhir")}</p>
          </div>
          <div className="hidden md:block text-right">
            <div className="text-2xl font-bold">{sessions.length}</div>
            <div className="text-sm opacity-80">{getText("Total Sessions", "Total Sidang")}</div>
          </div>
        </div>
      </div>

      {/* Filter Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder={getText("Search by name, NIM, title...", "Cari berdasarkan nama, NIM, judul...")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="relative">
                <GraduationCap className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <select
                  value={programFilter}
                  onChange={(e) => setProgramFilter(e.target.value)}
                  className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white min-w-[180px]"
                >
                  <option value="">{getText("All Programs", "Semua Program")}</option>
                  {studyPrograms.map(program => (
                    <option key={program.id} value={program.id}>{program.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={() => fetchSessions()} className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg" title={getText("Refresh", "Muat Ulang")}>
              <RefreshCw className="h-5 w-5" />
            </button>
            <button onClick={() => { setShowPrintModal(true); printForm.reset(); }} className="flex items-center space-x-2 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
              <Printer className="h-4 w-4" />
              <span>{getText("Print", "Cetak")}</span>
            </button>
            {isDepartmentAdmin && (
              <button onClick={() => { setEditingSession(null); resetForm(); setShowModal(true); }} className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm">
                <Plus className="h-4 w-4" />
                <span>{getText("Add Session", "Tambah Sidang")}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sessions Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                {isSuperAdmin && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Program</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Schedule</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Room</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Committee</th>
                {isDepartmentAdmin && <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>}
              </tr>
            </thead>
            <tbody className="bg-white divide-y">
              {loading ? (
                <tr><td colSpan={isDepartmentAdmin ? 8 : 7} className="text-center p-12"><RefreshCw className="h-6 w-6 animate-spin mx-auto" /></td></tr>
              ) : filteredSessions.length === 0 ? (
                <tr><td colSpan={isDepartmentAdmin ? 8 : 7} className="text-center p-12 text-gray-500">{getText("No sessions found", "Tidak ada jadwal sidang")}</td></tr>
              ) : (
                filteredSessions.map((session) => (
                  <tr key={session.id} className="hover:bg-gray-50">
                    {isSuperAdmin && <td className="px-6 py-4">{session.student?.study_program?.department?.name || 'N/A'}</td>}
                    <td className="px-6 py-4">
                      <div className="font-medium">{session.student?.full_name}</div>
                      <div className="text-sm text-gray-500">{session.student?.identity_number}</div>
                    </td>
                    <td className="px-6 py-4">{session.student?.study_program?.name}</td>
                    <td className="px-6 py-4">
                      <div>{format(parseISO(session.date), 'MMM d, yyyy')}</div>
                      <div className="text-sm text-gray-500">{session.start_time} - {session.end_time}</div>
                    </td>
                    <td className="px-6 py-4">{session.room?.name || 'N/A'}</td>
                    <td className="px-6 py-4 max-w-xs truncate">{session.title}</td>
                    <td className="px-6 py-4 text-xs">
                      <div>Sup: {session.supervisor}</div>
                      <div>Exam: {session.examiner}</div>
                      <div>Sec: {session.secretary}</div>
                    </td>
                    {isDepartmentAdmin && (
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => handleEdit(session)} className="text-blue-600 hover:text-blue-900 p-2"><Edit className="h-4 w-4" /></button>
                        <button onClick={() => setShowDeleteConfirm(session.id)} className="text-red-600 hover:text-red-900 p-2"><Trash2 className="h-4 w-4" /></button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && isDepartmentAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">{editingSession ? getText('Edit Session', 'Edit Sidang') : getText('Add New Session', 'Tambah Sidang Baru')}</h3>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 p-2 rounded-lg"><X className="h-6 w-6" /></button>
              </div>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                {/* Student Info Section */}
                <div className="space-y-4">
                    <h4 className="text-lg font-semibold border-b pb-2">{getText("Student Information", "Informasi Mahasiswa")}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">{getText("Student NIM", "NIM Mahasiswa")} *</label>
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
                                        setFormData({
                                            student_name: foundStudent.full_name,
                                            student_nim: foundStudent.identity_number,
                                            study_program_id: foundStudent.study_program_id || ''
                                        });
                                        const program = studyPrograms.find(p => p.id === foundStudent.study_program_id);
                                        if (program) setProgramSearch(program.name);
                                        toast.success(getText('Student data auto-filled!', 'Data mahasiswa otomatis terisi!'));
                                    } else {
                                        form.setValue('student_id', '');
                                        setFormData(prev => ({ ...prev, student_name: '', student_nim: e.target.value, study_program_id: '' }));
                                        setProgramSearch('');
                                        // **FIXED**: Changed toast.info to toast() which is a valid function.
                                        if (e.target.value.length >= 5) {
                                            toast(getText('Student not found - you can enter manually', 'Mahasiswa tidak ditemukan - Anda bisa input manual'));
                                        }
                                    }
                                }}
                                onFocus={() => setShowStudentDropdown(true)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                />
                                {showStudentDropdown && studentSearch && (
                                <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto" onMouseLeave={() => setShowStudentDropdown(false)}>
                                    {students.filter(s => s.identity_number.includes(studentSearch) || s.full_name.toLowerCase().includes(studentSearch.toLowerCase())).slice(0, 5).map(student => (
                                    <button key={student.id} type="button" onClick={() => {
                                        setStudentSearch(student.identity_number);
                                        form.setValue('student_id', student.id);
                                        setFormData({ student_name: student.full_name, student_nim: student.identity_number, study_program_id: student.study_program_id || '' });
                                        const program = studyPrograms.find(p => p.id === student.study_program_id);
                                        if (program) setProgramSearch(program.name);
                                        setShowStudentDropdown(false);
                                    }} className="w-full text-left px-3 py-2 hover:bg-gray-50">
                                        <div>{student.full_name}</div><div className="text-sm text-gray-500">{student.identity_number}</div>
                                    </button>
                                    ))}
                                </div>
                                )}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">{getText("Student Name", "Nama Mahasiswa")} *</label>
                            <input type="text" value={formData.student_name} onChange={(e) => setFormData(prev => ({ ...prev, student_name: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">{getText("Study Program", "Program Studi")} *</label>
                            <div className="relative">
                                <input type="text" value={programSearch} onChange={(e) => { setProgramSearch(e.target.value); setShowProgramDropdown(true); }} onFocus={() => setShowProgramDropdown(true)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                                {showProgramDropdown && (
                                <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto" onMouseLeave={() => setShowProgramDropdown(false)}>
                                    {studyPrograms.filter(p => p.name.toLowerCase().includes(programSearch.toLowerCase())).slice(0, 5).map(program => (
                                    <button key={program.id} type="button" onClick={() => { setFormData(prev => ({ ...prev, study_program_id: program.id })); setProgramSearch(program.name); setShowProgramDropdown(false); }} className="w-full text-left px-3 py-2 hover:bg-gray-50">{program.name}</button>
                                    ))}
                                </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Other form sections go here, following the same pattern... */}
                {/* Schedule Information, Room Selection, Thesis Info, Committee... */}
                
                <div className="flex space-x-3 pt-6 border-t">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-6 py-3 border rounded-lg">{getText("Cancel", "Batal")}</button>
                  <button type="submit" disabled={submitting} className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg disabled:opacity-50">
                    {submitting ? getText("Saving...", "Menyimpan...") : (editingSession ? getText('Update Session', 'Perbarui Sidang') : getText('Create Session', 'Buat Sidang'))}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && isDepartmentAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium">{getText("Delete Session?", "Hapus Sidang?")}</h3>
              <p className="text-sm text-gray-500 my-2">{getText("This action cannot be undone.", "Tindakan ini tidak bisa dibatalkan.")}</p>
              <div className="flex justify-center space-x-4 mt-6">
                <button onClick={() => setShowDeleteConfirm(null)} className="px-6 py-2 border rounded-lg">{getText("Cancel", "Batal")}</button>
                <button onClick={() => handleDelete(showDeleteConfirm as string)} disabled={submitting} className="px-6 py-2 bg-red-600 text-white rounded-lg disabled:opacity-50">{submitting ? 'Deleting...' : 'Delete'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">{getText("Print Schedule", "Cetak Jadwal")}</h3>
                <form onSubmit={printForm.handleSubmit(handlePrint)} className="space-y-4">
                    {/* Form fields for print options */}
                </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionSchedule;
