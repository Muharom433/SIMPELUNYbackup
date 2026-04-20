import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, User, Users, GraduationCap, ChevronDown, X, Building2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface Department {
  id: string;
  name: string;
  code: string;
}

interface StudyProgram {
  id: string;
  name: string;
  code: string;
  department_id: string;
}

interface Lecturer {
  id: string;
  full_name: string;
  identity_number: string;
  attachments: string | null;
  role: string;
  is_homebase: boolean | null;
  study_program_id: string | null;
  department_id: string | null;
  study_program?: { id: string; name: string; code: string; department_id: string }[] | { id: string; name: string; code: string; department_id: string } | null;
}

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

// ─── Lecturer Card ────────────────────────────────────────────────────────────
const LecturerCard: React.FC<{ lecturer: Lecturer }> = ({ lecturer }) => {
  const [imageError, setImageError] = useState(false);
  const hasPhoto = lecturer.attachments && !imageError;

  const studyProgramName = lecturer.study_program
    ? Array.isArray(lecturer.study_program)
      ? lecturer.study_program[0]?.name
      : lecturer.study_program.name
    : null;

  return (
    <div className="group text-center bg-white rounded-xl border border-gray-200 shadow-md hover:shadow-2xl transition-all duration-300 flex flex-col overflow-hidden h-full hover:-translate-y-1">
      <div className="relative w-full aspect-[3/4] overflow-hidden bg-gray-100">
        {hasPhoto ? (
          <img
            src={lecturer.attachments!}
            alt={lecturer.full_name}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center">
            <User className="w-16 h-16 text-emerald-300/60" />
          </div>
        )}
        {studyProgramName && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/65 to-transparent px-2 py-2">
            <p className="text-[9px] sm:text-[10px] text-white/90 font-semibold uppercase tracking-wide line-clamp-2 leading-tight">
              {studyProgramName}
            </p>
          </div>
        )}
      </div>
      <div className="p-3 sm:p-4 flex flex-col flex-1 justify-center gap-0.5">
        <h3 className="text-sm sm:text-base font-bold text-gray-900 mb-1 min-h-[2.5rem] flex items-center justify-center group-hover:text-emerald-600 transition-colors duration-300 line-clamp-2 leading-tight">
          {lecturer.full_name}
        </h3>
        {lecturer.identity_number && (
          <p className="text-[10px] sm:text-xs text-slate-500 font-mono tracking-wide">
            NIP. {lecturer.identity_number}
          </p>
        )}
        <p className="text-[10px] sm:text-xs text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
          Dosen Tetap
        </p>
      </div>
    </div>
  );
};

// ─── Generic Searchable Dropdown ──────────────────────────────────────────────
interface DropdownOption {
  id: string;
  label: string;
  sublabel?: string;
  count?: number;
}

interface SearchableDropdownProps {
  options: DropdownOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  placeholder: string;
  allLabel: string;
  allCount: number;
  icon: React.ReactNode;
  accentClass?: string;       // e.g. 'emerald' | 'blue'
  searchPlaceholder?: string;
  disabled?: boolean;
}

const SearchableDropdown: React.FC<SearchableDropdownProps> = ({
  options,
  selectedId,
  onSelect,
  placeholder,
  allLabel,
  allCount,
  icon,
  accentClass = 'emerald',
  searchPlaceholder = 'Cari...',
  disabled = false,
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

  const handleSelect = (id: string) => {
    onSelect(id);
    setOpen(false);
    setSearch('');
  };

  const ring = accentClass === 'blue'
    ? 'focus-within:border-blue-500 ring-blue-100'
    : 'focus-within:border-emerald-500 ring-emerald-100';

  const activeText = accentClass === 'blue' ? 'text-blue-700 bg-blue-50' : 'text-emerald-700 bg-emerald-50';
  const activeBadge = accentClass === 'blue' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700';

  return (
    <div className={`relative w-full ${disabled ? 'opacity-50 pointer-events-none' : ''}`} ref={ref}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-all duration-200 bg-white shadow-sm
          ${open
            ? `border-${accentClass}-500 ring-2 ${ring} text-gray-900`
            : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:shadow'
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
          {selectedId !== 'all' && (
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
          <div className="max-h-60 overflow-y-auto">
            {/* "Semua" option */}
            {!search && (
              <button
                type="button"
                onClick={() => handleSelect('all')}
                className={`w-full flex items-center justify-between px-4 py-3 text-sm transition-colors border-b border-gray-50
                  ${selectedId === 'all' ? `${activeText} font-semibold` : 'text-gray-700 hover:bg-gray-50'}`}
              >
                <span>{allLabel}</span>
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${selectedId === 'all' ? activeBadge : 'bg-gray-100 text-gray-500'}`}>
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
                    ${selectedId === opt.id ? `${activeText} font-semibold` : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  <div className="text-left min-w-0">
                    <p className="font-medium truncate">{opt.label}</p>
                    {opt.sublabel && <p className="text-[11px] text-gray-400">{opt.sublabel}</p>}
                  </div>
                  {opt.count !== undefined && (
                    <span className={`flex-shrink-0 ml-2 text-xs font-bold px-1.5 py-0.5 rounded-full ${selectedId === opt.id ? activeBadge : 'bg-gray-100 text-gray-500'}`}>
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

// ─── Main Page ────────────────────────────────────────────────────────────────
const DosenDirectory: React.FC = () => {
  const [lecturerList, setLecturerList] = useState<Lecturer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [selectedProdi, setSelectedProdi] = useState<string>('all');

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Fetch home-base lecturers with study_program (which includes department_id)
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('users')
          .select(`
            id, full_name, identity_number, attachments, role,
            is_homebase, study_program_id, department_id,
            study_program:study_programs(id, name, code, department_id)
          `)
          .eq('role', 'lecturer')
          .eq('is_homebase', true)
          .order('full_name');

        if (error) throw error;
        setLecturerList(data || []);
      } catch (err) {
        console.error('Error fetching lecturers:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // ── Derive departments that actually have home-base lecturers ──────────────
  const departments = useMemo<Department[]>(() => {
    const map = new Map<string, Department>();
    lecturerList.forEach(l => {
      const sp = l.study_program
        ? Array.isArray(l.study_program) ? l.study_program[0] : l.study_program
        : null;
      if (!sp) return;
      const deptId = sp.department_id || l.department_id;
      if (deptId && !map.has(deptId)) {
        // We don't have dept name from query - use id as key, fill later
        map.set(deptId, { id: deptId, name: deptId, code: '' });
      }
    });
    return Array.from(map.values());
  }, [lecturerList]);

  // Fetch dept names from supabase for the departments we found
  const [deptNames, setDeptNames] = useState<Record<string, { name: string; code: string }>>({});
  useEffect(() => {
    if (departments.length === 0) return;
    const ids = departments.map(d => d.id);
    supabase
      .from('departments')
      .select('id, name, code')
      .in('id', ids)
      .then(({ data }) => {
        if (data) {
          const m: Record<string, { name: string; code: string }> = {};
          data.forEach(d => { m[d.id] = { name: d.name, code: d.code }; });
          setDeptNames(m);
        }
      });
  }, [departments]);

  // ── Derive study programs (filtered by selected dept if any) ───────────────
  const allStudyPrograms = useMemo<StudyProgram[]>(() => {
    const map = new Map<string, StudyProgram>();
    lecturerList.forEach(l => {
      if (!l.study_program_id || !l.study_program) return;
      const sp = Array.isArray(l.study_program) ? l.study_program[0] : l.study_program;
      if (sp && !map.has(sp.id)) map.set(sp.id, sp as StudyProgram);
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [lecturerList]);

  const filteredStudyPrograms = useMemo<StudyProgram[]>(() => {
    if (selectedDept === 'all') return allStudyPrograms;
    return allStudyPrograms.filter(sp => sp.department_id === selectedDept);
  }, [allStudyPrograms, selectedDept]);

  // When dept changes → reset prodi if it's no longer in the new dept
  useEffect(() => {
    if (selectedProdi === 'all') return;
    const still = filteredStudyPrograms.find(sp => sp.id === selectedProdi);
    if (!still) setSelectedProdi('all');
  }, [selectedDept]);

  // ── Counts ─────────────────────────────────────────────────────────────────
  // Count per dept
  const deptCounts = useMemo(() => {
    const c: Record<string, number> = { all: 0 };
    lecturerList.forEach(l => {
      const sp = l.study_program
        ? Array.isArray(l.study_program) ? l.study_program[0] : l.study_program
        : null;
      const deptId = sp?.department_id || l.department_id;
      c.all++;
      if (deptId) c[deptId] = (c[deptId] || 0) + 1;
    });
    return c;
  }, [lecturerList]);

  // Count per prodi (respecting dept filter)
  const prodiCounts = useMemo(() => {
    const base = selectedDept === 'all' ? lecturerList : lecturerList.filter(l => {
      const sp = l.study_program
        ? Array.isArray(l.study_program) ? l.study_program[0] : l.study_program
        : null;
      return (sp?.department_id || l.department_id) === selectedDept;
    });
    const c: Record<string, number> = { all: base.length };
    base.forEach(l => {
      if (l.study_program_id) c[l.study_program_id] = (c[l.study_program_id] || 0) + 1;
    });
    return c;
  }, [lecturerList, selectedDept]);

  // ── Final filtered list ────────────────────────────────────────────────────
  const filteredLecturers = useMemo(() => {
    let result = lecturerList;

    if (selectedDept !== 'all') {
      result = result.filter(l => {
        const sp = l.study_program
          ? Array.isArray(l.study_program) ? l.study_program[0] : l.study_program
          : null;
        return (sp?.department_id || l.department_id) === selectedDept;
      });
    }

    if (selectedProdi !== 'all') {
      result = result.filter(l => l.study_program_id === selectedProdi);
    }

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(l =>
        l.full_name.toLowerCase().includes(q) ||
        l.identity_number?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [lecturerList, selectedDept, selectedProdi, debouncedSearch]);

  const hasActiveFilter = selectedDept !== 'all' || selectedProdi !== 'all' || searchTerm !== '';
  const resetAll = () => { setSelectedDept('all'); setSelectedProdi('all'); setSearchTerm(''); };

  // ── Sticky header ──────────────────────────────────────────────────────────
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

  // Build dropdown option arrays
  const deptOptions: DropdownOption[] = useMemo(() =>
    departments
      .map(d => ({
        id: d.id,
        label: deptNames[d.id]?.name || d.id,
        sublabel: deptNames[d.id]?.code || '',
        count: deptCounts[d.id] ?? 0,
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    [departments, deptNames, deptCounts]
  );

  const prodiOptions: DropdownOption[] = useMemo(() =>
    filteredStudyPrograms.map(sp => ({
      id: sp.id,
      label: sp.name,
      sublabel: sp.code,
      count: prodiCounts[sp.id] ?? 0,
    })),
    [filteredStudyPrograms, prodiCounts]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-teal-50/50">

      {/* ── Sticky Header ─────────────────────────────────────────────────── */}
      <div className={`bg-white/85 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-20 transition-transform duration-300 ${showNavbar ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col gap-4">

            {/* Title + Search */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-md">
                  <GraduationCap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Daftar Dosen</h1>
                  <p className="text-xs text-gray-500 font-medium">Dosen Tetap · Fakultas Vokasi UNY</p>
                </div>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cari nama atau NIP..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 placeholder:text-gray-400 text-sm shadow-sm"
                />
                {searchTerm && (
                  <button type="button" onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Filter row: Dept + Prodi + count + reset */}
            <div className="flex flex-wrap items-center gap-2">

              {/* Label */}
              <span className="text-xs text-gray-500 font-semibold whitespace-nowrap">Filter:</span>

              {/* Department dropdown */}
              <div className="w-full sm:w-64">
                <SearchableDropdown
                  options={deptOptions}
                  selectedId={selectedDept}
                  onSelect={(id) => { setSelectedDept(id); setSelectedProdi('all'); }}
                  placeholder="Pilih Departemen"
                  allLabel="Semua Departemen"
                  allCount={deptCounts['all'] ?? 0}
                  icon={<Building2 className="w-4 h-4 text-blue-500" />}
                  accentClass="blue"
                  searchPlaceholder="Cari departemen..."
                />
              </div>

              {/* Divider arrow */}
              <span className="text-gray-300 text-lg hidden sm:block">›</span>

              {/* Prodi dropdown (disabled if no dept selected and multiple depts) */}
              <div className="w-full sm:w-72">
                <SearchableDropdown
                  options={prodiOptions}
                  selectedId={selectedProdi}
                  onSelect={setSelectedProdi}
                  placeholder="Pilih Program Studi"
                  allLabel="Semua Program Studi"
                  allCount={prodiCounts['all'] ?? 0}
                  icon={<GraduationCap className="w-4 h-4 text-emerald-500" />}
                  accentClass="emerald"
                  searchPlaceholder="Cari program studi..."
                />
              </div>

              {/* Count + Reset */}
              <div className="flex items-center gap-2 ml-auto">
                {!loading && (
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    <span className="font-semibold text-gray-600">{filteredLecturers.length}</span> dosen
                  </span>
                )}
                {hasActiveFilter && (
                  <button
                    onClick={resetAll}
                    className="flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-700 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors border border-red-200 whitespace-nowrap"
                  >
                    <X className="w-3 h-3" />
                    Reset
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Loading */}
        {loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1.5rem 2.5rem' }}>
            {[...Array(12)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* Empty */}
        {!loading && filteredLecturers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
              <Users className="w-10 h-10 text-emerald-300" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {hasActiveFilter ? 'Tidak ada hasil' : 'Belum ada data'}
            </h3>
            <p className="text-gray-500 text-center max-w-sm text-sm">
              {searchTerm
                ? `Tidak ditemukan dosen dengan kata kunci "${searchTerm}"`
                : selectedProdi !== 'all'
                  ? 'Tidak ada dosen pada program studi ini'
                  : selectedDept !== 'all'
                    ? 'Tidak ada dosen pada departemen ini'
                    : 'Data dosen belum tersedia'}
            </p>
            {hasActiveFilter && (
              <button onClick={resetAll}
                className="mt-4 px-4 py-2 text-sm font-medium text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-50 transition-colors">
                Reset semua filter
              </button>
            )}
          </div>
        )}

        {/* Grid */}
        {!loading && filteredLecturers.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1.5rem 2.5rem' }}>
            {filteredLecturers.map(l => <LecturerCard key={l.id} lecturer={l} />)}
          </div>
        )}
      </div>

      <div className="py-8 text-center text-sm text-gray-400">
        SIMPEL Kuliah © {new Date().getFullYear()}
      </div>
    </div>
  );
};

// re-export type needed inside file
interface DropdownOption {
  id: string;
  label: string;
  sublabel?: string;
  count?: number;
}

export default DosenDirectory;
