// ✅ Enhanced handleSubmit dengan comprehensive duplicate prevention
const handleSubmit = async (data: SessionFormData) => {
  try {
    setSubmitting(true);

    // ✅ Pre-submission duplicate check - Final validation
    if (!editingSession) {
      const finalDuplicateCheck = await performFinalDuplicateCheck();
      if (finalDuplicateCheck.hasDuplicate) {
        const proceed = confirm(getText(
          `FINAL WARNING: ${finalDuplicateCheck.message}\n\nAre you absolutely sure you want to create another session for this student?`,
          `PERINGATAN AKHIR: ${finalDuplicateCheck.message}\n\nApakah Anda benar-benar yakin ingin membuat sidang lain untuk mahasiswa ini?`
        ));
        
        if (!proceed) {
          setSubmitting(false);
          return;
        }
      }
    }

    let finalStudentId = data.student_id;
    
    // ✅ Enhanced student creation/validation logic
    if (!finalStudentId && formData.student_nim && formData.student_name) {
      const studentResult = await handleStudentCreationOrValidation();
      finalStudentId = studentResult.studentId;
      
      if (studentResult.hasConflict) {
        alert.error(studentResult.conflictMessage);
        setSubmitting(false);
        return;
      }
    }

    if (!finalStudentId) {
      throw new Error(getText(
        'Student information is required. Please select or enter student details.',
        'Informasi mahasiswa diperlukan. Silakan pilih atau masukkan detail mahasiswa.'
      ));
    }

    // ✅ Enhanced room conflict checking
    const roomConflictCheck = await validateRoomAvailability(data);
    if (roomConflictCheck.hasConflict) {
      alert.error(roomConflictCheck.message);
      setSubmitting(false);
      return;
    }

    const sessionData = {
      student_id: finalStudentId,
      date: data.date,
      start_time: data.start_time,
      end_time: data.end_time,
      room_id: data.room_id,
      title: data.title.trim(),
      supervisor: data.supervisor.trim(),
      examiner: data.examiner.trim(),
      secretary: data.secretary.trim(),
      created_by: profile?.id, // ✅ Track who created the session
      department_id: profile?.department_id, // ✅ Track department
    };

    if (editingSession) {
      const { error } = await supabase
        .from('final_sessions')
        .update({
          ...sessionData,
          updated_at: new Date().toISOString(),
          updated_by: profile?.id
        })
        .eq('id', editingSession.id);
      
      if (error) {
        console.error('Error updating session:', error);
        throw new Error(`Failed to update session: ${error.message}`);
      }
      
      alert.success(getText('Session updated successfully', 'Jadwal sidang berhasil diperbarui'));
    } else {
      const { data: newSession, error } = await supabase
        .from('final_sessions')
        .insert([{
          ...sessionData,
          created_at: new Date().toISOString()
        }])
        .select(`
          *,
          student:users(full_name, identity_number),
          room:rooms(name, code)
        `)
        .single();
      
      if (error) {
        console.error('Error creating session:', error);
        throw new Error(`Failed to create session: ${error.message}`);
      }

      // ✅ Enhanced success message with session details
      const studentName = newSession.student?.full_name || formData.student_name;
      const studentNim = newSession.student?.identity_number || formData.student_nim;
      const roomName = newSession.room?.name || 'Selected Room';
      const roomCode = newSession.room?.code || '';
      
      alert.success(
        getText(
          `✅ Session created successfully!\n👨‍🎓 Student: ${studentName} (${studentNim})\n🏢 Room: ${roomName} ${roomCode}\n📅 Date: ${format(new Date(data.date), 'MMM d, yyyy')}\n⏰ Time: ${data.start_time} - ${data.end_time}\n📝 Title: ${data.title.substring(0, 50)}${data.title.length > 50 ? '...' : ''}`,
          `✅ Jadwal sidang berhasil dibuat!\n👨‍🎓 Mahasiswa: ${studentName} (${studentNim})\n🏢 Ruangan: ${roomName} ${roomCode}\n📅 Tanggal: ${format(new Date(data.date), 'MMM d, yyyy')}\n⏰ Waktu: ${data.start_time} - ${data.end_time}\n📝 Judul: ${data.title.substring(0, 50)}${data.title.length > 50 ? '...' : ''}`
        )
      );

      // ✅ Log session creation for audit trail
      console.log('Session created:', {
        sessionId: newSession.id,
        studentId: finalStudentId,
        createdBy: profile?.id,
        timestamp: new Date().toISOString()
      });
    }

    setShowModal(false);
    setEditingSession(null);
    resetForm();
    fetchSessions();
    
    // ✅ Reset duplicate warning state
    setDuplicateWarning(null);
    
  } catch (error) {
    console.error('Error saving session:', error);
    
    let errorMessage = getText('Failed to save session', 'Gagal menyimpan jadwal sidang');
    
    if (error.message) {
      errorMessage = error.message;
    } else if (error.code === '23505') {
      errorMessage = getText(
        'Duplicate entry detected. This student may already have a session at this time.',
        'Data duplikat terdeteksi. Mahasiswa ini mungkin sudah memiliki sidang pada waktu ini.'
      );
    } else if (error.code === '23503') {
      errorMessage = getText(
        'Related data not found. Please refresh and try again.',
        'Data terkait tidak ditemukan. Silakan refresh dan coba lagi.'
      );
    }
    
    alert.error(errorMessage);
  } finally {
    setSubmitting(false);
  }
};

// ✅ Comprehensive final duplicate check function
const performFinalDuplicateCheck = async () => {
  try {
    const studentNim = formData.student_nim || studentInputRef.current?.value || '';
    
    if (!studentNim.trim()) {
      return { hasDuplicate: false };
    }

    // Check if student exists and has sessions
    const { data: studentData } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('identity_number', studentNim.trim())
      .maybeSingle();

    if (!studentData) {
      return { hasDuplicate: false };
    }

    const { data: existingSessions } = await supabase
      .from('final_sessions')
      .select(`
        id,
        date,
        start_time,
        end_time,
        title
      `)
      .eq('student_id', studentData.id);

    if (existingSessions && existingSessions.length > 0) {
      const sessionCount = existingSessions.length;
      const latestSession = existingSessions.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      )[0];

      return {
        hasDuplicate: true,
        message: getText(
          `Student "${studentData.full_name}" already has ${sessionCount} session(s). Latest: ${format(parseISO(latestSession.date), 'MMM d, yyyy')} at ${latestSession.start_time}`,
          `Mahasiswa "${studentData.full_name}" sudah memiliki ${sessionCount} sidang. Terbaru: ${format(parseISO(latestSession.date), 'MMM d, yyyy')} pukul ${latestSession.start_time}`
        ),
        sessionCount,
        studentName: studentData.full_name
      };
    }

    return { hasDuplicate: false };
  } catch (error) {
    console.error('Error in final duplicate check:', error);
    return { hasDuplicate: false };
  }
};

// ✅ Enhanced student creation/validation handler
const handleStudentCreationOrValidation = async () => {
  try {
    const studentNim = formData.student_nim.trim();
    const studentName = formData.student_name.trim();
    
    // First, check if student already exists
    const { data: existingUser, error: findError } = await supabase
      .from('users')
      .select('id, full_name, study_program_id')
      .eq('identity_number', studentNim)
      .maybeSingle();
    
    if (findError && findError.code !== 'PGRST116') {
      throw new Error(`Failed to check existing user: ${findError.message}`);
    }

    if (existingUser) {
      // ✅ Student exists - validate consistency
      if (existingUser.full_name.toLowerCase() !== studentName.toLowerCase()) {
        return {
          hasConflict: true,
          conflictMessage: getText(
            `NIM "${studentNim}" already exists with different name: "${existingUser.full_name}". Please verify the student information.`,
            `NIM "${studentNim}" sudah ada dengan nama berbeda: "${existingUser.full_name}". Silakan verifikasi informasi mahasiswa.`
          )
        };
      }
      
      // ✅ Check study program consistency
      if (formData.study_program_id && existingUser.study_program_id !== formData.study_program_id) {
        const existingProgram = studyPrograms.find(p => p.id === existingUser.study_program_id);
        const selectedProgram = studyPrograms.find(p => p.id === formData.study_program_id);
        
        return {
          hasConflict: true,
          conflictMessage: getText(
            `Student "${studentName}" is registered in "${existingProgram?.name || 'Unknown'}" but you selected "${selectedProgram?.name || 'Unknown'}". Please select the correct study program.`,
            `Mahasiswa "${studentName}" terdaftar di "${existingProgram?.name || 'Unknown'}" tetapi Anda memilih "${selectedProgram?.name || 'Unknown'}". Silakan pilih program studi yang benar.`
          )
        };
      }
      
      return { studentId: existingUser.id, hasConflict: false };
    } else {
      // ✅ Create new student with enhanced validation
      const selectedProgram = studyPrograms.find(p => p.id === formData.study_program_id);
      
      if (!selectedProgram) {
        return {
          hasConflict: true,
          conflictMessage: getText(
            'Study program not found. Please select a valid study program.',
            'Program studi tidak ditemukan. Silakan pilih program studi yang valid.'
          )
        };
      }

      // ✅ Additional validation for new student
      if (!studentNim.match(/^\d+$/)) {
        return {
          hasConflict: true,
          conflictMessage: getText(
            'Invalid NIM format. NIM should contain only numbers.',
            'Format NIM tidak valid. NIM hanya boleh berisi angka.'
          )
        };
      }

      if (studentName.length < 3) {
        return {
          hasConflict: true,
          conflictMessage: getText(
            'Student name is too short. Please enter the full name.',
            'Nama mahasiswa terlalu pendek. Silakan masukkan nama lengkap.'
          )
        };
      }
      
      const newUserData = {
        identity_number: studentNim,
        full_name: studentName,
        username: studentNim,
        email: `${studentNim}@student.edu`,
        role: 'student',
        password: studentNim, // ✅ In production, use secure password generation
        study_program_id: formData.study_program_id,
        department_id: selectedProgram.department_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: profile?.id // ✅ Track who created the student
      };

      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert([newUserData])
        .select('id')
        .single();

      if (createError) {
        console.error('Error creating user:', createError);
        
        if (createError.code === '23505') {
          return {
            hasConflict: true,
            conflictMessage: getText(
              'A student with this NIM already exists. Please check the NIM and try again.',
              'Mahasiswa dengan NIM ini sudah ada. Silakan periksa NIM dan coba lagi.'
            )
          };
        }
        
        throw new Error(`Failed to create user: ${createError.message}`);
      }

      // ✅ Log new student creation
      console.log('New student created:', {
        studentId: newUser.id,
        nim: studentNim,
        name: studentName,
        program: selectedProgram.name,
        createdBy: profile?.id
      });

      return { studentId: newUser.id, hasConflict: false };
    }
  } catch (error) {
    console.error('Error in handleStudentCreationOrValidation:', error);
    return {
      hasConflict: true,
      conflictMessage: getText(
        'An error occurred while processing student information. Please try again.',
        'Terjadi kesalahan saat memproses informasi mahasiswa. Silakan coba lagi.'
      )
    };
  }
};

// ✅ Enhanced room availability validation
const validateRoomAvailability = async (formData) => {
  try {
    const { date, start_time, end_time, room_id } = formData;
    
    if (!date || !start_time || !end_time || !room_id) {
      return { hasConflict: false };
    }

    // ✅ Check conflicts with existing final sessions
    const sessionConflicts = allSessions.filter(session => 
      session.date === date && 
      session.room_id === room_id &&
      (!editingSession || session.id !== editingSession.id) &&
      start_time < session.end_time && 
      end_time > session.start_time
    );

    if (sessionConflicts.length > 0) {
      const conflictDetails = sessionConflicts.map(session => 
        `${session.start_time}-${session.end_time} (${session.student?.full_name || 'Unknown'})`
      ).join(', ');

      return {
        hasConflict: true,
        message: getText(
          `Room conflict detected! The selected room is already booked for: ${conflictDetails}`,
          `Konflik ruangan terdeteksi! Ruangan yang dipilih sudah dipesan untuk: ${conflictDetails}`
        )
      };
    }

    // ✅ Check conflicts with lecture schedules
    const dateObj = new Date(date);
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const dayName = dayNames[dateObj.getDay()];
    
    const { data: lectureSchedules, error } = await supabase
      .from('lecture_schedules')
      .select('room, start_time, end_time, course_name')
      .eq('day', dayName);

    if (error) {
      console.error('Error checking lecture schedules:', error);
      return { hasConflict: false };
    }
    
    const selectedRoom = rooms.find(room => room.id === room_id);
    if (!selectedRoom) {
      return {
        hasConflict: true,
        message: getText('Selected room not found.', 'Ruangan yang dipilih tidak ditemukan.')
      };
    }

    const lectureConflicts = (lectureSchedules || []).filter(schedule => 
      schedule.room.toLowerCase() === selectedRoom.name.toLowerCase() &&
      start_time < schedule.end_time && 
      end_time > schedule.start_time
    );

    if (lectureConflicts.length > 0) {
      const conflictDetails = lectureConflicts.map(schedule => 
        `${schedule.start_time}-${schedule.end_time} (${schedule.course_name || 'Lecture'})`
      ).join(', ');

      return {
        hasConflict: true,
        message: getText(
          `Room conflict with lecture schedule! Conflicts: ${conflictDetails}`,
          `Konflik dengan jadwal kuliah! Konflik: ${conflictDetails}`
        )
      };
    }

    return { hasConflict: false };
  } catch (error) {
    console.error('Error validating room availability:', error);
    return { hasConflict: false };
  }
};

// ✅ Enhanced resetForm with comprehensive cleanup
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
  
  // ✅ Reset all form data states
  setFormData({ student_name: '', student_nim: '', study_program_id: '' });
  setCurrentStep(1);
  setCompletedSteps(new Set());
  
  // ✅ Reset duplicate warning states
  setDuplicateWarning(null);
  setIsCheckingDuplicate(false);
  
  // ✅ Clear all input refs
  if (studentInputRef.current) studentInputRef.current.value = '';
  if (studentNameRef.current) studentNameRef.current.value = '';
  if (titleInputRef.current) titleInputRef.current.value = '';
  if (supervisorInputRef.current) supervisorInputRef.current.value = '';
  if (examinerInputRef.current) examinerInputRef.current.value = '';
  if (secretaryInputRef.current) secretaryInputRef.current.value = '';
  
  // ✅ Hide any open dropdowns
  document.querySelectorAll('[id$="-dropdown"]').forEach(dropdown => {
    dropdown.style.display = 'none';
  });
  
  console.log('Form reset completed');
};

// ✅ Enhanced handleEdit with duplicate context
const handleEdit = (session: any) => {
  setEditingSession(session);
  
  // ✅ Reset duplicate warning when editing
  setDuplicateWarning(null);
  
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
  
  setFormData({
    student_name: session.student?.full_name || '',
    student_nim: session.student?.identity_number || '',
    study_program_id: session.student?.study_program?.id || ''
  });
  
  // ✅ Set to first step for editing workflow
  setCurrentStep(1);
  setCompletedSteps(new Set([1, 2, 3])); // Mark all steps as completed for editing
  
  setShowModal(true);
  
  console.log('Editing session:', session.id);
};

// ✅ Enhanced session statistics for dashboard
const getSessionStatistics = () => {
  const today = new Date();
  const thisWeek = startOfWeek(today);
  const thisMonth = startOfMonth(today);
  
  const stats = {
    total: sessions.length,
    today: sessions.filter(s => isSameDay(parseISO(s.date), today)).length,
    thisWeek: sessions.filter(s => parseISO(s.date) >= thisWeek).length,
    thisMonth: sessions.filter(s => parseISO(s.date) >= thisMonth).length,
    upcoming: sessions.filter(s => parseISO(s.date) > today).length,
    completed: sessions.filter(s => parseISO(s.date) < today).length
  };
  
  return stats;
};

// ✅ Enhanced export functionality
const exportSessionsData = (format = 'csv') => {
  try {
    const exportData = sessions.map(session => ({
      'Student Name': session.student?.full_name || '',
      'Student NIM': session.student?.identity_number || '',
      'Study Program': session.student?.study_program?.name || '',
      'Date': format(parseISO(session.date), 'yyyy-MM-dd'),
      'Start Time': session.start_time,
      'End Time': session.end_time,
      'Room': session.room?.name || '',
      'Room Code': session.room?.code || '',
      'Title': session.title,
      'Supervisor': session.supervisor,
      'Examiner': session.examiner,
      'Secretary': session.secretary,
      'Created At': format(parseISO(session.created_at), 'yyyy-MM-dd HH:mm:ss')
    }));

    if (format === 'csv') {
      const csvContent = [
        Object.keys(exportData[0]).join(','),
        ...exportData.map(row => Object.values(row).map(field => `"${field}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `session_schedule_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      link.click();
    }

    alert.success(getText('Data exported successfully', 'Data berhasil diekspor'));
  } catch (error) {
    console.error('Export error:', error);
    alert.error(getText('Failed to export data', 'Gagal mengekspor data'));
  }
};