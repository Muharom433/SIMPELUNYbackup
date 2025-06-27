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

type PrintFormData = {
  department_id?: string;
  study_program_id: string;
  academic_year: string;
  department_head_id?: string;
};

const SessionSchedule = () => {
  const { profile } = useAuth();
  const { getText } = useLanguage();
  
  // Main state
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [editingSession, setEditingSession] = useState<any | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<any | null>(null);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [programFilter, setProgramFilter] = useState('');

  // Data for dropdowns
  const [students, setStudents] = useState<any[]>([]);
  const [lecturers, setLecturers] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [studyPrograms, setStudyPrograms] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [departmentHeads, setDepartmentHeads] = useState<any[]>([]);
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);

  // Form data state for student info (separated inputs like BookRoom)
  const [formData, setFormData] = useState({
    student_name: '',
    student_nim: '',
    study_program_id: ''
  });

  // Dropdown search states
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

  const printForm = useForm<PrintFormData>();
  const watchDate = form.watch('date');
  const watchStartTime = form.watch('start_time');
  const watchEndTime = form.watch('end_time');

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

  useEffect(() => {
    if (watchDate && watchStartTime && watchEndTime) {
      checkAvailableRooms(watchDate, watchStartTime, watchEndTime);
    } else {
      // Reset to all rooms if no time constraints
      setAvailableRooms(rooms);
    }
  }, [watchDate, watchStartTime, watchEndTime, rooms]);

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
    } catch (error: any) {
      console.error('Error fetching sessions:', error);
      toast.error(getText('Failed to load sessions.', 'Gagal memuat jadwal sidang.'));
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      let query = supabase
        .from('users')
        .select(`
          *,
          study_program:study_programs(
            id,
            name,
            department_id
          )
        `)
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

  const fetchLecturers = async () => {
    try {
      let query = supabase
        .from('users')
        .select(`
          *,
          study_program:study_programs(
            id,
            name,
            department_id
          )
        `)
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

  const fetchRooms = async () => {
    try {
      // TIDAK DIBATASI DENGAN DEPARTEMEN - semua ruangan ditampilkan
      const { data, error } = await supabase.from('rooms').select('*').order('name');
      
      if (error) throw error;
      
      setRooms(data || []);
      setAvailableRooms(data || []);
    } catch (error: any) {
      console.error('Error fetching rooms:', error);
      toast.error(getText('Failed to load rooms.', 'Gagal memuat ruangan.'));
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
    } catch (error: any) {
      console.error('Error fetching study programs:', error);
      toast.error(getText('Failed to load study programs.', 'Gagal memuat program studi.'));
    }
  };

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

  const fetchDepartmentHeads = async () => {
    try {
      let query = supabase
        .from('users')
        .select('id, full_name, identity_number, study_program_id')
        .eq('role', 'lecturer');

      if (profile?.role === 'department_admin' && profile.department_id) {
        query = query.eq('department_id', profile.department_id);
      }

      const { data } = await query;
      setDepartmentHeads(data || []);
    } catch (error: any) {
      console.error('Error fetching department heads:', error);
      toast.error(getText('Failed to load department heads.', 'Gagal memuat kepala departemen.'));
    }
  };

  // Enhanced room availability check that includes lecture schedules
  const checkAvailableRooms = async (date: string, startTime: string, endTime: string) => {
    try {
      console.log('🔍 Checking room availability for:', { date, startTime, endTime });
      
      // Get day name for checking lecture schedules (Indonesian format)
      const dateObj = new Date(date);
      const dayNamesIndonesian = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const dayName = dayNamesIndonesian[dateObj.getDay()];
      
      console.log('📅 Checking for day:', dayName);
      
      // Fetch conflicts from both final_sessions and lecture_schedules
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
      
      console.log('📅 Found final sessions on same date:', finalSessionsResponse.data);
      console.log('📚 Found lecture schedules on same day:', lectureSchedulesResponse.data);
      
      // Get conflicting room IDs from final sessions
      const finalSessionConflicts = (finalSessionsResponse.data || [])
        .filter(session => {
          // Skip if it's the current session being edited
          if (editingSession && session.id === editingSession.id) {
            console.log('⏭️ Skipping current editing session');
            return false;
          }
          
          // Check for time overlap
          const sessionStart = session.start_time;
          const sessionEnd = session.end_time;
          
          if (!sessionStart || !sessionEnd) {
            console.log('⚠️ Session missing time data');
            return false;
          }
          
          // Time overlap logic: 
          // Overlap occurs if: start_time < session_end_time AND end_time > session_start_time
          const hasOverlap = startTime < sessionEnd && endTime > sessionStart;
          
          if (hasOverlap) {
            console.log('❌ Final session time conflict found:', {
              sessionTime: `${sessionStart}-${sessionEnd}`,
              newTime: `${startTime}-${endTime}`,
              roomId: session.room_id
            });
          }
          
          return hasOverlap;
        })
        .map(session => session.room_id)
        .filter(Boolean);

      // Get conflicting room IDs from lecture schedules
      const lectureScheduleConflicts = (lectureSchedulesResponse.data || [])
        .filter(schedule => {
          const scheduleStart = schedule.start_time;
          const scheduleEnd = schedule.end_time;
          
          if (!scheduleStart || !scheduleEnd || !schedule.room) {
            return false;
          }
          
          // Convert input times to comparable format (HH:mm:ss)
          let sessionStartTime, sessionEndTime;
          
          if (startTime.includes('T')) {
            // If datetime-local format (YYYY-MM-DDTHH:mm)
            sessionStartTime = startTime.split('T')[1] + ':00'; // Add seconds
            sessionEndTime = endTime.split('T')[1] + ':00'; // Add seconds
          } else {
            // If already time format (HH:mm or HH:mm:ss)
            sessionStartTime = startTime.includes(':') && startTime.split(':').length === 2 ? startTime + ':00' : startTime;
            sessionEndTime = endTime.includes(':') && endTime.split(':').length === 2 ? endTime + ':00' : endTime;
          }
          
          // Ensure schedule times have seconds
          const normalizedScheduleStart = scheduleStart.includes(':') && scheduleStart.split(':').length === 2 ? scheduleStart + ':00' : scheduleStart;
          const normalizedScheduleEnd = scheduleEnd.includes(':') && scheduleEnd.split(':').length === 2 ? scheduleEnd + ':00' : scheduleEnd;
          
          // Time overlap logic for lecture schedules
          const hasOverlap = sessionStartTime < normalizedScheduleEnd && sessionEndTime > normalizedScheduleStart;
          
          if (hasOverlap) {
            console.log('❌ Lecture schedule time conflict found:', {
              scheduleTime: `${normalizedScheduleStart}-${normalizedScheduleEnd}`,
              newTime: `${sessionStartTime}-${sessionEndTime}`,
              room: schedule.room
            });
          }
          
          return hasOverlap;
        });

      // Map lecture schedule room names to room IDs
      const lectureRoomIds = [];
      for (const conflictSchedule of lectureScheduleConflicts) {
        const matchingRoom = rooms.find(room => 
          room.name.toLowerCase() === conflictSchedule.room.toLowerCase()
        );
        if (matchingRoom) {
          lectureRoomIds.push(matchingRoom.id);
        }
      }
      
      // Combine all conflicting room IDs
      const allConflictingRoomIds = [...finalSessionConflicts, ...lectureRoomIds];
      
      console.log('🚫 All conflicting room IDs:', allConflictingRoomIds);
      
      // Filter available rooms - SEMUA RUANGAN TERSEDIA (tidak dibatasi departemen)
      const available = rooms.filter(room => !allConflictingRoomIds.includes(room.id));
      setAvailableRooms(available);
      
      console.log(`📊 Available rooms: ${available.length}/${rooms.length}`);
    } catch (error: any) {
      console.error('Error checking available rooms:', error);
      setAvailableRooms(rooms);
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
    
    setFormData({
      student_name: '',
      student_nim: '',
      study_program_id: ''
    });
    
    setStudentSearch('');
    setSupervisorSearch('');
    setExaminerSearch('');
    setSecretarySearch('');
    setRoomSearch('');
    setProgramSearch('');
    
    // Reset dropdown visibility
    setShowStudentDropdown(false);
    setShowSupervisorDropdown(false);
    setShowExaminerDropdown(false);
    setShowSecretaryDropdown(false);
    setShowRoomDropdown(false);
    setShowProgramDropdown(false);
  };

  const handleSubmit = async (data: SessionFormData) => {
    try {
      setSubmitting(true);

      let finalStudentId = data.student_id;
      
      // If no student_id (manual entry), create/find user first
      if (!finalStudentId && formData.student_nim && formData.student_name) {
        console.log('🔍 Creating/finding user for manual entry:', {
          nim: formData.student_nim,
          name: formData.student_name,
          program: formData.study_program_id
        });

        // Check if user already exists
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('identity_number', formData.student_nim)
          .single();

        if (existingUser) {
          console.log('✅ Found existing user:', existingUser.id);
          finalStudentId = existingUser.id;
        } else {
          // Create new user (auto-register like BookRoom)
          console.log('➕ Creating new user...');
          
          const selectedProgram = studyPrograms.find(p => p.id === formData.study_program_id);
          const newUserData = {
            identity_number: formData.student_nim,
            full_name: formData.student_name,
            email: `${formData.student_nim}@student.edu`,
            role: 'student',
            study_program_id: formData.study_program_id || null,
            department_id: selectedProgram?.department_id || null,
            // Set default password or generate one
            password_hash: 'temp_password_hash', // This should be properly hashed
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          const { data: newUser, error: createError } = await supabase
            .from('users')
            .insert([newUserData])
            .select('id')
            .single();

          if (createError) {
            console.error('❌ Error creating user:', createError);
            throw new Error(`Failed to create user: ${createError.message}`);
          }

          console.log('✅ Created new user:', newUser.id);
          finalStudentId = newUser.id;
          
          // Show success message for user creation
          toast.success(getText('New student registered successfully!', 'Mahasiswa baru berhasil didaftarkan!'));
        }
      }

      // Validate we have a student ID
      if (!finalStudentId) {
        throw new Error(getText('Student information is required', 'Informasi mahasiswa diperlukan'));
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

      console.log('💾 Saving session data:', sessionData);

      if (editingSession) {
        const { error } = await supabase
          .from('final_sessions')
          .update(sessionData)
          .eq('id', editingSession.id);
        if (error) throw error;
        toast.success(getText('Session updated successfully', 'Jadwal sidang berhasil diperbarui'));
      } else {
        const { error } = await supabase
          .from('final_sessions')
          .insert([sessionData]);
        if (error) throw error;
        toast.success(getText('Session created successfully', 'Jadwal sidang berhasil dibuat'));
      }

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

  const handleEdit = (session: any) => {
    setEditingSession(session);
    
    // Set form values
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
    
    // Set display values
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

  const handleDelete = async (id: string) => {
    try {
      setSubmitting(true);
      const { error } = await supabase
        .from('final_sessions')
        .delete()
        .eq('id', id);
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

  const handlePrint = async (formData: PrintFormData) => {
    try {
      const isSuperAdmin = profile?.role === 'super_admin';
      const departmentIdForQuery = isSuperAdmin ? formData.department_id : profile.department_id;
      const selectedProgram = studyPrograms.find(p => p.id === formData.study_program_id);
      const currentDepartment = departments.find(d => d.id === departmentIdForQuery);
      
      let departmentHead;
      if (isSuperAdmin) {
        departmentHead = { full_name: getText('DEPARTMENT HEAD', 'KEPALA DEPARTEMEN'), identity_number: '123' };
      } else {
        departmentHead = departmentHeads.find(h => h.id === formData.department_head_id);
      }

      if (!selectedProgram || !departmentHead || !currentDepartment) {
        toast.error(getText("Please ensure all fields are selected and data is loaded.", "Pastikan semua field telah dipilih dan data telah dimuat."));
        return;
      }

      const sessionsToExport = sessions.filter(session => 
        session.student?.study_program?.id === formData.study_program_id
      );

      if (sessionsToExport.length === 0) {
        toast.error(getText("No sessions found for the selected criteria.", "Tidak ditemukan jadwal sidang untuk kriteria yang dipilih."));
        return;
      }

      const doc = new jsPDF();
      let pageWidth = doc.internal.pageSize.getWidth();
      const departmentName = currentDepartment.name.toUpperCase();

      // Header
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

      const subtitle = `JADWAL SIDANG ${selectedProgram.name.toUpperCase()} TAHUN AKADEMIK ${formData.academic_year}`;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      const titleMaxWidth = pageWidth - 30;
      const titleLines = doc.splitTextToSize(subtitle, titleMaxWidth);
      doc.text(titleLines, pageWidth / 2, currentY, { align: 'center' });
      currentY += (titleLines.length * 5) + 10;

      const tableColumn = [
        getText("No.", "No."),
        getText("NIM", "NIM"),
        getText("Name", "Nama"),
        getText("Date", "Tanggal"),
        getText("Time", "Waktu"),
        getText("Room", "Ruangan"),
        getText("Title", "Judul"),
        getText("Supervisor", "Pembimbing"),
        getText("Examiner", "Penguji"),
        getText("Secretary", "Sekretaris")
      ];

      const tableRows: any[] = [];
      sessionsToExport.forEach((session, index) => {
        tableRows.push([
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
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: currentY,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 1.5, valign: 'middle' },
        headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
        columnStyles: {
          0: { halign: 'center', cellWidth: 10 },
          1: { halign: 'center', cellWidth: 20 },
          2: { halign: 'left', cellWidth: 25 },
          3: { halign: 'center', cellWidth: 20 },
          4: { halign: 'center', cellWidth: 20 },
          5: { halign: 'center', cellWidth: 15 },
          6: { halign: 'left', cellWidth: 30 },
          7: { halign: 'left', cellWidth: 25 },
          8: { halign: 'left', cellWidth: 25 },
          9: { halign: 'left', cellWidth: 25 }
        }
      });

      // Signature
      const finalY = (doc as any).lastAutoTable.finalY || 100;
      const signatureX = 140;
      const signatureY = finalY + 10;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Yogyakarta, ${format(new Date(), 'd MMMM yyyy')}`, signatureX, signatureY);
      doc.text(getText("Department Head,", "Kepala Departemen,"), signatureX, signatureY + 5);

      const nameY = signatureY + 30;
      doc.setFont('helvetica', 'bold');
      doc.text(departmentHead.full_name, signatureX, nameY);

      const nipY = nameY + 5;
      doc.setFont('helvetica', 'normal');
      doc.text(`NIP. ${departmentHead.identity_number}`, signatureX, nipY);

      doc.save(`Jadwal_Sidang_${selectedProgram.name.replace(/\s+/g, '_')}.pdf`);
      setShowPrintModal(false);
    } catch (e: any) {
      console.error("PDF Generation Error:", e);
      toast.error(getText("An unexpected error occurred while generating the PDF.", "Terjadi kesalahan tak terduga saat membuat PDF."));
    }
  };

  const filteredSessions = sessions.filter(session => {
    const matchesSearch = 
      session.student?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.student?.identity_number?.includes(searchTerm) ||
      session.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.supervisor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.examiner?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.secretary?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDate = !dateFilter || session.date === dateFilter;
    const matchesProgram = !programFilter || session.student?.study_program?.id === programFilter;
    
    return matchesSearch && matchesDate && matchesProgram;
  });

  const isDepartmentAdmin = profile?.role === 'department_admin';
  const isSuperAdmin = profile?.role === 'super_admin';

  if (loading && !profile) {
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
            <p className="mt-2 opacity-90">{getText("Manage final examination sessions", "Kelola jadwal sidang akhir")}</p>
          </div>
          <div className="hidden md:block text-right">
            <div className="text-2xl font-bold">{sessions.length}</div>
            <div className="text-sm opacity-80">{getText("Total Sessions", "Total Sidang")}</div>
          </div>
        </div>
      </div>

      {/* Enhanced Filter Section */}
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
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
              />
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                />
              </div>
              <div className="relative">
                <GraduationCap className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <select
                  value={programFilter}
                  onChange={(e) => setProgramFilter(e.target.value)}
                  className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 appearance-none bg-white min-w-[180px]"
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
            <button
              onClick={() => fetchSessions()}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200"
              title={getText("Refresh", "Muat Ulang")}
            >
              <RefreshCw className="h-5 w-5" />
            </button>
            <button
              onClick={() => {
                setShowPrintModal(true);
                printForm.reset();
              }}
              className="flex items-center space-x-2 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
            >
              <Printer className="h-4 w-4" />
              <span>{getText("Print", "Cetak")}</span>
            </button>
            {isDepartmentAdmin && (
              <button
                onClick={() => {
                  setEditingSession(null);
                  resetForm();
                  setShowModal(true);
                }}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <Plus className="h-4 w-4" />
                <span>{getText("Add Session", "Tambah Sidang")}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Enhanced Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
              <tr>
                {isSuperAdmin && (
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    <div className="flex items-center space-x-1">
                      <Building className="h-4 w-4" />
                      <span>{getText("Department", "Departemen")}</span>
                    </div>
                  </th>
                )}
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <div className="flex items-center space-x-1">
                    <User className="h-4 w-4" />
                    <span>{getText("Student", "Mahasiswa")}</span>
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <div className="flex items-center space-x-1">
                    <GraduationCap className="h-4 w-4" />
                    <span>{getText("Program", "Program")}</span>
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-4 w-4" />
                    <span>{getText("Schedule", "Jadwal")}</span>
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <div className="flex items-center space-x-1">
                    <MapPin className="h-4 w-4" />
                    <span>{getText("Room", "Ruangan")}</span>
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <div className="flex items-center space-x-1">
                    <BookOpen className="h-4 w-4" />
                    <span>{getText("Title", "Judul")}</span>
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <div className="flex items-center space-x-1">
                    <Users className="h-4 w-4" />
                    <span>{getText("Committee", "Panitia")}</span>
                  </div>
                </th>
                {isDepartmentAdmin && (
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    {getText("Actions", "Aksi")}
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={isDepartmentAdmin ? 8 : (isSuperAdmin ? 8 : 7)} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <RefreshCw className="h-6 w-6 animate-spin text-blue-600 mr-2" />
                      <span className="text-gray-600">{getText("Loading sessions...", "Memuat jadwal sidang...")}</span>
                    </div>
                  </td>
                </tr>
              ) : filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={isDepartmentAdmin ? 8 : (isSuperAdmin ? 8 : 7)} className="px-6 py-12 text-center">
                    <div className="text-gray-500">
                      <UserCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium mb-2">{getText("No sessions found", "Tidak ada jadwal sidang ditemukan")}</p>
                      <p>{getText("Try adjusting your search or filters", "Coba sesuaikan pencarian atau filter Anda")}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredSessions.map((session) => (
                  <tr key={session.id} className="hover:bg-gray-50 transition-colors duration-200">
                    {isSuperAdmin && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-8 w-8 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
                            <Building className="h-4 w-4 text-white" />
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">{session.student?.study_program?.department?.name || 'N/A'}</div>
                          </div>
                        </div>
                      </td>
                    )}
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
                      <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full inline-block">
                        {session.student?.study_program?.name}
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
                      <div className="text-sm text-gray-900 max-w-xs truncate" title={session.title}>
                        {session.title}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs space-y-1">
                        <div><span className="font-medium text-blue-600">{getText('Supervisor', 'Pembimbing')}:</span> {session.supervisor}</div>
                        <div><span className="font-medium text-green-600">{getText('Examiner', 'Penguji')}:</span> {session.examiner}</div>
                        <div><span className="font-medium text-purple-600">{getText('Secretary', 'Sekretaris')}:</span> {session.secretary}</div>
                      </div>
                    </td>
                    {isDepartmentAdmin && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleEdit(session)}
                            className="text-blue-600 hover:text-blue-900 p-2 rounded-lg hover:bg-blue-50 transition-all duration-200"
                            title={getText("Edit session", "Edit jadwal sidang")}
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(session.id)}
                            className="text-red-600 hover:text-red-900 p-2 rounded-lg hover:bg-red-50 transition-all duration-200"
                            title={getText("Delete session", "Hapus jadwal sidang")}
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

      {/* Add/Edit Modal */}
      {showModal && isDepartmentAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
                  <UserCheck className="h-6 w-6 text-blue-600" />
                  <span>{editingSession ? getText('Edit Session Schedule', 'Edit Jadwal Sidang') : getText('Add New Session Schedule', 'Tambah Jadwal Sidang Baru')}</span>
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                {/* Student Information - Separated like BookRoom */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-3 pb-4 border-b border-gray-200">
                    <User className="h-5 w-5 text-blue-500" />
                    <h4 className="text-lg font-semibold text-gray-800">{getText("Student Information", "Informasi Mahasiswa")}</h4>
                  </div>
                  
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
                            
                            // Auto-search for existing students
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
                              toast.success(getText('Student data auto-filled!', 'Data mahasiswa otomatis terisi!'));
                            } else {
                              // Clear student_id for manual entry
                              form.setValue('student_id', '');
                              setFormData(prev => ({
                                ...prev,
                                student_name: '',
                                student_nim: e.target.value,
                                study_program_id: ''
                              }));
                              setProgramSearch('');
                              
                              // Show info for manual entry
                              if (e.target.value.length >= 5) {
                                toast.info(getText('Student not found - you can enter manually', 'Mahasiswa tidak ditemukan - Anda bisa input manual'));
                              }
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
                                    toast.success(getText('Student data auto-filled!', 'Data mahasiswa otomatis terisi!'));
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
                                {getText('No students found - you can enter manually', 'Tidak ada mahasiswa ditemukan - Anda bisa input manual')}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">{getText("Student Name", "Nama Mahasiswa")} *</label>
                      <input
                        type="text"
                        value={formData.student_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, student_name: e.target.value }))}
                        placeholder={getText("Enter student name...", "Masukkan nama mahasiswa...")}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">{getText("Study Program", "Program Studi")} *</label>
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
                  
                  {/* Info box for manual entry */}
                  {studentSearch && !form.getValues('student_id') && formData.student_nim && (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
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

                {/* Schedule Information */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-3 pb-4 border-b border-gray-200">
                    <Calendar className="h-5 w-5 text-blue-500" />
                    <h4 className="text-lg font-semibold text-gray-800">{getText("Schedule Information", "Informasi Jadwal")}</h4>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">{getText("Date", "Tanggal")} *</label>
                      <input
                        {...form.register('date')}
                        type="date"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      {form.formState.errors.date && (
                        <p className="mt-1 text-sm text-red-600">{form.formState.errors.date.message}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">{getText("Start Time", "Waktu Mulai")} *</label>
                      <input
                        {...form.register('start_time')}
                        type="time"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      {form.formState.errors.start_time && (
                        <p className="mt-1 text-sm text-red-600">{form.formState.errors.start_time.message}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">{getText("End Time", "Waktu Selesai")} *</label>
                      <input
                        {...form.register('end_time')}
                        type="time"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      {form.formState.errors.end_time && (
                        <p className="mt-1 text-sm text-red-600">{form.formState.errors.end_time.message}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Room Selection */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-3 pb-4 border-b border-gray-200">
                    <MapPin className="h-5 w-5 text-blue-500" />
                    <h4 className="text-lg font-semibold text-gray-800">{getText("Room Selection", "Pilihan Ruangan")}</h4>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{getText("Room", "Ruangan")} *</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={roomSearch}
                        onChange={(e) => {
                          setRoomSearch(e.target.value);
                          setShowRoomDropdown(true);
                        }}
                        onFocus={() => setShowRoomDropdown(true)}
                        placeholder={getText('Search and select room...', 'Cari dan pilih ruangan...')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      
                      {showRoomDropdown && (
                        <div 
                          className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto"
                          onMouseLeave={() => setShowRoomDropdown(false)}
                        >
                          {availableRooms
                            .filter(room => room.name.toLowerCase().includes(roomSearch.toLowerCase()))
                            .slice(0, 10)
                            .map(room => (
                              <button
                                key={room.id}
                                type="button"
                                onClick={() => {
                                  form.setValue('room_id', room.id);
                                  setRoomSearch(room.name);
                                  setShowRoomDropdown(false);
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                              >
                                <div className="font-medium">{room.name}</div>
                                <div className="text-sm text-gray-500">{room.code || 'No Code'} • Kapasitas: {room.capacity || '-'}</div>
                              </button>
                            ))
                          }
                          {availableRooms.filter(room => room.name.toLowerCase().includes(roomSearch.toLowerCase())).length === 0 && (
                            <div className="px-3 py-2 text-gray-500 text-sm">
                              {getText('No available rooms found', 'Tidak ada ruangan tersedia ditemukan')}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {form.formState.errors.room_id && (
                      <p className="mt-1 text-sm text-red-600">{form.formState.errors.room_id.message}</p>
                    )}
                    {watchStartTime && watchEndTime && watchDate && (
                      <p className="mt-2 text-sm text-gray-600">
                        💡 {getText(`Showing ${availableRooms.length} available rooms (all rooms, not limited by department) for ${watchDate} from ${watchStartTime} to ${watchEndTime}`, `Menampilkan ${availableRooms.length} ruangan tersedia (semua ruangan, tidak dibatasi departemen) untuk ${watchDate} dari ${watchStartTime} sampai ${watchEndTime}`)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Title */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-3 pb-4 border-b border-gray-200">
                    <BookOpen className="h-5 w-5 text-blue-500" />
                    <h4 className="text-lg font-semibold text-gray-800">{getText("Thesis Information", "Informasi Skripsi")}</h4>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{getText("Thesis Title", "Judul Skripsi/Tesis")} *</label>
                    <textarea
                      {...form.register('title')}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder={getText("Enter the complete thesis title...", "Masukkan judul lengkap skripsi/tesis...")}
                    />
                    {form.formState.errors.title && (
                      <p className="mt-1 text-sm text-red-600">{form.formState.errors.title.message}</p>
                    )}
                  </div>
                </div>

                {/* Committee Members - Always show all lecturers from department */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-3 pb-4 border-b border-gray-200">
                    <Users className="h-5 w-5 text-blue-500" />
                    <h4 className="text-lg font-semibold text-gray-800">{getText("Committee Members", "Anggota Panitia")}</h4>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">{getText("Supervisor", "Pembimbing")} *</label>
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
                                    form.setValue('supervisor', lecturer.full_name);
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
                      {form.formState.errors.supervisor && (
                        <p className="mt-1 text-sm text-red-600">{form.formState.errors.supervisor.message}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">{getText("Examiner", "Penguji")} *</label>
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
                                    form.setValue('examiner', lecturer.full_name);
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
                      {form.formState.errors.examiner && (
                        <p className="mt-1 text-sm text-red-600">{form.formState.errors.examiner.message}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">{getText("Secretary", "Sekretaris")} *</label>
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
                                    form.setValue('secretary', lecturer.full_name);
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
                      {form.formState.errors.secretary && (
                        <p className="mt-1 text-sm text-red-600">{form.formState.errors.secretary.message}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-3 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingSession(null);
                      resetForm();
                    }}
                    className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-medium"
                  >
                    {getText("Cancel", "Batal")}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-sm hover:shadow-md"
                  >
                    {submitting ? (
                      <span className="flex items-center justify-center space-x-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>{getText("Saving...", "Menyimpan...")}</span>
                      </span>
                    ) : (
                      <span className="flex items-center justify-center space-x-2">
                        <UserCheck className="h-4 w-4" />
                        <span>{editingSession ? getText('Update Session', 'Perbarui Sidang') : getText('Create Session', 'Buat Sidang')}</span>
                      </span>
                    )}
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
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0 h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">{getText("Delete Session Schedule", "Hapus Jadwal Sidang")}</h3>
                  <p className="text-sm text-gray-500 mt-1">{getText("This action cannot be undone", "Tindakan ini tidak dapat dibatalkan")}</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-6">
                {getText("Are you sure you want to delete this session schedule? All associated data will be permanently removed.", "Apakah Anda yakin ingin menghapus jadwal sidang ini? Semua data terkait akan dihapus secara permanen.")}
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all duration-200 font-medium"
                >
                  {getText("Cancel", "Batal")}
                </button>
                <button
                  onClick={() => handleDelete(showDeleteConfirm as string)}
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-all duration-200 font-medium"
                >
                  {submitting ? getText('Deleting...', 'Menghapus...') : getText('Delete', 'Hapus')}
                </button>
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
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                  <Printer className="h-6 w-6 text-blue-600" />
                  <span>{getText("Print Session Schedule", "Cetak Jadwal Sidang")}</span>
                </h3>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <form onSubmit={printForm.handleSubmit(handlePrint)} className="space-y-4">
                {isSuperAdmin && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{getText("Department", "Departemen")} *</label>
                    <select
                      {...printForm.register('department_id')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">{getText("Select department...", "Pilih departemen...")}</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{getText("Study Program", "Program Studi")} *</label>
                  <select
                    {...printForm.register('study_program_id')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">{getText("Select study program...", "Pilih program studi...")}</option>
                    {studyPrograms.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{getText("Academic Year", "Tahun Akademik")} *</label>
                  <input
                    {...printForm.register('academic_year')}
                    type="text"
                    placeholder={getText("e.g. 2024/2025", "contoh: 2024/2025")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                {isDepartmentAdmin && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{getText("Department Head", "Kepala Departemen")} *</label>
                    <select
                      {...printForm.register('department_head_id')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">{getText("Select department head...", "Pilih kepala departemen...")}</option>
                      {departmentHeads.map(h => (
                        <option key={h.id} value={h.id}>{h.full_name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowPrintModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all duration-200 font-medium"
                  >
                    {getText("Cancel", "Batal")}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 font-medium flex items-center justify-center space-x-2"
                  >
                    <Printer className="h-4 w-4" />
                    <span>{getText("Generate PDF", "Buat PDF")}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionSchedule;