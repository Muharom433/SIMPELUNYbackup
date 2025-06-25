// components/Layout/Layout.tsx
import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import { useAuth } from '../../hooks/useAuth';

const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, signOut, signIn } = useAuth();

  const handleMenuClick = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleCloseSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar - Simple Show/Hide */}
      <div className={`${sidebarOpen ? 'w-80' : 'w-0'} lg:w-80 transition-all duration-300 overflow-hidden`}>
        <Sidebar 
          user={user} 
          isOpen={sidebarOpen} 
          onClose={handleCloseSidebar}
        />
      </div>

      {/* Main Content */}
      <div className="flex flex-col flex-1">
        <Header
          user={user}
          onMenuClick={handleMenuClick}
          onSignOut={signOut}
          onSignIn={signIn}
        />
        
        <main className="flex-1 overflow-auto bg-gradient-to-br from-gray-50 to-blue-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;