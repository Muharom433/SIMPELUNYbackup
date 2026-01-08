import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { parseISO, format, differenceInMinutes, isBefore, startOfDay, isSameDay } from "date-fns";
import { id } from "date-fns/locale";
import {
  Calendar,
  Clock,
  Building,
  AlertTriangle,
  ChevronDown,
  Search,
  Users,
  Eye,
  User,
  CheckCircle,
  Info,
  X,
  BookOpen,
  GraduationCap,
  RefreshCw,
  CalendarIcon,
  UserCheck,
  ChevronUp,
  Loader2,
  ClipboardList,
  AlertCircle,
  Settings,
  Upload,
  FileText,
  Camera,
  ChevronLeft,
  ChevronRight,
  Package,
  Plus,
  Minus,
  Star,
  Wrench,
  DoorOpen,
  Table2,
  MapPin,
  Maximize2,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { alert } from '../components/Alert/AlertHelper';
import { useLanguage } from "../contexts/LanguageContext";
import { useThrottledSubmit } from '../hooks/useThrottledSubmit';

// =====================================================
// TYPE DEFINITIONS
// =====================================================
type Booking = {
  id: string;
  start_time: string;
  end_time: string;
  purpose?: string;
  status?: string;
  user_info?: any;
  attachments?: string[];
  user?: { full_name?: string; identity_number?: string };
};

type ScheduleDetails = {
  lectures?: any[];
  exams?: any[];
  sessions?: any[];
};

type Room = {
  id: string;
  name: string;
  code?: string;
  capacity?: number;
  faculty?: string;
  building?: string;
  department?: { id: string; name: string; } | null;
  targetDateBookings?: Booking[];
  scheduleDetails?: ScheduleDetails;
  inUse?: boolean;
  is_available?: boolean;
  attachments?: string;
  floor?: string;
  building_id?: string;
  tables?: any[];
};

type Equipment = {
  id: string;
  name: string;
  code: string;
  category: string;
  quantity: number;
  unit: string;
  is_mandatory: boolean;
  is_available: boolean;
  condition: string;
  rooms_id: string | null;
  Spesification?: string;
  rooms?: {
    id: string;
    name: string;
    code: string;
  };
};

type EquipmentSelection = {
  equipment: Equipment;
  quantity: number;
  isMandatory: boolean;
};

type FormValues = {
  start_datetime?: string;
  end_datetime?: string;
  sks?: number;
  class_type?: string;
  purpose?: string;
  identity_number?: string;
  full_name?: string;
  phone_number?: string;
  study_program_id?: string;
  room_id?: string;
  attachments?: string[];
  equipment_requested?: string[];
  equipment_quantities?: number[];
};

type LectureSchedule = {
  id: string;
  room: string;
  day: string;
  start_time: string;
  end_time: string;
  course_name: string;
  course_code: string;
  class: string;
  subject_study: string;
  lecturer?: string;
  semester?: number;
};

interface CombinedSchedule {
  id: string;
  type: 'lecture' | 'exam' | 'session' | 'booking';
  start_time: string;
  end_time: string;
  title: string;
  subtitle?: string;
  description?: string;
  icon: any;
  color: string;
  bgColor: string;
  borderColor: string;
}

type RoomStatus = 'Available' | 'Scheduled' | 'Conflict' | 'In Use' | 'Unavailable';

interface RoomStatusResult {
  status: RoomStatus;
  reason: string;
  color: string;
  hasSchedule: boolean;
  isAvailable: boolean;
  conflictDetails?: string[];
}

// ==================== HELPER COMPONENTS ====================
const PhotoPlaceholder = ({ title, subtitle }: { title?: string, subtitle?: string }) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center bg-cyan-50 text-center p-4 z-10">
    <div className="w-16 h-16 bg-cyan-100 rounded-full flex items-center justify-center mb-3 animate-pulse">
      <Loader2 className="w-8 h-8 text-cyan-600 animate-spin" />
    </div>
    {title && <h3 className="font-bold text-lg text-gray-800 animate-pulse">{title}</h3>}
    {subtitle && <p className="text-sm text-gray-500 mb-2 animate-pulse">{subtitle}</p>}
    <p className="text-xs text-cyan-600 font-medium animate-pulse">Memuat foto...</p>
  </div>
);

const ImageWithLoader = ({ src, alt, className, title, subtitle }: { src: string, alt: string, className?: string, title?: string, subtitle?: string }) => {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <>
      {isLoading && <PhotoPlaceholder title={title} subtitle={subtitle} />}
      <img
        src={src}
        alt={alt}
        className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        onLoad={() => setIsLoading(false)}
      />
    </>
  );
};

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Parse time string from database (format: "HH:mm:ss" or "HH:mm")
 * Returns hours and minutes as numbers
 */
function parseTimeString(timeStr: string): { hours: number; minutes: number } | null {
  if (!timeStr) return null;

  const cleaned = timeStr.trim();
  const parts = cleaned.split(':');

  if (parts.length >= 2) {
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);

    if (!isNaN(hours) && !isNaN(minutes) && hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return { hours, minutes };
    }
  }

  return null;
}

/**
 * Convert time string to minutes from midnight for easy comparison
 */
function timeToMinutes(timeStr: string): number | null {
  const parsed = parseTimeString(timeStr);
  if (!parsed) return null;
  return parsed.hours * 60 + parsed.minutes;
}

/**
 * Check if two time ranges overlap
 * Range 1: start1 - end1
 * Range 2: start2 - end2
 * Returns true if they overlap
 */
function checkTimeOverlap(
  start1Minutes: number,
  end1Minutes: number,
  start2Minutes: number,
  end2Minutes: number
): boolean {
  return end1Minutes > start2Minutes && start1Minutes < end2Minutes;
}

/**
 * Get day name in Indonesian from date string
 */
function getDayNameIndonesian(dateStr: string): string {
  const date = new Date(dateStr);
  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  return dayNames[date.getDay()];
}

/**
 * Get local date string in yyyy-MM-dd format
 */
const getLocalDateString = (date = new Date()) => {
  return format(date, 'yyyy-MM-dd');
};

/**
 * Format datetime for display (DD/MM/YYYY HH:mm)
 */
const formatDateTime = (iso?: string) => {
  if (!iso) return "Belum diatur";
  try {
    const date = parseISO(iso);
    return format(date, 'dd/MM/yyyy HH:mm', { locale: id });
  } catch {
    return "Belum diatur";
  }
};



// =====================================================
// DATETIME PICKER MODAL COMPONENT
// =====================================================
const DateTimePickerModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSelect: (datetime: string) => void;
  value?: string;
  label: string;
  minDateTime?: string;
  isEndTime?: boolean;
}> = ({ isOpen, onClose, onSelect, value, label, minDateTime, isEndTime }) => {
  const { getText } = useLanguage();

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());
  const [selectedHour, setSelectedHour] = useState("08");
  const [selectedMinute, setSelectedMinute] = useState("00");

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  useEffect(() => {
    if (value) {
      try {
        const datetime = new Date(value);
        setSelectedYear(datetime.getFullYear());
        setSelectedMonth(datetime.getMonth());
        setSelectedDay(datetime.getDate());
        setSelectedHour(format(datetime, 'HH'));
        setSelectedMinute(format(datetime, 'mm'));
      } catch {
        const now = new Date();
        setSelectedYear(now.getFullYear());
        setSelectedMonth(now.getMonth());
        setSelectedDay(now.getDate());
        setSelectedHour("08");
        setSelectedMinute("00");
      }
    } else {
      const now = new Date();
      setSelectedYear(now.getFullYear());
      setSelectedMonth(now.getMonth());
      setSelectedDay(now.getDate());
      setSelectedHour(isEndTime ? "09" : "08");
      setSelectedMinute("00");
    }
  }, [value, isOpen, isEndTime]);

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const isDateDisabled = (day: number) => {
    const date = new Date(selectedYear, selectedMonth, day);
    const today = startOfDay(new Date());

    if (isBefore(date, today)) {
      return true;
    }

    if (minDateTime) {
      const minDate = new Date(minDateTime);
      const selectedDate = new Date(selectedYear, selectedMonth, day,
        parseInt(selectedHour), parseInt(selectedMinute));
      if (isBefore(selectedDate, minDate)) {
        return true;
      }
    }

    return false;
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
    const firstDay = getFirstDayOfMonth(selectedYear, selectedMonth);
    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-10"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const isSelected = day === selectedDay;
      const isDisabled = isDateDisabled(day);
      const isToday = isSameDay(new Date(selectedYear, selectedMonth, day), new Date());

      days.push(
        <button
          key={day}
          type="button"
          disabled={isDisabled}
          onClick={() => !isDisabled && setSelectedDay(day)}
          className={`
            h-10 rounded-lg text-sm font-medium transition-all
            ${isSelected
              ? 'bg-blue-600 text-white'
              : isToday
                ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                : isDisabled
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'hover:bg-gray-100 text-gray-700'
            }
          `}
        >
          {day}
        </button>
      );
    }

    return days;
  };

  const handleConfirm = () => {
    const year = selectedYear;
    const month = String(selectedMonth + 1).padStart(2, '0');
    const day = String(selectedDay).padStart(2, '0');
    const datetime = `${year}-${month}-${day}T${selectedHour}:${selectedMinute}`;

    if (minDateTime) {
      const minDate = new Date(minDateTime);
      const selectedDate = new Date(datetime);
      if (isBefore(selectedDate, minDate) || selectedDate.getTime() === minDate.getTime()) {
        alert.error(
          getText('End time must be after start time', 'Waktu selesai harus setelah waktu mulai'),
          ""
        );
        return;
      }
    }

    onSelect(datetime);
    onClose();
  };

  const formatDisplayDate = () => {
    const day = String(selectedDay).padStart(2, '0');
    const month = String(selectedMonth + 1).padStart(2, '0');
    const year = selectedYear;
    return `${day}/${month}/${year}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">{label}</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {getText('Date', 'Tanggal')} (DD/MM/YYYY)
            </label>

            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="text-center">
                <div className="font-semibold">
                  {monthNames[selectedMonth]} {selectedYear}
                </div>
                <div className="text-sm text-gray-500">
                  {getText('Selected', 'Dipilih')}: {formatDisplayDate()}
                </div>
              </div>

              <button
                type="button"
                onClick={handleNextMonth}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2">
              {dayNames.map(day => (
                <div key={day} className="text-center text-xs font-semibold text-gray-500 h-8 flex items-center justify-center">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {renderCalendar()}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {getText('Time', 'Waktu')} (24 {getText('Hour Format', 'Jam')})
            </label>

            <div className="flex items-center space-x-2">
              <div className="flex-1">
                <select
                  value={selectedHour}
                  onChange={(e) => setSelectedHour(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {Array.from({ length: 24 }, (_, i) => {
                    const hour = String(i).padStart(2, '0');
                    return (
                      <option key={hour} value={hour}>
                        {hour}
                      </option>
                    );
                  })}
                </select>
              </div>

              <span className="font-semibold text-xl">:</span>

              <div className="flex-1">
                <select
                  value={selectedMinute}
                  onChange={(e) => setSelectedMinute(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {Array.from({ length: 60 }, (_, i) => {
                    const minute = String(i).padStart(2, '0');
                    return (
                      <option key={minute} value={minute}>
                        {minute}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <p className="text-xs text-gray-500 mt-2">
              {getText('Format', 'Format')}: {formatDisplayDate()} {selectedHour}:{selectedMinute}
            </p>
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            {getText('Cancel', 'Batal')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
          >
            {getText('Confirm', 'Konfirmasi')}
          </button>
        </div>
      </div>
    </div>
  );
};

// =====================================================
// EQUIPMENT SELECTION COMPONENT
// =====================================================
const EquipmentSelectionSection: React.FC<{
  mandatoryEquipment: EquipmentSelection[];
  optionalEquipment: Equipment[];
  selectedOptionalEquipment: Map<string, number>;
  onOptionalEquipmentChange: (equipmentId: string, quantity: number) => void;
  getText: (en: string, id: string) => string;
  selectedRoom: Room | null;
}> = ({
  mandatoryEquipment,
  optionalEquipment,
  selectedOptionalEquipment,
  onOptionalEquipmentChange,
  getText,
}) => {
    const [showOptionalSection, setShowOptionalSection] = useState(false);
    const [equipmentSearchQuery, setEquipmentSearchQuery] = useState("");

    // Filter optional equipment based on search query (by name and code)
    const filteredOptionalEquipment = useMemo(() => {
      if (!equipmentSearchQuery.trim()) {
        return optionalEquipment;
      }
      const query = equipmentSearchQuery.toLowerCase().trim();
      return optionalEquipment.filter((equipment) =>
        equipment.name.toLowerCase().includes(query) ||
        equipment.code.toLowerCase().includes(query)
      );
    }, [optionalEquipment, equipmentSearchQuery]);

    return (
      <div className="border-t border-gray-200/50 pt-6">
        <div className="flex items-center space-x-3 mb-4">
          <Package className="h-6 w-6 text-emerald-600" />
          <h2 className="text-xl font-bold text-gray-800">{getText('Equipment', 'Peralatan')}</h2>
        </div>

        {/* Mandatory Equipment Section */}
        {mandatoryEquipment.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center space-x-2 mb-3">
              <Star className="h-4 w-4 text-amber-500" />
              <h3 className="text-sm font-semibold text-gray-700">
                {getText('Mandatory Equipment (Auto-included)', 'Peralatan Wajib (Otomatis ditambahkan)')}
              </h3>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {mandatoryEquipment.map((item) => (
                  <div
                    key={item.equipment.id}
                    className="flex items-center justify-between p-3 bg-white rounded-lg border border-amber-200"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-amber-100 rounded-lg">
                        <Wrench className="h-4 w-4 text-amber-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{item.equipment.name}</p>
                        <p className="text-xs text-gray-500">{item.equipment.code}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-amber-700">{item.quantity}</span>
                      <span className="text-xs text-gray-500 ml-1">{item.equipment.unit}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center space-x-2 text-xs text-amber-700">
                <Info className="h-3 w-3" />
                <span>
                  {getText(
                    'These equipment items are required for the selected room and will be automatically included.',
                    'Peralatan ini wajib untuk ruangan yang dipilih dan akan otomatis disertakan.'
                  )}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Optional Equipment Section */}
        <div>
          <button
            type="button"
            onClick={() => setShowOptionalSection(!showOptionalSection)}
            className="flex items-center space-x-2 w-full p-3 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
          >
            <Package className="h-4 w-4 text-emerald-600" />
            <span className="font-medium text-emerald-800">
              {getText('Optional Equipment', 'Peralatan Opsional')}
            </span>
            <span className="text-sm text-emerald-600">
              ({selectedOptionalEquipment.size} {getText('selected', 'dipilih')})
            </span>
            <div className="flex-1" />
            {showOptionalSection ? (
              <ChevronUp className="h-4 w-4 text-emerald-600" />
            ) : (
              <ChevronDown className="h-4 w-4 text-emerald-600" />
            )}
          </button>

          {showOptionalSection && (
            <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              {optionalEquipment.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    {getText('No optional equipment available', 'Tidak ada peralatan opsional tersedia')}
                  </p>
                </div>
              ) : (
                <>
                  {/* Search Input for Optional Equipment */}
                  <div className="mb-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={equipmentSearchQuery}
                        onChange={(e) => setEquipmentSearchQuery(e.target.value)}
                        placeholder={getText('Search by name or code...', 'Cari berdasarkan nama atau kode...')}
                        className="w-full pl-10 pr-10 py-2 border border-emerald-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white transition-all"
                      />
                      {equipmentSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setEquipmentSearchQuery("")}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {equipmentSearchQuery && (
                      <p className="text-xs text-emerald-600 mt-1">
                        {getText('Found', 'Ditemukan')} {filteredOptionalEquipment.length} {getText('equipment', 'peralatan')}
                      </p>
                    )}
                  </div>

                  {filteredOptionalEquipment.length === 0 ? (
                    <div className="text-center py-6 text-gray-500">
                      <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">
                        {getText('No equipment found matching', 'Tidak ada peralatan yang cocok dengan')} "{equipmentSearchQuery}"
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                      {filteredOptionalEquipment.map((equipment) => {
                        const isSelected = selectedOptionalEquipment.has(equipment.id);
                        const selectedQty = selectedOptionalEquipment.get(equipment.id) || 0;

                        return (
                          <div
                            key={equipment.id}
                            className={`p-3 rounded-lg border-2 transition-all ${isSelected
                              ? 'border-emerald-500 bg-emerald-100'
                              : 'border-gray-200 bg-white hover:border-emerald-300'
                              }`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                <div className={`p-1.5 rounded ${isSelected ? 'bg-emerald-200' : 'bg-gray-100'}`}>
                                  <Package className={`h-3 w-3 ${isSelected ? 'text-emerald-700' : 'text-gray-500'}`} />
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900 text-sm">{equipment.name}</p>
                                  <p className="text-xs text-gray-500">{equipment.code}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-xs text-gray-500">
                                  {getText('Available', 'Tersedia')}: {equipment.quantity} {equipment.unit}
                                </span>
                              </div>
                            </div>

                            {equipment.rooms?.name && (
                              <p className="text-xs text-gray-500 mb-2">
                                📍 {equipment.rooms.name}
                              </p>
                            )}

                            <div className="flex items-center justify-between">
                              {isSelected ? (
                                <div className="flex items-center space-x-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (selectedQty > 1) {
                                        onOptionalEquipmentChange(equipment.id, selectedQty - 1);
                                      } else {
                                        onOptionalEquipmentChange(equipment.id, 0);
                                      }
                                    }}
                                    className="p-1 bg-emerald-200 hover:bg-emerald-300 rounded transition-colors"
                                  >
                                    <Minus className="h-3 w-3 text-emerald-700" />
                                  </button>
                                  <span className="font-bold text-emerald-700 min-w-[24px] text-center">
                                    {selectedQty}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (selectedQty < equipment.quantity) {
                                        onOptionalEquipmentChange(equipment.id, selectedQty + 1);
                                      }
                                    }}
                                    disabled={selectedQty >= equipment.quantity}
                                    className="p-1 bg-emerald-200 hover:bg-emerald-300 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <Plus className="h-3 w-3 text-emerald-700" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => onOptionalEquipmentChange(equipment.id, 1)}
                                  className="px-3 py-1 bg-emerald-600 text-white text-xs font-medium rounded hover:bg-emerald-700 transition-colors"
                                >
                                  + {getText('Add', 'Tambah')}
                                </button>
                              )}

                              {isSelected && (
                                <button
                                  type="button"
                                  onClick={() => onOptionalEquipmentChange(equipment.id, 0)}
                                  className="text-red-500 hover:text-red-700 transition-colors"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-3 flex items-center space-x-2 text-xs text-emerald-700">
                    <Info className="h-3 w-3" />
                    <span>
                      {getText(
                        'Optional equipment can be borrowed from any available location.',
                        'Peralatan opsional dapat dipinjam dari lokasi mana pun yang tersedia.'
                      )}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Equipment Summary */}
        {(mandatoryEquipment.length > 0 || selectedOptionalEquipment.size > 0) && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center space-x-2 text-sm text-blue-800">
              <CheckCircle className="h-4 w-4" />
              <span className="font-medium">
                {getText('Equipment Summary:', 'Ringkasan Peralatan:')}
              </span>
              <span>
                {mandatoryEquipment.length + selectedOptionalEquipment.size} {getText('items', 'item')}
                {' • '}
                {mandatoryEquipment.reduce((sum, item) => sum + item.quantity, 0) +
                  Array.from(selectedOptionalEquipment.values()).reduce((sum, qty) => sum + qty, 0)} {getText('total units', 'total unit')}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

// =====================================================
// MAIN COMPONENT
// =====================================================
const BookRoom: React.FC = () => {
  const { isSubmitting: isThrottling, throttledSubmit } = useThrottledSubmit(3000);
  const { getText } = useLanguage();
  const { register, handleSubmit, setValue, getValues, watch } = useForm<FormValues>({
    defaultValues: {
      sks: 3,
      class_type: "theory",
      purpose: "Class/Lecture",
      attachments: [],
      equipment_requested: [],
      equipment_quantities: [],
    },
  });

  // State Management
  const [activeTab, setActiveTab] = useState<'course' | 'normal'>('course');
  const [showSKSField, setShowSKSField] = useState(false);
  const [todaySchedules, setTodaySchedules] = useState<LectureSchedule[]>([]);
  const [courseSearch, setCourseSearch] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<LectureSchedule | null>(null);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [showPendingBookings, setShowPendingBookings] = useState(false);
  const [pendingBookings, setPendingBookings] = useState<Booking[]>([]);
  const [loadingPendingBookings, setLoadingPendingBookings] = useState(false);

  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleModalRoom, setScheduleModalRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [identitySuggestions, setIdentitySuggestions] = useState<any[]>([]);
  const [showIdentityDropdown, setShowIdentityDropdown] = useState(false);
  const [combinedSchedules, setCombinedSchedules] = useState<CombinedSchedule[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [targetDate, setTargetDate] = useState(getLocalDateString());

  const [isManualEntry, setIsManualEntry] = useState(false);
  const [studyPrograms, setStudyPrograms] = useState<any[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<any>(null);

  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  // Equipment State
  const [mandatoryEquipment, setMandatoryEquipment] = useState<EquipmentSelection[]>([]);
  const [optionalEquipment, setOptionalEquipment] = useState<Equipment[]>([]);
  const [selectedOptionalEquipment, setSelectedOptionalEquipment] = useState<Map<string, number>>(new Map());
  const [loadingEquipment, setLoadingEquipment] = useState(false);

  // Room Detail Modal State
  const [showRoomDetailModal, setShowRoomDetailModal] = useState(false);
  const [selectedRoomDetail, setSelectedRoomDetail] = useState<Room | null>(null);
  const [selectedRoomBuilding, setSelectedRoomBuilding] = useState<any>(null);
  const [fullscreenPhoto, setFullscreenPhoto] = useState<string | null>(null);
  const [loadingRoomDetail, setLoadingRoomDetail] = useState(false);

  // Success Modal State
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [submittedBookingInfo, setSubmittedBookingInfo] = useState<{
    name: string;
    studyProgram: string;
    roomName: string;
    date: string;
    startTime: string;
    endTime: string;
  } | null>(null);


  // Refs
  const identityInputRef = useRef<HTMLInputElement | null>(null);
  const fullNameInputRef = useRef<HTMLInputElement | null>(null);
  const phoneInputRef = useRef<HTMLInputElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Watch form values
  const startDateTime = watch("start_datetime");
  const endDateTime = watch("end_datetime");
  const sks = watch("sks");
  const classType = watch("class_type");
  const watchPurpose = watch("purpose");
  const watchAttachments = watch("attachments");

  // =====================================================
  // HELPER FUNCTIONS
  // =====================================================

  const getTodayDayName = () => {
    const today = new Date();
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    return dayNames[today.getDay()];
  };

  const getDayName = (date: string) => {
    const dateObj = new Date(date);
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    return dayNames[dateObj.getDay()];
  };

  const getFileTypeIcon = (attachment: string) => {
    if (attachment.startsWith('data:application/pdf')) {
      return <FileText className="h-4 w-4 text-red-600" />;
    } else if (attachment.startsWith('data:image/')) {
      return <Camera className="h-4 w-4 text-amber-600" />;
    } else {
      return <FileText className="h-4 w-4 text-gray-600" />;
    }
  };

  const getFileName = (attachment: string, index: number) => {
    if (attachment.startsWith('data:application/pdf')) {
      return `Document_${index + 1}.pdf`;
    } else if (attachment.startsWith('data:image/')) {
      return `Image_${index + 1}.jpg`;
    } else {
      return `File_${index + 1}`;
    }
  };

  // =====================================================
  // FILE HANDLING
  // =====================================================

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const currentAttachments = getValues('attachments') || [];

    Array.from(files).forEach((file) => {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        alert.error(
          getText('Please select an image or PDF file', 'Silakan pilih file gambar atau PDF'),
          ""
        );
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        alert.error(
          getText('File size must be less than 10MB', 'Ukuran file harus kurang dari 10MB'),
          ""
        );
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) {
          const newAttachments = [...currentAttachments, result];
          setValue('attachments', newAttachments);
          alert.success(
            getText('File uploaded successfully', 'File berhasil diunggah'),
            ""
          );
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (index: number) => {
    const currentAttachments = getValues('attachments') || [];
    const updatedAttachments = currentAttachments.filter((_, i) => i !== index);
    setValue('attachments', updatedAttachments);
  };

  // =====================================================
  // EQUIPMENT FETCHING
  // =====================================================

  /**
   * Fetch mandatory equipment for selected room
   */
  const fetchMandatoryEquipmentForRoom = async (roomId: string) => {
    try {
      setLoadingEquipment(true);


      const { data, error } = await supabase
        .from('equipment')
        .select(`
          id, name, code, category, quantity, unit, is_mandatory, is_available, condition, rooms_id,
          rooms (id, name, code)
        `)
        .eq('rooms_id', roomId)
        .eq('is_mandatory', true)
        .eq('condition', 'GOOD')
        .gt('quantity', 0);

      if (error) throw error;



      // Convert to EquipmentSelection with quantity = 1 for each mandatory item
      const mandatorySelections: EquipmentSelection[] = (data || []).map((eq: any) => ({
        equipment: eq,
        quantity: 1, // Default 1 for mandatory
        isMandatory: true
      }));

      setMandatoryEquipment(mandatorySelections);

    } catch (error) {
      console.error('❌ Error fetching mandatory equipment:', error);
      setMandatoryEquipment([]);
    } finally {
      setLoadingEquipment(false);
    }
  };

  /**
   * Fetch all optional equipment (available from any room)
   */
  const fetchOptionalEquipment = async () => {
    try {


      const { data, error } = await supabase
        .from('equipment')
        .select(`
          id, name, code, category, quantity, unit, is_mandatory, is_available, condition, rooms_id,
          rooms (id, name, code)
        `)
        .eq('is_available', true)
        .eq('is_mandatory', false)
        .eq('condition', 'GOOD')
        .gt('quantity', 0)
        .order('name');

      if (error) throw error;


      setOptionalEquipment((data as any[]) || []);

    } catch (error) {
      console.error('❌ Error fetching optional equipment:', error);
      setOptionalEquipment([]);
    }
  };

  /**
   * Handle optional equipment selection change
   */
  const handleOptionalEquipmentChange = (equipmentId: string, quantity: number) => {
    setSelectedOptionalEquipment(prev => {
      const newMap = new Map(prev);
      if (quantity <= 0) {
        newMap.delete(equipmentId);
      } else {
        newMap.set(equipmentId, quantity);
      }
      return newMap;
    });
  };

  // =====================================================
  // DATA FETCHING FUNCTIONS
  // =====================================================

  const fetchTodayLectures = async () => {
    setLoadingCourses(true);
    try {
      const todayDay = getTodayDayName();

      const { data, error } = await supabase
        .from('lecture_schedules')
        .select('*')
        .eq('day', todayDay)
        .order('start_time');

      if (error) throw error;

      setTodaySchedules(data || []);
    } catch (error) {
      console.error("Error fetching today's lectures:", error);
      alert.error(getText("Failed to load today's lecture schedule", "Gagal memuat jadwal kuliah hari ini"), "");
    } finally {
      setLoadingCourses(false);
    }
  };

  const fetchPendingBookings = async () => {
    const identityNumber = getValues("identity_number");
    if (!identityNumber) return;

    setLoadingPendingBookings(true);
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('identity_number', identityNumber)
        .single();

      let bookingsQuery = supabase
        .from('bookings')
        .select(`
          id,
          start_time,
          end_time,
          purpose,
          status,
          room_id,
          user_info,
          attachments,
          rooms (
            name,
            code
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (userData) {
        bookingsQuery = bookingsQuery.eq('user_id', userData.id);
      } else {
        bookingsQuery = bookingsQuery.contains('user_info', { identity_number: identityNumber });
      }

      const { data, error } = await bookingsQuery;

      if (error) throw error;

      setPendingBookings(data || []);
    } catch (error) {
      console.error("Error fetching pending bookings:", error);
    } finally {
      setLoadingPendingBookings(false);
    }
  };

  async function fetchStudyPrograms() {
    try {
      const { data, error } = await supabase
        .from('study_programs')
        .select('id, name, code')
        .order('name');

      if (error) throw error;
      setStudyPrograms(data || []);
    } catch (err) {
      console.error("Error fetching study programs:", err);
    }
  }

  // =====================================================
  // ROOM FETCHING WITH COMPLETE SCHEDULE DATA
  // =====================================================

  const fetchRooms = useCallback(async (selectedDate: string) => {
    setLoadingRooms(true);
    try {


      const { data: roomsData, error } = await supabase
        .from('rooms')
        .select(`
          id,
          name,
          code,
          capacity,
          is_available,
          department_id,
          departments (
            id,
            name,
            code
          )
        `)
        .eq('is_available', true)
        .order('name', { ascending: true });

      if (error) throw error;

      if (!roomsData || roomsData.length === 0) {
        setRooms([]);
        return;
      }

      const mappedRooms: Room[] = roomsData.map((room: any) => ({
        id: room.id,
        name: room.name,
        code: room.code,
        capacity: room.capacity,
        is_available: room.is_available,
        faculty: room.departments?.name || getText("General", "Umum"),
        building: room.departments?.name || "",
        department: room.departments ? {
          id: room.departments.id,
          name: room.departments.name
        } : null,
        inUse: false,
        targetDateBookings: [],
        scheduleDetails: {
          lectures: [],
          exams: [],
          sessions: []
        },
      }));

      // 3. Get day name for lecture schedule matching
      const dayNameIndonesian = getDayNameIndonesian(selectedDate);


      // 4. Fetch ALL schedule data in parallel
      const [bookingsResult, lecturesResult, examsResult, sessionsResult] = await Promise.all([
        // Bookings - using timestamptz, need date range
        (async () => {
          const startOfDayUTC = `${selectedDate}T00:00:00+07:00`;
          const endOfDayUTC = `${selectedDate}T23:59:59+07:00`;

          const { data, error } = await supabase
            .from('bookings')
            .select(`
              id,
              start_time,
              end_time,
              purpose,
              room_id,
              status,
              users (
                full_name,
                identity_number
              )
            `)
            .gte('start_time', startOfDayUTC)
            .lte('start_time', endOfDayUTC)
            .in('status', ['approved', 'borrowed']);

          if (error) {
            console.error("Error fetching bookings:", error);
            return [];
          }
          return data || [];
        })(),

        // Lectures - using day name
        (async () => {
          const { data, error } = await supabase
            .from('lecture_schedules')
            .select('*')
            .eq('day', dayNameIndonesian);

          if (error) {
            console.error("Error fetching lectures:", error);
            return [];
          }
          return data || [];
        })(),

        // Exams - using date column
        (async () => {
          const { data, error } = await supabase
            .from('exams')
            .select('*')
            .eq('date', selectedDate);

          if (error) {
            console.error("Error fetching exams:", error);
            return [];
          }
          return data || [];
        })(),

        // Sessions - using date column
        (async () => {
          const { data, error } = await supabase
            .from('final_sessions')
            .select('*')
            .eq('date', selectedDate);

          if (error) {
            console.error("Error fetching sessions:", error);
            return [];
          }
          return data || [];
        })()
      ]);



      // 5. Merge ALL data into rooms
      const fullyMergedRooms = mappedRooms.map(room => {
        // Match bookings by room_id
        const roomBookings = bookingsResult.filter(b => b.room_id === room.id);

        // Match lectures by room name (case-insensitive partial match)
        const roomLectures = lecturesResult.filter(l =>
          l.room && room.name &&
          (l.room.toLowerCase().includes(room.name.toLowerCase()) ||
            room.name.toLowerCase().includes(l.room.toLowerCase()))
        );

        // Match exams by room_id
        const roomExams = examsResult.filter(e => e.room_id === room.id);

        // Match sessions by room_id
        const roomSessions = sessionsResult.filter(s => s.room_id === room.id);

        const hasAnySchedule = roomBookings.length > 0 || roomLectures.length > 0 ||
          roomExams.length > 0 || roomSessions.length > 0;

        return {
          ...room,
          targetDateBookings: roomBookings.map(booking => ({
            id: booking.id,
            start_time: booking.start_time,
            end_time: booking.end_time,
            purpose: booking.purpose,
            status: booking.status,
            user: {
              full_name: (booking.users as any)?.full_name || getText("Unknown", "Tidak diketahui"),
              identity_number: (booking.users as any)?.identity_number || "",
            },
          })),
          scheduleDetails: {
            lectures: roomLectures,
            exams: roomExams,
            sessions: roomSessions
          },
          inUse: hasAnySchedule
        };
      });


      setRooms(fullyMergedRooms);

    } catch (err) {
      console.error("Error loading rooms:", err);
      setRooms([]);
    } finally {
      setLoadingRooms(false);
    }
  }, [getText]);

  // =====================================================
  // ROOM AVAILABILITY VALIDATION
  // =====================================================

  function checkRoomAvailability(room: Room, startTime: string, endTime: string): RoomStatusResult {
    const conflictDetails: string[] = [];

    const userStart = new Date(startTime);
    const userEnd = new Date(endTime);

    if (isNaN(userStart.getTime()) || isNaN(userEnd.getTime()) || userEnd <= userStart) {
      return {
        status: 'Unavailable',
        reason: getText("Invalid date/time", "Tanggal/waktu tidak valid"),
        color: "bg-gray-100 text-gray-800 border-gray-200",
        hasSchedule: false,
        isAvailable: false
      };
    }

    const userStartMinutes = userStart.getHours() * 60 + userStart.getMinutes();
    const userEndMinutes = userEnd.getHours() * 60 + userEnd.getMinutes();

    let hasConflict = false;
    let hasScheduleToday = false;

    // Check bookings
    if (room.targetDateBookings && room.targetDateBookings.length > 0) {
      hasScheduleToday = true;

      for (const booking of room.targetDateBookings) {
        const bookingStart = new Date(booking.start_time);
        const bookingEnd = new Date(booking.end_time);

        const bookingStartLocal = new Date(bookingStart.getTime());
        const bookingEndLocal = new Date(bookingEnd.getTime());

        const bookingStartMinutes = bookingStartLocal.getHours() * 60 + bookingStartLocal.getMinutes();
        const bookingEndMinutes = bookingEndLocal.getHours() * 60 + bookingEndLocal.getMinutes();

        if (checkTimeOverlap(userStartMinutes, userEndMinutes, bookingStartMinutes, bookingEndMinutes)) {
          hasConflict = true;
          conflictDetails.push(`Booking: ${format(bookingStartLocal, 'HH:mm')}-${format(bookingEndLocal, 'HH:mm')}`);

          return {
            status: 'In Use',
            reason: getText(
              `Room is booked at ${format(bookingStartLocal, 'HH:mm')}-${format(bookingEndLocal, 'HH:mm')}`,
              `Ruangan sudah dibooking pukul ${format(bookingStartLocal, 'HH:mm')}-${format(bookingEndLocal, 'HH:mm')}`
            ),
            color: "bg-red-100 text-red-800 border-red-200",
            hasSchedule: true,
            isAvailable: false,
            conflictDetails
          };
        }
      }
    }

    // Check exams
    if (room.scheduleDetails?.exams && room.scheduleDetails.exams.length > 0) {
      hasScheduleToday = true;

      for (const exam of room.scheduleDetails.exams) {
        if (exam.is_take_home) continue;

        const examStartMinutes = timeToMinutes(exam.start_time);
        const examEndMinutes = timeToMinutes(exam.end_time);

        if (examStartMinutes === null || examEndMinutes === null) continue;

        if (checkTimeOverlap(userStartMinutes, userEndMinutes, examStartMinutes, examEndMinutes)) {
          hasConflict = true;
          conflictDetails.push(`Exam: ${exam.course_name || 'UAS'} (${exam.start_time?.substring(0, 5)}-${exam.end_time?.substring(0, 5)})`);
        }
      }
    }

    // Check final sessions
    if (room.scheduleDetails?.sessions && room.scheduleDetails.sessions.length > 0) {
      hasScheduleToday = true;

      for (const session of room.scheduleDetails.sessions) {
        const sessionStartMinutes = timeToMinutes(session.start_time);
        const sessionEndMinutes = timeToMinutes(session.end_time);

        if (sessionStartMinutes === null || sessionEndMinutes === null) continue;

        if (checkTimeOverlap(userStartMinutes, userEndMinutes, sessionStartMinutes, sessionEndMinutes)) {
          hasConflict = true;
          conflictDetails.push(`Sidang: ${session.start_time?.substring(0, 5)}-${session.end_time?.substring(0, 5)}`);
        }
      }
    }

    // Check lectures
    if (room.scheduleDetails?.lectures && room.scheduleDetails.lectures.length > 0) {
      hasScheduleToday = true;

      for (const lecture of room.scheduleDetails.lectures) {
        const lectureStartMinutes = timeToMinutes(lecture.start_time);
        const lectureEndMinutes = timeToMinutes(lecture.end_time);

        if (lectureStartMinutes === null || lectureEndMinutes === null) continue;

        if (checkTimeOverlap(userStartMinutes, userEndMinutes, lectureStartMinutes, lectureEndMinutes)) {
          hasConflict = true;
          conflictDetails.push(`Kuliah: ${lecture.course_name} (${lecture.start_time?.substring(0, 5)}-${lecture.end_time?.substring(0, 5)})`);
        }
      }
    }

    if (hasConflict) {
      return {
        status: 'Conflict',
        reason: getText(
          `Time conflict: ${conflictDetails.join(', ')}`,
          `Bentrok jadwal: ${conflictDetails.join(', ')}`
        ),
        color: "bg-red-100 text-red-800 border-red-200",
        hasSchedule: true,
        isAvailable: false,
        conflictDetails
      };
    }

    if (hasScheduleToday) {
      return {
        status: 'Scheduled',
        reason: getText(
          "Room has other schedules today but no conflict with your time",
          "Ruangan memiliki jadwal lain hari ini tapi tidak bentrok dengan waktu Anda"
        ),
        color: "bg-yellow-100 text-yellow-800 border-yellow-200",
        hasSchedule: true,
        isAvailable: true
      };
    }

    return {
      status: 'Available',
      reason: getText("Room is free", "Ruangan tersedia"),
      color: "bg-green-100 text-green-800 border-green-200",
      hasSchedule: false,
      isAvailable: true
    };
  }

  function getOptimizedRoomStatus(room: Room): RoomStatusResult {
    if (!room.is_available) {
      return {
        status: 'Unavailable',
        reason: getText("Room is disabled", "Ruangan dinonaktifkan"),
        color: "bg-gray-100 text-gray-800 border-gray-200",
        hasSchedule: false,
        isAvailable: false
      };
    }

    const s = getValues("start_datetime");
    const e = getValues("end_datetime");

    if (!s || !e) {
      const hasScheduledContent =
        (room.targetDateBookings && room.targetDateBookings.length > 0) ||
        (room.scheduleDetails?.lectures && room.scheduleDetails.lectures.length > 0) ||
        (room.scheduleDetails?.exams && room.scheduleDetails.exams.length > 0) ||
        (room.scheduleDetails?.sessions && room.scheduleDetails.sessions.length > 0);

      if (hasScheduledContent) {
        return {
          status: 'Scheduled',
          reason: getText("Room has scheduled activities", "Ruangan memiliki aktivitas terjadwal"),
          color: "bg-yellow-100 text-yellow-800 border-yellow-200",
          hasSchedule: true,
          isAvailable: false
        };
      }

      return {
        status: 'Available',
        reason: "",
        color: "bg-green-100 text-green-800 border-green-200",
        hasSchedule: false,
        isAvailable: true
      };
    }

    return checkRoomAvailability(room, s, e);
  }

  // =====================================================
  // FETCH SCHEDULES FOR MODAL
  // =====================================================

  const fetchSchedulesForRoom = async (roomName: string, roomId: string, selectedDate: string) => {
    setLoadingSchedules(true);
    try {
      const combined: CombinedSchedule[] = [];
      const dayNameIndonesian = getDayNameIndonesian(selectedDate);

      // 1. Fetch lecture schedules
      const { data: lectureData } = await supabase
        .from('lecture_schedules')
        .select('*')
        .eq('day', dayNameIndonesian)
        .ilike('room', `%${roomName}%`)
        .order('start_time');

      if (lectureData) {
        lectureData.forEach(lecture => {
          combined.push({
            id: lecture.id,
            type: 'lecture',
            start_time: lecture.start_time?.substring(0, 5) || '',
            end_time: lecture.end_time?.substring(0, 5) || '',
            title: lecture.course_name || getText('Lecture', 'Kuliah'),
            subtitle: `${getText('Class', 'Kelas')} ${lecture.class} • ${lecture.subject_study}`,
            description: `${getText('Lecturer', 'Dosen')}: ${lecture.lecturer || 'TBA'} • ${getText('Semester', 'Semester')} ${lecture.semester}`,
            icon: BookOpen,
            color: 'text-blue-700',
            bgColor: 'bg-blue-50',
            borderColor: 'border-blue-200'
          });
        });
      }

      // 2. Fetch exam schedules
      const { data: examData } = await supabase
        .from('exams')
        .select('*')
        .eq('room_id', roomId)
        .eq('date', selectedDate)
        .order('start_time');

      if (examData) {
        examData.forEach(exam => {
          combined.push({
            id: exam.id,
            type: 'exam',
            start_time: exam.is_take_home ? getText('Take Home', 'Take Home') : exam.start_time?.substring(0, 5) || '',
            end_time: exam.is_take_home ? '' : exam.end_time?.substring(0, 5) || '',
            title: `${exam.course_name || getText('UAS Exam', 'Ujian UAS')}`,
            subtitle: `${exam.student_amount} ${getText('students', 'mahasiswa')} • ${getText('Semester', 'Semester')} ${exam.semester}`,
            description: `${getText('Class', 'Kelas')} ${exam.class} • ${getText('Inspector', 'Pengawas')}: ${exam.inspector}`,
            icon: GraduationCap,
            color: 'text-green-700',
            bgColor: 'bg-green-50',
            borderColor: 'border-green-200'
          });
        });
      }

      // 3. Fetch final sessions
      const { data: sessionData } = await supabase
        .from('final_sessions')
        .select(`
          *,
          student:users!student_id(full_name, identity_number)
        `)
        .eq('room_id', roomId)
        .eq('date', selectedDate)
        .order('start_time');

      if (sessionData) {
        sessionData.forEach(session => {
          combined.push({
            id: session.id,
            type: 'session',
            start_time: session.start_time?.substring(0, 5) || '',
            end_time: session.end_time?.substring(0, 5) || '',
            title: `${session.student?.full_name || getText('Final Session', 'Sidang Akhir')}`,
            subtitle: `ID: ${session.student?.identity_number}`,
            description: `${getText('Supervisor', 'Pembimbing')}: ${session.supervisor} • ${getText('Examiner', 'Penguji')}: ${session.examiner}`,
            icon: UserCheck,
            color: 'text-purple-700',
            bgColor: 'bg-purple-50',
            borderColor: 'border-purple-200'
          });
        });
      }

      // 4. Fetch bookings
      const startOfDayUTC = `${selectedDate}T00:00:00+07:00`;
      const endOfDayUTC = `${selectedDate}T23:59:59+07:00`;

      const { data: bookingData } = await supabase
        .from('bookings')
        .select(`
          *,
          user:users!user_id(full_name, identity_number)
        `)
        .eq('room_id', roomId)
        .in('status', ['approved', 'borrowed'])
        .gte('start_time', startOfDayUTC)
        .lte('start_time', endOfDayUTC)
        .order('start_time');

      if (bookingData) {
        bookingData.forEach(booking => {
          const startDate = new Date(booking.start_time);
          const endDate = new Date(booking.end_time);

          combined.push({
            id: booking.id,
            type: 'booking',
            start_time: format(startDate, 'HH:mm'),
            end_time: format(endDate, 'HH:mm'),
            title: `${booking.purpose || getText('Room Booking', 'Pemesanan Ruangan')}`,
            subtitle: `${booking.user?.full_name} • ${booking.user?.identity_number}`,
            description: `${getText('Status', 'Status')}: ${booking.status?.toUpperCase()}`,
            icon: CalendarIcon,
            color: 'text-orange-700',
            bgColor: 'bg-orange-50',
            borderColor: 'border-orange-200'
          });
        });
      }

      combined.sort((a, b) => {
        const aTime = a.start_time === getText('Take Home', 'Take Home') ? '00:00' : a.start_time;
        const bTime = b.start_time === getText('Take Home', 'Take Home') ? '00:00' : b.start_time;
        return aTime.localeCompare(bTime);
      });

      setCombinedSchedules(combined);

    } catch (error) {
      console.error('Error fetching schedules:', error);
      alert.error(getText("Failed to load schedule for this room.", "Gagal memuat jadwal untuk ruangan ini."));
    } finally {
      setLoadingSchedules(false);
    }
  };

  // =====================================================
  // IDENTITY SEARCH
  // =====================================================

  async function searchIdentity(value: string) {
    if (value.length < 3) {
      setIdentitySuggestions([]);
      setShowIdentityDropdown(false);
      setIsManualEntry(true);
      return;
    }

    try {
      const { data: users, error } = await supabase
        .from('users')
        .select(`
          id,
          identity_number,
          full_name,
          phone_number,
          study_program_id,
          study_programs (
            id,
            name,
            code
          )
        `)
        .or(`identity_number.ilike.%${value}%,full_name.ilike.%${value}%`)
        .limit(10);

      if (error) throw error;

      if (!users || users.length === 0) {
        setIdentitySuggestions([]);
        setShowIdentityDropdown(false);
        setIsManualEntry(true);

        if (fullNameInputRef.current) fullNameInputRef.current.disabled = false;
        if (phoneInputRef.current) phoneInputRef.current.disabled = false;

        return;
      }

      const mappedUsers = users.map((user: any) => ({
        id: user.id,
        identity_number: user.identity_number,
        full_name: user.full_name,
        phone_number: user.phone_number || "",
        study_program: user.study_programs?.name || "",
        study_program_id: user.study_program_id || "",
      }));

      setIdentitySuggestions(mappedUsers);
      setShowIdentityDropdown(true);
      setIsManualEntry(false);

    } catch (err) {
      console.error("Error fetching identity suggestions:", err);
      setIdentitySuggestions([]);
      setShowIdentityDropdown(false);
      setIsManualEntry(true);
    }
  }

  function selectIdentity(user: any) {
    setValue("identity_number", user.identity_number);
    setValue("full_name", user.full_name);
    setValue("phone_number", user.phone_number);
    setValue("study_program_id", user.study_program_id);

    if (identityInputRef.current) identityInputRef.current.value = user.identity_number;
    if (fullNameInputRef.current) {
      fullNameInputRef.current.value = user.full_name;
      fullNameInputRef.current.disabled = true;
    }
    if (phoneInputRef.current) {
      phoneInputRef.current.value = user.phone_number;
      phoneInputRef.current.disabled = true;
    }

    setSelectedProgram(user.study_program);
    setShowIdentityDropdown(false);
    setIdentitySuggestions([]);
    setIsManualEntry(false);

    setTimeout(() => {
      fetchPendingBookings();
    }, 100);
  }

  function handleIdentityChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setValue("identity_number", value);

    if (value.length === 0) {
      setValue("full_name", "");
      setValue("phone_number", "");
      setValue("study_program_id", "");
      if (fullNameInputRef.current) {
        fullNameInputRef.current.value = "";
        fullNameInputRef.current.disabled = false;
      }
      if (phoneInputRef.current) {
        phoneInputRef.current.value = "";
        phoneInputRef.current.disabled = false;
      }
      setSelectedProgram(null);
      setIsManualEntry(false);
      setPendingBookings([]);
    } else {
      searchIdentity(value);
    }
  }

  // =====================================================
  // ROOM SELECTION HANDLERS
  // =====================================================

  function handleRoomSelect(room: Room) {
    const status = getOptimizedRoomStatus(room);
    if (!status.isAvailable) {
      alert.error(
        getText("This room is not available for the selected time", "Ruangan ini tidak tersedia untuk waktu yang dipilih"),
        ""
      );
      return;
    }

    setSelectedRoom(room);
    setValue("room_id", room.id);

    // Fetch mandatory equipment for this room
    fetchMandatoryEquipmentForRoom(room.id);

    // Clear optional equipment selection when room changes
    setSelectedOptionalEquipment(new Map());
  }

  function handleCourseSelect(course: LectureSchedule) {
    setSelectedCourse(course);

    const today = getLocalDateString();
    const startTime = `${today}T${course.start_time}`;
    const endTime = `${today}T${course.end_time}`;

    setValue("start_datetime", startTime);
    setValue("end_datetime", endTime);
    setValue("purpose", `${course.course_name} - ${course.class}`);

    const matchedRoom = rooms.find(room => {
      const roomNameLower = room.name.toLowerCase();
      const courseRoomLower = course.room.toLowerCase();

      // Multiple matching strategies
      return (
        roomNameLower.includes(courseRoomLower) ||
        courseRoomLower.includes(roomNameLower) ||
        roomNameLower.replace(/[^a-z0-9]/g, '') === courseRoomLower.replace(/[^a-z0-9]/g, '') ||
        (room.code && room.code.toLowerCase() === courseRoomLower)
      );
    });

    if (matchedRoom) {
      console.log('✅ Found matching room for course:', {
        courseRoom: course.room,
        matchedRoom: matchedRoom.name
      });

      setSelectedRoom(matchedRoom);
      setValue("room_id", matchedRoom.id);

      // Fetch equipment untuk ruangan yang cocok
      fetchMandatoryEquipmentForRoom(matchedRoom.id);
    } else {
      console.warn('❌ No matching room found for course:', {
        courseRoom: course.room,
        availableRooms: rooms.map(r => r.name)
      });

      // Reset state
      setSelectedRoom(null);
      setValue("room_id", "");
      setMandatoryEquipment([]);

      // Tampilkan warning
      alert.warning(
        getText(
          'Room not found automatically',
          'Ruangan tidak ditemukan secara otomatis'
        ),
        getText(
          `Room "${course.room}" is not in the system. Please contact administration.`,
          `Ruangan "${course.room}" tidak ada di sistem. Silakan hubungi administrasi.`
        )
      );
    }

    // Clear optional equipment selection
    setSelectedOptionalEquipment(new Map());
  }

  // =====================================================
  // ROOM TYPE HELPERS FOR SORTING
  // =====================================================

  function getRoomType(roomName: string): string {
    const name = roomName.toUpperCase();
    if (name.includes('GK')) return 'GK';
    if (name.includes('GLA')) return 'GLA';
    if (name.includes('LAB')) return 'Lab';
    if (name.includes('KULIAH') || name.includes('KELAS')) return 'Kuliah';
    return 'Other';
  }

  function getRoomTypePriority(roomType: string): number {
    const priorityMap: { [key: string]: number } = {
      'GK': 1,
      'GLA': 2,
      'Kuliah': 3,
      'Lab': 4,
      'Other': 5
    };
    return priorityMap[roomType] || 5;
  }

  // =====================================================
  // FILTERED AND SORTED ROOMS
  // =====================================================

  const filteredAndSortedRooms = useMemo(() => {
    let filtered = rooms;

    if (searchTerm && searchTerm.trim() !== '') {
      const searchLower = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(room => {
        const roomName = (room.name || '').toLowerCase();
        const roomCode = (room.code || '').toLowerCase();
        const deptName = (room.department?.name || '').toLowerCase();
        const building = (room.building || '').toLowerCase();

        return roomName.includes(searchLower) ||
          roomCode.includes(searchLower) ||
          deptName.includes(searchLower) ||
          building.includes(searchLower);
      });
    }

    if (activeTab === 'normal' && startDateTime && endDateTime) {
      filtered = filtered.filter(room => {
        const status = getOptimizedRoomStatus(room);
        return status.status === 'Available' || status.status === 'Scheduled';
      });

      filtered.sort((a, b) => {
        const statusA = getOptimizedRoomStatus(a);
        const statusB = getOptimizedRoomStatus(b);

        const statusPriority = { 'Available': 0, 'Scheduled': 1 };
        const statusDiff = (statusPriority[statusA.status as keyof typeof statusPriority] ?? 2) -
          (statusPriority[statusB.status as keyof typeof statusPriority] ?? 2);

        if (statusDiff !== 0) return statusDiff;

        const aType = getRoomType(a.name);
        const bType = getRoomType(b.name);
        const typeDiff = getRoomTypePriority(aType) - getRoomTypePriority(bType);

        if (typeDiff !== 0) return typeDiff;

        return (b.capacity ?? 0) - (a.capacity ?? 0);
      });
    } else {
      filtered.sort((a, b) => {
        return (a.name || '').localeCompare(b.name || '');
      });
    }

    return filtered;
  }, [rooms, searchTerm, startDateTime, endDateTime, activeTab]);

  const filteredCourses = useMemo(() => {
    if (!courseSearch) return todaySchedules;

    const searchLower = courseSearch.toLowerCase();
    return todaySchedules.filter(schedule =>
      schedule.course_name?.toLowerCase().includes(searchLower) ||
      schedule.course_code?.toLowerCase().includes(searchLower) ||
      schedule.lecturer?.toLowerCase().includes(searchLower) ||
      schedule.subject_study?.toLowerCase().includes(searchLower)
    );
  }, [todaySchedules, courseSearch]);

  // =====================================================
  // EFFECTS
  // =====================================================

  useEffect(() => {
    const initializeData = async () => {
      try {
        // 1. Fetch data yang diperlukan untuk semua tab
        await Promise.all([
          fetchStudyPrograms(),
          fetchTodayLectures(),
          fetchOptionalEquipment(),
        ]);

        // 2. Fetch rooms untuk hari ini (INITIAL LOAD)
        const todayDate = getLocalDateString();
        setTargetDate(todayDate);
        await fetchRooms(todayDate);


      } catch (error) {
        console.error('❌ Error initializing data:', error);
      }
    };

    initializeData();
  }, []); // Hanya dijalankan sekali saat mount



  useEffect(() => {
    fetchStudyPrograms();
    fetchTodayLectures();
    fetchOptionalEquipment(); // Fetch optional equipment on mount
  }, []);

  // useEffect(() => {
  //   if (activeTab === 'normal' && startDateTime) {
  //     const newDate = format(new Date(startDateTime), 'yyyy-MM-dd');
  //     setTargetDate(newDate);
  //     fetchRooms(newDate);

  //     if (selectedRoom) {
  //       setSelectedRoom(null);
  //       setValue("room_id", "");
  //       setMandatoryEquipment([]);
  //       setSelectedOptionalEquipment(new Map());
  //     }
  //   }
  // }, [startDateTime, activeTab]);

  useEffect(() => {
    if (activeTab === 'normal' && startDateTime) {
      const newDate = format(new Date(startDateTime), 'yyyy-MM-dd');
      setTargetDate(newDate);
      fetchRooms(newDate);

      if (selectedRoom) {
        setSelectedRoom(null);
        setValue("room_id", "");
        setMandatoryEquipment([]);
        setSelectedOptionalEquipment(new Map());
      }
    } else if (activeTab === 'course') {
      // Pastikan rooms sudah diload untuk tab course
      if (rooms.length === 0) {
        const todayDate = getLocalDateString();
        fetchRooms(todayDate);
      }
    }
  }, [startDateTime, activeTab]);

  useEffect(() => {
    if (activeTab === 'normal' && !startDateTime) {
      fetchRooms(targetDate);
    }
  }, [targetDate, activeTab]);

  useEffect(() => {
    if (scheduleModalRoom && targetDate) {
      fetchSchedulesForRoom(scheduleModalRoom.name, scheduleModalRoom.id, targetDate);
    }
  }, [scheduleModalRoom, targetDate]);

  // Auto-calculate end time when SKS is shown
  useEffect(() => {
    if (activeTab === 'normal' && showSKSField && startDateTime && sks && classType) {
      try {
        const start = new Date(startDateTime);
        if (!isNaN(start.getTime())) {
          const minutesPerSKS = classType === "theory" ? 50 : 170;
          const totalMinutes = sks * minutesPerSKS;
          const endTime = new Date(start.getTime() + totalMinutes * 60000);
          const formattedEndTime = format(endTime, "yyyy-MM-dd'T'HH:mm");
          setValue("end_datetime", formattedEndTime);
        }
      } catch (err) {
        console.error("Error calculating end time:", err);
      }
    }
  }, [startDateTime, sks, classType, setValue, activeTab, showSKSField]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowIdentityDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // =====================================================
  // BOOKING DURATION CALCULATION
  // =====================================================

  const bookingDuration = useMemo(() => {
    const s = getValues("start_datetime");
    const e = getValues("end_datetime");
    if (!s || !e) return null;
    try {
      const start = new Date(s);
      const end = new Date(e);
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return null;
      const minutes = differenceInMinutes(end, start);
      const hrs = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return { totalMinutes: minutes, totalHours: hrs, remainderMinutes: mins };
    } catch {
      return null;
    }
  }, [startDateTime, endDateTime]);

  // =====================================================
  // FORM SUBMISSION
  // =====================================================

  const onSubmit = async (data: FormValues) => {
    // Validation for 'Other' purpose
    if (data.purpose === 'Other' && (!data.attachments || data.attachments.length === 0)) {
      alert.error(
        getText("Please attach supporting documents for 'Other' purpose", "Silakan lampirkan dokumen pendukung untuk tujuan 'Lainnya'"),
        ""
      );
      return;
    }

    // Validate start and end times
    if (data.start_datetime && data.end_datetime) {
      const start = new Date(data.start_datetime);
      const end = new Date(data.end_datetime);

      if (end <= start) {
        alert.error(
          getText("End time must be after start time", "Waktu selesai harus setelah waktu mulai"),
          ""
        );
        return;
      }
    }

    if (activeTab === 'course' && !selectedCourse) {
      alert.error(getText("Please select a course first", "Pilih mata kuliah terlebih dahulu"), "");
      return;
    }

    if (activeTab === 'normal' && !selectedRoom) {
      alert.error(getText("Please select a room first", "Pilih ruangan terlebih dahulu"), "");
      return;
    }

    setLoading(true);
    try {
      let userId = null;
      let roomId = data.room_id;

      if (activeTab === 'course' && selectedCourse) {
        const matchedRoom = rooms.find(room =>
          room.name.toLowerCase().includes(selectedCourse.room.toLowerCase()) ||
          selectedCourse.room.toLowerCase().includes(room.name.toLowerCase())
        );
        if (!matchedRoom) {
          throw new Error(getText("Room for the course not found", "Ruangan untuk mata kuliah tidak ditemukan"));
        }
        roomId = matchedRoom.id;
      }

      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('identity_number', data.identity_number)
        .single();

      userId = existingUser?.id || null;

      // Convert local time to UTC
      const adjustToUTC = (dateStr: string) => {
        if (!dateStr) return null;
        const date = new Date(dateStr);
        return date.toISOString();
      };

      const startTimeISO = data.start_datetime ? adjustToUTC(data.start_datetime) : null;
      const endTimeISO = data.end_datetime ? adjustToUTC(data.end_datetime) : null;

      // Build equipment arrays
      const equipmentIds: string[] = [];
      const equipmentQuantities: number[] = [];

      // Add mandatory equipment first
      mandatoryEquipment.forEach(item => {
        equipmentIds.push(item.equipment.id);
        equipmentQuantities.push(item.quantity);
      });

      // Add selected optional equipment
      selectedOptionalEquipment.forEach((qty, id) => {
        equipmentIds.push(id);
        equipmentQuantities.push(qty);
      });

      const bookingData = {
        room_id: roomId,
        user_id: userId,
        start_time: startTimeISO,
        end_time: endTimeISO,
        purpose: data.purpose,
        sks: showSKSField ? data.sks : null,
        class_type: showSKSField ? data.class_type : null,
        status: 'pending',
        attachments: data.attachments || [],
        equipment_requested: equipmentIds,
        equipment_quantities: equipmentQuantities,
        user_info: {
          identity_number: data.identity_number,
          full_name: data.full_name,
          phone_number: data.phone_number,
          study_program_id: data.study_program_id
        }
      };



      const { error } = await supabase.from('bookings').insert(bookingData);
      if (error) throw error;

      // Get study program name for WhatsApp message
      const programName = studyPrograms.find(p => p.id === data.study_program_id)?.name || '-';
      const roomName = selectedRoom?.name || 'Unknown';
      const formattedDate = data.start_datetime ? format(new Date(data.start_datetime), 'dd MMMM yyyy') : '-';
      const formattedStart = data.start_datetime ? format(new Date(data.start_datetime), 'HH:mm') : '-';
      const formattedEnd = data.end_datetime ? format(new Date(data.end_datetime), 'HH:mm') : '-';

      // Store booking info for success modal
      setSubmittedBookingInfo({
        name: data.full_name || '-',
        studyProgram: programName,
        roomName: roomName,
        date: formattedDate,
        startTime: formattedStart,
        endTime: formattedEnd,
      });

      // Show success modal instead of alert
      setShowSuccessModal(true);

    } catch (err: any) {
      console.error("Booking error:", err);
      alert.error(err.message || getText("Failed to send booking", "Gagal mengirim pemesanan"), "");
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <main className="flex-1 overflow-auto bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-sm border-b border-white/20 sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-lg">
                  <Calendar className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    {getText('Smart Room Booking', 'Pemesanan Ruangan')}
                  </h1>
                  <p className="text-gray-600 mt-1">
                    {getText('Book a room from here', 'Pesan ruangan di halaman ini')}
                  </p>
                </div>
              </div>
              <div className="hidden md:block">
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-800">
                    {activeTab === 'course' ? filteredCourses.length : filteredAndSortedRooms.length}
                  </div>
                  <div className="text-sm text-gray-500">
                    {activeTab === 'course'
                      ? getText("Today's Courses", 'Mata Kuliah Hari Ini')
                      : getText('Available Rooms', 'Ruangan Tersedia')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Tabs */}
          <div className="bg-white rounded-xl shadow-lg border border-white/20 mb-6">
            <div className="flex border-b">
              <button
                type="button"
                onClick={() => setActiveTab('course')}
                className={`flex-1 px-6 py-4 text-center font-medium transition-all ${activeTab === 'course'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
              >
                <div className="flex items-center justify-center space-x-2">
                  <BookOpen className="h-5 w-5" />
                  <span>{getText("Same as SIAKAD Schedule", 'Sesuai Jadwal SIAKAD')}</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('normal')}
                className={`flex-1 px-6 py-4 text-center font-medium transition-all ${activeTab === 'normal'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
              >
                <div className="flex items-center justify-center space-x-2">
                  <CalendarIcon className="h-5 w-5" />
                  <span>{getText('Booking for a new schedule', 'Booking Diluar Jadwal')}</span>
                </div>
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit((data) => throttledSubmit(() => onSubmit(data)))}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column - Main Content */}
              <div className="lg:col-span-2 relative z-20">
                <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6 space-y-8">

                  {/* ==================== COURSE TAB ==================== */}
                  {activeTab === 'course' && (
                    <div>
                      <div className="flex items-center space-x-3 mb-6">
                        <BookOpen className="h-6 w-6 text-blue-600" />
                        <h2 className="text-xl font-bold text-gray-800">
                          {getText(`Select Today's Course (${getTodayDayName()})`, `Pilih Mata Kuliah Hari Ini (${getTodayDayName()})`)}
                        </h2>
                      </div>

                      {/* Course Search */}
                      <div className="mb-4">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <input
                            type="text"
                            placeholder={getText("Search course name, code, or lecturer...", "Cari nama mata kuliah, kode, atau dosen...")}
                            className="w-full pl-10 pr-4 py-2 bg-white/50 border border-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            value={courseSearch}
                            onChange={(e) => setCourseSearch(e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Selected Course Display */}
                      {selectedCourse && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-blue-800 font-medium">
                                {getText('Selected Course:', 'Mata Kuliah Dipilih:')} {selectedCourse.course_name}
                              </p>
                              <p className="text-xs text-blue-600 mt-1">
                                {selectedCourse.course_code} • {getText('Class', 'Kelas')} {selectedCourse.class} • {selectedCourse.room}
                              </p>
                              <p className="text-xs text-blue-600">
                                {getText('Time:', 'Jam:')} {selectedCourse.start_time} - {selectedCourse.end_time} •
                                {getText('Lecturer:', 'Dosen:')} {selectedCourse.lecturer || 'TBA'}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCourse(null);
                                setValue("start_datetime", "");
                                setValue("end_datetime", "");
                                setValue("purpose", "");
                                setSelectedRoom(null);
                                setValue("room_id", "");
                                setMandatoryEquipment([]);
                                setSelectedOptionalEquipment(new Map());
                              }}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              <X className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Course List */}
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {loadingCourses || loadingRooms ? (
                          <div className="text-center py-8">
                            <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
                            <p className="text-gray-600">{getText('Loading course schedule...', 'Memuat jadwal kuliah...')}</p>
                          </div>
                        ) : filteredCourses.length === 0 ? (
                          <div className="text-center py-8">
                            <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-600">
                              {courseSearch
                                ? getText('No courses match your search', 'Tidak ada mata kuliah yang cocok dengan pencarian')
                                : getText('No courses today', 'Tidak ada mata kuliah hari ini')}
                            </p>
                          </div>
                        ) : (
                          filteredCourses.map((course) => {
                            const isSelected = selectedCourse?.id === course.id;
                            return (
                              <div
                                key={course.id}
                                className={`p-4 rounded-lg border-2 transition-all duration-200 ${isSelected
                                  ? "border-blue-500 bg-blue-50"
                                  : "cursor-pointer hover:shadow-md hover:border-blue-300 border-gray-200 bg-white/50"
                                  }`}
                                onClick={() => handleCourseSelect(course)}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <h4 className="font-semibold text-gray-900">{course.course_name}</h4>
                                    <p className="text-sm text-gray-600 mt-1">
                                      {course.course_code} • {getText('Class', 'Kelas')} {course.class}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                      {course.subject_study} • {getText('Semester', 'Semester')} {course.semester}
                                    </p>
                                    <div className="flex items-center space-x-4 mt-2 text-sm">
                                      <div className="flex items-center space-x-1">
                                        <Clock className="h-4 w-4 text-gray-400" />
                                        <span className="text-gray-600">
                                          {course.start_time?.substring(0, 5)} - {course.end_time?.substring(0, 5)}
                                        </span>
                                      </div>
                                      <div className="flex items-center space-x-1">
                                        <Building className="h-4 w-4 text-gray-400" />
                                        <span className="text-gray-600">{course.room}</span>
                                      </div>
                                    </div>
                                    {course.lecturer && (
                                      <p className="text-sm text-gray-500 mt-1">
                                        {getText('Lecturer:', 'Dosen:')} {course.lecturer}
                                      </p>
                                    )}
                                  </div>
                                  {isSelected && (
                                    <div className="ml-2">
                                      <CheckCircle className="h-6 w-6 text-blue-600" />
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-center space-x-2 text-sm text-yellow-800">
                          <AlertCircle className="h-4 w-4" />
                          <span>{getText("Booking only for today's courses. Room will be automatically selected according to the schedule.", "Booking hanya untuk mata kuliah hari ini. Ruangan akan otomatis dipilih sesuai jadwal.")}</span>
                        </div>
                      </div>

                      {/* Equipment Section for Course Tab */}
                      {selectedCourse && selectedRoom && (
                        <EquipmentSelectionSection
                          mandatoryEquipment={mandatoryEquipment}
                          optionalEquipment={optionalEquipment}
                          selectedOptionalEquipment={selectedOptionalEquipment}
                          onOptionalEquipmentChange={handleOptionalEquipmentChange}
                          getText={getText}
                          selectedRoom={selectedRoom}
                        />
                      )}
                    </div>
                  )}

                  {/* ==================== NORMAL BOOKING TAB ==================== */}
                  {activeTab === 'normal' && (
                    <>
                      {/* Booking Details Section */}
                      <div>
                        <div className="flex items-center space-x-3 mb-6">
                          <Calendar className="h-6 w-6 text-blue-600" />
                          <h2 className="text-xl font-bold text-gray-800">{getText('Booking Details', 'Detail Pemesanan')}</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Start DateTime */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              {getText('Date & Start Time', 'Tanggal & Waktu Mulai')} *
                            </label>
                            <button
                              type="button"
                              onClick={() => setShowStartDatePicker(true)}
                              className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-between"
                            >
                              <div className="flex items-center space-x-2">
                                <CalendarIcon className="h-4 w-4 text-gray-500" />
                                <span className="text-gray-700">{formatDateTime(startDateTime)}</span>
                              </div>
                              <ChevronDown className="h-4 w-4 text-gray-400" />
                            </button>
                          </div>

                          {/* End DateTime */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              {getText('Date & End Time', 'Tanggal & Waktu Selesai')} *
                            </label>
                            <button
                              type="button"
                              onClick={() => setShowEndDatePicker(true)}
                              className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-between"
                            >
                              <div className="flex items-center space-x-2">
                                <CalendarIcon className="h-4 w-4 text-gray-500" />
                                <span className="text-gray-700">{formatDateTime(endDateTime)}</span>
                              </div>
                              <ChevronDown className="h-4 w-4 text-gray-400" />
                            </button>
                          </div>

                          {/* SKS Toggle */}
                          <div className="md:col-span-2">
                            <button
                              type="button"
                              onClick={() => setShowSKSField(!showSKSField)}
                              className="flex items-center space-x-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                            >
                              <Settings className="h-4 w-4" />
                              <span className="text-sm font-medium">
                                {showSKSField
                                  ? getText('Hide SKS Settings', 'Sembunyikan Pengaturan SKS')
                                  : getText('Show SKS Settings (Optional)', 'Tampilkan Pengaturan SKS (Opsional)')}
                              </span>
                              {showSKSField ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                          </div>

                          {/* SKS Fields */}
                          {showSKSField && (
                            <>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  {getText('SKS (Credits)', 'SKS (Kredit)')} *
                                </label>
                                <select
                                  {...register("sks" as any)}
                                  className="w-full px-3 py-2 bg-white/50 border border-gray-200/50 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                >
                                  {[1, 2, 3, 4, 5, 6].map(n => (
                                    <option key={n} value={n}>{n} SKS</option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  {getText('Class Type', 'Tipe Kelas')} *
                                </label>
                                <select
                                  {...register("class_type" as any)}
                                  className="w-full px-3 py-2 bg-white/50 border border-gray-200/50 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                >
                                  <option value="theory">{getText('Theory (50 minutes/SKS)', 'Teori (50 menit/SKS)')}</option>
                                  <option value="practical">{getText('Practical (170 minutes/SKS)', 'Praktik (170 menit/SKS)')}</option>
                                </select>
                              </div>
                            </>
                          )}

                          {/* Purpose */}
                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              {getText('Purpose', 'Tujuan')} *
                            </label>
                            <select
                              {...register("purpose" as any)}
                              className="w-full px-3 py-2 bg-white/50 border border-gray-200/50 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            >
                              <option value="Class/Lecture">{getText('Lecture', 'Kuliah')}</option>
                              <option value="Other">{getText('Other', 'Lainnya')}</option>
                            </select>
                          </div>

                          {/* File Upload for "Other" purpose */}
                          {watchPurpose === 'Other' && (
                            <div className="md:col-span-2">
                              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-4">
                                <div className="flex items-center space-x-2">
                                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                                  <h3 className="font-medium text-yellow-900">
                                    {getText('Supporting Documents Required', 'Dokumen Pendukung Diperlukan')}
                                  </h3>
                                </div>

                                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                                  <input
                                    type="file"
                                    multiple
                                    accept="image/*,.pdf"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                    id="file-upload"
                                  />
                                  <label htmlFor="file-upload" className="cursor-pointer">
                                    <span className="text-sm font-medium text-blue-600 hover:text-blue-700">
                                      {getText('Upload Files', 'Unggah File')}
                                    </span>
                                  </label>
                                  <p className="text-xs text-gray-500 mt-1">
                                    {getText('PDF, JPG, PNG up to 10MB', 'PDF, JPG, PNG hingga 10MB')}
                                  </p>
                                </div>

                                {watchAttachments && watchAttachments.length > 0 && (
                                  <div className="space-y-2">
                                    {watchAttachments.map((attachment, index) => (
                                      <div key={index} className="flex items-center justify-between p-2 bg-white rounded border">
                                        <div className="flex items-center space-x-2">
                                          {getFileTypeIcon(attachment)}
                                          <span className="text-sm">{getFileName(attachment, index)}</span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => removeAttachment(index)}
                                          className="text-red-600 hover:text-red-800"
                                        >
                                          <X className="h-4 w-4" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Selected Day Info */}
                        {startDateTime && (
                          <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                            <div className="flex items-center space-x-2 text-sm text-purple-800">
                              <Calendar className="h-4 w-4" />
                              <span>
                                {getText('Selected Day:', 'Hari Dipilih:')} <strong>{getDayName(startDateTime)}</strong>, {format(new Date(startDateTime), 'dd MMMM yyyy')}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Info about filtering */}
                        {startDateTime && endDateTime && (
                          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center space-x-2 text-sm text-blue-800">
                              <Info className="h-4 w-4" />
                              <span>
                                {getText(
                                  'Showing rooms that are Available or Scheduled (no time conflict). Rooms with conflicts are hidden.',
                                  'Menampilkan ruangan yang Tersedia atau Terjadwal (tidak bentrok waktu). Ruangan yang bentrok disembunyikan.'
                                )}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Duration Display */}
                        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-center space-x-2 text-sm text-green-800">
                            <Clock className="h-4 w-4" />
                            <span className="font-medium">
                              {getText('Duration:', 'Durasi:')} {bookingDuration?.totalHours ? `${bookingDuration.totalHours} ${getText('hours', 'jam')} ${bookingDuration.remainderMinutes} ${getText('minutes', 'menit')}` : '-'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Room Selection Section */}
                      <div className="border-t border-gray-200/50 pt-8">
                        <div className="flex items-center space-x-3 mb-6">
                          <Building className="h-6 w-6 text-green-600" />
                          <h2 className="text-xl font-bold text-gray-800">{getText('Select Room', 'Pilih Ruangan')}</h2>
                          {startDateTime && endDateTime && (
                            <span className="bg-green-100 text-green-800 text-sm px-3 py-1 rounded-full font-medium">
                              {filteredAndSortedRooms.length} {getText('rooms shown', 'ruangan ditampilkan')}
                            </span>
                          )}
                        </div>

                        {/* Selected Room Display */}
                        {selectedRoom && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm text-blue-800 font-medium">
                                  {getText('Selected Room:', 'Ruangan Dipilih:')} {selectedRoom.name} ({selectedRoom.code})
                                </p>
                                <p className="text-xs text-blue-600">
                                  {getText('Capacity:', 'Kapasitas:')} {selectedRoom.capacity} {getText('seats', 'kursi')}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedRoom(null);
                                  setValue("room_id", "");
                                  setMandatoryEquipment([]);
                                  setSelectedOptionalEquipment(new Map());
                                }}
                                className="text-blue-600 hover:text-blue-800"
                              >
                                <X className="h-5 w-5" />
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Warning if no room selected */}
                        {!selectedRoom && startDateTime && endDateTime && (
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                            <div className="flex items-center space-x-2">
                              <AlertTriangle className="h-5 w-5 text-amber-600" />
                              <p className="text-sm text-amber-800 font-medium">
                                {getText('Please select a room to continue', 'Silakan pilih ruangan untuk melanjutkan')}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Prompt to select time first */}
                        {(!startDateTime || !endDateTime) ? (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                            <CalendarIcon className="h-12 w-12 text-yellow-600 mx-auto mb-3" />
                            <p className="text-yellow-800 font-medium">
                              {getText('Please select date and time first', 'Silakan pilih tanggal dan waktu terlebih dahulu')}
                            </p>
                            <p className="text-yellow-600 text-sm mt-2">
                              {getText('Rooms will be displayed after you set the booking time', 'Ruangan akan ditampilkan setelah Anda mengatur waktu pemesanan')}
                            </p>
                          </div>
                        ) : (
                          <>
                            {/* Room Search */}
                            <div className="relative mb-4">
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                  type="text"
                                  placeholder={getText("Search room (name, code, or building)...", "Cari ruangan (nama, kode, atau gedung)...")}
                                  className="w-full pl-10 pr-4 py-2 bg-white/50 border border-gray-200/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                  value={searchTerm}
                                  onChange={(e) => setSearchTerm(e.target.value)}
                                />
                              </div>
                            </div>

                            {/* Room List */}
                            <div className="space-y-3 max-h-80 overflow-y-auto">
                              {loadingRooms ? (
                                <div className="text-center py-8">
                                  <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
                                  <p className="text-gray-600">{getText('Loading rooms...', 'Memuat ruangan...')}</p>
                                </div>
                              ) : filteredAndSortedRooms.length === 0 ? (
                                <div className="text-center py-8">
                                  <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                  <p className="text-gray-600">
                                    {getText('No available rooms for the selected time', 'Tidak ada ruangan tersedia untuk waktu yang dipilih')}
                                  </p>
                                  <p className="text-sm text-gray-500 mt-2">
                                    {getText('All rooms have schedule conflicts. Try selecting a different time.', 'Semua ruangan bentrok jadwal. Coba pilih waktu yang berbeda.')}
                                  </p>
                                </div>
                              ) : (
                                filteredAndSortedRooms.map((room) => {
                                  const status = getOptimizedRoomStatus(room);
                                  const isSelected = selectedRoom?.id === room.id;

                                  return (
                                    <div
                                      key={room.id}
                                      className={`p-4 rounded-lg border-2 transition-all duration-200 cursor-pointer ${isSelected
                                        ? "border-blue-500 bg-blue-50"
                                        : "hover:shadow-md hover:border-blue-300 border-gray-200 bg-white/50"
                                        }`}
                                      onClick={() => handleRoomSelect(room)}
                                    >
                                      <div className="flex items-center justify-between mb-2">
                                        <div>
                                          <h4 className="font-semibold text-gray-900">{room.name}</h4>
                                          <p className="text-sm text-gray-600">
                                            {room.code ? `${getText('Code:', 'Kode:')} ${room.code}` : ''}
                                            {room.department?.name ? ` • ${room.department.name}` : ''}
                                          </p>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${status.color}`}>
                                          {status.status === 'Available'
                                            ? getText('Available', 'Tersedia')
                                            : getText('Scheduled', 'Terjadwal')}
                                        </span>
                                      </div>

                                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                                        <div className="flex items-center space-x-1">
                                          <Users className="h-4 w-4" />
                                          <span>{room.capacity ?? 0} {getText('seats', 'kursi')}</span>
                                        </div>
                                        <div className="flex items-center space-x-1">
                                          <Building className="h-4 w-4" />
                                          <span>{room.department?.name || getText('General', 'Umum')}</span>
                                        </div>
                                        {status.hasSchedule && (
                                          <button
                                            type="button"
                                            className="text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setScheduleModalRoom(room);
                                              setShowScheduleModal(true);
                                            }}
                                            title={getText("View Schedule", "Lihat Jadwal")}
                                          >
                                            <Eye className="h-4 w-4" />
                                            <span className="text-xs">{getText('View Schedule', 'Lihat Jadwal')}</span>
                                          </button>
                                        )}
                                        {/* Room Details Button */}
                                        <button
                                          type="button"
                                          className="text-emerald-600 hover:text-emerald-800 flex items-center space-x-1"
                                          onClick={async (e) => {
                                            e.stopPropagation();

                                            // Show modal immediately with basic data
                                            setSelectedRoomDetail(room);
                                            setSelectedRoomBuilding(null);
                                            setShowRoomDetailModal(true);
                                            setLoadingRoomDetail(true);

                                            try {
                                              // Fetch room details in background
                                              const { data: roomData, error: roomError } = await supabase
                                                .from('rooms')
                                                .select('id, name, code, capacity, is_available, attachments, floor, building_id')
                                                .eq('id', room.id)
                                                .single();

                                              if (roomError) {
                                                console.error('Error fetching room:', roomError);
                                                setLoadingRoomDetail(false);
                                                return;
                                              }

                                              // Fetch tables count and building in parallel
                                              const [tablesResult, buildingResult] = await Promise.all([
                                                supabase
                                                  .from('tables')
                                                  .select('id', { count: 'exact', head: true })
                                                  .eq('room_id', room.id),
                                                roomData?.building_id
                                                  ? supabase
                                                    .from('building')
                                                    .select('name')
                                                    .eq('id', roomData.building_id)
                                                    .single()
                                                  : Promise.resolve({ data: null })
                                              ]);

                                              setSelectedRoomDetail({
                                                ...room,
                                                attachments: roomData?.attachments || null,
                                                floor: roomData?.floor || null,
                                                building_id: roomData?.building_id || null,
                                                tables: tablesResult.count ? Array(tablesResult.count).fill({}) : []
                                              });
                                              setSelectedRoomBuilding(buildingResult.data);
                                            } catch (err) {
                                              console.error('Error in room details:', err);
                                            } finally {
                                              setLoadingRoomDetail(false);
                                            }
                                          }}
                                          title={getText("Room Details", "Detail Ruangan")}
                                        >
                                          <DoorOpen className="h-4 w-4" />
                                          <span className="text-xs">{getText('Room Details', 'Detail Ruangan')}</span>
                                        </button>
                                      </div>

                                      {/* Show info for Scheduled rooms */}
                                      {status.status === 'Scheduled' && (
                                        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                                          <p className="text-xs text-yellow-800">
                                            <Info className="h-3 w-3 inline mr-1" />
                                            {getText('Has other schedules today but no conflict with your selected time', 'Ada jadwal lain hari ini tapi tidak bentrok dengan waktu yang Anda pilih')}
                                          </p>
                                        </div>
                                      )}

                                      {isSelected && (
                                        <div className="mt-2 p-2 bg-blue-100 border border-blue-300 rounded">
                                          <p className="text-xs text-blue-800 font-medium">
                                            ✓ {getText('Room selected', 'Ruangan dipilih')}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Equipment Section for Normal Tab */}
                      {selectedRoom && (
                        <EquipmentSelectionSection
                          mandatoryEquipment={mandatoryEquipment}
                          optionalEquipment={optionalEquipment}
                          selectedOptionalEquipment={selectedOptionalEquipment}
                          onOptionalEquipmentChange={handleOptionalEquipmentChange}
                          getText={getText}
                          selectedRoom={selectedRoom}
                        />
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Right Column - Personal Info & Submit */}
              <div className="lg:col-span-1 relative z-10">
                <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6 space-y-6">
                  {/* Personal Information */}
                  <div>
                    <div className="flex items-center space-x-3 mb-6">
                      <User className="h-6 w-6 text-purple-600" />
                      <h2 className="text-xl font-bold text-gray-800">{getText('Personal Information', 'Informasi Pribadi')}</h2>
                    </div>

                    <div className="space-y-4">
                      {/* Identity Number */}
                      <div className="relative" ref={dropdownRef}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {getText('Identity Number (NIM/NIP)', 'Nomor Identitas (NIM/NIP)')} *
                        </label>
                        <input
                          ref={identityInputRef}
                          type="text"
                          defaultValue=""
                          onChange={handleIdentityChange}
                          placeholder={getText("Enter your ID", "Masukkan ID Anda")}
                          autoComplete="off"
                          className="w-full px-3 py-2 bg-white/50 border border-gray-200/50 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />

                        {showIdentityDropdown && identitySuggestions.length > 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            {identitySuggestions.map((user, idx) => (
                              <div
                                key={idx}
                                onClick={() => selectIdentity(user)}
                                className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                              >
                                <div className="font-medium text-gray-900">{user.full_name}</div>
                                <div className="text-sm text-gray-600">{user.identity_number}</div>
                                <div className="text-xs text-gray-500">{user.study_program}</div>
                              </div>
                            ))}
                          </div>
                        )}

                        {isManualEntry && (
                          <p className="mt-1 text-xs text-blue-600">
                            {getText('Data not found. Please fill manually.', 'Data tidak ditemukan. Silakan isi manual.')}
                          </p>
                        )}
                      </div>

                      {/* Full Name */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {getText('Full Name', 'Nama Lengkap')} *
                        </label>
                        <input
                          ref={fullNameInputRef}
                          type="text"
                          defaultValue=""
                          onChange={(e) => setValue("full_name", e.target.value)}
                          placeholder={getText("Enter your full name", "Masukkan nama lengkap")}
                          className="w-full px-3 py-2 bg-white/50 border border-gray-200/50 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                      </div>

                      {/* Phone Number */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {getText('Phone Number', 'Nomor Telepon')} *
                        </label>
                        <input
                          ref={phoneInputRef}
                          type="tel"
                          defaultValue=""
                          onChange={(e) => setValue("phone_number", e.target.value)}
                          placeholder="08xxxxxxxxxx"
                          className="w-full px-3 py-2 bg-white/50 border border-gray-200/50 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                      </div>

                      {/* Study Program */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {getText('Study Program', 'Program Studi')} *
                        </label>
                        {isManualEntry ? (
                          <select
                            onChange={(e) => setValue("study_program_id", e.target.value)}
                            className="w-full px-3 py-2 bg-white/50 border border-gray-200/50 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                          >
                            <option value="">{getText('Select Study Program', 'Pilih Program Studi')}</option>
                            {studyPrograms.map((program) => (
                              <option key={program.id} value={program.id}>
                                {program.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            readOnly
                            value={selectedProgram || ""}
                            placeholder={getText("Study program will be filled automatically", "Program studi akan terisi otomatis")}
                            className="w-full px-3 py-2 bg-gray-100 border border-gray-200/50 rounded-lg shadow-sm cursor-not-allowed"
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Pending Bookings */}
                  {getValues("identity_number") && (
                    <div className="border-t border-gray-200/50 pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setShowPendingBookings(!showPendingBookings);
                          if (!showPendingBookings) {
                            fetchPendingBookings();
                          }
                        }}
                        className="w-full flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg hover:bg-yellow-100 transition-colors"
                      >
                        <div className="flex items-center space-x-2">
                          <ClipboardList className="h-5 w-5 text-yellow-600" />
                          <span className="text-sm font-medium text-yellow-800">
                            {getText('View your bookings', 'Lihat Status Booking Anda ')}
                          </span>
                        </div>
                        {showPendingBookings ? <ChevronUp className="h-4 w-4 text-yellow-600" /> : <ChevronDown className="h-4 w-4 text-yellow-600" />}
                      </button>

                      {showPendingBookings && (
                        <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                          {loadingPendingBookings ? (
                            <div className="text-center py-4">
                              <Loader2 className="h-6 w-6 animate-spin text-gray-400 mx-auto" />
                            </div>
                          ) : pendingBookings.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-4">
                              {getText('You have not made any bookings', 'Anda belum melakukan pemesanan')}
                            </p>
                          ) : (
                            pendingBookings.map((booking: any) => (
                              <div key={booking.id} className="p-3 bg-white border border-gray-200 rounded-lg">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-sm font-medium text-gray-800">
                                    {booking.rooms?.name || getText('Room', 'Ruangan')}
                                  </p>
                                  <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                                    PENDING
                                  </span>
                                </div>
                                <p className="text-xs text-gray-600">
                                  {format(new Date(booking.start_time), 'dd/MM/yyyy HH:mm')} -
                                  {format(new Date(booking.end_time), 'HH:mm')}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">{booking.purpose}</p>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Submit Button */}
                  <div className="border-t border-gray-200/50 pt-6">
                    <button
                      type="submit"
                      disabled={
                        loading || isThrottling ||
                        (activeTab === 'course' && !selectedCourse) ||
                        (activeTab === 'normal' && !selectedRoom) ||
                        (watchPurpose === 'Other' && (!watchAttachments || watchAttachments.length === 0))
                      }
                      className={`w-full flex items-center justify-center space-x-2 py-3 px-4 font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 shadow-lg
                        ${loading || isThrottling
                          ? 'bg-gray-400 cursor-not-allowed opacity-50'
                          : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700'
                        }`}
                    >
                      {loading || isThrottling ? (
                        <>
                          <RefreshCw className="h-5 w-5 animate-spin" />
                          <span>{getText('Sending...', 'Mengirim...')}</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-5 w-5" />
                          <span>{getText('Submit Booking', 'Kirim Pemesanan')}</span>
                        </>
                      )}
                    </button>

                    {/* Notice */}
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start space-x-3">
                        <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div className="text-sm text-blue-800">
                          <p className="font-semibold mb-2">{getText('Notice', 'Perhatian')}</p>
                          <ul className="space-y-1 text-xs">
                            <li>• {getText('Leave your ID card like KTP/Student Card to Admin', 'Tinggalkan Kartu Identitas seperti KTP/KTM ke Admin')}</li>
                            <li>• {getText('Follow existing procedures', 'Ikuti Prosedur yang sudah ada')}</li>
                            <li>• {getText('Book before taking the room key', 'Lakukan Booking Sebelum Mengambil Kunci Ruangan')}</li>
                            <li>• {getText('Equipment will be reserved when approved', 'Peralatan akan direservasi saat disetujui')}</li>
                          </ul>
                          <div className="mt-3 pt-3 border-t border-blue-300">
                            <button
                              type="button"
                              onClick={() => window.open('https://wa.me/6285869554147', '_blank')}
                              className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-colors shadow-sm"
                            >
                              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                              </svg>
                              <span>{getText('Contact: 085869554147', 'Hubungi: 085869554147')}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* DateTime Picker Modals */}
        <DateTimePickerModal
          isOpen={showStartDatePicker}
          onClose={() => setShowStartDatePicker(false)}
          onSelect={(datetime) => {
            setValue("start_datetime", datetime);
            if (endDateTime) {
              const end = new Date(endDateTime);
              const start = new Date(datetime);
              if (end <= start) {
                setValue("end_datetime", "");
              }
            }
          }}
          value={startDateTime}
          label={getText('Select Start Date & Time', 'Pilih Tanggal & Waktu Mulai')}
        />

        <DateTimePickerModal
          isOpen={showEndDatePicker}
          onClose={() => setShowEndDatePicker(false)}
          onSelect={(datetime) => setValue("end_datetime", datetime)}
          value={endDateTime}
          minDateTime={startDateTime}
          isEndTime={true}
          label={getText('Select End Date & Time', 'Pilih Tanggal & Waktu Selesai')}
        />

        {/* Schedule Modal */}
        {showScheduleModal && scheduleModalRoom && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white p-5 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                    <Building className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{scheduleModalRoom.name}</h3>
                    <p className="text-blue-100 text-sm">
                      {getText('Schedule for', 'Jadwal untuk')} {getDayName(targetDate)}, {format(new Date(targetDate), 'dd MMM yyyy')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto flex-1">
                {loadingSchedules ? (
                  <div className="flex justify-center items-center h-48">
                    <RefreshCw className="animate-spin h-8 w-8 text-blue-500" />
                  </div>
                ) : combinedSchedules.length > 0 ? (
                  <div className="space-y-4">
                    {combinedSchedules.map((schedule, index) => {
                      const IconComponent = schedule.icon;
                      return (
                        <div
                          key={`${schedule.type}-${schedule.id}-${index}`}
                          className={`${schedule.bgColor} rounded-lg p-4 border-2 ${schedule.borderColor}`}
                        >
                          <div className="flex items-start space-x-3">
                            <div className="p-2 bg-white rounded-lg shadow-sm flex-shrink-0">
                              <IconComponent className={`h-5 w-5 ${schedule.color}`} />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <span className={`text-xs font-bold ${schedule.color} bg-white px-2 py-1 rounded-full uppercase`}>
                                  {schedule.type === 'lecture' ? getText('Lecture', 'Kuliah') :
                                    schedule.type === 'exam' ? getText('Exam', 'UAS') :
                                      schedule.type === 'session' ? getText('Session', 'Sidang') :
                                        getText('Booking', 'Booking')}
                                </span>
                                <span className="font-bold text-gray-800">
                                  {schedule.end_time ? `${schedule.start_time} - ${schedule.end_time}` : schedule.start_time}
                                </span>
                              </div>
                              <div className="font-semibold text-gray-900">{schedule.title}</div>
                              {schedule.subtitle && (
                                <div className={`text-sm ${schedule.color} font-medium`}>{schedule.subtitle}</div>
                              )}
                              {schedule.description && (
                                <div className="text-sm text-gray-600">{schedule.description}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-16 text-gray-500">
                    <CalendarIcon className="h-16 w-16 mx-auto mb-4 opacity-40" />
                    <p className="text-lg font-semibold mb-2">{getText('No schedule', 'Tidak ada jadwal')}</p>
                    <p className="text-sm">
                      {getText('This room has no activities scheduled for this date', 'Ruangan ini tidak memiliki aktivitas terjadwal untuk tanggal ini')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Room Detail Modal */}
        {showRoomDetailModal && selectedRoomDetail && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
                <div className="flex items-center gap-2">
                  <DoorOpen className="h-5 w-5" />
                  <h3 className="font-bold text-lg">{getText('Room Details', 'Detail Ruangan')}</h3>
                </div>
                <button
                  onClick={() => {
                    setShowRoomDetailModal(false);
                    setSelectedRoomDetail(null);
                    setSelectedRoomBuilding(null);
                  }}
                  className="text-white/70 hover:text-white p-1 hover:bg-white/10 rounded"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 space-y-6 overflow-y-auto">
                {/* Room Photo */}
                {loadingRoomDetail ? (
                  <div className="relative rounded-xl overflow-hidden shadow-lg h-48 bg-gradient-to-br from-emerald-50 to-teal-50">
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                      <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-3 animate-pulse">
                        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                      </div>
                      <h4 className="font-bold text-lg text-gray-800 animate-pulse">{selectedRoomDetail.name}</h4>
                      {selectedRoomDetail.code && <p className="text-sm text-gray-500 mb-2 animate-pulse">{selectedRoomDetail.code}</p>}
                      <p className="text-xs text-emerald-600 font-medium animate-pulse">{getText('Loading photo...', 'Memuat foto...')}</p>
                    </div>
                  </div>
                ) : selectedRoomDetail.attachments ? (
                  <div className="relative rounded-xl overflow-hidden shadow-lg">
                    <ImageWithLoader
                      src={selectedRoomDetail.attachments}
                      alt={selectedRoomDetail.name}
                      className="w-full h-48 object-cover"
                      title={selectedRoomDetail.name}
                      subtitle={selectedRoomDetail.code}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                    <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                      <div>
                        <h4 className="text-white font-bold text-xl drop-shadow-lg">{selectedRoomDetail.name}</h4>
                        {selectedRoomDetail.code && <p className="text-white/90 text-sm drop-shadow-md">{selectedRoomDetail.code}</p>}
                      </div>
                      <button
                        onClick={() => setFullscreenPhoto(selectedRoomDetail.attachments || null)}
                        className="p-2 bg-white/20 hover:bg-white/40 backdrop-blur-sm rounded-lg text-white transition-all shadow-lg"
                        title={getText('View Full Image', 'Lihat Gambar Penuh')}
                      >
                        <Maximize2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-6 text-center border border-emerald-100">
                    <div className="w-16 h-16 mx-auto bg-emerald-100 rounded-full flex items-center justify-center mb-3">
                      <DoorOpen className="h-8 w-8 text-emerald-500" />
                    </div>
                    <h4 className="font-bold text-xl text-gray-800">{selectedRoomDetail.name}</h4>
                    {selectedRoomDetail.code && <p className="text-gray-500 text-sm">{selectedRoomDetail.code}</p>}
                    <p className="text-xs text-emerald-500 mt-2 italic">{getText('No photo available', 'Tidak ada foto')}</p>
                  </div>
                )}

                {/* Location */}
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">{getText('Location', 'Lokasi')}</span>
                  </div>
                  <p className="text-gray-800 font-semibold">
                    {selectedRoomBuilding?.name || getText('General Building', 'Gedung Umum')} • Lt. {selectedRoomDetail.floor || '-'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {getText('Department:', 'Departemen:')} {selectedRoomDetail.department?.name || getText('General', 'Umum')}
                  </p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                    <div className="flex items-center gap-2 text-blue-600 mb-1">
                      <Users className="h-4 w-4" />
                      <span className="text-xs font-medium uppercase">{getText('Capacity', 'Kapasitas')}</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-700">{selectedRoomDetail.capacity || 0}</p>
                  </div>
                  <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
                    <div className="flex items-center gap-2 text-orange-600 mb-1">
                      <Table2 className="h-4 w-4" />
                      <span className="text-xs font-medium uppercase">{getText('Cabinets', 'Kabinet')}</span>
                    </div>
                    <p className="text-2xl font-bold text-orange-700">{selectedRoomDetail.tables?.length || 0}</p>
                  </div>
                </div>

                {/* Availability Status */}
                <div className={`rounded-xl p-4 border flex items-center gap-3 ${selectedRoomDetail.is_available
                  ? 'bg-green-50 border-green-200'
                  : 'bg-gray-50 border-gray-200'
                  }`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${selectedRoomDetail.is_available ? 'bg-green-100' : 'bg-gray-200'
                    }`}>
                    <CheckCircle className={`h-5 w-5 ${selectedRoomDetail.is_available ? 'text-green-600' : 'text-gray-400'
                      }`} />
                  </div>
                  <div>
                    <p className={`font-semibold ${selectedRoomDetail.is_available ? 'text-green-700' : 'text-gray-700'
                      }`}>
                      {selectedRoomDetail.is_available
                        ? getText('Available', 'Tersedia')
                        : getText('Unavailable', 'Tidak Tersedia')}
                    </p>
                    <p className={`text-sm ${selectedRoomDetail.is_available ? 'text-green-600' : 'text-gray-500'
                      }`}>
                      {selectedRoomDetail.is_available
                        ? getText('Room can be booked', 'Ruangan dapat dipesan')
                        : getText('Room is currently unavailable', 'Ruangan sedang tidak tersedia')}
                    </p>
                  </div>
                </div>


              </div>

              {/* Footer */}
              <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                <button
                  onClick={() => {
                    setShowRoomDetailModal(false);
                    setSelectedRoomDetail(null);
                    setSelectedRoomBuilding(null);
                  }}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium rounded-xl hover:from-emerald-600 hover:to-teal-600 shadow-lg transition-all"
                >
                  {getText('Close', 'Tutup')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Fullscreen Photo Preview Modal */}
        {fullscreenPhoto && (
          <div
            className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200 cursor-zoom-out"
            onClick={() => setFullscreenPhoto(null)}
          >
            <button
              onClick={() => setFullscreenPhoto(null)}
              className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full text-white transition-all"
              title={getText('Close', 'Tutup')}
            >
              <X className="h-6 w-6" />
            </button>
            <img
              src={fullscreenPhoto}
              alt="Fullscreen preview"
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

        {/* Booking Success Modal */}
        {showSuccessModal && submittedBookingInfo && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center animate-in fade-in zoom-in duration-300">
              {/* Success Icon */}
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full mb-6 shadow-lg">
                <CheckCircle className="h-10 w-10 text-white" />
              </div>

              {/* Title */}
              <h2 className="text-2xl font-bold text-gray-800 mb-3">
                {getText('Booking Request Submitted!', 'Pemesanan Berhasil Dikirim!')}
              </h2>

              {/* Message */}
              <p className="text-gray-600 mb-6">
                {getText(
                  'Your room booking request has been submitted successfully. Please wait for approval from the administrator.',
                  'Permintaan pemesanan ruangan Anda telah berhasil dikirim. Silakan tunggu persetujuan dari administrator.'
                )}
              </p>

              {/* Info Box - Important Notes */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-left">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-medium mb-2">{getText('Important Notes:', 'Catatan Penting:')}</p>
                    <ul className="space-y-1 text-xs">
                      <li>• {getText('Bring your ID (KTM recommended) when picking up', 'Bawa identitas (disarankan KTM) saat pengambilan')}</li>
                      <li>• {getText('Pick up and return on time', 'Ambil dan kembalikan tepat waktu')}</li>
                      <li>• {getText('Contact admin if needed', 'Hubungi admin jika diperlukan')}</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Booking Details */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
                <p className="text-xs text-blue-600 mb-2 font-medium">{getText('Booking Details:', 'Detail Pemesanan:')}</p>
                <p className="text-sm text-blue-800">
                  <strong>{submittedBookingInfo.name}</strong> - {submittedBookingInfo.studyProgram}
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  {getText('Room:', 'Ruangan:')} {submittedBookingInfo.roomName}
                </p>
                <p className="text-sm text-blue-700">
                  {submittedBookingInfo.date}, {submittedBookingInfo.startTime} - {submittedBookingInfo.endTime}
                </p>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowSuccessModal(false);
                    window.location.reload();
                  }}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg"
                >
                  {getText('OK, Got it!', 'OK, Mengerti!')}
                </button>
              </div>

              {/* WhatsApp Contact */}
              <button
                onClick={() => {
                  const message = encodeURIComponent(
                    `Saya ${submittedBookingInfo.name} program studi ${submittedBookingInfo.studyProgram} meminjam ruang ${submittedBookingInfo.roomName} untuk hari dan tanggal ${submittedBookingInfo.date} pukul ${submittedBookingInfo.startTime} - ${submittedBookingInfo.endTime}`
                  );
                  window.open(`https://wa.me/6285869554147?text=${message}`, '_blank');
                }}
                className="mt-4 text-sm text-green-600 hover:text-green-700 flex items-center justify-center gap-2 w-full py-2 border border-green-200 rounded-lg hover:bg-green-50 transition-colors"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                </svg>
                {getText('Send Message to Admin via WhatsApp', 'Kirim Pesan ke Admin via WhatsApp')}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};

export default BookRoom;