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
  Filter,
  Edit,
  Trash2,
  Eye,
  RefreshCw,
  X,
  AlertCircle,
  Check,
  Plus,
  Building,
  User,
  BookOpen,
  Clock,
  Users,
  CalendarIcon,
  GraduationCap,
  FileText,
  Download,
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

// --- MODIFIED: Added department_id for Super Admin printing ---
const printSchema = z.object({
    department_id: z.string().optional(), // Optional for dept_admin, required for super_admin
    study_program_id: z.string().min(1, 'Study Program is required'),
    semester: z.enum(['GASAL', 'GENAP'], { required_error: 'Semester type is required' }),
    academic_year: z.string().min(9, 'Academic Year is required (e.g., 2023/2024)').regex(/^\d{4}\/\d{4}$/, 'Invalid format. Use (`YYYY/YYYY`)'),
    department_head_id: z.string().min(1, 'Department Head is required'),
    department_head_name: z.string().optional(),
}).superRefine((data, ctx) => {
    // --- NEW: Custom validation to require department for super_admin ---
    const { profile } = useAuth.getState();
    if (profile?.role === 'super_admin' && !data.department_id) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['department_id'],
            message: 'Department is required for Super Admin.',
        });
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

    // --- NEW: State for Super Admin's print modal ---
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
    
    // --- NEW: Effect to reset study program when department changes in print modal ---
    useEffect(() => {
        if (isSuperAdmin) {
            printForm.setValue('study_program_id', '');
        }
    }, [printSelectedDepartment]);


    const fetchExamModeStatus = async () => { /* ... NO CHANGE ... */ };
    const handleModeChange = () => { if (profile?.role !== 'super_admin') return; setShowClearConfirm(true); };
    const confirmClearAndToggleMode = async () => { /* ... NO CHANGE ... */ };

    // --- MODIFIED: fetchExams now handles super_admin role to show all exams ---
    const fetchExams = async () => { 
        try { 
            let query = supabase.from('exams').select('*, room:rooms(*), lecturer:users!lecturer_id(*), department:departments(*), study_program:study_programs(*)'); 
            if (profile?.role === 'department_admin' && profile?.department_id) { 
                query = query.eq('department_id', profile.department_id); 
            }
            // Super admin sees all exams, so no filter is applied for them.
            query = query.order('date', { ascending: true }); 
            const { data, error } = await query; 
            if (error) throw error; 
            setExams(data || []); 
        } catch (error: any) { 
            console.error('Error fetching exams:', error); 
            toast.error('Failed to load exams.'); 
        } 
    };

    // --- MODIFIED: fetchStudyPrograms now handles super_admin role ---
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
    const fetchRooms = async () => { /* ... NO CHANGE ... */ };
    const fetchLecturers = async () => { /* ... NO CHANGE, already correct for department admin ... */ };

    // --- MODIFIED: fetchDepartments now fetches all for super_admin ---
    const fetchDepartments = async () => { 
        try { 
            let query = supabase.from('departments').select('id, name'); 
            // Super Admin needs all departments for the print filter
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
    
    const fetchDepartmentHeads = async () => { /* ... NO CHANGE ... */ };
    const fetchBookedRooms = async (date: string, session: string) => { /* ... NO CHANGE ... */ };
    const filterLecturersByStudyProgram = (studyProgramId: string) => { /* ... NO CHANGE ... */ };
    const getDayFromDate = (dateString: string) => { /* ... NO CHANGE ... */ };
    const handleSubmit = async (data: ExamFormData) => { /* ... NO CHANGE ... */ };
    const handleEdit = (exam: any) => { /* ... NO CHANGE ... */ };
    const handleDelete = async (id: string) => { /* ... NO CHANGE ... */ };

    const filteredExams = exams.filter(exam => {
        const matchesSearch = (exam.course_name && exam.course_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                              exam.course_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              exam.class.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              (exam.department?.name && exam.department.name.toLowerCase().includes(searchTerm.toLowerCase())); // Added department search
        const matchesDate = !dateFilter || exam.date === dateFilter;
        const matchesSession = sessionFilter === 'all' || exam.session === sessionFilter;
        const matchesSemester = semesterFilter === 'all' || exam.semester.toString() === semesterFilter;
        return matchesSearch && matchesDate && matchesSession && matchesSemester;
    });

    const getAvailableRooms = () => { /* ... NO CHANGE ... */ };
    
    // --- MODIFIED: handlePrint now handles super_admin and department_admin differently ---
    const handlePrint = async (formData: PrintFormData) => { 
        try { 
            const departmentIdForQuery = isSuperAdmin ? formData.department_id : profile.department_id;
            
            const selectedProgram = studyPrograms.find(p => p.id === formData.study_program_id); 
            const departmentHead = departmentHeads.find(h => h.id === formData.department_head_id); 
            const currentDepartment = departments.find(d => d.id === departmentIdForQuery);

            if (!selectedProgram || !departmentHead || !currentDepartment) { 
                toast.error("Please ensure all fields are selected and data is loaded."); 
                return; 
            } 
            
            const examsToPrint = exams.filter(exam => 
                exam.study_program_id === formData.study_program_id &&
                exam.department_id === departmentIdForQuery
            ); 

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
            doc.setFontSize(12); doc.setFont('helvetica', 'normal');
            doc.text("KEMENTERIAN PENDIDIKAN TINGGI, SAINS, DAN TEKNOLOGI", pageWidth / 2, currentY, { align: 'center' }); currentY += 5;
            doc.text("UNIVERSITAS NEGERI YOGYAKARTA", pageWidth / 2, currentY, { align: 'center' }); currentY += 5;
            doc.text("FAKULTAS VOKASI", pageWidth / 2, currentY, { align: 'center' });
            doc.setFontSize(14); doc.setFont('helvetica', 'bold');
            currentY += 5; doc.text(`DEPARTEMEN ${departmentName}`, pageWidth / 2, currentY, { align: 'center' }); currentY += 5;
            doc.setFontSize(9); doc.setFont('helvetica', 'normal');
            doc.text("Kampus I: Jalan Mandung No. 1 Pengasih, Kulon Progo Telp.(0274)774625", pageWidth / 2, currentY, { align: 'center' }); currentY += 3;
            doc.text("Kampus II: Pacarejo, Semanu, Gunungkidul Telp. (0274)5042222/(0274)5042255", pageWidth / 2, currentY, { align: 'center' }); currentY += 3;
            doc.text("Laman: https://fv.uny.ac.id E-mail: fv@uny.ac.id", pageWidth / 2, currentY, { align: 'center' }); currentY += 3;
            pageWidth -= 30;
            doc.setLineWidth(1); doc.line(14, currentY, pageWidth - 14, currentY); currentY += 10;
            const subtitle = `JADWAL UAS ${selectedProgram.name.toUpperCase()} SEMESTER ${formData.semester.toUpperCase()} TAHUN AKADEMIK ${formData.academic_year}`; 
            doc.setFontSize(12); doc.setFont('helvetica', 'bold'); 
            doc.text(subtitle, pageWidth / 2, currentY, { align: 'center' }); currentY += 7;
            const tableColumn = ["No.", "HARI", "TANGGAL", "SESI", "KODE MK", "MATA KULIAH", "SMT", "KLS", "MHS", "RUANG"]; 
            const tableRows: any[] = []; 
            examsToPrint.forEach((exam, index) => { 
                tableRows.push([ index + 1, exam.day, format(parseISO(exam.date), 'dd-MM-yyyy'), exam.session.replace(/Session \d+ \((.*)\)/, '$1'), exam.course_code, exam.course_name, exam.semester, exam.class, exam.student_amount, exam.room?.name || 'Take Home', ]); 
            }); 
            autoTable(doc, { head: [tableColumn], body: tableRows, startY: currentY, theme: 'grid', styles: { fontSize: 8, cellPadding: 1.5, valign: 'middle' }, headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' }, columnStyles: { 0: { halign: 'center', cellWidth: 8 }, 4: { halign: 'center' }, 6: { halign: 'center' }, 7: { halign: 'center' }, 8: { halign: 'center' } } }); 
            const finalY = (doc as any).lastAutoTable.finalY || 100; 
            doc.setFontSize(10); doc.setFont('helvetica', 'normal'); 
            doc.text(`Yogyakarta, ${format(new Date(), 'd MMMM yyyy')}`, 140, finalY + 10); 
            doc.text("Ketua Jurusan,", 140, finalY + 17); 
            doc.setFont('helvetica', 'bold'); 
            doc.text(departmentHead.full_name, 140, finalY + 37); 
            const nameWidth = doc.getTextWidth(departmentHead.full_name); 
            doc.setLineWidth(0.2); doc.line(140, finalY + 38, 140 + nameWidth, finalY + 38); 
            doc.setFont('helvetica', 'normal'); 
            doc.text(`NIP. ${departmentHead.identity_number}`, 140, finalY + 43); 
            doc.save(`Jadwal_UAS_${selectedProgram.code}_${formData.semester}.pdf`); 
        } catch (e: any) { 
            console.error("PDF Generation Error:", e); 
            toast.error("An unexpected error occurred while generating the PDF."); 
        } 
    };
    
    const isDepartmentAdmin = profile?.role === 'department_admin';
    const isSuperAdmin = profile?.role === 'super_admin';

    if (loading && !profile) {
        return <div className="flex justify-center items-center h-64"><RefreshCw className="animate-spin h-8 w-8 text-blue-600" /></div>;
    }

    // --- NEW: Entirely new rendering logic based on role and exam mode ---

    const MainView = () => (
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
                                <option value="all">All Sessions</option>
                                <option value="Session 1 (7:30-9:30)">Session 1 (7:30-9:30)</option>
                                <option value="Session 2 (9:45-11:45)">Session 2 (9:45-11:45)</option>
                                <option value="Session 3 (12:30-14:30)">Session 3 (12:30-14:30)</option>
                                <option value="Session 4 (14:45-16:45)">Session 4 (14:45-16:45)</option>
                                <option value="Take Home">Take Home</option>
                            </select>
                            <select value={semesterFilter} onChange={(e) => setSessionSemester(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" >
                                <option value="all">All Semesters</option>
                                {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (<option key={sem} value={sem.toString()}>Semester {sem}</option>))}
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
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"> Course </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"> Date & Session </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"> Class & Semester </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"> Room </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"> Lecturer </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"> Students </th>
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
            {/* ... Modals will be rendered at the end ... */}
        </div>
    );

    if (isSuperAdmin) {
        return (
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

                {examModeEnabled && <MainView />}
                
                {showClearConfirm && ( /* ... NO CHANGE in this modal ... */ )}
                {showModal && isDepartmentAdmin && ( /* ... Add/Edit modal ... */ )}
                {showDeleteConfirm && isDepartmentAdmin && ( /* ... Delete confirm modal ... */ )}
                {showPrintModal && ( /* ... Print modal ... */ )}
            </div>
        );
    }

    if (isDepartmentAdmin) {
        if (!examModeEnabled) {
            return (
                <div className="flex items-center justify-center h-64">
                    <div className="text-center p-8 bg-yellow-50 border border-yellow-200 rounded-xl">
                        <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Exam Scheduling Disabled</h3>
                        <p className="text-gray-600">This feature is currently unavailable. Please contact the Super Admin.</p>
                    </div>
                </div>
            );
        }
        
        return (
            <div className="space-y-6">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white"> <div className="flex items-center justify-between"> <div> <h1 className="text-3xl font-bold flex items-center space-x-3"> <Calendar className="h-8 w-8" /> <span>Exam Management</span> </h1> <p className="mt-2 opacity-90"> Manage exam schedules for your department </p> </div> <div className="hidden md:block text-right"> <div className="text-2xl font-bold">{exams.length}</div> <div className="text-sm opacity-80">Total Exams</div> </div> </div> </div>
                <MainView />
                {showModal && ( /* ... Add/Edit modal ... */ )}
                {showDeleteConfirm && ( /* ... Delete confirm modal ... */ )}
                {showPrintModal && ( /* ... Print modal ... */ )}
            </div>
        );
    }
    
    // All Modals are rendered here to avoid duplicating code
    return (
        <>
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
                                    {/* --- THIS IS THE SEARCHABLE LECTURER DROPDOWN --- */}
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Lecturer in Charge *</label>
                                    <Controller name="lecturer_id" control={form.control} render={({ field }) => {
                                        const options = filteredLecturers.map(l => ({ value: l.id, label: l.full_name }));
                                        const currentValue = options.find(o => o.value === field.value);
                                        return (
                                            <Select
                                                {...field}
                                                options={options}
                                                value={currentValue}
                                                onChange={val => field.onChange(val?.value)}
                                                placeholder="Search or select..."
                                                isClearable
                                                noOptionsMessage={() => watchStudyProgramId ? 'No lecturers found' : 'Select a study program first'}
                                            />
                                        )
                                    }} />
                                    {form.formState.errors.lecturer_id && (<p className="mt-1 text-sm text-red-600">{form.formState.errors.lecturer_id.message}</p>)}
                                </div> </div>
                                <div className="grid grid-cols-2 gap-4"> <div> <label className="block text-sm font-medium text-gray-700 mb-1">Room {watchSession !== 'Take Home' && '*'}</label> <Controller name="room_id" control={form.control} render={({ field }) => { const roomOptions = getAvailableRooms().map(r => ({ ...r, value: r.id, label: r.name })); const selectedValue = roomOptions.find(o => o.value === field.value); return ( <Select {...field} options={roomOptions} value={selectedValue} onChange={option => field.onChange(option ? option.value : '')} isDisabled={watchSession === 'Take Home'} placeholder="Search or select..." isClearable formatOptionLabel={room => ( <div> <span>{room.name}</span> <span style={{ color: '#888', marginLeft: '5px' }}> ({room.code}) - Cap: {room.capacity} </span> </div> )}/> ); }}/> {form.formState.errors.room_id && (<p className="mt-1 text-sm text-red-600">{form.formState.errors.room_id.message}</p>)} </div> <div> <label className="block text-sm font-medium text-gray-700 mb-1">Student Amount *</label> <input {...form.register('student_amount', { valueAsNumber: true })} type="number" min="0" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" /> {form.formState.errors.student_amount && (<p className="mt-1 text-sm text-red-600">{form.formState.errors.student_amount.message}</p>)} </div> </div>
                                <div className="flex space-x-3 pt-4"> <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button> <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{loading ? 'Saving...' : editingExam ? 'Update' : 'Create'}</button> </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
            
            {showDeleteConfirm && isDepartmentAdmin && ( /* ... NO CHANGE ... */ )}
            
            {showPrintModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-semibold text-gray-900">Print Exam Schedule</h3>
                                <button onClick={() => setShowPrintModal(false)} className="text-gray-400 hover:text-gray-600"> <X className="h-6 w-6" /> </button>
                            </div>
                            <form onSubmit={printForm.handleSubmit(handlePrint)} className="space-y-4">
                                {/* --- NEW: Conditional Department Dropdown for Super Admin --- */}
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
                                        {printForm.formState.errors.department_id && <p className="text-red-600 text-sm mt-1">{printForm.formState.errors.department_id.message}</p>}
                                    </div>
                                )}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Study Program *</label>
                                    <Controller
                                        name="study_program_id"
                                        control={printForm.control}
                                        render={({ field }) => {
                                            const filteredPrograms = isSuperAdmin 
                                                ? studyPrograms.filter(p => p.department_id === printSelectedDepartment)
                                                : studyPrograms;
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
                                    {printForm.formState.errors.study_program_id && <p className="text-red-600 text-sm mt-1">{printForm.formState.errors.study_program_id.message}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Semester Type *</label>
                                    <Controller
                                        name="semester"
                                        control={printForm.control}
                                        render={({ field }) => (
                                            <Select
                                                {...field}
                                                options={[{value: 'GASAL', label: 'GASAL (Odd)'}, {value: 'GENAP', label: 'GENAP (Even)'}]}
                                                value={field.value ? {value: field.value, label: `${field.value} (${field.value === 'GASAL' ? 'Odd' : 'Even'})`} : null}
                                                onChange={option => field.onChange(option?.value)}
                                                placeholder="Select semester type..."
                                            />
                                        )}
                                    />
                                    {printForm.formState.errors.semester && <p className="text-red-600 text-sm mt-1">{printForm.formState.errors.semester.message}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year *</label>
                                    <input {...printForm.register('academic_year')} type="text" placeholder="e.g. 2024/2025" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                    {printForm.formState.errors.academic_year && <p className="text-red-600 text-sm mt-1">{printForm.formState.errors.academic_year.message}</p>}
                                </div>
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
                                <div className="flex space-x-3 pt-4">
                                    <button type="button" onClick={() => setShowPrintModal(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button>
                                    <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Generate PDF</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
            {showClearConfirm && ( /* ... NO CHANGE ... */ )}
        </>
    )
};

export default ExamManagement;