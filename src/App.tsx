import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { LanguageProvider } from './contexts/LanguageContext';
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
import ToolAdministration from './pages/ToolAdministration';
import ToolLending from './pages/ToolLending';
import ToolLendingManagement from './pages/ToolLendingManagement';
import Reports from './pages/Reports';
import SystemSettings from './pages/SystemSettings';
import Profile from './pages/Profile'; // No longer needs user prop
import { useAuth } from './hooks/useAuth';

function App() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <LanguageProvider>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">Loading Faculty CRM...</p>
          </div>
        </div>
      </LanguageProvider>
    );
  }

  return (
    <LanguageProvider>
      <Router>
        <Routes>
          <Route path="/auth" element={<AuthForm />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="book" element={<BookRoom />} />
            <Route path="checkout" element={<CheckOut />} />
            <Route path="permit-letter" element={<PermitLetter />} />
            
            {/* Public/Student Routes */}
            <Route path="tools" element={<ToolLending />} />
            <Route path="profile" element={<Profile />} /> {/* No props needed */}
            <Route path="exams" element={<ExamManagement />} />
            <Route path="session-schedule" element={<SessionSchedule />} />
            
            {/* Super Admin Routes */}
            <Route path="tool-lending-management" element={<ToolLendingManagement />} />
            <Route path="rooms" element={<RoomManagement />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="departments" element={<DepartmentManagement />} />
            <Route path="study-programs" element={<StudyProgramManagement />} />
            <Route path="bookings" element={<BookingManagement />} />
            <Route path="validation" element={<ValidationQueue />} />
            <Route path="checkout-validation" element={<CheckoutValidation />} />
            <Route path="schedules" element={<LectureSchedules />} />
            <Route path="tool-admin" element={<ToolAdministration />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<SystemSettings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </LanguageProvider>
  );
}

export default App;