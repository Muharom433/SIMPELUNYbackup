// FUNGSI-FUNGSI BARU UNTUK LECTURE SCHEDULES
// Copy paste ini SETELAH fungsi openMatchingModal (sekitar line 1006)

// Fetch schedules for selected lecturer in matching modal
const fetchLecturerSchedules = async (lecturerName: string) => {
    if (!lecturerName) {
        setLecturerSchedules([]);
        return;
    }

    try {
        setLoadingLecturerSchedules(true);
        const { data, error } = await supabase
            .from('lecture_schedules')
            .select('*')
            .eq('lecturer', lecturerName)
            .order('day', { ascending: true })
            .order('start_time', { ascending: true });

        if (error) throw error;
        setLecturerSchedules(data || []);
    } catch (error: any) {
        console.error('Error fetching lecturer schedules:', error);
        setLecturerSchedules([]);
    } finally {
        setLoadingLecturerSchedules(false);
    }
};

// Handle adding new user from matching modal
const handleAddNewUserInMatching = async (userData: {
    full_name: string;
    identity_number: string;
    email: string;
    phone: string;
    position: string;
}) => {
    try {
        setMatchingLoading(true);

        // Create new user with lecturer role
        const { data: newUser, error: userError } = await supabase
            .from('users')
            .insert({
                full_name: userData.full_name,
                identity_number: userData.identity_number,
                email: userData.email,
                phone: userData.phone,
                position: userData.position,
                role: 'lecturer',
            })
            .select()
            .single();

        if (userError) throw userError;

        alert.success(getText(
            `User "${userData.full_name}" created successfully!`,
            `User "${userData.full_name}" berhasil dibuat!`
        ));

        // Refresh lecturers list
        const { data: updatedLecturers } = await supabase
            .from('users')
            .select('id, full_name, identity_number')
            .eq('role', 'lecturer')
            .order('full_name');

        setLecturers(updatedLecturers || []);

        // Auto-select the newly created user for the current unmatched lecturer
        if (newUserScheduleName) {
            setLecturerMappings(prev => ({ ...prev, [newUserScheduleName]: newUser.id }));
        }

        setShowAddUserInMatching(false);
        setNewUserScheduleName('');

        // Re-analyze to update unmatched list
        await analyzeUnmatchedData();

    } catch (error: any) {
        console.error('Error adding new user:', error);
        alert.error(error.message || getText('Failed to add user', 'Gagal menambahkan user'));
    } finally {
        setMatchingLoading(false);
    }
};

// Handle duplicate schedule
const handleDuplicateSchedule = async (duplicateData: Partial<ScheduleForm>) => {
    if (!scheduleToDuplicate) return;

    try {
        setLoading(true);

        // Get room name from room ID
        const selectedRoomData = rooms.find(r => r.id === duplicateData.room);

        const scheduleData = {
            course_name: duplicateData.course_name || scheduleToDuplicate.course_name,
            course_code: duplicateData.course_code || scheduleToDuplicate.course_code,
            lecturer: duplicateData.lecturer || scheduleToDuplicate.lecturer,
            room: selectedRoomData?.name || duplicateData.room || scheduleToDuplicate.room,
            subject_study: duplicateData.subject_study || scheduleToDuplicate.subject_study,
            day: duplicateData.day || scheduleToDuplicate.day,
            start_time: duplicateData.start_time || scheduleToDuplicate.start_time,
            end_time: duplicateData.end_time || scheduleToDuplicate.end_time,
            semester: duplicateData.semester || scheduleToDuplicate.semester,
            academics_year: duplicateData.academics_year || scheduleToDuplicate.academics_year,
            type: duplicateData.type || scheduleToDuplicate.type,
            class: duplicateData.class || scheduleToDuplicate.class,
            amount: duplicateData.amount || scheduleToDuplicate.amount,
            kurikulum: duplicateData.kurikulum || scheduleToDuplicate.kurikulum,
        };

        const { error } = await supabase
            .from('lecture_schedules')
            .insert(scheduleData);

        if (error) throw error;

        alert.success(getText('Schedule duplicated successfully!', 'Jadwal berhasil diduplikat!'));
        setShowDuplicateModal(false);
        setScheduleToDuplicate(null);
        fetchSchedules();
    } catch (error: any) {
        console.error('Error duplicating schedule:', error);
        alert.error(error.message || getText('Failed to duplicate schedule', 'Gagal menduplikat jadwal'));
    } finally {
        setLoading(false);
    }
};
