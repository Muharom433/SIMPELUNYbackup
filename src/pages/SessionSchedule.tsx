import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, User, Plus, Search, Filter, Download, Edit3, Trash2, Users, BookOpen, ChevronDown, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface SessionSchedule {
  id: string;
  student_id: string;
  date: string;
  start_time: string;
  end_time: string;
  room_id: string;
  title: string;
  supervisor: string;
  examiner: string;
  secretary: string;
  created_at: string;
  updated_at: string;
  // Relations
  student?: {
    id: string;
    full_name: string;
    identity_number: string;
    study_program_id: string;
    study_program?: {
      name: string;
      department_id: string;
      department?: {
        name: string;
      };
    };
  };
  room?: {
    id: string;
    name: string;
    department_id: string;
  };
}

interface User {
  id: string;
  full_name: string;
  identity_number: string;
  role: string;
  study_program_id?: string;
  study_program?: {
    name: string;
    department_id: string;
  };
}

interface Room {
  id: string;
  name: string;
  department_id: string;
}

interface StudyProgram {
  id: string;
  name: string;
  department_id: string;
}

const SessionSchedule: React.FC = () => {
  const { getText } = useLanguage();
  const [user, setUser] = useState<any>(null);
  const [sessions, setSessions] = useState<SessionSchedule[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<SessionSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSession, setEditingSession] = useState<SessionSchedule | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProgram, setSelectedProgram] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  // Form states
  const [formData, setFormData] = useState({
    student_id: '',
    student_name: '',
    student_nim: '',
    study_program_id: '',
    date: '',
    start_time: '',
    end_time: '',
    room_id: '',
    title: '',
    supervisor: '',
    examiner: '',
    secretary: ''
  });

  // Dropdown data
  const [students, setStudents] = useState<User[]>([]);
  const [lecturers, setLecturers] = useState<User[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [studyPrograms, setStudyPrograms] = useState<StudyProgram[]>([]);

  // Search dropdowns
  const [studentSearch, setStudentSearch] = useState('');
  const [supervisorSearch, setSupervisorSearch] = useState('');
  const [examinerSearch, setExaminerSearch] = useState('');
  const [secretarySearch, setSecretarySearch] = useState('');
  const [roomSearch, setRoomSearch] = useState('');
  const [programSearch, setProgramSearch] = useState('');

  // Dropdown visibility
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const [showSupervisorDropdown, setShowSupervisorDropdown] = useState(false);
  const [showExaminerDropdown, setShowExaminerDropdown] = useState(false);
  const [showSecretaryDropdown, setShowSecretaryDropdown] = useState(false);
  const [showRoomDropdown, setShowRoomDropdown] = useState(false);
  const [showProgramDropdown, setShowProgramDropdown] = useState(false);

  useEffect(() => {
    getCurrentUser();
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (user) {
      fetchSessions();
    }
  }, [user]);

  useEffect(() => {
    filterSessions();
  }, [sessions, searchTerm, selectedProgram, selectedDate]);

  useEffect(() => {
    if (formData.date && formData.start_time && formData.end_time) {
      checkAvailableRooms();
    }
  }, [formData.date, formData.start_time, formData.end_time]);

  const getCurrentUser = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      const { data: userData } = await supabase
        .from('users')
        .select(`
          *,
          study_program:study_programs(
            name,
            department_id,
            department:departments(name)
          )
        `)
        .eq('id', authUser.id)
        .single();
      setUser(userData);
    }
  };

  const fetchInitialData = async () => {
    try {
      // Fetch study programs
      const { data: programsData } = await supabase
        .from('study_programs')
        .select(`
          *,
          department:departments(name)
        `)
        .order('name');
      setStudyPrograms(programsData || []);

      // Fetch students
      const { data: studentsData } = await supabase
        .from('users')
        .select(`
          *,
          study_program:study_programs(
            name,
            department_id
          )
        `)
        .eq('role', 'student')
        .order('full_name');
      setStudents(studentsData || []);

      // Fetch lecturers
      const { data: lecturersData } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'lecturer')
        .order('full_name');
      setLecturers(lecturersData || []);

      // Fetch rooms
      const { data: roomsData } = await supabase
        .from('rooms')
        .select('*')
        .order('name');
      setRooms(roomsData || []);

    } catch (error) {
      console.error('Error fetching initial data:', error);
    }
  };

  const fetchSessions = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('final_sessions')
        .select(`
          *,
          student:users!student_id(
            id,
            full_name,
            identity_number,
            study_program:study_programs(
              name,
              department_id,
              department:departments(name)
            )
          ),
          room:rooms(
            id,
            name,
            department_id
          )
        `)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

      // Filter by department for department admins
      if (user?.role === 'department_admin' && user?.study_program?.department_id) {
        // We need to filter by department through the student's study program
        const { data: departmentSessions } = await query;
        const filteredByDepartment = departmentSessions?.filter(session => 
          session.student?.study_program?.department_id === user.study_program.department_id
        );
        setSessions(filteredByDepartment || []);
      } else {
        const { data: allSessions } = await query;
        setSessions(allSessions || []);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkAvailableRooms = async () => {
    try {
      const { data: conflictingSessions } = await supabase
        .from('final_sessions')
        .select('room_id')
        .eq('date', formData.date)
        .or(`and(start_time.lte.${formData.end_time},end_time.gte.${formData.start_time})`);

      const conflictingRoomIds = conflictingSessions?.map(session => session.room_id) || [];
      
      let filteredRooms = rooms;
      
      // Filter by department for department admins
      if (user?.role === 'department_admin' && user?.study_program?.department_id) {
        filteredRooms = rooms.filter(room => room.department_id === user.study_program.department_id);
      }
      
      const available = filteredRooms.filter(room => !conflictingRoomIds.includes(room.id));
      setAvailableRooms(available);
    } catch (error) {
      console.error('Error checking available rooms:', error);
      setAvailableRooms(rooms);
    }
  };

  const filterSessions = () => {
    let filtered = sessions;

    if (searchTerm) {
      filtered = filtered.filter(session =>
        session.student?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        session.student?.identity_number?.includes(searchTerm) ||
        session.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        session.supervisor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        session.examiner?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        session.secretary?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedProgram) {
      filtered = filtered.filter(session =>
        session.student?.study_program?.name === selectedProgram
      );
    }

    if (selectedDate) {
      filtered = filtered.filter(session => session.date === selectedDate);
    }

    setFilteredSessions(filtered);
  };

  const handleStudentSelect = (student: User) => {
    setFormData(prev => ({
      ...prev,
      student_id: student.id,
      student_name: student.full_name,
      student_nim: student.identity_number,
      study_program_id: student.study_program_id || ''
    }));
    setStudentSearch(student.full_name);
    setShowStudentDropdown(false);
  };

  const resetForm = () => {
    setFormData({
      student_id: '',
      student_name: '',
      student_nim: '',
      study_program_id: '',
      date: '',
      start_time: '',
      end_time: '',
      room_id: '',
      title: '',
      supervisor: '',
      examiner: '',
      secretary: ''
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const sessionData = {
        student_id: formData.student_id,
        date: formData.date,
        start_time: formData.start_time,
        end_time: formData.end_time,
        room_id: formData.room_id,
        title: formData.title,
        supervisor: formData.supervisor,
        examiner: formData.examiner,
        secretary: formData.secretary
      };

      if (editingSession) {
        await supabase
          .from('final_sessions')
          .update(sessionData)
          .eq('id', editingSession.id);
      } else {
        await supabase
          .from('final_sessions')
          .insert(sessionData);
      }

      fetchSessions();
      setShowAddModal(false);
      setShowEditModal(false);
      setEditingSession(null);
      resetForm();
    } catch (error) {
      console.error('Error saving session:', error);
    }
  };

  const handleEdit = (session: SessionSchedule) => {
    setEditingSession(session);
    setFormData({
      student_id: session.student_id,
      student_name: session.student?.full_name || '',
      student_nim: session.student?.identity_number || '',
      study_program_id: session.student?.study_program_id || '',
      date: session.date,
      start_time: session.start_time,
      end_time: session.end_time,
      room_id: session.room_id,
      title: session.title,
      supervisor: session.supervisor,
      examiner: session.examiner,
      secretary: session.secretary
    });
    
    // Set search values for display
    setStudentSearch(session.student?.full_name || '');
    setRoomSearch(session.room?.name || '');
    
    setShowEditModal(true);
  };

  const handleDelete = async (sessionId: string) => {
    if (window.confirm(getText('Are you sure you want to delete this session?', 'Apakah Anda yakin ingin menghapus sesi ini?'))) {
      try {
        await supabase
          .from('final_sessions')
          .delete()
          .eq('id', sessionId);
        fetchSessions();
      } catch (error) {
        console.error('Error deleting session:', error);
      }
    }
  };

  const generatePDF = (programName?: string) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(16);
    doc.text('JADWAL SIDANG AKHIR', 105, 20, { align: 'center' });
    
    if (programName) {
      doc.setFontSize(12);
      doc.text(`Program Studi: ${programName}`, 105, 30, { align: 'center' });
    }
    
    // Filter sessions by program if specified
    let sessionsToExport = filteredSessions;
    if (programName) {
      sessionsToExport = filteredSessions.filter(session => 
        session.student?.study_program?.name === programName
      );
    }
    
    // Table data
    const tableData = sessionsToExport.map(session => [
      session.student?.identity_number || '-',
      session.student?.full_name || '-',
      session.student?.study_program?.name || '-',
      new Date(session.date).toLocaleDateString('id-ID'),
      session.start_time.slice(0, 5),
      session.end_time.slice(0, 5),
      session.room?.name || '-',
      session.title,
      session.supervisor,
      session.examiner,
      session.secretary
    ]);
    
    // Table
    (doc as any).autoTable({
      head: [['NIM', 'Nama', 'Prodi', 'Tanggal', 'Mulai', 'Selesai', 'Ruangan', 'Judul', 'Pembimbing', 'Penguji', 'Sekretaris']],
      body: tableData,
      startY: programName ? 40 : 30,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] }
    });
    
    // Save
    const fileName = programName 
      ? `Jadwal_Sidang_${programName.replace(/\s+/g, '_')}.pdf`
      : 'Jadwal_Sidang_Semua.pdf';
    doc.save(fileName);
  };

  const getFilteredList = (list: any[], searchTerm: string, searchField: string) => {
    if (!searchTerm) return [];
    
    // Remove academic titles for search
    const cleanSearchTerm = searchTerm.toLowerCase()
      .replace(/prof\.|dr\.|s\.pd\.|m\.pd\.|s\.kom\.|m\.kom\./gi, '')
      .trim();
    
    return list.filter(item => {
      const cleanName = item[searchField].toLowerCase()
        .replace(/prof\.|dr\.|s\.pd\.|m\.pd\.|s\.kom\.|m\.kom\./gi, '')
        .trim();
      const cleanIdentity = item.identity_number?.toLowerCase() || '';
      return cleanName.includes(cleanSearchTerm) || cleanIdentity.includes(cleanSearchTerm);
    }).slice(0, 5);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {getText('Session Schedule', 'Jadwal Sidang')}
            </h1>
            <p className="text-gray-600">
              {getText('Manage final exam sessions', 'Kelola jadwal sidang akhir')}
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            {user?.role === 'department_admin' && (
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
              >
                <Plus className="h-5 w-5" />
                <span>{getText('Add Session', 'Tambah Sidang')}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {getText('Search', 'Cari')}
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={getText('Search by name, NIM, title...', 'Cari berdasarkan nama, NIM, judul...')}
                className="pl-10 w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {getText('Study Program', 'Program Studi')}
            </label>
            <select
              value={selectedProgram}
              onChange={(e) => setSelectedProgram(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">{getText('All Programs', 'Semua Program')}</option>
              {studyPrograms
                .filter(program => {
                  if (user?.role === 'department_admin' && user?.study_program?.department_id) {
                    return program.department_id === user.study_program.department_id;
                  }
                  return true;
                })
                .map(program => (
                  <option key={program.id} value={program.name}>
                    {program.name}
                  </option>
                ))
              }
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {getText('Date', 'Tanggal')}
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {getText('Export PDF', 'Ekspor PDF')}
            </label>
            <div className="space-y-2">
              <button
                onClick={() => generatePDF()}
                className="w-full bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg flex items-center justify-center space-x-2 transition-colors text-sm"
              >
                <Download className="h-4 w-4" />
                <span>{getText('All Programs', 'Semua Program')}</span>
              </button>
              
              {selectedProgram && (
                <button
                  onClick={() => generatePDF(selectedProgram)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg flex items-center justify-center space-x-2 transition-colors text-sm"
                >
                  <Download className="h-4 w-4" />
                  <span>{selectedProgram}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sessions Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getText('Student', 'Mahasiswa')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getText('Program', 'Program')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getText('Schedule', 'Jadwal')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getText('Room', 'Ruangan')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getText('Title', 'Judul')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {getText('Committee', 'Panitia')}
                </th>
                {user?.role === 'department_admin' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {getText('Actions', 'Aksi')}
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSessions.map((session) => (
                <tr key={session.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {session.student?.full_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {session.student?.identity_number}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {session.student?.study_program?.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {new Date(session.date).toLocaleDateString('id-ID')}
                    </div>
                    <div className="text-sm text-gray-500">
                      {session.start_time.slice(0, 5)} - {session.end_time.slice(0, 5)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {session.room?.name}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 max-w-xs truncate">
                      {session.title}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs space-y-1">
                      <div><span className="font-medium">{getText('Supervisor', 'Pembimbing')}:</span> {session.supervisor}</div>
                      <div><span className="font-medium">{getText('Examiner', 'Penguji')}:</span> {session.examiner}</div>
                      <div><span className="font-medium">{getText('Secretary', 'Sekretaris')}:</span> {session.secretary}</div>
                    </div>
                  </td>
                  {user?.role === 'department_admin' && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEdit(session)}
                          className="text-blue-600 hover:text-blue-900 p-1 rounded"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(session.id)}
                          className="text-red-600 hover:text-red-900 p-1 rounded"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredSessions.length === 0 && (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {getText('No sessions found', 'Tidak ada sesi ditemukan')}
              </h3>
              <p className="text-gray-500">
                {getText('Try adjusting your search filters', 'Coba sesuaikan filter pencarian Anda')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingSession 
                    ? getText('Edit Session', 'Edit Sidang')
                    : getText('Add New Session', 'Tambah Sidang Baru')
                  }
                </h2>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                    setEditingSession(null);
                    resetForm();
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Student Information */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {getText('Search Student by NIM', 'Cari Mahasiswa berdasarkan NIM')}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={studentSearch}
                        onChange={(e) => {
                          setStudentSearch(e.target.value);
                          setShowStudentDropdown(true);
                        }}
                        onFocus={() => setShowStudentDropdown(true)}
                        placeholder={getText('Enter NIM or name', 'Masukkan NIM atau nama')}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      
                      {showStudentDropdown && studentSearch && (
                        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                          {getFilteredList(
                            students.filter(student => {
                              if (user?.role === 'department_admin' && user?.study_program?.department_id) {
                                return student.study_program?.department_id === user.study_program.department_id;
                              }
                              return true;
                            }), 
                            studentSearch, 
                            'full_name'
                          ).map(student => (
                          <button
                              key={student.id}
                              type="button"
                              onClick={() => handleStudentSelect(student)}
                              className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                            >
                              <div className="font-medium">{student.full_name}</div>
                              <div className="text-sm text-gray-500">{student.identity_number}</div>
                            </button>
                          ))}
                          {getFilteredList(
                            students.filter(student => {
                              if (user?.role === 'department_admin' && user?.study_program?.department_id) {
                                return student.study_program?.department_id === user.study_program.department_id;
                              }
                              return true;
                            }), 
                            studentSearch, 
                            'full_name'
                          ).length === 0 && (
                            <div className="px-3 py-2 text-gray-500 text-sm">
                              {getText('No students found', 'Tidak ada mahasiswa ditemukan')}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {getText('Student Name', 'Nama Mahasiswa')}
                    </label>
                    <input
                      type="text"
                      value={formData.student_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, student_name: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {getText('Study Program', 'Program Studi')}
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
                        placeholder={getText('Search study program', 'Cari program studi')}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      
                      {showProgramDropdown && programSearch && (
                        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                          {studyPrograms
                            .filter(program => {
                              if (user?.role === 'department_admin' && user?.study_program?.department_id) {
                                return program.department_id === user.study_program.department_id &&
                                       program.name.toLowerCase().includes(programSearch.toLowerCase());
                              }
                              return program.name.toLowerCase().includes(programSearch.toLowerCase());
                            })
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

                {/* Schedule Information */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {getText('Date', 'Tanggal')}
                    </label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {getText('Start Time', 'Waktu Mulai')}
                    </label>
                    <input
                      type="time"
                      value={formData.start_time}
                      onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {getText('End Time', 'Waktu Selesai')}
                    </label>
                    <input
                      type="time"
                      value={formData.end_time}
                      onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {getText('Room', 'Ruangan')}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={roomSearch}
                        onChange={(e) => {
                          setRoomSearch(e.target.value);
                          setShowRoomDropdown(true);
                        }}
                        onFocus={() => setShowRoomDropdown(true)}
                        placeholder={getText('Search available rooms', 'Cari ruangan tersedia')}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      
                      {showRoomDropdown && roomSearch && (
                        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                          {availableRooms
                            .filter(room => room.name.toLowerCase().includes(roomSearch.toLowerCase()))
                            .slice(0, 5)
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
                                {room.name}
                              </button>
                            ))
                          }
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Session Details */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {getText('Thesis Title', 'Judul Skripsi/Tesis')}
                  </label>
                  <textarea
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                {/* Committee Members */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {getText('Supervisor', 'Pembimbing')}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={supervisorSearch}
                        onChange={(e) => {
                          setSupervisorSearch(e.target.value);
                          setShowSupervisorDropdown(true);
                        }}
                        onFocus={() => setShowSupervisorDropdown(true)}
                        placeholder={getText('Search supervisor', 'Cari pembimbing')}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      
                      {showSupervisorDropdown && supervisorSearch && (
                        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                          {getFilteredList(lecturers, supervisorSearch, 'full_name').map(lecturer => (
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
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {getText('Examiner', 'Penguji')}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={examinerSearch}
                        onChange={(e) => {
                          setExaminerSearch(e.target.value);
                          setShowExaminerDropdown(true);
                        }}
                        onFocus={() => setShowExaminerDropdown(true)}
                        placeholder={getText('Search examiner', 'Cari penguji')}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      
                      {showExaminerDropdown && examinerSearch && (
                        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                          {getFilteredList(lecturers, examinerSearch, 'full_name').map(lecturer => (
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
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {getText('Secretary', 'Sekretaris')}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={secretarySearch}
                        onChange={(e) => {
                          setSecretarySearch(e.target.value);
                          setShowSecretaryDropdown(true);
                        }}
                        onFocus={() => setShowSecretaryDropdown(true)}
                        placeholder={getText('Search secretary', 'Cari sekretaris')}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      
                      {showSecretaryDropdown && secretarySearch && (
                        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                          {getFilteredList(lecturers, secretarySearch, 'full_name').map(lecturer => (
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
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Submit Buttons */}
                <div className="flex items-center justify-end space-x-4 pt-6 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setShowEditModal(false);
                      setEditingSession(null);
                      resetForm();
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    {getText('Cancel', 'Batal')}
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    {editingSession 
                      ? getText('Update Session', 'Perbarui Sidang')
                      : getText('Create Session', 'Buat Sidang')
                    }
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