## Modal Components untuk ditambahkan ke LectureSchedules.tsx

### 1. Add User Modal (tambahkan sebelum closing tag </div> di akhir component, sekitar line 2623)

```tsx
{/* Add New User Modal in Matching */}
{showAddUserInMatching && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
      <div className="bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 p-6 text-white">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-bold flex items-center gap-3">
            <UserPlus className="h-6 w-6" />
            {getText('Add New User', 'Tambah Pengguna Baru')}
          </h3>
          <button
            onClick={() => {
              setShowAddUserInMatching(false);
              setNewUserScheduleName('');
            }}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        <p className="mt-2 text-sm opacity-90">
          {getText('Create new user', 'Buat akun pengguna baru')}
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          handleAddNewUserInMatching({
            full_name: formData.get('full_name') as string,
            identity_number: formData.get('identity_number') as string,
            email: formData.get('email') as string,
            phone: formData.get('phone') as string,
            position: formData.get('position') as string,
          });
        }}
        className="p-6 space-y-4 max-h-[70vh] overflow-y-auto"
      >
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">
            {getText('Full Name', 'Nama Lengkap')} *
          </label>
          <input
            type="text"
            name="full_name"
            defaultValue={newUserScheduleName}
            required
            className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-blue-500 focus:ring-0 transition-colors"
            placeholder={getText('Enter full name', 'Masukkan nama lengkap')}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              {getText('ID Number', 'NIM/NIP')} *
            </label>
            <input
              type="text"
              name="identity_number"
              required
              className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-blue-500 focus:ring-0 transition-colors"
              placeholder="NIM/NIP"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              {getText('Email', 'Email')} *
            </label>
            <input
              type="email"
              name="email"
              required
              className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-blue-500 focus:ring-0 transition-colors"
              placeholder="user@email.com"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              {getText('Phone', 'Telepon')}
            </label>
            <input
              type="tel"
              name="phone"
              className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-blue-500 focus:ring-0 transition-colors"
              placeholder="08xxxxxxxxxx"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              {getText('Position', 'Jabatan')}
            </label>
            <input
              type="text"
              name="position"
              className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-blue-500 focus:ring-0 transition-colors"
              placeholder={getText('e.g. Lecturer, Assistant', 'cth. Dosen, Asisten')}
            />
          </div>
        </div>

        <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => {
              setShowAddUserInMatching(false);
              setNewUserScheduleName('');
            }}
            className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold transition-colors"
          >
            {getText('Cancel', 'Batal')}
          </button>
          <button
            type="submit"
            disabled={matchingLoading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold transition-all shadow-lg"
          >
            {matchingLoading ? (
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                {getText('Creating...', 'Membuat...')}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                {getText('Create User', 'Buat Pengguna')}
              </div>
            )}
          </button>
        </div>
      </form>
    </div>
  </div>
)}
```

### 2. Duplicate Schedule Modal (tambahkan sebelum closing tag </div> di akhir component)

```tsx
{/* Duplicate Schedule Modal */}
{showDuplicateModal && scheduleToDuplicate && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
      <div className="bg-gradient-to-r from-green-500 via-emerald-500 to-teal-600 p-6 text-white">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-bold flex items-center gap-3">
            <Copy className="h-6 w-6" />
            {getText('Duplicate Schedule', 'Duplikat Jadwal')}
          </h3>
          <button
            onClick={() => {
              setShowDuplicateModal(false);
              setScheduleToDuplicate(null);
            }}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        <p className="mt-2 text-sm opacity-90">
          {getText(
            'Modify the schedule details below before creating the duplicate',
            'Ubah detail jadwal di bawah sebelum membuat duplikat'
          )}
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          handleDuplicateSchedule({
            course_name: formData.get('course_name') as string,
            course_code: formData.get('course_code') as string,
            lecturer: formData.get('lecturer') as string,
            room: formData.get('room') as string,
            subject_study: formData.get('subject_study') as string,
            day: formData.get('day') as string,
            start_time: formData.get('start_time') as string,
            end_time: formData.get('end_time') as string,
            semester: parseInt(formData.get('semester') as string),
            academics_year: parseInt(formData.get('academics_year') as string),
            type: formData.get('type') as 'theory' | 'practical',
            class: formData.get('class') as string,
            amount: parseInt(formData.get('amount') as string || '0'),
            kurikulum: formData.get('kurikulum') as string,
          });
        }}
        className="p-6 space-y-6 max-h-[70vh] overflow-y-auto"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              {getText('Course Name', 'Nama Mata Kuliah')} *
            </label>
            <input
              type="text"
              name="course_name"
              defaultValue={scheduleToDuplicate.course_name || ''}
              required
              className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-green-500 focus:ring-0 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              {getText('Course Code', 'Kode Mata Kuliah')} *
            </label>
            <input
              type="text"
              name="course_code"
              defaultValue={scheduleToDuplicate.course_code || ''}
              required
              className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-green-500 focus:ring-0 transition-colors"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              {getText('Lecturer', 'Dosen')} *
            </label>
            <input
              type="text"
              name="lecturer"
              defaultValue={scheduleToDuplicate.lecturer || ''}
              required
              className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-green-500 focus:ring-0 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              {getText('Room', 'Ruangan')} *
            </label>
            <select
              name="room"
              defaultValue={rooms.find(r => r.name === scheduleToDuplicate.room)?.id || ''}
              required
              className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-green-500 focus:ring-0 transition-colors"
            >
              <option value="">{getText('Select room', 'Pilih ruangan')}</option>
              {rooms.map(room => (
                <option key={room.id} value={room.id}>
                  {room.name} ({room.code}) - {room.capacity} {getText('seats', 'kursi')}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">
            {getText('Study Program', 'Program Studi')} *
          </label>
          <input
            type="text"
            name="subject_study"
            defaultValue={scheduleToDuplicate.subject_study || ''}
            required
            className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-green-500 focus:ring-0 transition-colors"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              {getText('Day', 'Hari')} *
            </label>
            <select
              name="day"
              defaultValue={scheduleToDuplicate.day || ''}
              required
              className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-green-500 focus:ring-0 transition-colors"
            >
              <option value="">{getText('Select Day', 'Pilih Hari')}</option>
              {dayNames.map(day => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              {getText('Start Time', 'Waktu Mulai')} *
            </label>
            <input
              type="time"
              name="start_time"
              defaultValue={scheduleToDuplicate.start_time || ''}
              required
              className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-green-500 focus:ring-0 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              {getText('End Time', 'Waktu Selesai')} *
            </label>
            <input
              type="time"
              name="end_time"
              defaultValue={scheduleToDuplicate.end_time || ''}
              required
              className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-green-500 focus:ring-0 transition-colors"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              {getText('Semester', 'Semester')} *
            </label>
            <select
              name="semester"
              defaultValue={scheduleToDuplicate.semester?.toString() || '1'}
              required
              className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-green-500 focus:ring-0 transition-colors"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                <option key={sem} value={sem}>Semester {sem}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              {getText('Academic Year', 'Tahun Akademik')} *
            </label>
            <input
              type="number"
              name="academics_year"
              defaultValue={scheduleToDuplicate.academics_year || new Date().getFullYear()}
              required
              className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-green-500 focus:ring-0 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              {getText('Class Type', 'Tipe Kelas')} *
            </label>
            <select
              name="type"
              defaultValue={scheduleToDuplicate.type || 'theory'}
              required
              className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-green-500 focus:ring-0 transition-colors"
            >
              <option value="theory">{getText('Theory', 'Teori')}</option>
              <option value="practical">{getText('Practical', 'Praktik')}</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              {getText('Class/Rombel', 'Kelas/Rombel')} *
            </label>
            <input
              type="text"
              name="class"
              defaultValue={scheduleToDuplicate.class || ''}
              required
              className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-green-500 focus:ring-0 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              {getText('Amount', 'Jumlah')}
            </label>
            <input
              type="number"
              name="amount"
              min="0"
              defaultValue={scheduleToDuplicate.amount || 0}
              className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-green-500 focus:ring-0 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              {getText('Curriculum', 'Kurikulum')}
            </label>
            <input
              type="text"
              name="kurikulum"
              defaultValue={scheduleToDuplicate.kurikulum || ''}
              className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-green-500 focus:ring-0 transition-colors"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => {
              setShowDuplicateModal(false);
              setScheduleToDuplicate(null);
            }}
            className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold transition-colors"
          >
            {getText('Cancel', 'Batal')}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold transition-all shadow-lg"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                {getText('Duplicating...', 'Menduplikat...')}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Copy className="h-4 w-4" />
                {getText('Create Duplicate', 'Buat Duplikat')}
              </div>
            )}
          </button>
        </div>
      </form>
    </div>
  </div>
)}
```
