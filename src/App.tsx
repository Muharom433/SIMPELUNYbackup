import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import AuthForm from './components/Auth/AuthForm';
import Dashboard from './pages/Dashboard';
import BookRoom from './pages/BookRoom';
import CheckOut from './pages/CheckOut';
import RoomManagement from './pages/RoomManagement';
import UserManagement from './pages/UserManagement';
import DepartmentManagement from './pages/DepartmentManagement';
import StudyProgramManagement from './pages/StudyProgramManagement';
import BookingManagement from './pages/BookingManagement';
import ValidationQueue from './pages/ValidationQueue';
import CheckoutValidation from './pages/CheckoutValidation';
import LectureSchedules from './pages/LectureSchedules';
import ExamManagement from './pages/ExamManagement';
import ToolAdministration from './pages/ToolAdministration';
import Reports from './pages/Reports';
import SystemSettings from './pages/SystemSettings';
import { useAuth } from './hooks/useAuth';

function App() {
  const { loading } = useAuth();

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
        <Route path="/book" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="book" element={<BookRoom />} />
          <Route path="checkout" element={<CheckOut />} />
          
          {/* Student/Public Routes */}
          <Route path="tools" element={<div className="p-6">Tool Lending Service - Coming Soon</div>} />
          <Route path="my-bookings" element={<div className="p-6">My Bookings - Coming Soon</div>} />
          <Route path="profile" element={<div className="p-6">Profile Management - Coming Soon</div>} />
          
          {/* Department Admin Routes */}
          <Route path="department-analytics" element={<div className="p-6">Department Analytics - Coming Soon</div>} />
          <Route path="exam-schedules" element={<div className="p-6">Exam Schedules - Coming Soon</div>} />
          <Route path="department-bookings" element={<div className="p-6">Department Bookings - Coming Soon</div>} />
          <Route path="department-reports" element={<div className="p-6">Department Reports - Coming Soon</div>} />
          <Route path="department-equipment" element={<div className="p-6">Equipment Management - Coming Soon</div>} />
          <Route path="exams" element={<ExamManagement />} />
          
          {/* Super Admin Routes */}
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
  );
}

export default App;