// ENHANCED LECTURER MATCHING SECTION
// Replace the entire "Lecturer Tab Content" section (around line 2521-2600)
// dengan kode di bawah ini:

{/* Lecturer Tab Content */ }
{
    matchingTab === 'lecturers' && (
        <div className="space-y-4">
            {unmatchedLecturers.length === 0 ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-6 flex flex-col items-center justify-center gap-3">
                    <CheckCircle className="h-12 w-12 text-green-500" />
                    <span className="text-green-700 font-medium text-lg">{getText('All lecturer names are synced!', 'Semua nama dosen sudah tersinkron!')}</span>
                </div>
            ) : (
                <>
                    {/* Info Box */}
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                        <strong>{getText('Note:', 'Catatan:')}</strong> {getText(
                            'Clicking "Set" will update the selected user\'s name to match the schedule name (Excel data is master).',
                            'Klik "Set" akan mengupdate nama user yang dipilih agar sesuai dengan nama di jadwal (data Excel adalah master).'
                        )}
                    </div>

                    {/* Button to add new user */}
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => {
                                setShowAddUserInMatching(true);
                                setNewUserScheduleName('');
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md"
                        >
                            <UserPlus className="h-4 w-4" />
                            {getText('Add New User', 'Tambah User Baru')}
                        </button>
                    </div>

                    {/* Action Bar - Set All Button */}
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <div className="flex items-center justify-between gap-4">
                            <div className="text-sm text-purple-800">
                                <strong>{getText('Instructions:', 'Petunjuk:')}</strong>{' '}
                                {getText(
                                    'Select target user for each item below, then click "Set All" to apply all at once.',
                                    'Pilih user target untuk setiap item di bawah, lalu klik "Set Semua" untuk menerapkan sekaligus.'
                                )}
                            </div>
                            <button
                                onClick={handleBatchUpdateAllLecturers}
                                disabled={lecturerMappingsCount === 0 || matchingLoading}
                                className="px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold flex items-center gap-2 shadow-md whitespace-nowrap"
                            >
                                <Check className="h-4 w-4" />
                                {getText(`Set All (${lecturerMappingsCount})`, `Set Semua (${lecturerMappingsCount})`)}
                            </button>
                        </div>
                    </div>

                    {/* Lecturer List - Dropdowns with schedule preview */}
                    <div className="space-y-3 max-h-96 overflow-y-auto border border-gray-200 rounded-lg p-3">
                        {unmatchedLecturers.map((lecturer, index) => (
                            <div key={`lecturer-${index}`} className="space-y-2">
                                <div
                                    className={`flex items-center gap-4 p-3 rounded-lg transition-colors ${lecturerMappings[lecturer]
                                        ? 'bg-purple-50 border border-purple-300'
                                        : 'bg-gray-50 border border-gray-200'
                                        }`}
                                >
                                    {/* Source lecturer name */}
                                    <div className="w-1/3 min-w-[180px]">
                                        <span className="text-sm font-medium text-purple-700">{lecturer}</span>
                                        <span className="text-xs text-gray-500 block">{getText('(Schedule name)', '(Nama di jadwal)')}</span>
                                    </div>

                                    <span className="text-gray-400">←</span>

                                    {/* Target dropdown */}
                                    <div className="flex-1">
                                        <SearchableDropdownById
                                            options={lecturers.map(l => ({ id: l.id, name: l.full_name, code: l.identity_number }))}
                                            value={lecturerMappings[lecturer] || ''}
                                            onChange={(id) => {
                                                setLecturerMappings(prev => ({ ...prev, [lecturer]: id }));
                                                // Auto-fetch schedules when mapping is selected
                                                if (id) {
                                                    setSelectedLecturerForSchedule(lecturer);
                                                    fetchLecturerSchedules(lecturer);
                                                }
                                            }}
                                            placeholder={getText('Select target user...', 'Pilih user target...')}
                                            searchPlaceholder={getText('Search by name or ID...', 'Cari nama atau NIP...')}
                                            emptyMessage={getText('No user found', 'User tidak ditemukan')}
                                        />
                                    </div>

                                    {/* Mapped indicator and toggle button */}
                                    {lecturerMappings[lecturer] && (
                                        <>
                                            <CheckCircle className="h-5 w-5 text-purple-600 flex-shrink-0" />
                                            <button
                                                onClick={() => {
                                                    if (selected LecturerForSchedule === lecturer) {
                                                setSelectedLecturerForSchedule('');
                                            setLecturerSchedules([]);
                        } else {
                                                setSelectedLecturerForSchedule(lecturer);
                                            fetchLecturerSchedules(lecturer);
                        }
                      }}
                                            className="p-2 text-purple-600 hover:bg-purple-100 rounded transition-colors"
                                            title={getText('Show/Hide Schedules', 'Tampilkan/Sembunyikan Jadwal')}
                    >
                                            {selectedLecturerForSchedule === lecturer ? (
                                                <ChevronDown className="h-5 w-5" />
                                            ) : (
                                                <ChevronRight className="h-5 w-5" />
                                            )}
                                        </button>
                                </>
                )}
                            </div>

              {/* Lecturer Schedules Panel */ }
              { selectedLecturerForSchedule === lecturer && lecturerMappings[lecturer] && (
                                <div className="ml-8 bg-white border border-purple-200 rounded-lg p-4">
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
                                                <div key={idx} className="flex items-center  justify-between p-3 bg-purple-50 rounded-lg text-sm border border-purple-100">
                                                    <div className="flex-1">
                                                        <div className="font-medium text-gray-900">{sched.course_name}</div>
                                                        <div className="text-xs text-gray-600 mt-0.5">
                                                            <span className="font-medium">{sched.day}</span> • {sched.start_time?.substring(0, 5)} - {sched.end_time?.substring(0, 5)} • <span className="text-purple-700">{sched.room}</span>
                                                        </div>
                                                    </div>
                                                    <span className="text-xs px-2 py-1 bg-purple-200 text-purple-800 rounded font-medium ml-2">
                                                        {sched.class}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                    </div>
          ))}
                </div>
        </>
    )
}
  </div >
)}
