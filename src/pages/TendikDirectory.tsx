import React, { useState, useEffect, useMemo } from 'react';
import { Search, User, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Staff {
  id: string;
  full_name: string;
  identity_number: string;
  attachments: string | null;
  role: string;
  department?: { name: string }[] | { name: string } | null;
}

// Role display name helper
const getRoleDisplayName = (role: string): string => {
  const roleMap: { [key: string]: string } = {
    super_admin: 'Super Admin',
    department_admin: 'Admin Departemen',
    lecturer: 'Dosen',
    student: 'Mahasiswa',
    laboratory: 'Laboratorium',
    staffing: 'Kepegawaian',
    purchasing: 'Pengadaan',
    technician: 'Teknisi',
    frontdesk: 'Front Desk',
    staff: 'Tenaga Kependidikan',
  };
  return roleMap[role] || role;
};

// Skeleton Card Component
const SkeletonCard: React.FC = () => (
  <div className="animate-pulse">
    <div className="w-full aspect-[3/4] bg-gray-200 mb-2" />
    <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto mb-1" />
    <div className="h-3 bg-gray-200 rounded w-1/2 mx-auto" />
  </div>
);

// Staff Card Component
const StaffCard: React.FC<{ staff: Staff }> = ({ staff }) => {
  const [imageError, setImageError] = useState(false);

  const hasPhoto = staff.attachments && !imageError;

  return (
    <div className="group text-center bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col overflow-hidden h-full">
      {/* Profile Photo - 3:4 Aspect Ratio, No rounded corners */}
      <div className="relative w-full aspect-[3/4] overflow-hidden bg-gray-100">
        {hasPhoto ? (
          <img
            src={staff.attachments!}
            alt={staff.full_name}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
            <User className="w-16 h-16 text-blue-300/50" />
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1 justify-center">
        {/* Name - Matches example: Bold, Dark */}
        <h3 className="text-sm sm:text-base font-bold text-gray-900 mb-2 min-h-[3rem] flex items-center justify-center group-hover:text-blue-600 transition-colors duration-300 line-clamp-2 leading-tight">
          {staff.full_name}
        </h3>

        {/* Role & Department - Matches example: Uppercase, Gray, Centered, No Badge */}
        <div className="text-[10px] sm:text-xs text-slate-500 font-semibold uppercase tracking-wider leading-relaxed">
          <p className="mb-1 text-slate-600">{getRoleDisplayName(staff.role)}</p>
          {staff.department && (
            <p className="text-slate-400">
              {Array.isArray(staff.department)
                ? staff.department[0]?.name
                : staff.department.name}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const TendikDirectory: React.FC = () => {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch staff data
  useEffect(() => {
    const fetchStaff = async () => {
      try {
        setLoading(true);
        // Filter only: staff, laboratory, technician, staffing, purchasing, frontdesk
        const { data, error } = await supabase
          .from('users')
          .select('id, full_name, identity_number, attachments, role, department:departments(name)')
          .in('role', ['staff', 'laboratory', 'technician', 'staffing', 'purchasing', 'frontdesk'])
          .order('full_name');

        if (error) throw error;
        setStaffList(data || []);
      } catch (error) {
        console.error('Error fetching staff:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStaff();
  }, []);

  // Filter staff by search term (name or identity_number/NIP)
  const filteredStaff = useMemo(() => {
    if (!debouncedSearch.trim()) return staffList;
    const search = debouncedSearch.toLowerCase();
    return staffList.filter(staff =>
      staff.full_name.toLowerCase().includes(search) ||
      staff.identity_number?.toLowerCase().includes(search)
    );
  }, [staffList, debouncedSearch]);

  // Scroll direction handler
  const [showNavbar, setShowNavbar] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const controlNavbar = () => {
      if (typeof window !== 'undefined') {
        const currentScrollY = window.scrollY;

        // Show if scrolling up or at the top
        if (currentScrollY < lastScrollY || currentScrollY < 50) {
          setShowNavbar(true);
        } else if (currentScrollY > lastScrollY && currentScrollY > 50) {
          // Hide if scrolling down and not at the top
          setShowNavbar(false);
        }

        setLastScrollY(currentScrollY);
      }
    };

    window.addEventListener('scroll', controlNavbar);
    return () => window.removeEventListener('scroll', controlNavbar);
  }, [lastScrollY]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
      {/* Header Section */}
      <div className={`bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-10 transition-transform duration-300 ${showNavbar ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Title */}
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Daftar Tenaga Kependidikan
                </h1>
                <p className="text-sm text-gray-500 font-medium">
                  Fakultas Vokasi UNY
                </p>
              </div>
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Cari berdasarkan nama atau NIP..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 placeholder:text-gray-400"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Loading State */}
        {loading && (
          <div
            className="gap-6"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: '2rem 4rem'
            }}
          >
            {[...Array(15)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredStaff.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <Users className="w-10 h-10 text-gray-300" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {searchTerm ? 'Tidak ada hasil' : 'Belum ada data'}
            </h3>
            <p className="text-gray-500 text-center max-w-sm">
              {searchTerm
                ? `Tidak ditemukan tenaga kependidikan dengan nama "${searchTerm}"`
                : 'Data tenaga kependidikan belum tersedia'
              }
            </p>
          </div>
        )}

        {/* Staff Grid */}
        {/* Staff Grid */}
        {!loading && filteredStaff.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: '2rem 4rem'
            }}
          >
            {filteredStaff.map((staff) => (
              <StaffCard key={staff.id} staff={staff} />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="py-8 text-center text-sm text-gray-400">
        SIMPEL Kuliah © {new Date().getFullYear()}
      </div>
    </div>
  );
};

export default TendikDirectory;
