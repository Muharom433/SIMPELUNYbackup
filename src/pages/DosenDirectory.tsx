import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, User, Users, GraduationCap, ChevronDown, X, Building2, SlidersHorizontal, MapPin, Image as ImageIcon } from 'lucide-react';
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
  attachments?: string | null;
  role: string;
  is_homebase: boolean | null;
  study_program_id: string | null;
  department_id: string | null;
  study_program?: { id: string; name: string; code: string; department_id: string; status: string }[] | { id: string; name: string; code: string; department_id: string; status: string } | null;
  room_users?: {
    room: {
      id: string;
      name: string;
      floor: string | null;
      building: {
        name: string;
        campus: { name: string } | null;
      } | null;
    } | null;
  }[] | null;
}

interface RoomDetails {
  id: string;
  name: string;
  floor: string | null;
  building: string | null;
  campus: string | null;
  attachments: string | null;
  lecturerName: string;
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
const LecturerCard: React.FC<{ lecturer: Lecturer; onShowRoom: (room: RoomDetails) => void }> = ({ lecturer, onShowRoom }) => {
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
            .eq('id', lecturer.id)
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
  }, [lecturer.id, hasFetched]);

  const hasPhoto = photoData && !imageError;

  const studyProgramName = lecturer.study_program
    ? Array.isArray(lecturer.study_program)
      ? lecturer.study_program[0]?.name
      : lecturer.study_program.name
    : null;

  // Extract detailed assigned room information
  let roomDetails = null;
  if (lecturer.room_users && lecturer.room_users.length > 0) {
    const assignedRoom = lecturer.room_users[0]?.room;
    if (assignedRoom) {
      roomDetails = {
        id: assignedRoom.id,
        name: assignedRoom.name,
        building: assignedRoom.building?.name || null,
        campus: assignedRoom.building?.campus?.name || null,
        floor: assignedRoom.floor || null,
        attachments: null,
        lecturerName: lecturer.full_name
      };
    }
  }

  return (
    <div ref={cardRef} className="group text-center bg-white rounded-xl border border-gray-200 shadow-md hover:shadow-2xl transition-all duration-300 flex flex-col overflow-hidden h-full hover:-translate-y-1">
      <div className="relative w-full aspect-[3/4] overflow-hidden bg-gray-100">
        {!hasFetched ? (
          <div className="w-full h-full bg-gray-200 animate-pulse" />
        ) : hasPhoto ? (
          <img
            src={photoData!}
            alt={lecturer.full_name}
            onError={() => setImageError(true)}
            loading="lazy"
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
        {roomDetails ? (
          <div className="mt-2 w-full">
            <button 
              onClick={() => onShowRoom(roomDetails)}
              className="w-full py-2 px-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg transition-colors text-[10px] sm:text-[11px] font-bold text-center shadow-sm flex items-center justify-center gap-1.5"
            >
              <MapPin className="w-3.5 h-3.5" />
              Ruangan
            </button>
          </div>
        ) : (
          <div className="mt-2 text-[11px] sm:text-xs text-gray-400 bg-gray-50/50 rounded-lg p-3 border border-gray-100 flex items-center justify-center italic">
            Belum ada data ruangan
          </div>
        )}
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
  accentClass?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
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
  accentClass = 'emerald',
  searchPlaceholder = 'Cari...',
  disabled = false,
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

  const handleSelect = (id: string) => {
    onSelect(id);
    setOpen(false);
    setSearch('');
  };

  const colors = {
    emerald: {
      ring: 'focus-within:border-emerald-500 ring-emerald-100',
      activeText: 'text-emerald-700 bg-emerald-50',
      activeBadge: 'bg-emerald-100 text-emerald-700',
      border: 'border-emerald-500',
    },
    blue: {
      ring: 'focus-within:border-blue-500 ring-blue-100',
      activeText: 'text-blue-700 bg-blue-50',
      activeBadge: 'bg-blue-100 text-blue-700',
      border: 'border-blue-500',
    },
  };
  const c = colors[accentClass as keyof typeof colors] || colors.emerald;

  const isActive = selectedId !== 'all';

  return (
    <div className={`relative w-full ${disabled ? 'opacity-40 pointer-events-none' : ''}`} ref={ref}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-all duration-200 bg-white shadow-sm
          ${open
            ? `${c.border} border ring-2 ${c.ring} text-gray-900`
            : isActive
              ? `border-gray-300 text-gray-900 bg-gray-50`
              : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:shadow'
          }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex-shrink-0">{icon}</span>
          <span className="truncate text-left">
            {selectedId === 'all'
              ? allLabel
              : selected
                ? selected.label
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
          {/* Search inside dropdown */}
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
                className={`w-full flex items-center px-4 py-3 text-sm transition-colors border-b border-gray-50
                  ${selectedId === 'all' ? `${c.activeText} font-semibold` : 'text-gray-700 hover:bg-gray-50'}`}
              >
                <span>{allLabel}</span>
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

                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Filter Info Badge ─────────────────────────────────────────────────────────
const FilterBadge: React.FC<{ label: string; onRemove: () => void }> = ({ label, onRemove }) => (
  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold border border-emerald-200">
    {label}
    <button onClick={onRemove} className="ml-0.5 text-emerald-500 hover:text-red-500 transition-colors">
      <X className="w-3 h-3" />
    </button>
  </span>
);

// ─── Main Page ────────────────────────────────────────────────────────────────
const DosenDirectory: React.FC = () => {
  const [lecturerList, setLecturerList] = useState<Lecturer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [selectedProdi, setSelectedProdi] = useState<string>('all');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [selectedRoomModal, setSelectedRoomModal] = useState<RoomDetails | null>(null);

  const handleShowRoomModal = async (room: RoomDetails) => {
    setSelectedRoomModal({ ...room, attachments: null });
    try {
      const { data } = await supabase.from('rooms').select('attachments').eq('id', room.id).single();
      if (data) {
        setSelectedRoomModal(prev => prev?.id === room.id ? { ...prev, attachments: data.attachments } : prev);
      }
    } catch (err) {
      console.error('Error fetching room attachments:', err);
    }
  };

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Fetch home-base lecturers — only whose study_program has status='show'
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('users')
          .select(`
            id, full_name, identity_number, role,
            is_homebase, study_program_id, department_id,
            study_program:study_programs(id, name, code, department_id, status),
            room_users(
              room:rooms(
                id,
                name,
                floor,
                building:building_id(
                  name,
                  campus:campus_id(name)
                )
              )
            )
          `)
          .eq('role', 'lecturer')
          .eq('is_homebase', true)
          .order('full_name');

        if (error) throw error;

        // Filter out lecturers whose study program is hidden
        const filtered = (data || []).filter(l => {
          const sp = l.study_program
            ? Array.isArray(l.study_program) ? l.study_program[0] : l.study_program
            : null;
          // If no study program linked, include anyway; if linked, only show if status='show'
          if (!sp) return true;
          return sp.status === 'show';
        });

        setLecturerList(filtered);
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
        map.set(deptId, { id: deptId, name: deptId, code: '' });
      }
    });
    return Array.from(map.values());
  }, [lecturerList]);

  // Fetch dept names
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

  // ── Derive study programs ─────────────────────────────────────────────────
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

  // ── Counts ────────────────────────────────────────────────────────────────
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

  // ── Final filtered list ───────────────────────────────────────────────────
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

  // Dropdown options
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

  const selectedDeptName = selectedDept !== 'all' ? (deptNames[selectedDept]?.name || selectedDept) : null;
  const selectedProdiName = selectedProdi !== 'all' ? (allStudyPrograms.find(sp => sp.id === selectedProdi)?.name || '') : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-teal-50/50">

      {/* ── Sticky Header ───────────────────────────────────────────────────── */}
      <div className={`bg-white/90 backdrop-blur-md border-b border-gray-100 sticky top-0 z-20 transition-transform duration-300 shadow-sm ${showNavbar ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col gap-3">

            {/* Title + Search row */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-md">
                  <GraduationCap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Daftar Dosen</h1>
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
                    className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200 placeholder:text-gray-400 text-sm shadow-sm"
                  />
                  {searchTerm && (
                    <button type="button" onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Filter toggle button (mobile-friendly) */}
                <button
                  onClick={() => setShowFilterPanel(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all duration-200 shadow-sm ${showFilterPanel || selectedDept !== 'all' || selectedProdi !== 'all'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                    }`}
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  <span className="hidden sm:inline">Filter</span>
                  {(selectedDept !== 'all' || selectedProdi !== 'all') && (
                    <span className="w-2 h-2 rounded-full bg-white/80 sm:hidden" />
                  )}
                </button>
              </div>
            </div>

            {/* ── Filter Panel (collapsible) ─────────────────────────────────── */}
            {showFilterPanel && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 sm:p-4 space-y-3">
                {/* Panel header */}
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Filter Dosen</p>
                  {hasActiveFilter && (
                    <button
                      onClick={resetAll}
                      className="text-xs font-medium text-red-500 hover:text-red-700 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <X className="w-3 h-3" />
                      Reset semua
                    </button>
                  )}
                </div>

                {/* Helper text */}
                <p className="text-xs text-gray-400 leading-relaxed">
                  Pilih <span className="font-semibold text-blue-600">Departemen</span> untuk mempersempit pilihan program studi, atau langsung pilih <span className="font-semibold text-emerald-600">Program Studi</span> tanpa perlu memilih departemen terlebih dahulu.
                </p>

                {/* Filter dropdowns */}
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-start">

                  {/* Label col (desktop) */}
                  <div className="hidden sm:flex flex-col gap-2 pt-0.5">
                    <div className="flex items-center gap-1.5 h-10">
                      <Building2 className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-[11px] font-semibold text-gray-500 whitespace-nowrap">Departemen</span>
                    </div>
                    <div className="flex items-center gap-1.5 h-10">
                      <GraduationCap className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-[11px] font-semibold text-gray-500 whitespace-nowrap">Program Studi</span>
                    </div>
                  </div>

                  {/* Dropdowns col */}
                  <div className="flex flex-col gap-2 flex-1 w-full">

                    {/* Dept dropdown */}
                    <div className="w-full">
                      <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider mb-1 sm:hidden flex items-center gap-1">
                        <Building2 className="w-3 h-3" /> Departemen
                      </p>
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
                        hint={selectedDept === 'all' ? 'Opsional · Mempersempit daftar program studi' : undefined}
                      />
                    </div>

                    {/* Prodi dropdown */}
                    <div className="w-full">
                      <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider mb-1 sm:hidden flex items-center gap-1">
                        <GraduationCap className="w-3 h-3" /> Program Studi
                      </p>
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
                        hint={selectedDept !== 'all' ? `Menampilkan prodi di ${deptNames[selectedDept]?.name || '...'}` : 'Pilih langsung tanpa filter departemen'}
                      />
                    </div>
                  </div>


                </div>

                {/* Active filter badges */}
                {(selectedDeptName || selectedProdiName) && (
                  <div className="flex flex-wrap gap-1.5 pt-1 border-t border-gray-200">
                    <span className="text-[10px] text-gray-400 font-medium self-center">Filter aktif:</span>
                    {selectedDeptName && (
                      <FilterBadge label={`Dept: ${selectedDeptName}`} onRemove={() => { setSelectedDept('all'); setSelectedProdi('all'); }} />
                    )}
                    {selectedProdiName && (
                      <FilterBadge label={`Prodi: ${selectedProdiName}`} onRemove={() => setSelectedProdi('all')} />
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Count bar (always visible below header) */}
            {!showFilterPanel && (
              <div className="flex items-center gap-2 flex-wrap">
                {(selectedDeptName || selectedProdiName || searchTerm) && (
                  <>
                    <span className="text-xs text-gray-400">Filter aktif:</span>
                    {selectedDeptName && (
                      <FilterBadge label={`Dept: ${selectedDeptName}`} onRemove={() => { setSelectedDept('all'); setSelectedProdi('all'); }} />
                    )}
                    {selectedProdiName && (
                      <FilterBadge label={`Prodi: ${selectedProdiName}`} onRemove={() => setSelectedProdi('all')} />
                    )}
                    {searchTerm && (
                      <FilterBadge label={`"${searchTerm}"`} onRemove={() => setSearchTerm('')} />
                    )}
                  </>
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
            {filteredLecturers.map(l => <LecturerCard key={l.id} lecturer={l} onShowRoom={handleShowRoomModal} />)}
          </div>
        )}
      </div>

      {selectedRoomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h3 className="font-bold text-gray-800">Detail Ruangan</h3>
              <button onClick={() => setSelectedRoomModal(null)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Dosen</span>
                <span className="font-bold text-gray-900 text-base">{selectedRoomModal.lecturerName}</span>
              </div>
              
              <div className="p-4 bg-orange-50 rounded-xl border border-orange-100 flex flex-col gap-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-orange-500" />
                  <span className="font-bold text-orange-900 text-lg leading-tight">{selectedRoomModal.name}</span>
                </div>
                
                <div className="flex flex-col gap-2 pl-7">
                  {selectedRoomModal.building && (
                    <div className="flex flex-col">
                      <span className="text-[10px] text-orange-600/80 font-bold uppercase tracking-wider">Gedung</span>
                      <span className="font-medium text-orange-800 text-sm">{selectedRoomModal.building} {selectedRoomModal.campus ? `(${selectedRoomModal.campus})` : ''}</span>
                    </div>
                  )}
                  {selectedRoomModal.floor && (
                    <div className="flex flex-col">
                      <span className="text-[10px] text-orange-600/80 font-bold uppercase tracking-wider">Lantai</span>
                      <span className="font-medium text-orange-800 text-sm">{selectedRoomModal.floor}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">Foto Ruangan</span>
                {selectedRoomModal.attachments ? (
                  <div className="rounded-xl overflow-hidden border border-gray-200 aspect-video relative bg-gray-100 shadow-sm">
                    <img src={selectedRoomModal.attachments} alt={selectedRoomModal.name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                  </div>
                ) : (
                  <div className="rounded-xl border border-gray-200 aspect-video flex flex-col items-center justify-center bg-gray-50 text-gray-400 gap-2">
                    <ImageIcon className="w-8 h-8 opacity-40" />
                    <span className="text-sm font-medium">Belum ada foto ruangan</span>
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-100">
              <button 
                onClick={() => setSelectedRoomModal(null)}
                className="w-full py-2.5 bg-white border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-100 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="py-8 text-center text-sm text-gray-400">
        SIMPEL Kuliah © {new Date().getFullYear()}
      </div>
    </div>
  );
};

export default DosenDirectory;
