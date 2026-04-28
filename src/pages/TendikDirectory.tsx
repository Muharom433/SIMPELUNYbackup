import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, User, Users, ChevronDown, X, Building2, SlidersHorizontal, Briefcase } from 'lucide-react';
import { supabase } from '../lib/supabase';

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface DeptInfo {
  id: string;
  name: string;
  code?: string;
}

interface Staff {
  id: string;
  full_name: string;
  identity_number: string;
  attachments?: string | null;
  role: string;
  department_id: string | null;
  department?: DeptInfo[] | DeptInfo | null;
}

interface DropdownOption {
  id: string;
  label: string;
  sublabel?: string;
  count?: number;
}

// ─── Role display name helper ─────────────────────────────────────────────────
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
    finance: 'Keuangan',
  };
  return roleMap[role] || role;
};

// ─── Skeleton Card ────────────────────────────────────────────────────────────
const SkeletonCard: React.FC = () => (
  <div className="animate-pulse">
    <div className="w-full aspect-[3/4] bg-gray-200 rounded-t-xl" />
    <div className="p-3 space-y-2">
      <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto" />
      <div className="h-3 bg-gray-200 rounded w-1/2 mx-auto" />
      <div className="h-3 bg-gray-200 rounded w-2/3 mx-auto" />
    </div>
  </div>
);

// ─── Staff Card ───────────────────────────────────────────────────────────────
const StaffCard: React.FC<{ staff: Staff }> = ({ staff }) => {
  const [imageError, setImageError] = useState(false);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let observer: IntersectionObserver | null = null;
    if (cardRef.current) {
      observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !hasFetched) {
          setHasFetched(true);
          supabase
            .from('users')
            .select('attachments')
            .eq('id', staff.id)
            .single()
            .then(({ data }) => {
              if (data?.attachments) {
                setPhotoData(data.attachments);
              }
            });
        }
      }, { rootMargin: '100px' });
      observer.observe(cardRef.current);
    }
    return () => {
      if (observer) observer.disconnect();
    };
  }, [staff.id, hasFetched]);

  const hasPhoto = photoData && !imageError;

  const deptName = staff.department
    ? Array.isArray(staff.department)
      ? staff.department[0]?.name
      : staff.department.name
    : null;

  return (
    <div ref={cardRef} className="group text-center bg-white rounded-xl border border-gray-200 shadow-md hover:shadow-2xl transition-all duration-300 flex flex-col overflow-hidden h-full hover:-translate-y-1">
      {/* Photo area */}
      <div className="relative w-full aspect-[3/4] overflow-hidden bg-gray-100">
        {!hasFetched ? (
          <div className="w-full h-full bg-gray-200 animate-pulse" />
        ) : hasPhoto ? (
          <img
            src={photoData!}
            alt={staff.full_name}
            onError={() => setImageError(true)}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
            <User className="w-16 h-16 text-blue-300/60" />
          </div>
        )}
        {/* Role overlay at bottom of photo */}
        {deptName && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/65 to-transparent px-2 py-2">
            <p className="text-[9px] sm:text-[10px] text-white/90 font-semibold uppercase tracking-wide line-clamp-2 leading-tight">
              {deptName}
            </p>
          </div>
        )}
      </div>

      <div className="p-3 sm:p-4 flex flex-col flex-1 justify-center gap-0.5">
        {/* Name */}
        <h3 className="text-sm sm:text-base font-bold text-gray-900 mb-1 min-h-[2.5rem] flex items-center justify-center group-hover:text-blue-600 transition-colors duration-300 line-clamp-2 leading-tight">
          {staff.full_name}
        </h3>

        {/* NIP / Identity number */}
        {staff.identity_number && (
          <p className="text-[10px] sm:text-xs text-slate-500 font-mono tracking-wide">
            NIP. {staff.identity_number}
          </p>
        )}

        {/* Role */}
        <p className="text-[10px] sm:text-xs text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
          {getRoleDisplayName(staff.role)}
        </p>
      </div>
    </div>
  );
};

// ─── Searchable Dropdown ──────────────────────────────────────────────────────
interface SearchableDropdownProps {
  options: DropdownOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  placeholder: string;
  allLabel: string;
  allCount: number;
  icon: React.ReactNode;
  accentClass?: string;
  searchPlaceholder?: string;
  hint?: string;
}

const SearchableDropdown: React.FC<SearchableDropdownProps> = ({
  options,
  selectedId,
  onSelect,
  placeholder,
  allLabel,
  allCount,
  icon,
  accentClass = 'blue',
  searchPlaceholder = 'Cari...',
  hint,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(o =>
      o.label.toLowerCase().includes(q) ||
      (o.sublabel && o.sublabel.toLowerCase().includes(q))
    );
  }, [options, search]);

  const selected = options.find(o => o.id === selectedId);
  const isActive = selectedId !== 'all';

  const handleSelect = (id: string) => {
    onSelect(id);
    setOpen(false);
    setSearch('');
  };

  const colors = {
    blue: {
      border: 'border-blue-500',
      ring: 'ring-blue-100',
      activeText: 'text-blue-700 bg-blue-50',
      activeBadge: 'bg-blue-100 text-blue-700',
    },
    indigo: {
      border: 'border-indigo-500',
      ring: 'ring-indigo-100',
      activeText: 'text-indigo-700 bg-indigo-50',
      activeBadge: 'bg-indigo-100 text-indigo-700',
    },
  };
  const c = colors[accentClass as keyof typeof colors] || colors.blue;

  return (
    <div className="relative w-full" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-all duration-200 bg-white shadow-sm
          ${open
            ? `${c.border} border ring-2 ${c.ring} text-gray-900`
            : isActive
              ? 'border-gray-300 text-gray-900 bg-gray-50'
              : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:shadow'
          }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex-shrink-0">{icon}</span>
          <span className="truncate text-left">
            {selectedId === 'all'
              ? `${allLabel} (${allCount})`
              : selected
                ? `${selected.label}${selected.count !== undefined ? ` (${selected.count})` : ''}`
                : placeholder}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {isActive && (
            <span
              role="button"
              onClick={e => { e.stopPropagation(); handleSelect('all'); }}
              className="p-0.5 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {hint && !isActive && (
        <p className="mt-1 text-[10px] text-gray-400 px-1">{hint}</p>
      )}

      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden min-w-[220px]">
          <div className="p-2.5 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                placeholder={searchPlaceholder}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300"
              />
              {search && (
                <button type="button" onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {!search && (
              <button
                type="button"
                onClick={() => handleSelect('all')}
                className={`w-full flex items-center justify-between px-4 py-3 text-sm transition-colors border-b border-gray-50
                  ${selectedId === 'all' ? `${c.activeText} font-semibold` : 'text-gray-700 hover:bg-gray-50'}`}
              >
                <span>{allLabel}</span>
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${selectedId === 'all' ? c.activeBadge : 'bg-gray-100 text-gray-500'}`}>
                  {allCount}
                </span>
              </button>
            )}
            {filtered.length === 0 ? (
              <div className="px-4 py-5 text-sm text-gray-400 text-center">Tidak ditemukan</div>
            ) : (
              filtered.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelect(opt.id)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors
                    ${selectedId === opt.id ? `${c.activeText} font-semibold` : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  <div className="text-left min-w-0">
                    <p className="font-medium truncate">{opt.label}</p>
                    {opt.sublabel && <p className="text-[11px] text-gray-400">{opt.sublabel}</p>}
                  </div>
                  {opt.count !== undefined && (
                    <span className={`flex-shrink-0 ml-2 text-xs font-bold px-1.5 py-0.5 rounded-full ${selectedId === opt.id ? c.activeBadge : 'bg-gray-100 text-gray-500'}`}>
                      {opt.count}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Filter Badge ─────────────────────────────────────────────────────────────
const FilterBadge: React.FC<{ label: string; onRemove: () => void }> = ({ label, onRemove }) => (
  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold border border-blue-200">
    {label}
    <button onClick={onRemove} className="ml-0.5 text-blue-500 hover:text-red-500 transition-colors">
      <X className="w-3 h-3" />
    </button>
  </span>
);

// ─── Main Page ────────────────────────────────────────────────────────────────
const TendikDirectory: React.FC = () => {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Fetch staff
  useEffect(() => {
    const fetchStaff = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('users')
          .select('id, full_name, identity_number, role, department_id, department:departments(id, name, code)')
          .in('role', ['staff', 'laboratory', 'technician', 'staffing', 'purchasing', 'frontdesk', 'finance'])
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

  // Derived departments list
  const departments = useMemo<DropdownOption[]>(() => {
    const map = new Map<string, { name: string; code?: string; count: number }>();
    staffList.forEach(s => {
      const dept = s.department
        ? Array.isArray(s.department) ? s.department[0] : s.department
        : null;
      if (dept && dept.id) {
        const existing = map.get(dept.id);
        if (existing) existing.count++;
        else map.set(dept.id, { name: dept.name, code: (dept as DeptInfo).code, count: 1 });
      }
    });
    return Array.from(map.entries())
      .map(([id, v]) => ({ id, label: v.name, sublabel: v.code, count: v.count }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [staffList]);

  // Derived roles list
  const TENDIK_ROLES = ['staff', 'laboratory', 'technician', 'staffing', 'purchasing', 'frontdesk', 'finance'];
  const roleOptions = useMemo<DropdownOption[]>(() => {
    const counts: Record<string, number> = {};
    const baselist = selectedDept === 'all' ? staffList : staffList.filter(s => {
      const dept = s.department
        ? Array.isArray(s.department) ? s.department[0] : s.department
        : null;
      return (dept as DeptInfo)?.id === selectedDept;
    });
    baselist.forEach(s => { counts[s.role] = (counts[s.role] || 0) + 1; });
    return TENDIK_ROLES
      .filter(r => counts[r] > 0)
      .map(r => ({ id: r, label: getRoleDisplayName(r), count: counts[r] }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [staffList, selectedDept]);

  // Counts
  const deptCounts = useMemo(() => {
    const c: Record<string, number> = { all: staffList.length };
    staffList.forEach(s => {
      const dept = s.department
        ? Array.isArray(s.department) ? s.department[0] : s.department
        : null;
      if ((dept as DeptInfo)?.id) c[(dept as DeptInfo).id] = (c[(dept as DeptInfo).id] || 0) + 1;
    });
    return c;
  }, [staffList]);

  const roleCounts = useMemo(() => {
    const base = selectedDept === 'all' ? staffList : staffList.filter(s => {
      const dept = s.department
        ? Array.isArray(s.department) ? s.department[0] : s.department
        : null;
      return (dept as DeptInfo)?.id === selectedDept;
    });
    const c: Record<string, number> = { all: base.length };
    base.forEach(s => { c[s.role] = (c[s.role] || 0) + 1; });
    return c;
  }, [staffList, selectedDept]);

  // When dept changes, reset role if no longer present
  useEffect(() => {
    if (selectedRole === 'all') return;
    const still = roleOptions.find(r => r.id === selectedRole);
    if (!still) setSelectedRole('all');
  }, [selectedDept]);

  // Final filtered list
  const filteredStaff = useMemo(() => {
    let result = staffList;

    if (selectedDept !== 'all') {
      result = result.filter(s => {
        const dept = s.department
          ? Array.isArray(s.department) ? s.department[0] : s.department
          : null;
        return (dept as DeptInfo)?.id === selectedDept;
      });
    }

    if (selectedRole !== 'all') {
      result = result.filter(s => s.role === selectedRole);
    }

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(s =>
        s.full_name.toLowerCase().includes(q) ||
        s.identity_number?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [staffList, selectedDept, selectedRole, debouncedSearch]);

  const hasActiveFilter = selectedDept !== 'all' || selectedRole !== 'all' || searchTerm !== '';
  const resetAll = () => { setSelectedDept('all'); setSelectedRole('all'); setSearchTerm(''); };

  const selectedDeptName = selectedDept !== 'all'
    ? (departments.find(d => d.id === selectedDept)?.label || selectedDept)
    : null;
  const selectedRoleName = selectedRole !== 'all' ? getRoleDisplayName(selectedRole) : null;

  // Sticky navbar
  const [showNavbar, setShowNavbar] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  useEffect(() => {
    const handler = () => {
      const y = window.scrollY;
      if (y < lastScrollY || y < 50) setShowNavbar(true);
      else if (y > lastScrollY && y > 50) setShowNavbar(false);
      setLastScrollY(y);
    };
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, [lastScrollY]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">

      {/* ── Sticky Header ───────────────────────────────────────────────────── */}
      <div className={`bg-white/90 backdrop-blur-md border-b border-gray-100 sticky top-0 z-20 transition-transform duration-300 shadow-sm ${showNavbar ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col gap-3">

            {/* Title + Search row */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-md">
                  <Briefcase className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Daftar Tenaga Kependidikan</h1>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Search */}
                <div className="relative flex-1 sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Cari nama atau NIP..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 placeholder:text-gray-400 text-sm shadow-sm"
                  />
                  {searchTerm && (
                    <button type="button" onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>


            {/* Count bar (always visible, below header) */}
            {!showFilterPanel && (
              <div className="flex items-center gap-2 flex-wrap">
                {(selectedDeptName || selectedRoleName || searchTerm) && (
                  <>
                    <span className="text-xs text-gray-400">Filter aktif:</span>
                    {selectedDeptName && (
                      <FilterBadge label={`Dept: ${selectedDeptName}`} onRemove={() => { setSelectedDept('all'); setSelectedRole('all'); }} />
                    )}
                    {selectedRoleName && (
                      <FilterBadge label={selectedRoleName} onRemove={() => setSelectedRole('all')} />
                    )}
                    {searchTerm && (
                      <FilterBadge label={`"${searchTerm}"`} onRemove={() => setSearchTerm('')} />
                    )}
                  </>
                )}
                {!loading && (
                  <span className="ml-auto text-xs text-gray-400">
                    <span className="font-semibold text-gray-700">{filteredStaff.length}</span> tendik
                  </span>
                )}
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Loading */}
        {loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1.5rem 2.5rem' }}>
            {[...Array(15)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* Empty */}
        {!loading && filteredStaff.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mb-4">
              <Users className="w-10 h-10 text-blue-300" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {hasActiveFilter ? 'Tidak ada hasil' : 'Belum ada data'}
            </h3>
            <p className="text-gray-500 text-center max-w-sm text-sm">
              {searchTerm
                ? `Tidak ditemukan tenaga kependidikan dengan kata kunci "${searchTerm}"`
                : selectedRole !== 'all'
                  ? 'Tidak ada tendik dengan jabatan ini'
                  : selectedDept !== 'all'
                    ? 'Tidak ada tendik pada departemen ini'
                    : 'Data tenaga kependidikan belum tersedia'}
            </p>
            {hasActiveFilter && (
              <button onClick={resetAll}
                className="mt-4 px-4 py-2 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors">
                Reset semua filter
              </button>
            )}
          </div>
        )}

        {/* Grid */}
        {!loading && filteredStaff.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1.5rem 2.5rem' }}>
            {filteredStaff.map(s => <StaffCard key={s.id} staff={s} />)}
          </div>
        )}
      </div>

      <div className="py-8 text-center text-sm text-gray-400">
        SIMPEL Kuliah © {new Date().getFullYear()}
      </div>
    </div>
  );
};

export default TendikDirectory;
