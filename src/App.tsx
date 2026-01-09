import React, { Suspense } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { LanguageProvider } from './contexts/LanguageContext';
import { AuthProvider } from './contexts/AuthContext';
import { SystemSettingsProvider } from './contexts/SystemSettingsContext';
import Layout from './components/Layout/Layout';
import AuthForm from './components/Auth/AuthForm';
import Dashboard from './pages/Dashboard';
import BookRoom from './pages/BookRoom';
import CheckOut from './pages/CheckOut';
import RoomManagement from './pages/RoomManagement';
import UserManagement from './pages/UserManagement';
import DepartmentManagement from './pages/DepartmentManagement';
import StudyProgramManagement from './pages/StudyProgramManagement';
import PermitLetter from './pages/PermitLetter';
import BookingManagement from './pages/BookingManagement';
import ValidationQueue from './pages/ValidationQueue';
import CheckoutValidation from './pages/CheckoutValidation';
import LectureSchedules from './pages/LectureSchedules';
import ExamManagement from './pages/ExamManagement';
import SessionSchedule from './pages/SessionSchedule';
import Reports from './pages/Reports';
import TendikDirectory from './pages/TendikDirectory';
import SystemSettings from './pages/SystemSettings';
import LocationManagement from './pages/LocationManagement';
import LaboratoryLocationManagement from './pages/LaboratoryLocationManagement';
import ScheduleCalendar from './pages/ScheduleCalendar';
import Profile from './pages/Profile';
import { useAuthContext } from './contexts/AuthContext';

// Lazy loaded components for Tool Lending feature
const ToolAdministration = React.lazy(() => import('./pages/ToolAdministration'));
const ToolLending = React.lazy(() => import('./pages/ToolLending'));
const ToolLendingManagement = React.lazy(() => import('./pages/ToolLendingManagement'));
const TechnicianTodoList = React.lazy(() => import('./pages/TechnicianTodoList'));

// Lazy loaded components for Form Builder feature
const FormManagement = React.lazy(() => import('./pages/FormManagement'));
const FormBuilder = React.lazy(() => import('./pages/FormBuilder'));
const FormView = React.lazy(() => import('./pages/FormView'));
const FormResponses = React.lazy(() => import('./pages/FormResponses'));

// Lazy loaded components for Finance/Attendance feature
const DosenPresensi = React.lazy(() => import('./pages/DosenPresensi'));
const FinanceAttendance = React.lazy(() => import('./pages/FinanceAttendance'));

// Loading component for Suspense fallback
const LazyLoadingFallback = () => (
  <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
    <div className="text-center">
      <div className="relative">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto mb-4"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
      </div>
      <p className="text-gray-600 font-medium">Memuat Tool Management...</p>
      <p className="text-gray-400 text-sm mt-1">Mohon tunggu sebentar</p>
    </div>
  </div>
);

// Inner component to handle loading state from AuthContext
const AppContent = () => {
  const { loading, user } = useAuthContext();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading Faculty CRM...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/auth" element={<AuthForm />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard user={user} />} />
          <Route path="book" element={<BookRoom />} />
          <Route path="checkout" element={<CheckOut />} />
          <Route path="permit-letter" element={<PermitLetter />} />

          {/* Public/Student Routes */}
          <Route path="tools" element={<Suspense fallback={<LazyLoadingFallback />}><ToolLending /></Suspense>} />
          <Route path="profile" element={<Profile />} />
          <Route path="exams" element={<ExamManagement />} />
          <Route path="session-schedule" element={<SessionSchedule />} />

          {/* Super Admin Routes */}
          <Route path="tool-lending-management" element={<Suspense fallback={<LazyLoadingFallback />}><ToolLendingManagement /></Suspense>} />
          <Route path="rooms" element={<RoomManagement />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="departments" element={<DepartmentManagement />} />
          <Route path="study-programs" element={<StudyProgramManagement />} />
          <Route path="bookings" element={<BookingManagement />} />
          <Route path="validation" element={<ValidationQueue />} />
          <Route path="checkout-validation" element={<CheckoutValidation />} />
          <Route path="schedules" element={<LectureSchedules />} />
          <Route path="tool-admin" element={<Suspense fallback={<LazyLoadingFallback />}><ToolAdministration /></Suspense>} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<SystemSettings />} />
          <Route path="locations" element={<LocationManagement />} />
          <Route path="laboratory-locations" element={<LaboratoryLocationManagement />} />
          <Route path="schedule-calendar" element={<ScheduleCalendar />} />

          {/* Technician Routes */}
          <Route path="technician-todo" element={<Suspense fallback={<LazyLoadingFallback />}><TechnicianTodoList /></Suspense>} />

          {/* Form Builder Routes (within Layout) */}
          <Route path="forms" element={<Suspense fallback={<LazyLoadingFallback />}><FormManagement /></Suspense>} />
          <Route path="form-builder" element={<Suspense fallback={<LazyLoadingFallback />}><FormBuilder /></Suspense>} />
          <Route path="form-builder/:id" element={<Suspense fallback={<LazyLoadingFallback />}><FormBuilder /></Suspense>} />
          <Route path="form-responses/:id" element={<Suspense fallback={<LazyLoadingFallback />}><FormResponses /></Suspense>} />

          {/* Finance Routes */}
          <Route path="attendance-verification" element={<Suspense fallback={<LazyLoadingFallback />}><FinanceAttendance /></Suspense>} />
          <Route path="attendance-recap" element={<Suspense fallback={<LazyLoadingFallback />}><FinanceAttendance /></Suspense>} />
        </Route>

        {/* Public Form View - Standalone without Layout */}
        <Route path="form/:id" element={<Suspense fallback={<LazyLoadingFallback />}><FormView /></Suspense>} />
        <Route path="tendik" element={<Suspense fallback={<LazyLoadingFallback />}><TendikDirectory /></Suspense>} />
        <Route path="presensi-dosen" element={<Suspense fallback={<LazyLoadingFallback />}><DosenPresensi /></Suspense>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <SystemSettingsProvider>
          <AppContent />
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 3000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                iconTheme: {
                  primary: '#22c55e',
                  secondary: '#fff',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
              },
            }}
          />
        </SystemSettingsProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
