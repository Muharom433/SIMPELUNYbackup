// src/contexts/LanguageContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'en' | 'id';

interface LanguageContextType {
  currentLanguage: Language;
  setLanguage: (lang: Language) => void;
  getText: (en: string, id: string) => string;
  formatTime: (date: Date) => string;
  formatDate: (date: Date) => string;
  getLanguageLabel: (lang: Language) => string;
  getLanguageFlag: (lang: Language) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState<Language>('en');

  // Load saved language from localStorage on mount
  useEffect(() => {
    const savedLanguage = localStorage.getItem('language') as Language;
    if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'id')) {
      setCurrentLanguage(savedLanguage);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setCurrentLanguage(lang);
    localStorage.setItem('language', lang);
    // Here you could also call i18n.changeLanguage(lang) if using react-i18next
  };

  const getText = (en: string, id: string) => {
    return currentLanguage === 'id' ? id : en;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString(currentLanguage === 'id' ? 'id-ID' : 'en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(currentLanguage === 'id' ? 'id-ID' : 'en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getLanguageLabel = (lang: Language) => {
    switch (lang) {
      case 'en': return 'English';
      case 'id': return 'Bahasa Indonesia';
      default: return 'English';
    }
  };

  const getLanguageFlag = (lang: Language) => {
    switch (lang) {
      case 'en': return '🇺🇸';
      case 'id': return '🇮🇩';
      default: return '🇺🇸';
    }
  };

  const value: LanguageContextType = {
    currentLanguage,
    setLanguage,
    getText,
    formatTime,
    formatDate,
    getLanguageLabel,
    getLanguageFlag,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

const getText = useCallback((english: string, indonesian: string): string => {
  const result = language === 'en' ? english : indonesian;
  console.log('getText called:', { english, indonesian, language, result }); // Debug log
  
  // Pastikan selalu return string
  if (typeof result !== 'string') {
    console.error('getText returning non-string:', result);
    return english; // Fallback ke English
  }
  
  return result;
}, [language]);

// Alternative debug approach - cek apakah context loaded
const isContextReady = language !== null && language !== undefined;
console.log('Language context ready:', isContextReady, 'Current language:', language);

if (!isContextReady) {
  console.warn('Language context not ready yet');
}

return { language, setLanguage, getText, isContextReady };

// Translation constants for common UI elements
export const translations = {
  // Common
  loading: { en: 'Loading...', id: 'Memuat...' },
  search: { en: 'Search', id: 'Cari' },
  cancel: { en: 'Cancel', id: 'Batal' },
  save: { en: 'Save', id: 'Simpan' },
  delete: { en: 'Delete', id: 'Hapus' },
  edit: { en: 'Edit', id: 'Edit' },
  submit: { en: 'Submit', id: 'Kirim' },
  close: { en: 'Close', id: 'Tutup' },
  
  // Navigation
  dashboard: { en: 'Dashboard', id: 'Dasbor' },
  bookRoom: { en: 'Book Room', id: 'Pesan Ruangan' },
  toolLending: { en: 'Tool Lending', id: 'Peminjaman Alat' },
  checkOut: { en: 'Check Out', id: 'Pengembalian' },
  profile: { en: 'Profile', id: 'Profil' },
  settings: { en: 'Settings', id: 'Pengaturan' },
  
  // Admin Navigation
  systemAnalytics: { en: 'System Analytics', id: 'Analitik Sistem' },
  roomManagement: { en: 'Room Management', id: 'Manajemen Ruangan' },
  userManagement: { en: 'User Management', id: 'Manajemen Pengguna' },
  departments: { en: 'Departments', id: 'Departemen' },
  studyPrograms: { en: 'Study Programs', id: 'Program Studi' },
  bookingManagement: { en: 'Booking Management', id: 'Manajemen Pemesanan' },
  validationQueue: { en: 'Validation Queue', id: 'Antrian Validasi' },
  lectureSchedules: { en: 'Lecture Schedules', id: 'Jadwal Kuliah' },
  examManagement: { en: 'Exam Management', id: 'Manajemen Ujian' },
  toolAdministration: { en: 'Tool Administration', id: 'Administrasi Alat' },
  reports: { en: 'Reports', id: 'Laporan' },
  systemSettings: { en: 'System Settings', id: 'Pengaturan Sistem' },
  
  // Book Room
  smartRoomBooking: { en: 'Self Service Lecture', id: 'Sistem Pelayanan Kuliah' },
  reserveYourSpace: { en: 'Reserve your perfect study space', id: 'Pesan ruang belajar yang sempurna' },
  availableRooms: { en: 'Available Rooms', id: 'Ruangan Tersedia' },
  bookYourRoom: { en: 'Book Your Room', id: 'Pesan Ruangan Anda' },
  personalInformation: { en: 'Personal Information', id: 'Informasi Pribadi' },
  bookingDetails: { en: 'Booking Details', id: 'Detail Pemesanan' },
  requestEquipment: { en: 'Request Equipment', id: 'Permintaan Peralatan' },
  startTime: { en: 'Start Time', id: 'Waktu Mulai' },
  endTime: { en: 'End Time', id: 'Waktu Selesai' },
  autoCalculate: { en: 'Auto Calculate', id: 'Otomatis' },
  manual: { en: 'Manual', id: 'Manual' },
  duration: { en: 'Duration', id: 'Durasi' },
  minutes: { en: 'minutes', id: 'menit' },
  sksCredits: { en: 'SKS (Credits)', id: 'SKS (Kredit)' },
  classType: { en: 'Class Type', id: 'Tipe Kelas' },
  theory: { en: 'Theory', id: 'Teori' },
  practical: { en: 'Practical', id: 'Praktik' },
  submitBookingRequest: { en: 'Submit Booking Request', id: 'Kirim Permintaan Pemesanan' },
  seats: { en: 'seats', id: 'kursi' },
  rooms: { en: 'rooms', id: 'ruangan' },
  
  // Status
  inUse: { en: 'In Use', id: 'Sedang Digunakan' },
  scheduled: { en: 'Scheduled', id: 'Terjadwal' },
  available: { en: 'Available', id: 'Tersedia' },
  
  // Checkout
  equipmentCheckOut: { en: 'Equipment Check Out', id: 'Pengembalian Peralatan' },
  completeEquipmentReturn: { en: 'Complete your equipment return and report any issues', id: 'Selesaikan pengembalian peralatan dan laporkan masalah' },
  findYourBooking: { en: 'Find Your Booking', id: 'Cari Pemesanan Anda' },
  selectedBookingDetails: { en: 'Selected Booking Details', id: 'Detail Pemesanan Terpilih' },
  userInformation: { en: 'User Information', id: 'Informasi Pengguna' },
  location: { en: 'Location', id: 'Lokasi' },
  purpose: { en: 'Purpose', id: 'Tujuan' },
  requestedEquipment: { en: 'Requested Equipment', id: 'Peralatan yang Diminta' },
  reportIssue: { en: 'Report an issue or problem', id: 'Laporkan masalah atau kendala' },
  reportIssueDescription: { en: 'Check this if you experienced any problems with the equipment, room condition, or facilities during your booking.', id: 'Centang ini jika Anda mengalami masalah dengan peralatan, kondisi ruangan, atau fasilitas selama pemesanan.' },
  issueReportDetails: { en: 'Issue Report Details', id: 'Detail Laporan Masalah' },
  issueCategory: { en: 'Issue Category', id: 'Kategori Masalah' },
  issueDescription: { en: 'Issue Description', id: 'Deskripsi Masalah' },
  attachPhotos: { en: 'Attach Photos (Optional)', id: 'Lampirkan Foto (Opsional)' },
  completeEquipmentReturnBtn: { en: 'Complete Equipment Return', id: 'Selesaikan Pengembalian Peralatan' },
  
  // Categories
  equipmentIssues: { en: 'Equipment Issues', id: 'Masalah Peralatan' },
  roomCondition: { en: 'Room Condition', id: 'Kondisi Ruangan' },
  cleanliness: { en: 'Cleanliness', id: 'Kebersihan' },
  safety: { en: 'Safety', id: 'Keamanan' },
  maintenance: { en: 'Maintenance', id: 'Pemeliharaan' },
  other: { en: 'Other', id: 'Lainnya' },
  
  // Notifications
  notifications: { en: 'Notifications', id: 'Notifikasi' },
  noNewNotifications: { en: 'No new notifications', id: 'Tidak ada notifikasi baru' },
  allCaughtUp: { en: "You're all caught up!", id: 'Semua sudah terbaca!' },
  pendingRoomBookings: { en: 'Pending Room Bookings', id: 'Pemesanan Ruangan Menunggu' },
  pendingCheckouts: { en: 'Pending Checkouts', id: 'Pengembalian Menunggu' },
  booking: { en: 'booking', id: 'pemesanan' },
  checkout: { en: 'checkout', id: 'pengembalian' },
  waitingForApproval: { en: 'waiting for approval', id: 'menunggu persetujuan' },
  actionRequired: { en: 'Action Required', id: 'Aksi Diperlukan' },
  reviewNeeded: { en: 'Review Needed', id: 'Perlu Ditinjau' },
  markAllAsRead: { en: 'Mark all as read', id: 'Tandai semua sebagai telah dibaca' },
  
  // User Menu
  viewProfile: { en: 'View Profile', id: 'Lihat Profil' },
  signOut: { en: 'Sign Out', id: 'Keluar' },
  signIn: { en: 'Sign In', id: 'Masuk' },
  online: { en: 'Online', id: 'Online' },
  
  // Forms
  fullName: { en: 'Full Name', id: 'Nama Lengkap' },
  identityNumber: { en: 'Identity Number (NIM/NIP)', id: 'Nomor Identitas (NIM/NIP)' },
  studyProgram: { en: 'Study Program', id: 'Program Studi' },
  phoneNumber: { en: 'Phone Number', id: 'Nomor Telepon' },
  physicalIdRequired: { en: 'Physical ID Required', id: 'ID Fisik Diperlukan' },
  bringPhysicalId: { en: 'Please bring your physical ID card when using the room.', id: 'Harap bawa kartu identitas fisik saat menggunakan ruangan.' },
  
  // Time and Date
  dateTime: { en: 'Date & Time', id: 'Tanggal & Waktu' },
  now: { en: 'NOW', id: 'SEKARANG' },
  
  // Messages
  whatHappensNext: { en: 'What happens next?', id: 'Apa yang terjadi selanjutnya?' },
  bookingWillBeCompleted: { en: 'Your booking will be marked as completed', id: 'Pemesanan Anda akan ditandai sebagai selesai' },
  equipmentWillBeChecked: { en: 'Equipment will be checked and processed for return', id: 'Peralatan akan diperiksa dan diproses untuk dikembalikan' },
  issuesWillBeForwarded: { en: 'Any reported issues will be forwarded to the maintenance team', id: 'Masalah yang dilaporkan akan diteruskan ke tim pemeliharaan' },
  confirmationNotification: { en: "You'll receive a confirmation notification", id: 'Anda akan menerima notifikasi konfirmasi' },
};

// Tambahan translations untuk Session Schedule di LanguageContext.tsx
// Tambahkan ke bagian translations object:

export const sessionScheduleTranslations = {
  // Session Schedule
  sessionSchedule: { en: 'Session Schedule', id: 'Jadwal Sidang' },
  manageFinalExamSessions: { en: 'Manage final exam sessions', id: 'Kelola jadwal sidang akhir' },
  addSession: { en: 'Add Session', id: 'Tambah Sidang' },
  editSession: { en: 'Edit Session', id: 'Edit Sidang' },
  addNewSession: { en: 'Add New Session', id: 'Tambah Sidang Baru' },
  updateSession: { en: 'Update Session', id: 'Perbarui Sidang' },
  createSession: { en: 'Create Session', id: 'Buat Sidang' },
  
  // Form fields
  searchStudentByNIM: { en: 'Search Student by NIM', id: 'Cari Mahasiswa berdasarkan NIM' },
  enterNIMOrName: { en: 'Enter NIM or name', id: 'Masukkan NIM atau nama' },
  studentName: { en: 'Student Name', id: 'Nama Mahasiswa' },
  searchStudyProgram: { en: 'Search study program', id: 'Cari program studi' },
  searchAvailableRooms: { en: 'Search available rooms', id: 'Cari ruangan tersedia' },
  thesisTitle: { en: 'Thesis Title', id: 'Judul Skripsi/Tesis' },
  
  // Committee roles
  supervisor: { en: 'Supervisor', id: 'Pembimbing' },
  examiner: { en: 'Examiner', id: 'Penguji' },
  secretary: { en: 'Secretary', id: 'Sekretaris' },
  searchSupervisor: { en: 'Search supervisor', id: 'Cari pembimbing' },
  searchExaminer: { en: 'Search examiner', id: 'Cari penguji' },
  searchSecretary: { en: 'Search secretary', id: 'Cari sekretaris' },
  
  // Table headers
  student: { en: 'Student', id: 'Mahasiswa' },
  program: { en: 'Program', id: 'Program' },
  schedule: { en: 'Schedule', id: 'Jadwal' },
  room: { en: 'Room', id: 'Ruangan' },
  title: { en: 'Title', id: 'Judul' },
  committee: { en: 'Committee', id: 'Panitia' },
  actions: { en: 'Actions', id: 'Aksi' },
  
  // Filters
  allPrograms: { en: 'All Programs', id: 'Semua Program' },
  exportPDF: { en: 'Export PDF', id: 'Ekspor PDF' },
  
  // Messages
  noSessionsFound: { en: 'No sessions found', id: 'Tidak ada sesi ditemukan' },
  tryAdjustingFilters: { en: 'Try adjusting your search filters', id: 'Coba sesuaikan filter pencarian Anda' },
  areYouSureDeleteSession: { en: 'Are you sure you want to delete this session?', id: 'Apakah Anda yakin ingin menghapus sesi ini?' },
  selected: { en: 'Selected', id: 'Dipilih' },
  
  // Search placeholders
  searchByNameNIMTitle: { en: 'Search by name, NIM, title...', id: 'Cari berdasarkan nama, NIM, judul...' },
};

// Helper function to get translation by key
export const getTranslation = (key: keyof typeof translations, language: Language = 'en') => {
  return translations[key]?.[language] || key;
};