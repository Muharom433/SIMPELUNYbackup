# Enhancements untuk LectureSchedules.tsx

## 1. Fungsi-fungsi Baru (Tambahkan setelah line 1006)

```typescript
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
```

## 2. Modifikasi openMatchingModal (Line 1000-1006)

Ganti fungsi openMatchingModal dengan:

```typescript
const openMatchingModal = async () => {
  setShowMatchingModal(true);
  setMatchingTab('rooms');
  setRoomMappings( {});
  setLecturerMappings({});
  setSelectedLecturerForSchedule('');
  setLecturerSchedules([]);
  await analyzeUnmatchedData();
};
```

## 3. Tambahkan Tombol Duplicate di Tabel (sekitar line 1614-1629)

Tambahkan tombol duplicate sebelum tombol delete:

```typescript
<button
  onClick={() => {
    setScheduleToDuplicate(schedule);
    setShowDuplicateModal(true);
  }}
  className="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded transition-colors"
  title={getText('Duplicate', 'Duplikat')}
>
  <Copy className="h-3 w-3" />
</button>
```

## 4. Tambahkan Import Copy Icon (Line 1-46)

Tambahkan Copy ke import lucide-react:

```typescript
import {
  Clock,
  Plus,
  Search,
  Edit,
  Trash2,
  Upload,
  Download,
  FileUp,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Filter,
  Calendar,
  MapPin,
  User,
  RefreshCw,
  Send,
  AlertCircle,
  CheckCircle,
  Link,
  Eye,
  Copy, // <-- TAMBAHKAN INI
  UserPlus, // <-- TAMBAHKAN INI
} from 'lucide-react';
```

## 5. Modifikasi Lecturer Dropdown dalam Matching Modal

Pada bagian lecturer matching (sekitar line 2549-2582), tambahkan tombol "Tambah User" dan panel jadwal dosen:

Di atas "Lecturer List" section, tambahkan tombol:

```typescript
{/* Button to add new user */}
<div className="mb-4">
  <button
    onClick={() => {
      setShowAddUserInMatching(true);
      setNewUserScheduleName('');
    }}
    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
  >
    <UserPlus className="h-4 w-4" />
    {getText('Add New User', 'Tambah User Baru')}
  </button>
</div>
```

Di dalam loop unmatchedLecturers.map, setelah bagian dropdown (sekitar line 2581), tambahkan:

```typescript
{/* Show schedules for this lecturer when mapping is selected */}
{lecturerMappings[lecturer] && (
  <button
    onClick={() => {
      if (selectedLecturerForSchedule === lecturer) {
        setSelectedLecturerForSchedule('');
        setLecturerSchedules([]);
      } else {
        setSelectedLecturerForSchedule(lecturer);
        fetchLecturerSchedules(lecturer);
      }
    }}
    className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
    title={getText('Show Schedules', 'Lihat Jadwal')}
  >
    {selectedLecturerForSchedule === lecturer ? (
      <ChevronDown className="h-5 w-5" />
    ) : (
      <ChevronRight className="h-5 w-5" />
    )}
  </button>
)}

{/* Lecturer Schedules Panel */}
{selectedLecturerForSchedule === lecturer && lecturerMappings[lecturer] && (
  <div className="col-span-full mt-2 bg-white border border-purple-200 rounded-lg p-4">
    <h4 className="text-sm font-semibold text-purple-700 mb-3 flex items-center gap-2">
      <Calendar className="h-4 w-4" />
      {getText(`Schedules for ${lecturer}`, `Jadwal untuk ${lecturer}`)}
    </h4>
    {loadingLecturerSchedules ? (
      <div className="flex items-center justify-center py-4">
        <RefreshCw className="h-5 w-5 animate-spin text-purple-600" />
      </div>
    ) : lecturerSchedules.length === 0 ? (
      <p className="text-sm text-gray-500 text-center py-4">
        {getText('No schedules found', 'Tidak ada jadwal ditemukan')}
      </p>
    ) : (
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {lecturerSchedules.map((sched, idx) => (
          <div key={idx} className="flex items-center justify-between p-2 bg-purple-50 rounded text-sm">
            <div className="flex-1">
              <div className="font-medium text-gray-900">{sched.course_name}</div>
              <div className="text-xs text-gray-600">
                {sched.day} • {sched.start_time?.substring(0, 5)} - {sched.end_time?.substring(0, 5)} • {sched.room}
              </div>
            </div>
            <span className="text-xs px-2 py-1 bg-purple-200 text-purple-800 rounded">
              {sched.class}
            </span>
          </div>
        ))}
      </div>
    )}
  </div>
)}
```
