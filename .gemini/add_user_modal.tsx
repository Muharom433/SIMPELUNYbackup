
{/* Add New User Modal in Matching */ }
{
    showAddUserInMatching && (
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
    )
}
