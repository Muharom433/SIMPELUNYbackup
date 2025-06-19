import React, { useState, useEffect } from 'react';
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
  PowerOff
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
  session: z.string().min(1, 'Session is required'),
  semester: z.number().min(1, 'Semester must be at least 1').max(8, 'Semester cannot exceed 8'),
  class: z.string().min(1, 'Class is required'),
  student_amount: z.number().min(0, 'Student amount cannot be negative'),
  room_id: z.string().optional(),
  lecturer_id: z.string().min(1, 'Lecturer is required'),
  study_program_id: z.string().min(1, 'Study program is required'),
}).superRefine((data, ctx) => {
    if (data.session && data.session !== 'Take Home' && (!data.room_id || data.room_id === '')) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['room_id'],
            message: 'Room is required for this session type.',
        });
    }
});

// pages/ExamManagement.tsx

const printSchema = z.object({
    department_id: z.string().optional(),
    study_program_id: z.string().min(1, 'Study Program is required'),
    semester: z.enum(['GASAL', 'GENAP'], { required_error: 'Semester type is required' }),
    academic_year: z.string().min(9, 'Academic Year is required (e.g., 2023/2024)').regex(/^\d{4}\/\d{4}$/, 'Invalid format. Use (`YYYY/YYYY`)'),
    // --- MODIFIED: Made optional to accommodate department admin ---
    department_head_id: z.string().optional(),
    department_head_name: z.string().optional(),
}).superRefine((data, ctx) => {
    // This function now handles conditional validation for both roles
    const { profile } = useAuth.getState();
    if (profile?.role === 'super_admin') {
        if (!data.department_id) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['department_id'],
                message: 'Department is required for Super Admin.',
            });
        }
        // --- NEW: Rule to make department head required only for super_admin ---
        if (!data.department_head_id) {
             ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['department_head_id'],
                message: 'Department Head is required for Super Admin.',
            });
        }
    }
});

type ExamFormData = z.infer<typeof examSchema>;
type PrintFormData = z.infer<typeof printSchema>;

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
    const [sessionFilter, setSessionFilter] = useState('all');
    const [semesterFilter, setSessionSemester] = useState('all');
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

    const form = useForm<ExamFormData>({ resolver: zodResolver(examSchema), defaultValues: { course_name: '', course_code: '', date: format(new Date(), 'yyyy-MM-dd'), session: '', semester: 1, class: '', student_amount: 0, room_id: '', lecturer_id: '', study_program_id: '', }, });
    const printForm = useForm<PrintFormData>({ resolver: zodResolver(printSchema) });
    const watchDate = form.watch('date');
    const watchSession = form.watch('session');
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

    useEffect(() => { if (watchDate && watchSession) { fetchBookedRooms(watchDate, watchSession); } }, [watchDate, watchSession]);
    useEffect(() => { if (watchStudyProgramId) { filterLecturersByStudyProgram(watchStudyProgramId); form.setValue('lecturer_id', ''); } else { setFilteredLecturers(lecturers); } }, [watchStudyProgramId, lecturers]);
    
    useEffect(() => {
        if (profile?.role === 'super_admin') {
            printForm.setValue('study_program_id', '');
        }
    }, [printSelectedDepartment, profile?.role, printForm]);

    // All fetch functions and handlers remain the same as the previous correct version...
    const fetchExamModeStatus = async () => { try { setLoading(true); const { data, error } = await supabase.from('system_settings').select('setting_value').eq('id', 'b78e1661-7cdd-4ee0-b495-bf260a8a274c').single(); if (error) throw error; if (data) { setExamModeEnabled(data.setting_value === 'true'); } } catch (error) { console.error('Error fetching exam mode status:', error); setExamModeEnabled(false); } finally { setLoading(false); } };
    const handleModeChange = () => { if (profile?.role !== 'super_admin') return; setShowClearConfirm(true); };
    const confirmClearAndToggleMode = async () => { setLoading(true); try { const { error: deleteError } = await supabase.from('exams').delete().neq('id', '00000000-0000-0000-0000-000000000000'); if (deleteError) throw deleteError; const newMode = !examModeEnabled; const { error: updateError } = await supabase.from('system_settings').update({ setting_value: newMode.toString() }).eq('id', 'b78e1661-7cdd-4ee0-b495-bf260a8a274c'); if (updateError) throw updateError; setExamModeEnabled(newMode); setExams([]); toast.success(`Exam Mode has been ${newMode ? 'enabled' : 'disabled'} and all previous schedules have been cleared.`); } catch (error: any) { console.error('Error updating exam mode:', error); toast.error('Failed to update exam mode.'); } finally { setLoading(false); setShowClearConfirm(false); } };
    const fetchExams = async () => { try { let query = supabase.from('exams').select('*, room:rooms(*), lecturer:users!lecturer_id(*), department:departments(*), study_program:study_programs(*)'); if (profile?.role === 'department_admin' && profile?.department_id) { query = query.eq('department_id', profile.department_id); } query = query.order('date', { ascending: true }); const { data, error } = await query; if (error) throw error; setExams(data || []); } catch (error: any) { console.error('Error fetching exams:', error); toast.error('Failed to load exams.'); } };
    const fetchStudyPrograms = async () => { try { let query = supabase.from('study_programs').select('*'); if (profile?.role === 'department_admin' && profile?.department_id) { query = query.eq('department_id', profile.department_id); } const { data, error } = await query; if (error) throw error; setStudyPrograms(data || []); } catch (error: any) { console.error('Error fetching study programs:', error); toast.error('Failed to load study programs.'); } };
    const fetchRooms = async () => { try { let query = supabase.from('rooms').select('*'); if (profile?.role === 'department_admin' && profile?.department_id) { query = query.or(`department_id.eq.${profile.department_id},department_id.is.null`); } const { data, error } = await query; if (error) throw error; setRooms(data || []); } catch (error: any) { console.error('Error fetching rooms:', error); toast.error('Failed to load rooms.'); } };
    const fetchLecturers = async () => { try { let query = supabase.from('users').select('*').eq('role', 'lecturer'); if (profile?.role === 'department_admin' && profile?.department_id) { query = query.eq('department_id', profile.department_id); } const { data, error } = await query; if (error) throw error; setLecturers(data || []); setFilteredLecturers(data || []); } catch (error: any) { console.error('Error fetching lecturers:', error); toast.error('Failed to load lecturers.'); } };
    const fetchDepartments = async () => { try { let query = supabase.from('departments').select('id, name'); if (profile?.role === 'department_admin' && profile.department_id) { query = query.eq('id', profile.department_id); } const { data, error } = await query; if (error) throw error; setDepartments(data || []); } catch (error: any) { console.error('Error fetching departments:', error); toast.error('Failed to load departments.'); } };
    const fetchDepartmentHeads = async () => { try { const { data, error } = await supabase.from('users').select('id, full_name, identity_number').in('role', ['department_admin', 'super_admin']); if (error) throw error; setDepartmentHeads(data || []); } catch (error: any) { console.error('Error fetching department heads:', error); toast.error('Failed to load department heads.'); } };
    const fetchBookedRooms = async (date: string, session: string) => { if (session === 'Take Home') return; try { const { data, error } = await supabase .from('exams') .select('room_id') .eq('date', date) .eq('session', session); if (error) throw error; const bookedRoomIds = data.map(exam => exam.room_id); setBookedRooms(prev => ({ ...prev, [session]: bookedRoomIds })); } catch (error: any) { console.error('Error fetching booked rooms:', error); } };
    const filterLecturersByStudyProgram = (studyProgramId: string) => { if (!studyProgramId) { setFilteredLecturers(lecturers); return; } const filtered = lecturers.filter(lecturer => lecturer.study_program_id === studyProgramId); setFilteredLecturers(filtered); };
    const getDayFromDate = (dateString: string) => { const date = new Date(dateString); const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']; return days[date.getDay()]; };
    const handleSubmit = async (data: ExamFormData) => { try { setLoading(true); const day = getDayFromDate(data.date); const examData = { day, date: data.date, session: data.session, course_name: data.course_name, course_code: data.course_code, semester: data.semester, class: data.class, student_amount: data.student_amount, room_id: data.session === 'Take Home' ? null : data.room_id, lecturer_id: data.lecturer_id, department_id: profile.department_id, study_program_id: data.study_program_id, }; if (editingExam) { const { error } = await supabase .from('exams') .update(examData) .eq('id', editingExam.id); if (error) throw error; toast.success('Exam updated successfully'); } else { const { error } = await supabase .from('exams') .insert([examData]); if (error) throw error; toast.success('Exam created successfully'); } form.setValue('course_name', ''); form.setValue('course_code', ''); setEditingExam(null); fetchExams(); } catch (error: any) { console.error('Error saving exam:', error); toast.error(error.message || 'Failed to save exam'); } finally { setLoading(false); } };
    const handleEdit = (exam: any) => { setEditingExam(exam); form.reset({ course_name: exam.course_name || '', course_code: exam.course_code, date: exam.date, session: exam.session, semester: exam.semester, class: exam.class, student_amount: exam.student_amount, room_id: exam.room_id || '', lecturer_id: exam.lecturer_id, study_program_id: exam.study_program_id, }); setShowModal(true); };
    const handleDelete = async (id: string) => { try { setLoading(true); const { error } = await supabase .from('exams') .delete() .eq('id', id); if (error) throw error; toast.success('Exam deleted successfully'); setShowDeleteConfirm(null); fetchExams(); } catch (error: any) { console.error('Error deleting exam:', error); toast.error(error.message || 'Failed to delete exam'); } finally { setLoading(false); } };
    const filteredExams = exams.filter(exam => { const matchesSearch = (exam.course_name && exam.course_name.toLowerCase().includes(searchTerm.toLowerCase())) || exam.course_code.toLowerCase().includes(searchTerm.toLowerCase()) || exam.class.toLowerCase().includes(searchTerm.toLowerCase()) || (exam.department?.name && exam.department.name.toLowerCase().includes(searchTerm.toLowerCase())); const matchesDate = !dateFilter || exam.date === dateFilter; const matchesSession = sessionFilter === 'all' || exam.session === sessionFilter; const matchesSemester = semesterFilter === 'all' || exam.semester.toString() === semesterFilter; return matchesSearch && matchesDate && matchesSession && matchesSemester; });
    const getAvailableRooms = () => { if (!watchSession || watchSession === 'Take Home') return rooms; const currentRoomId = editingExam?.room_id; return rooms.filter(room => { const isBooked = bookedRooms[watchSession]?.includes(room.id); return !isBooked || room.id === currentRoomId; }); };
    const handlePrint = async (formData: PrintFormData) => {
    try {
        const departmentIdForQuery = isSuperAdmin ? formData.department_id : profile.department_id;
        const selectedProgram = studyPrograms.find(p => p.id === formData.study_program_id);
        const currentDepartment = departments.find(d => d.id === departmentIdForQuery);

        // --- MODIFIED: Logic to define departmentHead based on role ---
        let departmentHead;
        if (isDepartmentAdmin) {
            // Use the specified default values for Department Admin
            departmentHead = departmentHeads.find(h => h.id === formData.department_head_id);
            
        } else { // isSuperAdmin
            // Use the value selected from the form for Super Admin
          departmentHead = {
                full_name: 'KEPALA DEPARTEMEN',
                identity_number: '123'
            };
        }
        // --- End of modification ---

        if (!selectedProgram || !departmentHead || !currentDepartment) {
            toast.error("Please ensure all fields are selected and data is loaded.");
            return;
        } { toast.error("Please ensure all fields are selected and data is loaded."); return; } const examsToPrint = exams.filter(exam => exam.study_program_id === formData.study_program_id && exam.department_id === departmentIdForQuery); if (examsToPrint.length === 0) { toast.error("No exams found for the selected criteria."); return; } const doc = new jsPDF(); let pageWidth = doc.internal.pageSize.getWidth(); const departmentName = currentDepartment.name.toUpperCase(); const logoDataUrl = await getImageDataUrl(logoUNY); doc.addImage(logoDataUrl, 'PNG', 12, 15, 30, 30); let currentY = 22; doc.setFont('helvetica', 'normal'); doc.setFontSize(12); pageWidth += 30; doc.setFontSize(12); doc.setFont('helvetica', 'normal'); doc.text("KEMENTERIAN PENDIDIKAN TINGGI, SAINS, DAN TEKNOLOGI", pageWidth / 2, currentY, { align: 'center' }); currentY += 5; doc.text("UNIVERSITAS NEGERI YOGYAKARTA", pageWidth / 2, currentY, { align: 'center' }); currentY += 5; doc.text("FAKULTAS VOKASI", pageWidth / 2, currentY, { align: 'center' }); doc.setFontSize(14); doc.setFont('helvetica', 'bold'); currentY += 5; doc.text(`DEPARTEMEN ${departmentName}`, pageWidth / 2, currentY, { align: 'center' }); currentY += 5; doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.text("Kampus I: Jalan Mandung No. 1 Pengasih, Kulon Progo Telp.(0274)774625", pageWidth / 2, currentY, { align: 'center' }); currentY += 3; doc.text("Kampus II: Pacarejo, Semanu, Gunungkidul Telp. (0274)5042222/(0274)5042255", pageWidth / 2, currentY, { align: 'center' }); currentY += 3; doc.text("Laman: https://fv.uny.ac.id E-mail: fv@uny.ac.id", pageWidth / 2, currentY, { align: 'center' }); currentY += 3; pageWidth -= 30; doc.setLineWidth(1); doc.line(14, currentY, pageWidth - 14, currentY); currentY += 10; const subtitle = `JADWAL UAS ${selectedProgram.name.toUpperCase()} SEMESTER ${formData.semester.toUpperCase()} TAHUN AKADEMIK ${formData.academic_year}`; doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.text(subtitle, pageWidth / 2, currentY, { align: 'center' }); currentY += 7; const tableColumn = ["No.", "HARI", "TANGGAL", "SESI", "KODE MK", "MATA KULIAH", "SMT", "KLS", "MHS", "RUANG"]; const tableRows: any[] = []; examsToPrint.forEach((exam, index) => { tableRows.push([ index + 1, exam.day, format(parseISO(exam.date), 'dd-MM-yyyy'), exam.session.replace(/Session \d+ \((.*)\)/, '$1'), exam.course_code, exam.course_name, exam.semester, exam.class, exam.student_amount, exam.room?.name || 'Take Home', ]); }); autoTable(doc, { head: [tableColumn], body: tableRows, startY: currentY, theme: 'grid', styles: { fontSize: 8, cellPadding: 1.5, valign: 'middle' }, headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' }, columnStyles: { 0: { halign: 'center', cellWidth: 8 }, 4: { halign: 'center' }, 6: { halign: 'center' }, 7: { halign: 'center' }, 8: { halign: 'center' } } }); const finalY = (doc as any).lastAutoTable.finalY || 100; doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.text(`Yogyakarta, ${format(new Date(), 'd MMMMCxxInterop')}`, 140, finalY + 10); doc.text("Ketua Jurusan,", 140, finalY + 17); doc.setFont('helvetica', 'bold'); doc.text(departmentHead.full_name, 140, finalY + 37); const nameWidth = doc.getTextWidth(departmentHead.full_name); doc.setLineWidth(0.2); doc.line(140, finalY + 38, 140 + nameWidth, finalY + 38); doc.setFont('helvetica', 'normal'); doc.text(`NIP. ${departmentHead.identity_number}`, 140, finalY + 43); doc.save(`Jadwal_UAS_${selectedProgram.code}_${formData.semester}.pdf`); } catch (e: any) { console.error("PDF Generation Error:", e); toast.error("An unexpected error occurred while generating the PDF."); } };
    
    const isDepartmentAdmin = profile?.role === 'department_admin';
    const isSuperAdmin = profile?.role === 'super_admin';

    if (loading && !profile) {
        return <div className="flex justify-center items-center h-64"><RefreshCw className="animate-spin h-8 w-8 text-blue-600" /></div>;
    }

    // --- REFACTORED: Logic to determine page content ---
    let pageContent = null;

    const MainView = (
        <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                 <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                    <div className="flex flex-col sm:flex-row gap-4 flex-1">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input type="text" placeholder="Search exams, department..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div className="flex gap-2">
                            <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            <select value={sessionFilter} onChange={(e) => setSessionFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" >
                                <option value="all">All Sessions</option> <option value="Session 1 (7:30-9:30)">Session 1 (7:30-9:30)</option> <option value="Session 2 (9:45-11:45)">Session 2 (9:45-11:45)</option> <option value="Session 3 (12:30-14:30)">Session 3 (12:30-14:30)</option> <option value="Session 4 (14:45-16:45)">Session 4 (14:45-16:45)</option> <option value="Take Home">Take Home</option>
                            </select>
                            <select value={semesterFilter} onChange={(e) => setSessionSemester(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" >
                                <option value="all">All Semesters</option> {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (<option key={sem} value={sem.toString()}>Semester {sem}</option>))}
                            </select>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button onClick={() => fetchExams()} className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors" > <RefreshCw className="h-5 w-5" /> </button>
                        <button onClick={() => { setShowPrintModal(true); setPrintSelectedDepartment(''); printForm.reset(); }} className="flex items-center space-x-2 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"> <Printer className="h-4 w-4" /> <span>Print</span> </button>
                        {isDepartmentAdmin && <button onClick={() => { setEditingExam(null); form.reset({ course_name: '', course_code: '', date: format(new Date(), 'yyyy-MM-dd'), session: '', semester: 1, class: '', student_amount: 0, room_id: '', lecturer_id: '', study_program_id: '', }); setShowModal(true); }} className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700" > <Plus className="h-4 w-4" /> <span>Add Exam</span> </button>}
                    </div>
                </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                {isSuperAdmin && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"> Department </th>}
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"> Course </th> <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"> Date & Session </th> <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"> Class & Semester </th> <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"> Room </th> <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"> Lecturer </th> <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"> Students </th>
                                {isDepartmentAdmin && <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"> Actions </th>}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (<tr><td colSpan={isDepartmentAdmin ? 8 : (isSuperAdmin ? 8 : 7)} className="px-6 py-12 text-center"><div className="flex items-center justify-center"><RefreshCw className="h-6 w-6 animate-spin text-blue-600 mr-2" /><span className="text-gray-600">Loading exams...</span></div></td></tr>)
                                : filteredExams.length === 0 ? (<tr><td colSpan={isDepartmentAdmin ? 8 : (isSuperAdmin ? 8 : 7)} className="px-6 py-12 text-center"><div className="text-gray-500"><Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" /><p className="text-lg font-medium mb-2">No exams found</p><p>Try adjusting your search or filters</p></div></td></tr>)
                                : (filteredExams.map((exam) => (<tr key={exam.id} className="hover:bg-gray-50">
                                    {isSuperAdmin && <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm font-medium text-gray-900">{exam.department?.name || 'N/A'}</div></td>}
                                    <td className="px-6 py-4 whitespace-nowrap"><div><div className="text-sm font-medium text-gray-900">{exam.course_name || 'N/A'}</div><div className="text-sm text-gray-500">{exam.course_code}</div><div className="text-xs text-gray-500">{exam.study_program?.name}</div></div></td>
                                    <td className="px-6 py-4 whitespace-nowrap"><div><div className="text-sm font-medium text-gray-900">{format(parseISO(exam.date), 'MMM d, yyyy')}</div><div className="text-sm text-gray-500">{exam.day}</div><div className="text-sm text-gray-500">{exam.session}</div></div></td>
                                    <td className="px-6 py-4 whitespace-nowrap"><div><div className="text-sm font-medium text-gray-900">Class {exam.class}</div><div className="text-sm text-gray-500">Semester {exam.semester}</div></div></td>
                                    <td className="px-6 py-4 whitespace-nowrap"><div>{exam.session === 'Take Home' ? (<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">Take Home Exam</span>) : (<><div className="text-sm font-medium text-gray-900">{exam.room?.name || 'N/A'}</div><div className="text-sm text-gray-500">{exam.room?.code || 'N/A'}</div></>)}</div></td>
                                    <td className="px-6 py-4 whitespace-nowrap"><div className="flex items-center"><div className="h-8 w-8 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center"><User className="h-4 w-4 text-white" /></div><div className="ml-3"><div className="text-sm font-medium text-gray-900">{exam.lecturer?.full_name || 'Unknown'}</div></div></div></td>
                                    <td className="px-6 py-4 whitespace-nowrap"><div className="flex items-center"><Users className="h-4 w-4 text-gray-400 mr-1" /><span className="text-sm text-gray-900">{exam.student_amount}</span></div></td>
                                    {isDepartmentAdmin && (<td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"><div className="flex items-center justify-end space-x-2"><button onClick={() => handleEdit(exam)} className="text-blue-600 hover:text-blue-900 p-1 rounded transition-colors"><Edit className="h-4 w-4" /></button><button onClick={() => setShowDeleteConfirm(exam.id)} className="text-red-600 hover:text-red-900 p-1 rounded transition-colors"><Trash2 className="h-4 w-4" /></button></div></td>)}
                                </tr>)))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
    
    if (isSuperAdmin) {
        pageContent = (
            <div className="space-y-6">
                <div className="bg-gradient-to-r from-slate-600 to-slate-800 rounded-xl p-6 text-white">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-3xl font-bold flex items-center space-x-3"><Shield className="h-8 w-8" /> <span>Admin Dashboard</span></h1>
                            <p className="mt-2 opacity-90">Manage system-wide exam settings and view all schedules.</p>
                        </div>
                        <div className="text-center">
                            <button onClick={handleModeChange} className={`p-3 rounded-full transition-all duration-300 ${examModeEnabled ? 'bg-green-500 hover:bg-green-600 shadow-lg' : 'bg-red-500 hover:bg-red-600 shadow-lg'}`}>
                                {examModeEnabled ? <Power className="h-7 w-7 text-white" /> : <PowerOff className="h-7 w-7 text-white" />}
                            </button>
                            <p className={`mt-2 text-sm font-bold ${examModeEnabled ? 'text-green-300' : 'text-red-300'}`}>
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
                            <div><h1 className="text-3xl font-bold flex items-center space-x-3"><Calendar className="h-8 w-8" /><span>Exam Management</span></h1><p className="mt-2 opacity-90">Manage exam schedules for your department</p></div>
                            <div className="hidden md:block text-right"><div className="text-2xl font-bold">{exams.length}</div><div className="text-sm opacity-80">Total Exams</div></div>
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

    // --- REFACTORED: Single return statement with all modals at the end ---
    return (
        <>
            {pageContent}

            {showModal && isDepartmentAdmin && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-semibold text-gray-900"> {editingExam ? 'Edit Exam Schedule' : 'Add New Exam Schedule'} </h3>
                                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors"> <X className="h-6 w-6" /> </button>
                            </div>
                            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4"> <div> <label className="block text-sm font-medium text-gray-700 mb-1">Course Name *</label> <input {...form.register('course_name')} type="text" placeholder="e.g., Database Systems" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" /> {form.formState.errors.course_name && (<p className="mt-1 text-sm text-red-600">{form.formState.errors.course_name.message}</p>)} </div> <div> <label className="block text-sm font-medium text-gray-700 mb-1">Course Code *</label> <input {...form.register('course_code')} type="text" placeholder="e.g., CS301" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" /> {form.formState.errors.course_code && (<p className="mt-1 text-sm text-red-600">{form.formState.errors.course_code.message}</p>)} </div> </div>
                                <div className="grid grid-cols-2 gap-4"> <div> <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label> <input {...form.register('date')} type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" /> {form.formState.errors.date && (<p className="mt-1 text-sm text-red-600">{form.formState.errors.date.message}</p>)} </div> <div> <label className="block text-sm font-medium text-gray-700 mb-1">Session *</label> <select {...form.register('session')} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" > <option value="">Select Session</option> <option value="Session 1 (7:30-9:30)">Session 1 (7:30-9:30)</option> <option value="Session 2 (9:45-11:45)">Session 2 (9:45-11:45)</option> <option value="Session 3 (12:30-14:30)">Session 3 (12:30-14:30)</option> <option value="Session 4 (14:45-16:45)">Session 4 (14:45-16:45)</option> <option value="Take Home">Take Home</option> </select> {form.formState.errors.session && (<p className="mt-1 text-sm text-red-600">{form.formState.errors.session.message}</p>)} </div> </div>
                                <div className="grid grid-cols-2 gap-4"> <div> <label className="block text-sm font-medium text-gray-700 mb-1">Semester (1-8) *</label> <input {...form.register('semester', { valueAsNumber: true, onChange: (e) => { const value = parseInt(e.target.value); if (value < 1) e.target.value = '1'; if (value > 8) e.target.value = '8'; } })} type="number" min="1" max="8" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" /> {form.formState.errors.semester && (<p className="mt-1 text-sm text-red-600">{form.formState.errors.semester.message}</p>)} </div> <div> <label className="block text-sm font-medium text-gray-700 mb-1">Class *</label> <input {...form.register('class')} type="text" placeholder="e.g., A, B, C, etc." className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" /> {form.formState.errors.class && (<p className="mt-1 text-sm text-red-600">{form.formState.errors.class.message}</p>)} </div> </div>
                                <div className="grid grid-cols-2 gap-4"> <div> <label className="block text-sm font-medium text-gray-700 mb-1">Study Program *</label> <Controller name="study_program_id" control={form.control} render={({ field }) => { const options = studyPrograms.map(p => ({ ...p, value: p.id, label: p.name, })); const currentValue = options.find(o => o.value === field.value); return ( <Select {...field} options={options} value={currentValue} onChange={option => field.onChange(option ? option.value : '')} placeholder="Search or select..." isClearable formatOptionLabel={program => ( <div> <span>{program.name}</span> <span style={{ color: '#888', marginLeft: '5px' }}> ({program.code}) </span> </div> )}/> ); }} /> {form.formState.errors.study_program_id && (<p className="mt-1 text-sm text-red-600">{form.formState.errors.study_program_id.message}</p>)} </div> <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Lecturer in Charge *</label>
                                    <Controller name="lecturer_id" control={form.control} render={({ field }) => { const options = filteredLecturers.map(l => ({ value: l.id, label: l.full_name })); const currentValue = options.find(o => o.value === field.value); return ( <Select {...field} options={options} value={currentValue} onChange={val => field.onChange(val?.value)} placeholder="Search or select..." isClearable noOptionsMessage={() => watchStudyProgramId ? 'No lecturers found' : 'Select a study program first'} /> ) }} /> {form.formState.errors.lecturer_id && (<p className="mt-1 text-sm text-red-600">{form.formState.errors.lecturer_id.message}</p>)}
                                </div> </div>
                                <div className="grid grid-cols-2 gap-4"> <div> <label className="block text-sm font-medium text-gray-700 mb-1">Room {watchSession !== 'Take Home' && '*'}</label> <Controller name="room_id" control={form.control} render={({ field }) => { const roomOptions = getAvailableRooms().map(r => ({ ...r, value: r.id, label: r.name })); const selectedValue = roomOptions.find(o => o.value === field.value); return ( <Select {...field} options={roomOptions} value={selectedValue} onChange={option => field.onChange(option ? option.value : '')} isDisabled={watchSession === 'Take Home'} placeholder="Search or select..." isClearable formatOptionLabel={room => ( <div> <span>{room.name}</span> <span style={{ color: '#888', marginLeft: '5px' }}> ({room.code}) - Cap: {room.capacity} </span> </div> )}/> ); }}/> {form.formState.errors.room_id && (<p className="mt-1 text-sm text-red-600">{form.formState.errors.room_id.message}</p>)} </div> <div> <label className="block text-sm font-medium text-gray-700 mb-1">Student Amount *</label> <input {...form.register('student_amount', { valueAsNumber: true })} type="number" min="0" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" /> {form.formState.errors.student_amount && (<p className="mt-1 text-sm text-red-600">{form.formState.errors.student_amount.message}</p>)} </div> </div>
                                <div className="flex space-x-3 pt-4"> <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button> <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{loading ? 'Saving...' : editingExam ? 'Update' : 'Create'}</button> </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
            
            {showDeleteConfirm && isDepartmentAdmin && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                        <div className="flex items-center mb-4"><div className="flex-shrink-0"><AlertCircle className="h-6 w-6 text-red-600" /></div><div className="ml-3"><h3 className="text-lg font-medium text-gray-900">Delete Exam</h3></div></div>
                        <p className="text-sm text-gray-500 mb-6">Are you sure you want to delete this exam? This action cannot be undone.</p>
                        <div className="flex space-x-3"><button onClick={() => setShowDeleteConfirm(null)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button><button onClick={() => handleDelete(showDeleteConfirm as string)} disabled={loading} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">{loading ? 'Deleting...' : 'Delete'}</button></div>
                    </div>
                </div>
            )}
            
            {showPrintModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-semibold text-gray-900">Print Exam Schedule</h3>
                                <button onClick={() => setShowPrintModal(false)} className="text-gray-400 hover:text-gray-600"> <X className="h-6 w-6" /> </button>
                            </div>
                            <form onSubmit={printForm.handleSubmit(handlePrint)} className="space-y-4">
                                {isSuperAdmin && (
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
                    placeholder="Select head..."
                    isClearable
                />
            )}
        />
        {printForm.formState.errors.department_head_id && <p className="text-red-600 text-sm mt-1">{printForm.formState.errors.department_head_id.message}</p>}
    </div>
)}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Study Program *</label>
                                    <Controller name="study_program_id" control={printForm.control} render={({ field }) => { const filteredPrograms = isSuperAdmin ? studyPrograms.filter(p => p.department_id === printSelectedDepartment) : studyPrograms; const options = filteredPrograms.map(p => ({ value: p.id, label: p.name })); const currentValue = options.find(o => o.value === field.value); return ( <Select {...field} options={options} value={currentValue} onChange={option => field.onChange(option ? option.value : '')} placeholder="Select study program..." isDisabled={isSuperAdmin && !printSelectedDepartment} isClearable /> )}} />
                                    {printForm.formState.errors.study_program_id && <p className="text-red-600 text-sm mt-1">{printForm.formState.errors.study_program_id.message}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Semester Type *</label>
                                    <Controller name="semester" control={printForm.control} render={({ field }) => ( <Select {...field} options={[{value: 'GASAL', label: 'GASAL (Odd)'}, {value: 'GENAP', label: 'GENAP (Even)'}]} value={field.value ? {value: field.value, label: `${field.value} (${field.value === 'GASAL' ? 'Odd' : 'Even'})`} : null} onChange={option => field.onChange(option?.value)} placeholder="Select semester type..." /> )} />
                                    {printForm.formState.errors.semester && <p className="text-red-600 text-sm mt-1">{printForm.formState.errors.semester.message}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year *</label>
                                    <input {...printForm.register('academic_year')} type="text" placeholder="e.g. 2024/2025" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                    {printForm.formState.errors.academic_year && <p className="text-red-600 text-sm mt-1">{printForm.formState.errors.academic_year.message}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Department Head *</label>
                                    <Controller name="department_head_id" control={printForm.control} render={({ field }) => ( <Select options={departmentHeads.map(h => ({ value: h.id, label: h.full_name }))} value={field.value ? departmentHeads.map(h => ({ value: h.id, label: h.full_name })).find(o => o.value === field.value) : null} onChange={(option) => { field.onChange(option ? option.value : ''); const selectedHead = departmentHeads.find(h => h.id === option?.value); printForm.setValue('department_head_name', selectedHead?.full_name); }} placeholder="Select head..." isClearable /> )} />
                                    {printForm.formState.errors.department_head_id && <p className="text-red-600 text-sm mt-1">{printForm.formState.errors.department_head_id.message}</p>}
                                </div>
                                <div className="flex space-x-3 pt-4">
                                    <button type="button" onClick={() => setShowPrintModal(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button>
                                    <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Generate PDF</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {showClearConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                        <div className="flex items-start">
                            <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10"><AlertCircle className="h-6 w-6 text-red-600" /></div>
                            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                                <h3 className="text-lg leading-6 font-medium text-gray-900">Change Exam Mode?</h3>
                                <div className="mt-2"><p className="text-sm text-gray-500">This action will <span className="font-bold">PERMANENTLY DELETE ALL</span> existing exam schedules. Are you sure you want to continue?</p></div>
                            </div>
                        </div>
                        <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                            <button onClick={confirmClearAndToggleMode} type="button" className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 sm:ml-3 sm:w-auto sm:text-sm">Yes, Change & Delete</button>
                            <button onClick={() => setShowClearConfirm(false)} type="button" className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:w-auto sm:text-sm">Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ExamManagement;