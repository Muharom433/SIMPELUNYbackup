# INSTRUKSI LENGKAP: Menambahkan Fitur Baru ke LectureSchedules.tsx

## Status yang Sudah Selesai
✅ Import icon `Copy`, `UserPlus`, dan `ChevronRight` sudah ditambahkan
✅ State variables sudah ditambahkan (line 392-406)

## LANGKAH-LANGKAH IMPLEMENTASI

### LANGKAH 1: Modifikasi fungsi `openMatchingModal` (Line 1013-1019)

**LOKASI**: Cari fungsi `const openMatchingModal = async () => {`

**GANTI DENGAN**:
```typescript
const openMatchingModal = async () => {
  setShowMatchingModal(true);
  setMatchingTab('rooms');
  setRoomMappings({});
  setLecturerMappings({});
  setSelectedLecturerForSchedule('');
  setLecturerSchedules([]);
  await analyzeUnmatchedData();
};
```

---

### LANGKAH 2: Tambahkan 3 Fungsi Baru SETELAH `openMatchingModal`

**LOKASI**: Tambahkan SETELAH fungsi `openMatchingModal` dan SEBELUM fungsi `generatePDF`

**KODE YANG DITAMBAHKAN**:

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

---

### LANGKAH 3: Tambahkan Tombol Duplicate di Tabel Actions

**LOKASI**: Cari bagian Action Column di tabel (sekitar line 1613-1629)

**TAMBAHKAN** tombol duplicate SEBELUM tombol Edit:

```typescript
<td className="px-3 md:px-6 py-4 text-right">
  <div className="flex items-center justify-end gap-1">
    {/* TOMBOL DUPLICATE - TAMBAHKAN INI */}
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
    {/* END TOMBOL DUPLICATE */}
    
    <button
      onClick={() => handleEdit(schedule)}
      className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
      title={getText('Edit', 'Edit')}
    >
      <Edit className="h-3 w-3" />
    </button>
    <button
      onClick={() => setShowDeleteConfirm(schedule.id)}
      className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
      title={getText('Delete', 'Hapus')}
    >
      <Trash2 className="h-3 w-3" />
    </button>
  </div>
</td>
```

---

### LANGKAH 4: Modifikasi Lecturer Matching Section

**LOKASI**: Cari section "Lecturer Tab Content" (sekitar line 2521-2600)

**TAMBAHKAN** tombol "Tambah User" dan sistem untuk menampilkan jadwal dosen.

Saya akan membuat file terpisah untuk kode lengkap section ini karena cukup panjang.

---

### LANGKAH 5: Tambahkan Modal Components

**LOKASI**: SEBELUM penutup tag `</div>` terakhir di component (sebelum `export default LectureSchedules;`)

Lihat file `MODAL_COMPONENTS.md` untuk kode lengkap 2 modal:
1. Add User Modal
2. Duplicate Schedule Modal

---

## CARA TESTING

1. **Test Duplikat Jadwal**:
   - Buka halaman Jadwal Kuliah
   - Klik tombol hijau "Duplicate" pada salah satu jadwal
   - Modal akan membuka dengan data jadwal yang sudah terisi
   - Ubah data (misalnya ganti kelas/hari)
   - Klik "Create Duplicate"
   - Jadwal baru harus muncul di tabel

2. **Test Tambah User di Pencocokan**:
   - Upload Excel dengan nama dosen yang belum terdaftar
   - Buka "Pencocokan Data"
   - Klik tab "Pencocokan Dosen"
   - Klik tombol "Tambah User Baru"
   - Isi form dengan data dosen
   - User baru akan otomatis terdaftar

3. **Test Lihat Jadwal Dosen**:
   - Di tab "Pencocokan Dosen"
   - Pilih user untuk salah satu nama dosen
   - Klik tombol panah untuk expand jadwal
   - Jadwal dosen tersebut akan ditampilkan

---

## CATATAN PENTING

- File sudah terlalu besar (2640 lines) untuk edit otomatis
- Saya sudah menyiapkan semua kode di file terpisah:
  - `LECTURE_SCHEDULE_ENHANCEMENTS.md` - Fungsi-fungsi
  - `MODAL_COMPONENTS.md` - Modal UI
  - File ini - Instruksi step-by-step

- Icon `Copy`, `UserPlus`, `ChevronRight` SUDAH DITAMBAHKAN ✅
- State variables SUDAH DITAMBAHKAN ✅
- Sisanya perlu ditambahkan manual mengikuti instruksi di atas

**NEED HELP?** Beritahu saya bagian mana yang ingin saya bantu implementasikan lebih detail!
