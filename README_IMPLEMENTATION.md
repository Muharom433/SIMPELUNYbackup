# 🚀 PANDUAN IMPLEMENTASI LENGKAP - Fitur Baru Jadwal Kuliah

## ✅ STATUS IMPLEMENTASI

### Sudah Selesai Otomatis:
1. ✅ Import icon `Copy`, `UserPlus`, `ChevronRight` (Line 36-39)
2. ✅ State variables untuk fitur baru (Line 392-406)

### Perlu Ditambahkan Manual:
Ikuti langkah-langkah di bawah dengan teliti.

---

## 📋 LANGKAH 1: Update openMatchingModal Function

**File**: `src/pages/LectureSchedules.tsx`  
**Lokasi**: Cari fungsi `const openMatchingModal = async () => {` (sekitar line 1013)

**GANTI** fungsi tersebut dengan:

```typescript
const openMatchingModal = async () => {
  setShowMatchingModal(true);
  setMatchingTab('rooms');
  setRoomMappings({});
  setLecturerMappings({});
  setSelectedLecturerForSchedule('');  // ← TAMBAHKAN INI
  setLecturerSchedules([]);  // ← TAMBAHKAN INI
  await analyzeUnmatchedData();
};
```

---

## 📋 LANGKAH 2: Tambahkan 3 Fungsi Baru

**File**: `src/pages/LectureSchedules.tsx`  
**Lokasi**: SETELAH fungsi `openMatchingModal` dan SEBELUM `generatePDF` (sekitar line 1020)

**COPY-PASTE** kode berikut:

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

## 📋 LANGKAH 3: Tambahkan Tombol Duplicate di Tabel

**File**: `src/pages/LectureSchedules.tsx`  
**Lokasi**: Cari bagian Action Column (sekitar line 1613-1629)

**CARI** kode ini:

```typescript
<td className="px-3 md:px-6 py-4 text-right">
  <div className="flex items-center justify-end gap-1">
    <button
      onClick={() => handleEdit(schedule)}
```

**TAMBAHKAN** tombol duplicate SEBELUM tombol Edit:

```typescript
<td className="px-3 md:px-6 py-4 text-right">
  <div className="flex items-center justify-end gap-1">
    {/* ========== TOMBOL DUPLICATE - TAMBAHKAN INI ========== */}
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
    {/* ========== END TOMBOL DUPLICATE ========== */}
    
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

## 📋 LANGKAH 4: Tambahkan 2 Modal Components

**File**: `src/pages/LectureSchedules.tsx`  
**Lokasi**: SEBELUM closing tag terakhir `</div>` dan `export default LectureSchedules;` (sekitar line 2636)

**COPY seluruh kode dari file**:
- `MODAL_COMPONENTS.md`

Atau copy dari sini (kode lengkap ada di dokumen terpisah karena terlalu panjang).

### Modal 1: Add User Modal
### Modal 2: Duplicate Schedule Modal

Kedua modal ada di file `MODAL_COMPONENTS.md` - copy paste semuanya sebelum `export default LectureSchedules;`

---

## 📋 LANGKAH 5: Enhanced Lecturer Matching Section

**File**: `src/pages/LectureSchedules.tsx`  
**Lokasi**: Cari `{/* Lecturer Tab Content */}` (sekitar line 2521)

**GANTI** seluruh section `{/* Lecturer Tab Content */}` sampai closing tag `</div>` dari lecturer tab DENGAN kode dari file `.gemini/enhanced_lecturer_section.tsx`

---

## 🧪 CARA TESTING

### Test 1: Duplicate Jadwal
1. Buka halaman Jadwal Kuliah
2. Di tabel jadwal, klik tombol hijau dengan icon Copy
3. Modal "Duplikat Jadwal" akan terbuka dengan data pre-filled
4. Ubah beberapa field (misalnya ganti kelas dari "A" ke "B")
5. Klik "Create Duplicate"
6. Jadwal baru harus muncul di tabel

### Test 2: Tambah User di Pencocokan Dosen
1. Upload Excel dengan nama dosen yang belum ada di user management
2. Klik "Pencocokan Data"
3. Pilih tab "Pencocokan Dosen"
4. Klik tombol biru "Tambah User Baru"
5. Isi form dengan data dosen baru
6. Klik "Buat Pengguna"
7. User baru otomatis terdaftar dan bisa dipilih di dropdown

### Test 3: Lihat Jadwal Dosen
1. Di tab "Pencocokan Dosen"
2. Pilih salah satu user untuk nama dosen di dropdown
3. Setelah dipilih, tombol panah akan muncul di kanan
4. Klik tombol panah untuk expand
5. Jadwal lengkap dosen tersebut akan ditampilkan di bawahnya
6. Klik lagi untuk collapse

---

## 📦 FILE BANTUAN YANG SUDAH DIBUAT

1. **IMPLEMENTATION_GUIDE.md** - Panduan ini
2. **LECTURE_SCHEDULE_ENHANCEMENTS.md** - Detail semua fungsi
3. **MODAL_COMPONENTS.md** - Kode lengkap 2 modal
4. **.gemini/new_functions.tsx** - 3 fungsi baru
5. **.gemini/enhanced_lecturer_section.tsx** - Enhanced lecturer section

---

## ⚠️ CATATAN PENTING

- Pastikan tidak ada typo saat copy-paste
- Perhatikan indentasi (gunakan 2 spasi untuk React/TSX)
- Jangan lupa save file setelah edit
- Jika ada error TypeScript, check import statements
- Test setiap fitur satu per satu

---

## 🆘 TROUBLESHOOTING

### Error: "Cannot find name 'selectedLecturerForSchedule'"
- Pastikan state sudah ditamb ahkan di langkah awal (line 392-406)

### Error: "Property 'handleDuplicateSchedule' does not exist"
- Pastikan fungsi sudah ditambahkan di langkah 2

### Tombol Duplicate tidak muncul
- Check apakah icon Copy sudah di-import
- Check apakah kode button sudah ditambahkan di kolom action yang benar

### Modal tidak muncul
- Pastikan modal components sudah ditambahkan sebelum `export default`
- Check console untuk error

---

## 📞 NEED HELP?

Jika ada bagian yang kurang jelas atau error, beritahu saya:
1. Bagian mana yang error
2. Pesan error yang muncul
3. Screenshot jika perlu

Saya siap membantu implementasi detail untuk setiap bagian!
