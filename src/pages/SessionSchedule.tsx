// ✅ Enhanced StudentInformationStep dengan duplicate detection
const StudentInformationStep = () => {
  const dropdownRef = useRef(null);
  const programDisplayRef = useRef(null);
  const programDropdownRef = useRef(null);
  
  // ✅ State untuk duplicate detection
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  
  const localData = useRef({
    studentSearch: '',
    studentName: '',
    studentNim: '',
    studyProgramId: '',
    selectedProgramDisplay: ''
  });

  // ✅ Function untuk check existing sessions
  const checkExistingSession = async (studentNim, studentName) => {
    if (!studentNim.trim() && !studentName.trim()) {
      setDuplicateWarning(null);
      return;
    }

    setIsCheckingDuplicate(true);
    try {
      // Check by NIM first
      let query = supabase
        .from('final_sessions')
        .select(`
          id,
          date,
          start_time,
          end_time,
          student:users!student_id(
            id,
            full_name,
            identity_number,
            study_program:study_programs(name)
          )
        `);

      if (studentNim.trim()) {
        // Query by student NIM
        const { data: studentData } = await supabase
          .from('users')
          .select('id')
          .eq('identity_number', studentNim.trim())
          .maybeSingle();

        if (studentData) {
          query = query.eq('student_id', studentData.id);
        } else {
          // No student found with this NIM, safe to proceed
          setDuplicateWarning(null);
          return;
        }
      } else if (studentName.trim()) {
        // If only name provided, check by name (less accurate)
        const { data: existingSessions } = await supabase
          .from('final_sessions')
          .select(`
            id,
            date,
            start_time,
            end_time,
            student:users!student_id(
              id,
              full_name,
              identity_number,
              study_program:study_programs(name)
            )
          `);

        const matchingSessions = existingSessions?.filter(session => 
          session.student?.full_name?.toLowerCase().includes(studentName.toLowerCase())
        );

        if (matchingSessions && matchingSessions.length > 0) {
          setDuplicateWarning({
            type: 'name_match',
            sessions: matchingSessions,
            message: getText(
              `Found ${matchingSessions.length} existing session(s) with similar name. Please verify this is a different student.`,
              `Ditemukan ${matchingSessions.length} sidang dengan nama serupa. Pastikan ini mahasiswa yang berbeda.`
            )
          });
        } else {
          setDuplicateWarning(null);
        }
        return;
      }

      const { data: existingSessions, error } = await query;
      
      if (error) {
        console.error('Error checking existing sessions:', error);
        return;
      }

      if (existingSessions && existingSessions.length > 0) {
        // Filter out current editing session if exists
        const relevantSessions = existingSessions.filter(session => 
          !editingSession || session.id !== editingSession.id
        );

        if (relevantSessions.length > 0) {
          setDuplicateWarning({
            type: 'exact_match',
            sessions: relevantSessions,
            message: getText(
              `This student already has ${relevantSessions.length} scheduled session(s). Please check if you want to create another session.`,
              `Mahasiswa ini sudah memiliki ${relevantSessions.length} jadwal sidang. Periksa apakah Anda ingin membuat sidang lain.`
            )
          });
        } else {
          setDuplicateWarning(null);
        }
      } else {
        setDuplicateWarning(null);
      }
    } catch (error) {
      console.error('Error in checkExistingSession:', error);
    } finally {
      setIsCheckingDuplicate(false);
    }
  };

  // ✅ Debounced check untuk performance
  const debouncedCheck = useCallback(
    debounce((nim, name) => checkExistingSession(nim, name), 500),
    [editingSession]
  );

  const updateParentFormData = (field, value) => {
    localData.current[field] = value;
  };

  const syncToParentForm = () => {
    setFormData(prev => ({
      ...prev,
      student_name: localData.current.studentName,
      student_nim: localData.current.studentNim,
      study_program_id: localData.current.studyProgramId
    }));
  };

  // ✅ Enhanced student dropdown dengan duplicate info
  const showStudentDropdown = (searchTerm) => {
    if (!searchTerm.trim()) {
      hideStudentDropdown();
      return;
    }

    const filteredStudents = students.filter(student => 
      student && 
      student.identity_number && 
      student.full_name &&
      (
        student.identity_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.full_name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );

    if (filteredStudents.length === 0) {
      hideStudentDropdown();
      return;
    }

    // ✅ Check which students already have sessions
    const studentsWithSessionStatus = filteredStudents.map(student => {
      const hasExistingSession = allSessions.some(session => 
        session.student_id === student.id && 
        (!editingSession || session.id !== editingSession.id)
      );
      return { ...student, hasExistingSession };
    });

    const dropdownHTML = `
      <div class="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
        ${studentsWithSessionStatus.map(student => `
          <div 
            class="dropdown-item px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors duration-150 ${student.hasExistingSession ? 'bg-yellow-50' : ''}"
            data-student-id="${student.id}"
            data-student-nim="${student.identity_number}"
            data-student-name="${student.full_name}"
            data-program-id="${student.study_program_id || ''}"
            data-has-session="${student.hasExistingSession}"
          >
            <div class="flex items-center justify-between">
              <div class="flex-1">
                <div class="font-semibold text-gray-800">${student.identity_number}</div>
                <div class="text-sm text-gray-600">${student.full_name}</div>
                ${student.study_program ? `<div class="text-xs text-gray-500">${student.study_program.name}</div>` : ''}
              </div>
              ${student.hasExistingSession ? `
                <div class="ml-2 flex-shrink-0">
                  <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    ${getText('Has Session', 'Ada Sidang')}
                  </span>
                </div>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;

    if (dropdownRef.current) {
      dropdownRef.current.innerHTML = dropdownHTML;
      dropdownRef.current.style.display = 'block';
      
      dropdownRef.current.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('mousedown', (e) => e.preventDefault());
        item.addEventListener('click', (e) => {
          const studentId = e.currentTarget.dataset.studentId;
          const studentNim = e.currentTarget.dataset.studentNim;
          const studentName = e.currentTarget.dataset.studentName;
          const programId = e.currentTarget.dataset.programId;
          const hasSession = e.currentTarget.dataset.hasSession === 'true';
          
          studentInputRef.current.value = studentNim;
          studentNameRef.current.value = studentName;
          
          localData.current.studentNim = studentNim;
          localData.current.studentName = studentName;
          localData.current.studyProgramId = programId;
          
          form.setValue('student_id', studentId);
          syncToParentForm();
          
          // ✅ Show warning if student has existing session
          if (hasSession) {
            checkExistingSession(studentNim, studentName);
          } else {
            setDuplicateWarning(null);
          }
          
          if (programId) {
            const program = studyPrograms.find(p => p.id === programId);
            if (program) {
              const display = `${program.name} (${program.code})`;
              localData.current.selectedProgramDisplay = display;
              if (programDisplayRef.current) {
                programDisplayRef.current.value = display;
              }
            }
          }
          
          hideStudentDropdown();
          studentInputRef.current.focus();
        });
      });
    }
  };

  // ✅ Enhanced input handler dengan duplicate check
  const handleStudentInputChange = (e) => {
    const value = e.target.value;
    localData.current.studentNim = value;
    showStudentDropdown(value);
    
    // Trigger duplicate check
    if (value.trim().length >= 3) {
      debouncedCheck(value, localData.current.studentName);
    } else {
      setDuplicateWarning(null);
    }
  };

  const handleStudentNameChange = (e) => {
    const value = e.target.value;
    localData.current.studentName = value;
    
    // Trigger duplicate check if NIM is not available
    if (!localData.current.studentNim.trim() && value.trim().length >= 3) {
      debouncedCheck('', value);
    }
  };

  // ✅ Duplicate Warning Component
  const DuplicateWarningCard = () => {
    if (!duplicateWarning) return null;

    return (
      <div className={`rounded-lg border p-4 mb-4 ${
        duplicateWarning.type === 'exact_match' 
          ? 'bg-red-50 border-red-200' 
          : 'bg-yellow-50 border-yellow-200'
      }`}>
        <div className="flex items-start space-x-3">
          <div className={`flex-shrink-0 mt-0.5 ${
            duplicateWarning.type === 'exact_match' ? 'text-red-600' : 'text-yellow-600'
          }`}>
            <AlertCircle className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h4 className={`font-semibold ${
              duplicateWarning.type === 'exact_match' ? 'text-red-800' : 'text-yellow-800'
            }`}>
              {duplicateWarning.type === 'exact_match' 
                ? getText('Duplicate Session Detected', 'Sidang Duplikat Terdeteksi')
                : getText('Similar Name Found', 'Nama Serupa Ditemukan')
              }
            </h4>
            <p className={`text-sm mt-1 ${
              duplicateWarning.type === 'exact_match' ? 'text-red-700' : 'text-yellow-700'
            }`}>
              {duplicateWarning.message}
            </p>
            
            {/* ✅ Show existing sessions */}
            <div className="mt-3 space-y-2">
              {duplicateWarning.sessions.slice(0, 3).map((session, index) => (
                <div key={session.id} className={`text-xs p-2 rounded border ${
                  duplicateWarning.type === 'exact_match' 
                    ? 'bg-red-100 border-red-200' 
                    : 'bg-yellow-100 border-yellow-200'
                }`}>
                  <div className="font-medium">
                    {session.student?.full_name} ({session.student?.identity_number})
                  </div>
                  <div className="text-gray-600">
                    {format(parseISO(session.date), 'MMM d, yyyy')} • {session.start_time} - {session.end_time}
                  </div>
                  {session.student?.study_program && (
                    <div className="text-gray-500">
                      {session.student.study_program.name}
                    </div>
                  )}
                </div>
              ))}
              {duplicateWarning.sessions.length > 3 && (
                <div className="text-xs text-gray-500">
                  {getText(
                    `+ ${duplicateWarning.sessions.length - 3} more sessions`,
                    `+ ${duplicateWarning.sessions.length - 3} sidang lainnya`
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="text-center mb-4 md:mb-8">
        <h3 className="text-lg md:text-2xl font-bold text-gray-900 mb-2">
          {getText('Student Information', 'Informasi Mahasiswa')}
        </h3>
        <p className="text-sm md:text-base text-gray-600">
          {getText('Please select or enter student details for the examination', 'Silakan pilih atau masukkan detail mahasiswa untuk sidang')}
        </p>
      </div>

      {/* ✅ Duplicate Warning Display */}
      <DuplicateWarningCard />
      
      <div className="space-y-4 md:grid md:grid-cols-1 lg:grid-cols-3 md:gap-6 md:space-y-0">
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {getText("Student NIM", "NIM Mahasiswa")} *
            {isCheckingDuplicate && (
              <span className="ml-2 text-blue-600">
                <RefreshCw className="h-3 w-3 animate-spin inline" />
              </span>
            )}
          </label>
          <div className="relative">
            <input
              ref={studentInputRef}
              type="text"
              placeholder={getText("Search student by NIM or name...", "Cari mahasiswa berdasarkan NIM atau nama...")}
              onInput={handleStudentInputChange}
              onFocus={(e) => {
                showStudentDropdown(e.target.value);
              }}
              onBlur={() => {
                syncToParentForm();
                setTimeout(() => hideStudentDropdown(), 150);
              }}
              className={`w-full px-4 py-3 pr-10 border rounded-xl focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-200 ${
                duplicateWarning?.type === 'exact_match' 
                  ? 'border-red-300 focus:ring-red-500' 
                  : duplicateWarning?.type === 'name_match'
                  ? 'border-yellow-300 focus:ring-yellow-500'
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
              autoComplete="off"
            />
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <div ref={dropdownRef} style={{ display: 'none' }}></div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {getText("Student Name", "Nama Mahasiswa")} *
          </label>
          <input
            ref={studentNameRef}
            type="text"
            placeholder={getText("Enter student name...", "Masukkan nama mahasiswa...")}
            onInput={handleStudentNameChange}
            onBlur={() => {
              syncToParentForm();
            }}
            className={`w-full px-3 md:px-4 py-2 md:py-3 border rounded-lg md:rounded-xl focus:outline-none focus:ring-2 transition-all duration-200 text-sm md:text-base ${
              duplicateWarning?.type === 'exact_match' 
                ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                : duplicateWarning?.type === 'name_match'
                ? 'border-yellow-300 focus:ring-yellow-500 focus:border-yellow-500'
                : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
            }`}
            autoComplete="off"
          />
        </div>

        {/* Program Studi dropdown tetap sama */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {getText("Study Program", "Program Studi")} *
          </label>
          <div className="relative">
            <input
              ref={programDisplayRef}
              type="text"
              readOnly
              placeholder={getText("Click to select program...", "Klik untuk pilih program...")}
              onClick={showProgramDropdown}
              className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 cursor-pointer bg-white"
            />
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <div ref={programDropdownRef} style={{ display: 'none' }}></div>
          </div>
        </div>
      </div>
      
      {formData.student_nim && !form.getValues('student_id') && !duplicateWarning && (
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
};

// ✅ Enhanced validation step yang consider duplicate warning
const validateStep = useCallback((step) => {
  switch (step) {
    case 1:
      let studentNim = formData.student_nim || 
                      (studentInputRef.current?.value) || '';
      let studentName = formData.student_name || 
                       (studentNameRef.current?.value) || '';
      let studyProgramId = formData.study_program_id || '';
      
      // ✅ Check if all required fields are filled
      const hasRequiredFields = !!(studentNim.trim() && studentName.trim() && studyProgramId);
      
      // ✅ If there's an exact duplicate, require confirmation
      if (duplicateWarning?.type === 'exact_match') {
        const confirmed = confirm(getText(
          'This student already has scheduled sessions. Do you want to proceed with creating another session?',
          'Mahasiswa ini sudah memiliki jadwal sidang. Apakah Anda ingin melanjutkan membuat sidang lain?'
        ));
        return hasRequiredFields && confirmed;
      }
      
      return hasRequiredFields;
      
    case 2:
      return !!(form.getValues('date') && form.getValues('start_time') && form.getValues('end_time'));
      
    case 3:
      const roomId = form.getValues('room_id');
      
      let title = form.getValues('title') || 
                 (titleInputRef.current?.value) || '';
      let supervisor = form.getValues('supervisor') || 
                      (supervisorInputRef.current?.value) || '';
      let examiner = form.getValues('examiner') || 
                    (examinerInputRef.current?.value) || '';
      let secretary = form.getValues('secretary') || 
                     (secretaryInputRef.current?.value) || '';
      
      return !!(roomId && title.trim() && supervisor.trim() && examiner.trim() && secretary.trim());
      
    default:
      return false;
  }
}, [form, formData, duplicateWarning]);

// ✅ Debounce utility function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}