import React, { useState, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Select from 'react-select';
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
  Shield,
  Power,
  PowerOff,
  Building,
  BookOpen,
  Clock,
  MapPin,
  GraduationCap,
  Eye
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import logoUNY from '../assets/logouny.png';

const examSchema = z.object({
  course_name: z.string().min(1, 'Course name is required'),
  course_code: z.string().min(1, 'Course code is required'),
  date: z.string().min(1, 'Date is required'),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  is_take_home: z.boolean().default(false),
  semester: z.number().min(1, 'Semester must be at least 1').max(8, 'Semester cannot exceed 8'),
  class: z.string().min(1, 'Class is required'),
  student_amount: z.number().min(0, 'Student amount cannot be negative'),
  room_id: z.string().optional(),
  lecturer_id: z.string().min(1, 'Lecturer is required'),
  inspector: z.string().min(1, 'Inspector is required'),
  study_program_id: z.string().min(1, 'Study program is required'),
}).superRefine((data, ctx) => {
    // If not take home, start_time and end_time are required
    if (!data.is_take_home) {
        if (!data.start_time) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['start_time'],
                message: 'Start time is required for scheduled exams.',
            });
        }
        if (!data.end_time) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['end_time'],
                message: 'End time is required for scheduled exams.',
            });
        }
        if (data.start_time && data.end_time && data.start_time >= data.end_time) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['end_time'],
                message: 'End time must be after start time.',
            });
        }
        // Room required for scheduled exams
        if (!data.room_id || data.room_id === '') {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['room_id'],
                message: 'Room is required for scheduled exams.',
            });
        }
    }
});

type ExamFormData = z.infer<typeof examSchema>;

type PrintFormData = {
    department_id?: string;
    study_program_id: string;
    semester: 'GASAL' | 'GENAP';
    academic_year: string;
    department_head_id?: string;
    department_head_name?: string;
};

const getImageDataUrl = async (url: string): Promise<string> => {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

const ExamManagement = () => {
    const { profile } = useAuth();
    const [exams, setExams] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [editingExam, setEditingExam] = useState<any | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<any | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    const [timeFilter, setTimeFilter] = useState('');
    const [semesterFilter, setSemesterFilter] = useState('all');
    const [rooms, setRooms] = useState<any[]>([]);
    const [lecturers, setLecturers] = useState<any[]>([]);
    const [studyPrograms, setStudyPrograms] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [departmentHeads, setDepartmentHeads] = useState<any[]>([]);
    const [bookedRooms, setBookedRooms] = useState<any>({});
    const [filteredLecturers, setFilteredLecturers] = useState<any[]>([]);
    const [examModeEnabled, setExamModeEnabled] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [printSelectedDepartment, setPrintSelectedDepartment] = useState<string>('');

    const printSchema = useMemo(() => {
        return z.object({
            department_id: z.string().optional(),
            study_program_id: z.string().min(1, 'Study Program is required'),
            semester: z.enum(['GASAL', 'GENAP'], { required_error: 'Semester type is required' }),
            academic_year: z.string().min(9, 'Academic Year is required (e.g., 2023/2024)').regex(/^\d{4}\/\d{4}$/, 'Invalid format. Use (`YYYY/YYYY`)'),
            department_head_id: z.string().optional(),
            department_head_name: z.string().optional(),
        }).superRefine((data, ctx) => {
            if (profile?.role === 'super_admin' && !data.department_id) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['department_id'],
                    message: 'Department is required for Super Admin.',
                });
            }
            if (profile?.role === 'department_admin' && !data.department_head_id) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['department_head_id'],
                    message: 'Department Head is required.',
                });
            }
        });
    }, [profile?.role]);

    const form = useForm<ExamFormData>({ 
        resolver: zodResolver(examSchema), 
        defaultValues: { 
            course_name: '', 
            course_code: '', 
            date: format(new Date(), 'yyyy-MM-dd'), 
            start_time: '', 
            end_time: '', 
            is_take_home: false,
            semester: 1, 
            class: '', 
            student_amount: 0, 
            room_id: '', 
            lecturer_id: '',
            inspector: '',
            study_program_id: '', 
        }, 
    });

    const printForm = useForm<PrintFormData>({ resolver: zodResolver(printSchema) });
    const watchDate = form.watch('date');
    const watchStartTime = form.watch('start_time');
    const watchEndTime = form.watch('end_time');
    const watchIsTakeHome = form.watch('is_take_home');
    const watchStudyProgramId = form.watch('study_program_id');

    useEffect(() => {
        if (profile) {
            fetchExamModeStatus();
            fetchExams();
            fetchRooms();
            fetchLecturers();
            fetchStudyPrograms();
            fetchDepartments();
            fetchDepartmentHeads();
        }
    }, [profile]);

    useEffect(() => { 
        if (watchDate && watchStartTime && watchEndTime && !watchIsTakeHome) { 
            fetchBookedRooms(watchDate, watchStartTime, watchEndTime); 
        } 
    }, [watchDate, watchStartTime, watchEndTime, watchIsTakeHome]);

    useEffect(() => { 
        if (watchStudyProgramId) { 
            filterLecturersByStudyProgram(watchStudyProgramId); 
            form.setValue('lecturer_id', '');
            form.setValue('inspector', '');
        } else { 
            setFilteredLecturers(lecturers); 
        } 
    }, [watchStudyProgramId, lecturers]);
    
    useEffect(() => {
        if (profile?.role === 'super_admin') {
            printForm.setValue('study_program_id', '');
        }
    }, [printSelectedDepartment, profile?.role, printForm]);

    const fetchExamModeStatus = async () => { 
        try { 
            setLoading(true); 
            const { data, error } = await supabase
                .from('system_settings')
                .select('setting_value')
                .eq('id', 'b78e1661-7cdd-4ee0-b495-bf260a8a274c')
                .single(); 
            if (error) throw error; 
            if (data) { 
                setExamModeEnabled(data.setting_value === 'true'); 
            } 
        } catch (error) { 
            console.error('Error fetching exam mode status:', error); 
            setExamModeEnabled(false); 
        } finally { 
            setLoading(false); 
        } 
    };

    const handleModeChange = () => { 
        if (profile?.role !== 'super_admin') return; 
        setShowClearConfirm(true); 
    };

    const confirmClearAndToggleMode = async () => { 
        setLoading(true); 
        try { 
            const { error: deleteError } = await supabase
                .from('exams')
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000'); 
            if (deleteError) throw deleteError; 
            const newMode = !examModeEnabled; 
            const { error: updateError } = await supabase
                .from('system_settings')
                .update({ setting_value: newMode.toString() })
                .eq('id', 'b78e1661-7cdd-4ee0-b495-bf260a8a274c'); 
            if (updateError) throw updateError; 
            setExamModeEnabled(newMode); 
            setExams([]); 
            toast.success(`Exam Mode has been ${newMode ? 'enabled' : 'disabled'} and all previous schedules have been cleared.`); 
        } catch (error: any) { 
            console.error('Error updating exam mode:', error); 
            toast.error('Failed to update exam mode.'); 
        } finally { 
            setLoading(false); 
            setShowClearConfirm(false); 
        } 
    };

    const fetchExams = async () => { 
        try { 
            let query = supabase
                .from('exams')
                .select('*, room:rooms(*), lecturer:users!lecturer_id(*), department:departments(*), study_program:study_programs(*)'); 
            if (profile?.role === 'department_admin' && profile?.department_id) { 
                query = query.eq('department_id', profile.department_id); 
            } 
            query = query.order('date', { ascending: true }); 
            const { data, error } = await query; 
            if (error) throw error; 
            setExams(data || []); 
        } catch (error: any) { 
            console.error('Error fetching exams:', error); 
            toast.error('Failed to load exams.'); 
        } 
    };

    const fetchStudyPrograms = async () => { 
        try { 
            let query = supabase.from('study_programs').select('*'); 
            if (profile?.role === 'department_admin' && profile?.department_id) { 
                query = query.eq('department_id', profile.department_id); 
            } 
            const { data, error } = await query; 
            if (error) throw error; 
            setStudyPrograms(data || []); 
        } catch (error: any) { 
            console.error('Error fetching study programs:', error); 
            toast.error('Failed to load study programs.'); 
        } 
    };

    const fetchRooms = async () => { 
        try { 
            let query = supabase.from('rooms').select('*'); 
            if (profile?.role === 'department_admin' && profile?.department_id) { 
                query = query.or(`department_id.eq.${profile.department_id},department_id.is.null`); 
            } 
            const { data, error } = await query; 
            if (error) throw error; 
            setRooms(data || []); 
        } catch (error: any) { 
            console.error('Error fetching rooms:', error); 
            toast.error('Failed to load rooms.'); 
        } 
    };

    const fetchLecturers = async () => { 
        try { 
            let query = supabase
                .from('users')
                .select('*')
                .eq('role', 'lecturer'); 
            if (profile?.role === 'department_admin' && profile?.department_id) { 
                query = query.eq('department_id', profile.department_id); 
            } 
            const { data, error } = await query; 
            if (error) throw error; 
            setLecturers(data || []); 
            setFilteredLecturers(data || []); 
        } catch (error: any) { 
            console.error('Error fetching lecturers:', error); 
            toast.error('Failed to load lecturers.'); 
        } 
    };

    const fetchDepartments = async () => { 
        try { 
            let query = supabase.from('departments').select('id, name'); 
            if (profile?.role === 'department_admin' && profile.department_id) { 
                query = query.eq('id', profile.department_id); 
            } 
            const { data, error } = await query; 
            if (error) throw error; 
            setDepartments(data || []); 
        } catch (error: any) { 
            console.error('Error fetching departments:', error); 
            toast.error('Failed to load departments.'); 
        } 
    };

    const fetchDepartmentHeads = async () => { 
        try {  
            let query = supabase
                .from('users')
                .select('id, full_name, identity_number, department_id')
                .eq('role', 'lecturer'); 

            if (profile?.role === 'department_admin' && profile.department_id) {
                query = query.eq('department_id', profile.department_id);
            }

            const { data, error } = await query;
            if (error) throw error;
            setDepartmentHeads(data || []); 
        } catch (error: any) { 
            console.error('Error fetching department heads:', error); 
            toast.error('Failed to load department heads.'); 
        } 
    };

    const fetchBookedRooms = async (date: string, startTime: string, endTime: string) => { 
        try { 
            const { data, error } = await supabase 
                .from('exams') 
                .select('room_id') 
                .eq('date', date) 
                .eq('is_take_home', false)
                .or(`start_time.lte.${endTime},end_time.gte.${startTime}`); // Check for time overlap
                
            if (error) throw error; 
            const bookedRoomIds = data.map(exam => exam.room_id).filter(Boolean); 
            setBookedRooms(prev => ({ ...prev, [`${startTime}-${endTime}`]: bookedRoomIds })); 
        } catch (error: any) { 
            console.error('Error fetching booked rooms:', error); 
        } 
    };

    const filterLecturersByStudyProgram = (studyProgramId: string) => { 
        if (!studyProgramId) { 
            setFilteredLecturers(lecturers); 
            return; 
        } 
        const filtered = lecturers.filter(lecturer => lecturer.study_program_id === studyProgramId); 
        setFilteredLecturers(filtered); 
    };

    const getDayFromDate = (dateString: string) => { 
        const date = new Date(dateString); 
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']; 
        return days[date.getDay()]; 
    };

    const handleSubmit = async (data: ExamFormData) => {
        try {
            setLoading(true);
            const day = getDayFromDate(data.date);
            
            // Get inspector name from ID
            const inspectorInfo = lecturers.find(l => l.id === data.inspector);
            
            const examData = {
                day,
                date: data.date,
                start_time: data.is_take_home ? null : data.start_time,
                end_time: data.is_take_home ? null : data.end_time,
                is_take_home: data.is_take_home,
                course_name: data.course_name,
                course_code: data.course_code,
                semester: data.semester,
                class: data.class,
                student_amount: data.student_amount,
                room_id: data.is_take_home ? null : data.room_id,
                lecturer_id: data.lecturer_id,
                inspector: inspectorInfo?.full_name || null,
                department_id: profile.department_id,
                study_program_id: data.study_program_id,
            };
            
            if (editingExam) { 
                const { error } = await supabase 
                    .from('exams') 
                    .update(examData) 
                    .eq('id', editingExam.id); 
                if (error) throw error; 
                toast.success('Exam updated successfully'); 
                setShowModal(false);
                setEditingExam(null); 
            } else { 
                const { error } = await supabase 
                    .from('exams') 
                    .insert([examData]); 
                if (error) throw error; 
                toast.success('Exam created successfully'); 
            } 
            
            fetchExams(); 
        } catch (error: any) { 
            console.error('Error saving exam:', error); 
            toast.error(error.message || 'Failed to save exam'); 
        } finally { 
            setLoading(false); 
        } 
    };

    const handleEdit = (exam: any) => {
        setEditingExam(exam);
        
        // Find inspector by name to get ID for the form
        const inspectorUser = lecturers.find(l => l.full_name === exam.inspector);
        
        form.reset({
            course_name: exam.course_name || '',
            course_code: exam.course_code,
            date: exam.date,
            start_time: exam.start_time || '',
            end_time: exam.end_time || '',
            is_take_home: exam.is_take_home || false,
            semester: exam.semester,
            class: exam.class,
            student_amount: exam.student_amount,
            room_id: exam.room_id || '',
            lecturer_id: exam.lecturer_id,
            inspector: inspectorUser?.id || '',
            study_program_id: exam.study_program_id,
        });
        setShowModal(true);
    };

    const handleDelete = async (id: string) => { 
        try { 
            setLoading(true); 
            const { error } = await supabase 
                .from('exams') 
                .delete() 
                .eq('id', id); 
            if (error) throw error; 
            toast.success('Exam deleted successfully'); 
            setShowDeleteConfirm(null); 
            fetchExams(); 
        } catch (error: any) { 
            console.error('Error deleting exam:', error); 
            toast.error(error.message || 'Failed to delete exam'); 
        } finally { 
            setLoading(false); 
        } 
    };

    const filteredExams = exams.filter(exam => { 
        const matchesSearch = (exam.course_name && exam.course_name.toLowerCase().includes(searchTerm.toLowerCase())) || 
            exam.course_code.toLowerCase().includes(searchTerm.toLowerCase()) || 
            exam.class.toLowerCase().includes(searchTerm.toLowerCase()) || 
            (exam.department?.name && exam.department.name.toLowerCase().includes(searchTerm.toLowerCase())); 
        const matchesDate = !dateFilter || exam.date === dateFilter; 
        const matchesTime = !timeFilter || (exam.start_time && exam.start_time.includes(timeFilter));
        const matchesSemester = semesterFilter === 'all' || exam.semester.toString() === semesterFilter; 
        return matchesSearch && matchesDate && matchesTime && matchesSemester; 
    });

    const getAvailableRooms = () => { 
        if (watchIsTakeHome) return rooms; 
        
        if (!watchStartTime || !watchEndTime) return rooms;
        
        const currentRoomId = editingExam?.room_id; 
        const timeSlotKey = `${watchStartTime}-${watchEndTime}`;
        
        return rooms.filter(room => { 
            const isBooked = bookedRooms[timeSlotKey]?.includes(room.id); 
            return !isBooked || room.id === currentRoomId; 
        }); 
    };

    const handlePrint = async (formData: PrintFormData) => { 
        try { 
            const isSuperAdmin = profile?.role === 'super_admin'; 
            const departmentIdForQuery = isSuperAdmin ? formData.department_id : profile.department_id; 
            const selectedProgram = studyPrograms.find(p => p.id === formData.study_program_id); 
            const currentDepartment = departments.find(d => d.id === departmentIdForQuery); 
            let departmentHead; 
            if (isSuperAdmin) { 
                departmentHead = { full_name: 'KEPALA DEPARTEMEN', identity_number: '123' }; 
            } else { 
                departmentHead = departmentHeads.find(h => h.id === formData.department_head_id); 
            } 
            if (!selectedProgram || !departmentHead || !currentDepartment) { 
                toast.error("Please ensure all fields are selected and data is loaded."); 
                return; 
            } 
            const examsToPrint = exams.filter(exam => exam.study_program_id === formData.study_program_id && exam.department_id === departmentIdForQuery); 
            if (examsToPrint.length === 0) { 
                toast.error("No exams found for the selected criteria."); 
                return; 
            } 
            const doc = new jsPDF(); 
            let pageWidth = doc.internal.pageSize.getWidth(); 
            const departmentName = currentDepartment.name.toUpperCase(); 
            const logoDataUrl = await getImageDataUrl(logoUNY); 
            doc.addImage(logoDataUrl, 'PNG', 12, 15, 30, 30); 
            let currentY = 22; 
            doc.setFont('helvetica', 'normal'); 
            doc.setFontSize(12); 
            pageWidth += 30; 
            doc.setFontSize(12); 
            doc.setFont('helvetica', 'normal'); 
            doc.text("KEMENTERIAN PENDIDIKAN TINGGI, SAINS, DAN TEKNOLOGI", pageWidth / 2, currentY, { align: 'center' }); 
            currentY += 5; 
            doc.text("UNIVERSITAS NEGERI YOGYAKARTA", pageWidth / 2, currentY, { align: 'center' }); 
            currentY += 5; 
            doc.text("FAKULTAS VOKASI", pageWidth / 2, currentY, { align: 'center' }); 
            doc.setFontSize(14); 
            doc.setFont('helvetica', 'bold'); 
            currentY += 5; 
            doc.text(`DEPARTEMEN ${departmentName}`, pageWidth / 2, currentY, { align: 'center' }); 
            currentY += 5; 
            doc.setFontSize(9); 
            doc.setFont('helvetica', 'normal'); 
            doc.text("Kampus I: Jalan Mandung No. 1 Pengasih, Kulon Progo Telp.(0274)774625", pageWidth / 2, currentY, { align: 'center' }); 
            currentY += 3; 
            doc.text("Kampus II: Pacarejo, Semanu, Gunungkidul Telp. (0274)5042222/(0274)5042255", pageWidth / 2, currentY, { align: 'center' }); 
            currentY += 3; 
            doc.text("Laman: https://fv.uny.ac.id E-mail: fv@uny.ac.id", pageWidth / 2, currentY, { align: 'center' }); 
            currentY += 3; 
            pageWidth -= 30; 
            doc.setLineWidth(1); 
            doc.line(14, currentY, pageWidth - 14, currentY); 
            currentY += 10; 
            const subtitle = `JADWAL UAS ${selectedProgram.name.toUpperCase()} SEMESTER ${formData.semester.toUpperCase()} TAHUN AKADEMIK ${formData.academic_year}`; 
            doc.setFontSize(12); 
            doc.setFont('helvetica', 'bold'); 
            const titleMaxWidth = pageWidth - 30; 
            const titleLines = doc.splitTextToSize(subtitle, titleMaxWidth);
            doc.text(titleLines, pageWidth / 2, currentY, { align: 'center' });
            currentY += (titleLines.length * 5); 
            currentY += 5; 
            const tableColumn = ["No.", "HARI", "TANGGAL", "WAKTU", "KODE MK", "MATA KULIAH", "SMT", "KLS", "MHS", "RUANG", "PENGAWAS"]; 
            const tableRows: any[] = []; 
            examsToPrint.forEach((exam, index) => { 
                const inspectorName = exam.inspector || '-';
                const timeDisplay = exam.is_take_home ? 'Take Home' : (exam.start_time && exam.end_time ? `${exam.start_time}-${exam.end_time}` : '-');
                tableRows.push([ 
                    index + 1, 
                    exam.day, 
                    format(parseISO(exam.date), 'dd-MM-yyyy'), 
                    timeDisplay,
                    exam.course_code, 
                    exam.course_name, 
                    exam.semester, 
                    exam.class, 
                    exam.student_amount, 
                    exam.is_take_home ? 'Take Home' : (exam.room?.name || '-'),
                    inspectorName,
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
                    0: { halign: 'center', cellWidth: 8 }, 
                    3: { halign: 'center' },
                    4: { halign: 'center' }, 
                    6: { halign: 'center' }, 
                    7: { halign: 'center' }, 
                    8: { halign: 'center' } 
                } 
            }); 
            
            const additionalInfoColumn = ["KODE MK", "KELAS", "Dosen Pengawas", "Dosen Pengampu MK"];
            const additionalInfoRows: any[] = [];
            
            const uniqueCourses = new Set<string>();
            
            examsToPrint.forEach((exam) => {
                const uniqueKey = `${exam.course_code}-${exam.class}`;
                if (!uniqueCourses.has(uniqueKey)) {
                    const inspectorName = exam.inspector || '-';
                    additionalInfoRows.push([
                        exam.course_code,
                        exam.class,
                        inspectorName,
                        exam.lecturer?.full_name || 'N/A'
                    ]);
                    uniqueCourses.add(uniqueKey);
                }
            });
            
            const finalY = (doc as any).lastAutoTable.finalY || 100;
            let newFinalY = finalY;
            
            if (additionalInfoRows.length > 0) {
                let subheadingY = finalY + 10;
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.text("Daftar Dosen Pengawas", 14, subheadingY);
            
                autoTable(doc, {
                    head: [additionalInfoColumn],
                    body: additionalInfoRows,
                    startY: subheadingY + 5,
                    theme: 'grid',
                    tableWidth: 100,
                    styles: { fontSize: 8, cellPadding: 1.5, valign: 'middle' },
                    headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
                    columnStyles: {
                        0: { halign: 'center', cellWidth: 25 },
                        1: { halign: 'center', cellWidth: 15 },
                    }
                });
                newFinalY = (doc as any).lastAutoTable.finalY;
            }
            
            const signatureX = 140;
            const signatureY = newFinalY + 10;
            const signatureMaxWidth = 60;
            
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`Yogyakarta, ${format(new Date(), 'd MMMM yyyy')}`, signatureX, signatureY);
            doc.text("Kepala Departemen,", signatureX, signatureY + 5); 
            
            const nameY = signatureY + 30;
            const nameLines = doc.splitTextToSize(departmentHead.full_name, signatureMaxWidth);
            doc.setFont('helvetica', 'bold');
            doc.text(nameLines, signatureX, nameY);
            
            const nameBlockHeight = (nameLines.length * doc.getLineHeight()) / doc.internal.scaleFactor;
            const nipY = nameY + nameBlockHeight + 1;
            doc.setFont('helvetica', 'normal');
            doc.text(`NIP. ${departmentHead.identity_number}`, signatureX, nipY);
            doc.save(`Jadwal_UAS_${selectedProgram.code}_${formData.semester}.pdf`);
            setShowPrintModal(false);
        } catch (e: any) {
            console.error("PDF Generation Error:", e);
            toast.error("An unexpected error occurred while generating the PDF.");
        }
    };

    const isDepartmentAdmin = profile?.role === 'department_admin';
    const isSuperAdmin = profile?.role === 'super_admin';

    if (loading && !profile) {
        return (
            <div className="flex justify-center items-center h-64">
                <RefreshCw className="animate-spin h-8 w-8 text-blue-600" />
            </div>
        );
    }

    let pageContent = null;
    const MainView = (
        <div className="space-y-6">
            {/* Enhanced Filter Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                    <div className="flex flex-col sm:flex-row gap-4 flex-1">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input 
                                type="text" 
                                placeholder="Search courses, departments..." 
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
                                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    type="time"
                                    value={timeFilter}
                                    onChange={(e) => setTimeFilter(e.target.value)}
                                    placeholder="Filter by time"
                                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 min-w-[140px]"
                                />
                            </div>
                            <div className="relative">
                                <GraduationCap className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <select 
                                    value={semesterFilter} 
                                    onChange={(e) => setSemesterFilter(e.target.value)} 
                                    className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 appearance-none bg-white min-w-[140px]" 
                                >
                                    <option value="all">All Semesters</option> 
                                    {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                                        <option key={sem} value={sem.toString()}>Semester {sem}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button 
                            onClick={() => fetchExams()} 
                            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200" 
                            title="Refresh"
                        > 
                            <RefreshCw className="h-5 w-5" /> 
                        </button>
                        <button 
                            onClick={() => { 
                                setShowPrintModal(true); 
                                setPrintSelectedDepartment(''); 
                                printForm.reset(); 
                            }} 
                            className="flex items-center space-x-2 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200" 
                        > 
                            <Printer className="h-4 w-4" /> 
                            <span>Print</span> 
                        </button>
                        {isDepartmentAdmin && (
                            <button 
                                onClick={() => { 
                                    setEditingExam(null); 
                                    form.reset({ 
                                        course_name: '', 
                                        course_code: '', 
                                        date: format(new Date(), 'yyyy-MM-dd'), 
                                        start_time: '', 
                                        end_time: '', 
                                        is_take_home: false,
                                        semester: 1, 
                                        class: '', 
                                        student_amount: 0, 
                                        room_id: '', 
                                        lecturer_id: '',
                                        inspector: '',
                                        study_program_id: '', 
                                    }); 
                                    setShowModal(true); 
                                }} 
                                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md" 
                            > 
                                <Plus className="h-4 w-4" /> 
                                <span>Add Exam</span> 
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
                                            <span>Department</span>
                                        </div>
                                    </th>
                                )}
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    <div className="flex items-center space-x-1">
                                        <BookOpen className="h-4 w-4" />
                                        <span>Course</span>
                                    </div>
                                </th> 
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    <div className="flex items-center space-x-1">
                                        <Calendar className="h-4 w-4" />
                                        <span>Date & Time</span>
                                    </div>
                                </th> 
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    <div className="flex items-center space-x-1">
                                        <GraduationCap className="h-4 w-4" />
                                        <span>Class & Semester</span>
                                    </div>
                                </th> 
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    <div className="flex items-center space-x-1">
                                        <MapPin className="h-4 w-4" />
                                        <span>Room</span>
                                    </div>
                                </th> 
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    <div className="flex items-center space-x-1">
                                        <User className="h-4 w-4" />
                                        <span>Lecturer</span>
                                    </div>
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    <div className="flex items-center space-x-1">
                                        <Eye className="h-4 w-4" />
                                        <span>Inspector</span>
                                    </div>
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    <div className="flex items-center space-x-1">
                                        <Users className="h-4 w-4" />
                                        <span>Students</span>
                                    </div>
                                </th>
                                {isDepartmentAdmin && (
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        Actions
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                <tr>
                                    <td colSpan={isDepartmentAdmin ? 9 : (isSuperAdmin ? 9 : 8)} className="px-6 py-12 text-center">
                                        <div className="flex items-center justify-center">
                                            <RefreshCw className="h-6 w-6 animate-spin text-blue-600 mr-2" />
                                            <span className="text-gray-600">Loading exams...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredExams.length === 0 ? (
                                <tr>
                                    <td colSpan={isDepartmentAdmin ? 9 : (isSuperAdmin ? 9 : 8)} className="px-6 py-12 text-center">
                                        <div className="text-gray-500">
                                            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                            <p className="text-lg font-medium mb-2">No exams found</p>
                                            <p>Try adjusting your search or filters</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredExams.map((exam) => {
                                    const inspectorName = exam.inspector || 'Not assigned';
                                    
                                    return (
                                        <tr key={exam.id} className="hover:bg-gray-50 transition-colors duration-200">
                                            {isSuperAdmin && (
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center">
                                                        <div className="h-8 w-8 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
                                                            <Building className="h-4 w-4 text-white" />
                                                        </div>
                                                        <div className="ml-3">
                                                            <div className="text-sm font-medium text-gray-900">{exam.department?.name || 'N/A'}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                            )}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div>
                                                    <div className="text-sm font-semibold text-gray-900">{exam.course_name || 'N/A'}</div>
                                                    <div className="text-sm text-gray-600 font-mono">{exam.course_code}</div>
                                                    <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full inline-block mt-1">
                                                        {exam.study_program?.name}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900">{format(parseISO(exam.date), 'MMM d, yyyy')}</div>
                                                    <div className="text-sm text-gray-600">{exam.day}</div>
                                                    {exam.is_take_home ? (
                                                        <div className="text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded-full inline-block mt-1">
                                                            Take Home Exam
                                                        </div>
                                                    ) : (
                                                        <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full inline-block mt-1">
                                                            {exam.start_time && exam.end_time ? `${exam.start_time} - ${exam.end_time}` : 'Time not set'}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900">Class {exam.class}</div>
                                                    <div className="text-sm text-gray-600">Semester {exam.semester}</div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div>
                                                    {exam.is_take_home ? (
                                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                                            <BookOpen className="h-3 w-3 mr-1" />
                                                            Take Home Exam
                                                        </span>
                                                    ) : (
                                                        <div className="flex items-center">
                                                            <div className="h-8 w-8 bg-gradient-to-r from-green-500 to-teal-500 rounded-lg flex items-center justify-center">
                                                                <MapPin className="h-4 w-4 text-white" />
                                                            </div>
                                                            <div className="ml-3">
                                                                <div className="text-sm font-medium text-gray-900">{exam.room?.name || 'N/A'}</div>
                                                                <div className="text-sm text-gray-600">{exam.room?.code || 'N/A'}</div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="h-8 w-8 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                                                        <User className="h-4 w-4 text-white" />
                                                    </div>
                                                    <div className="ml-3">
                                                        <div className="text-sm font-medium text-gray-900">{exam.lecturer?.full_name || 'Unknown'}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="h-8 w-8 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center">
                                                        <Eye className="h-4 w-4 text-white" />
                                                    </div>
                                                    <div className="ml-3">
                                                        <div className="text-sm font-medium text-gray-900">{inspectorName}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="h-8 w-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                                                        <Users className="h-4 w-4 text-white" />
                                                    </div>
                                                    <div className="ml-3">
                                                        <span className="text-sm font-medium text-gray-900">{exam.student_amount}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            {isDepartmentAdmin && (
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    <div className="flex items-center justify-end space-x-2">
                                                        <button 
                                                            onClick={() => handleEdit(exam)} 
                                                            className="text-blue-600 hover:text-blue-900 p-2 rounded-lg hover:bg-blue-50 transition-all duration-200"
                                                            title="Edit exam"
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </button>
                                                        <button 
                                                            onClick={() => setShowDeleteConfirm(exam.id)} 
                                                            className="text-red-600 hover:text-red-900 p-2 rounded-lg hover:bg-red-50 transition-all duration-200"
                                                            title="Delete exam"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
    
    if (isSuperAdmin) {
        pageContent = (
            <div className="space-y-6">
                <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-700 rounded-xl p-6 text-white shadow-lg">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-3xl font-bold flex items-center space-x-3">
                                <Shield className="h-8 w-8" /> 
                                <span>Super Admin Dashboard</span>
                            </h1>
                            <p className="mt-2 opacity-90">Manage system-wide exam settings and view all schedules.</p>
                        </div>
                        <div className="text-center">
                            <button 
                                onClick={handleModeChange} 
                                className={`p-3 rounded-full transition-all duration-300 ${examModeEnabled ? 'bg-emerald-500 hover:bg-emerald-600 shadow-lg' : 'bg-red-500 hover:bg-red-600 shadow-lg'}`}
                            >
                                {examModeEnabled ? <Power className="h-7 w-7 text-white" /> : <PowerOff className="h-7 w-7 text-white" />}
                            </button>
                            <p className={`mt-2 text-sm font-bold ${examModeEnabled ? 'text-emerald-200' : 'text-red-200'}`}>
                                Exam Mode: {examModeEnabled ? 'ENABLED' : 'DISABLED'}
                            </p>
                        </div>
                    </div>
                </div>
                {examModeEnabled && MainView}
            </div>
        );
    } else if (isDepartmentAdmin) {
        if (!examModeEnabled) {
            pageContent = (
                <div className="flex items-center justify-center h-64">
                    <div className="text-center p-8 bg-yellow-50 border border-yellow-200 rounded-xl">
                        <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Exam Scheduling Disabled</h3>
                        <p className="text-gray-600">This feature is currently unavailable. Please contact the Super Admin.</p>
                    </div>
                </div>
            );
        } else {
            pageContent = (
                <div className="space-y-6">
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-3xl font-bold flex items-center space-x-3">
                                    <Calendar className="h-8 w-8" />
                                    <span>Exam Management</span>
                                </h1>
                                <p className="mt-2 opacity-90">Manage exam schedules for your department</p>
                            </div>
                            <div className="hidden md:block text-right">
                                <div className="text-2xl font-bold">{exams.length}</div>
                                <div className="text-sm opacity-80">Total Exams</div>
                            </div>
                        </div>
                    </div>
                    {MainView}
                </div>
            );
        }
    } else {
        pageContent = (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
                    <p className="text-gray-600">You do not have permission to view this page.</p>
                </div>
            </div>
        );
    }

    return (
        <>
            {pageContent}

            {/* Modal Form - Updated with time fields and take home checkbox */}
            {showModal && isDepartmentAdmin && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
                                    <Calendar className="h-6 w-6 text-blue-600" />
                                    <span>{editingExam ? 'Edit Exam Schedule' : 'Add New Exam Schedule'}</span>
                                </h3>
                                <button 
                                    onClick={() => setShowModal(false)} 
                                    className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg" 
                                > 
                                    <X className="h-6 w-6" /> 
                                </button>
                            </div>
                            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                                {/* Course Information */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Course Name *</label>
                                        <input 
                                            {...form.register('course_name')} 
                                            type="text" 
                                            placeholder="e.g., Database Systems" 
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                                        />
                                        {form.formState.errors.course_name && (
                                            <p className="mt-1 text-sm text-red-600">{form.formState.errors.course_name.message}</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Course Code *</label>
                                        <input 
                                            {...form.register('course_code')} 
                                            type="text" 
                                            placeholder="e.g., CS301" 
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                                        />
                                        {form.formState.errors.course_code && (
                                            <p className="mt-1 text-sm text-red-600">{form.formState.errors.course_code.message}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Schedule Information - Updated with time fields */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
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
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Start Time {!watchIsTakeHome && '*'}
                                        </label>
                                        <input 
                                            {...form.register('start_time')} 
                                            type="time" 
                                            disabled={watchIsTakeHome}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
                                        />
                                        {form.formState.errors.start_time && (
                                            <p className="mt-1 text-sm text-red-600">{form.formState.errors.start_time.message}</p>
                                        )}
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            End Time {!watchIsTakeHome && '*'}
                                        </label>
                                        <input 
                                            {...form.register('end_time')} 
                                            type="time" 
                                            disabled={watchIsTakeHome}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed" 
                                        />
                                        {form.formState.errors.end_time && (
                                            <p className="mt-1 text-sm text-red-600">{form.formState.errors.end_time.message}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Take Home Checkbox */}
                                <div className="flex items-center space-x-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                    <input 
                                        {...form.register('is_take_home')} 
                                        type="checkbox" 
                                        id="is_take_home"
                                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" 
                                    />
                                    <label htmlFor="is_take_home" className="text-sm font-medium text-blue-900 flex items-center space-x-2">
                                        <BookOpen className="h-4 w-4" />
                                        <span>This is a Take Home Exam</span>
                                    </label>
                                    {watchIsTakeHome && (
                                        <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                                            No time schedule or room required
                                        </span>
                                    )}
                                </div>

                                {/* Class Information */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Semester (1-8) *</label>
                                        <input 
                                            {...form.register('semester', { 
                                                valueAsNumber: true, 
                                                onChange: (e) => { 
                                                    const value = parseInt(e.target.value); 
                                                    if (value < 1) e.target.value = '1'; 
                                                    if (value > 8) e.target.value = '8'; 
                                                } 
                                            })} 
                                            type="number" 
                                            min="1" 
                                            max="8" 
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                                        />
                                        {form.formState.errors.semester && (
                                            <p className="mt-1 text-sm text-red-600">{form.formState.errors.semester.message}</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Class *</label>
                                        <input 
                                            {...form.register('class')} 
                                            type="text" 
                                            placeholder="e.g., A, B, C" 
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                                        />
                                        {form.formState.errors.class && (
                                            <p className="mt-1 text-sm text-red-600">{form.formState.errors.class.message}</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Student Amount *</label>
                                        <input 
                                            {...form.register('student_amount', { valueAsNumber: true })} 
                                            type="number" 
                                            min="0" 
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                                        />
                                        {form.formState.errors.student_amount && (
                                            <p className="mt-1 text-sm text-red-600">{form.formState.errors.student_amount.message}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Study Program */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Study Program *</label>
                                    <Controller 
                                        name="study_program_id" 
                                        control={form.control} 
                                        render={({ field }) => { 
                                            const options = studyPrograms.map(p => ({ 
                                                value: p.id, 
                                                label: `${p.name} (${p.code})`, 
                                            })); 
                                            const currentValue = options.find(o => o.value === field.value); 
                                            return ( 
                                                <Select 
                                                    {...field} 
                                                    options={options} 
                                                    value={currentValue} 
                                                    onChange={option => field.onChange(option ? option.value : '')} 
                                                    placeholder="Search or select study program..." 
                                                    isClearable 
                                                    styles={{
                                                        control: (provided) => ({
                                                            ...provided,
                                                            minHeight: '42px',
                                                            borderColor: '#d1d5db',
                                                        }),
                                                    }}
                                                /> 
                                            ); 
                                        }} 
                                    />
                                    {form.formState.errors.study_program_id && (
                                        <p className="mt-1 text-sm text-red-600">{form.formState.errors.study_program_id.message}</p>
                                    )}
                                </div>
                                        
                                {/* Lecturer and Inspector */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Lecturer in Charge *</label>
                                        <Controller 
                                            name="lecturer_id" 
                                            control={form.control} 
                                            render={({ field }) => { 
                                                const options = filteredLecturers.map(l => ({ 
                                                    value: l.id, 
                                                    label: l.full_name 
                                                })); 
                                                const currentValue = options.find(o => o.value === field.value); 
                                                return ( 
                                                    <Select 
                                                        {...field} 
                                                        options={options} 
                                                        value={currentValue} 
                                                        onChange={val => field.onChange(val?.value)} 
                                                        placeholder="Search or select lecturer..." 
                                                        isClearable 
                                                        noOptionsMessage={() => watchStudyProgramId ? 'No lecturers found' : 'Select a study program first'} 
                                                        styles={{
                                                            control: (provided) => ({
                                                                ...provided,
                                                                minHeight: '42px',
                                                                borderColor: '#d1d5db',
                                                            }),
                                                        }}
                                                    /> 
                                                ) 
                                            }} 
                                        />
                                        {form.formState.errors.lecturer_id && (
                                            <p className="mt-1 text-sm text-red-600">{form.formState.errors.lecturer_id.message}</p>
                                        )}
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Inspector (Pengawas) *</label>
                                        <Controller 
                                            name="inspector" 
                                            control={form.control} 
                                            render={({ field }) => { 
                                                const options = filteredLecturers.map(l => ({ 
                                                    value: l.id,
                                                    label: l.full_name
                                                })); 
                                                const currentValue = options.find(o => o.value === field.value); 
                                                return ( 
                                                    <Select 
                                                        {...field} 
                                                        options={options} 
                                                        value={currentValue} 
                                                        onChange={val => field.onChange(val?.value)} 
                                                        placeholder="Search or select inspector..." 
                                                        isClearable 
                                                        noOptionsMessage={() => watchStudyProgramId ? 'No lecturers found' : 'Select a study program first'} 
                                                        styles={{
                                                            control: (provided) => ({
                                                                ...provided,
                                                                minHeight: '42px',
                                                                borderColor: '#d1d5db',
                                                            }),
                                                        }}
                                                    /> 
                                                ) 
                                            }} 
                                        />
                                        {form.formState.errors.inspector && (
                                            <p className="mt-1 text-sm text-red-600">{form.formState.errors.inspector.message}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Room Assignment - Updated */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Room {!watchIsTakeHome && '*'}
                                        {watchIsTakeHome && (
                                            <span className="text-gray-500 text-sm ml-2">(Not required for Take Home exams)</span>
                                        )}
                                    </label>
                                    <Controller 
                                        name="room_id" 
                                        control={form.control} 
                                        render={({ field }) => { 
                                            const roomOptions = getAvailableRooms().map(r => ({ 
                                                value: r.id, 
                                                label: `${r.name} (${r.code}) - Cap: ${r.capacity}` 
                                            })); 
                                            const selectedValue = roomOptions.find(o => o.value === field.value); 
                                            return ( 
                                                <Select 
                                                    {...field} 
                                                    options={roomOptions} 
                                                    value={selectedValue} 
                                                    onChange={option => field.onChange(option ? option.value : '')} 
                                                    isDisabled={watchIsTakeHome} 
                                                    placeholder={watchIsTakeHome ? 'No room needed for Take Home exam' : 'Search or select room...'} 
                                                    isClearable 
                                                    styles={{
                                                        control: (provided) => ({
                                                            ...provided,
                                                            minHeight: '42px',
                                                            borderColor: '#d1d5db',
                                                            backgroundColor: watchIsTakeHome ? '#f9fafb' : 'white',
                                                        }),
                                                    }}
                                                /> 
                                            ); 
                                        }}
                                    />
                                    {form.formState.errors.room_id && (
                                        <p className="mt-1 text-sm text-red-600">{form.formState.errors.room_id.message}</p>
                                    )}
                                    {!watchIsTakeHome && watchStartTime && watchEndTime && (
                                        <p className="mt-2 text-sm text-gray-600">
                                            💡 Only available rooms for the selected date and time are shown
                                        </p>
                                    )}
                                </div>

                                {/* Action Buttons */}
                                <div className="flex space-x-3 pt-4 border-t border-gray-200">
                                    <button 
                                        type="button" 
                                        onClick={() => setShowModal(false)} 
                                        className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-medium"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit" 
                                        disabled={loading} 
                                        className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-sm hover:shadow-md"
                                    >
                                        {loading ? (
                                            <span className="flex items-center justify-center space-x-2">
                                                <RefreshCw className="h-4 w-4 animate-spin" />
                                                <span>Saving...</span>
                                            </span>
                                        ) : (
                                            <span className="flex items-center justify-center space-x-2">
                                                <Calendar className="h-4 w-4" />
                                                <span>{editingExam ? 'Update Exam' : 'Create Exam'}</span>
                                            </span>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Enhanced Delete Confirmation Modal */}
            {showDeleteConfirm && isDepartmentAdmin && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
                        <div className="p-6">
                            <div className="flex items-center mb-4">
                                <div className="flex-shrink-0 h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
                                    <AlertCircle className="h-6 w-6 text-red-600" />
                                </div>
                                <div className="ml-4">
                                    <h3 className="text-lg font-medium text-gray-900">Delete Exam Schedule</h3>
                                    <p className="text-sm text-gray-500 mt-1">This action cannot be undone</p>
                                </div>
                            </div>
                            <p className="text-sm text-gray-600 mb-6">
                                Are you sure you want to delete this exam schedule? All associated data will be permanently removed.
                            </p>
                            <div className="flex space-x-3">
                                <button 
                                    onClick={() => setShowDeleteConfirm(null)} 
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all duration-200 font-medium"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={() => handleDelete(showDeleteConfirm as string)} 
                                    disabled={loading} 
                                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-all duration-200 font-medium"
                                >
                                    {loading ? 'Deleting...' : 'Delete'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Enhanced Print Modal */}
            {showPrintModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                                    <Printer className="h-6 w-6 text-blue-600" />
                                    <span>Print Exam Schedule</span>
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
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Department *</label>
                                        <Controller 
                                            name="department_id" 
                                            control={printForm.control} 
                                            render={({ field }) => (
                                                <Select 
                                                    options={departments.map(d => ({ value: d.id, label: d.name }))} 
                                                    onChange={(option) => { 
                                                        field.onChange(option ? option.value : ''); 
                                                        setPrintSelectedDepartment(option ? option.value : ''); 
                                                    }} 
                                                    placeholder="Select department..." 
                                                    isClearable 
                                                />
                                            )} 
                                        />
                                        {printForm.formState.errors.department_id && (
                                            <p className="text-red-600 text-sm mt-1">{printForm.formState.errors.department_id.message}</p>
                                        )}
                                    </div>
                                )}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Study Program *</label>
                                    <Controller 
                                        name="study_program_id" 
                                        control={printForm.control} 
                                        render={({ field }) => { 
                                            const filteredPrograms = isSuperAdmin ? studyPrograms.filter(p => p.department_id === printSelectedDepartment) : studyPrograms; 
                                            const options = filteredPrograms.map(p => ({ value: p.id, label: p.name })); 
                                            const currentValue = options.find(o => o.value === field.value); 
                                            return ( 
                                                <Select 
                                                    {...field} 
                                                    options={options} 
                                                    value={currentValue} 
                                                    onChange={option => field.onChange(option ? option.value : '')} 
                                                    placeholder="Select study program..." 
                                                    isDisabled={isSuperAdmin && !printSelectedDepartment} 
                                                    isClearable 
                                                /> 
                                            )
                                        }} 
                                    />
                                    {printForm.formState.errors.study_program_id && (
                                        <p className="text-red-600 text-sm mt-1">{printForm.formState.errors.study_program_id.message}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Semester Type *</label>
                                    <Controller 
                                        name="semester" 
                                        control={printForm.control} 
                                        render={({ field }) => ( 
                                            <Select 
                                                {...field} 
                                                options={[
                                                    {value: 'GASAL', label: 'GASAL (Odd)'}, 
                                                    {value: 'GENAP', label: 'GENAP (Even)'}
                                                ]} 
                                                value={field.value ? {value: field.value, label: `${field.value} (${field.value === 'GASAL' ? 'Odd' : 'Even'})`} : null} 
                                                onChange={option => field.onChange(option?.value)} 
                                                placeholder="Select semester type..." 
                                            /> 
                                        )} 
                                    />
                                    {printForm.formState.errors.semester && (
                                        <p className="text-red-600 text-sm mt-1">{printForm.formState.errors.semester.message}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year *</label>
                                    <input 
                                        {...printForm.register('academic_year')} 
                                        type="text" 
                                        placeholder="e.g. 2024/2025" 
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                                    />
                                    {printForm.formState.errors.academic_year && (
                                        <p className="text-red-600 text-sm mt-1">{printForm.formState.errors.academic_year.message}</p>
                                    )}
                                </div>
                                {isDepartmentAdmin && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Department Head *</label>
                                        <Controller 
                                            name="department_head_id" 
                                            control={printForm.control} 
                                            render={({ field }) => ( 
                                                <Select 
                                                    options={departmentHeads.map(h => ({ value: h.id, label: h.full_name }))} 
                                                    value={field.value ? departmentHeads.map(h => ({ value: h.id, label: h.full_name })).find(o => o.value === field.value) : null} 
                                                    onChange={(option) => { 
                                                        field.onChange(option ? option.value : ''); 
                                                        const selectedHead = departmentHeads.find(h => h.id === option?.value); 
                                                        printForm.setValue('department_head_name', selectedHead?.full_name); 
                                                    }} 
                                                    placeholder="Search and select head..." 
                                                    isClearable 
                                                /> 
                                            )} 
                                        />
                                        {printForm.formState.errors.department_head_id && (
                                            <p className="text-red-600 text-sm mt-1">{printForm.formState.errors.department_head_id.message}</p>
                                        )}
                                    </div>
                                )}
                                <div className="flex space-x-3 pt-4">
                                    <button 
                                        type="button" 
                                        onClick={() => setShowPrintModal(false)} 
                                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all duration-200 font-medium"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit" 
                                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 font-medium flex items-center justify-center space-x-2"
                                    >
                                        <Printer className="h-4 w-4" />
                                        <span>Generate PDF</span>
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Enhanced Clear Confirmation Modal */}
            {showClearConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
                        <div className="p-6">
                            <div className="flex items-center mb-4">
                                <div className="flex-shrink-0 h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
                                    <AlertCircle className="h-6 w-6 text-red-600" />
                                </div>
                                <div className="ml-4">
                                    <h3 className="text-lg leading-6 font-medium text-gray-900">Change Exam Mode?</h3>
                                    <p className="text-sm text-gray-500 mt-1">This action will permanently delete all data</p>
                                </div>
                            </div>
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                                <p className="text-sm text-red-800">
                                    This action will <span className="font-bold">PERMANENTLY DELETE ALL</span> existing exam schedules. 
                                    Are you sure you want to continue?
                                </p>
                            </div>
                            <div className="flex space-x-3">
                                <button 
                                    onClick={() => setShowClearConfirm(false)} 
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all duration-200 font-medium"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={confirmClearAndToggleMode} 
                                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-200 font-medium"
                                >
                                    Yes, Change & Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ExamManagement;