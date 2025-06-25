// components/Layout/Layout.tsx
import React, { useState, useEffect } from 'react';
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

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sidebarOpen && window.innerWidth < 1024) {
        const target = event.target as Element;
        const sidebar = document.getElementById('mobile-sidebar');
        const menuButton = document.querySelector('[aria-label="Toggle menu"]');
        
        // Close if clicked outside sidebar and not on menu button
        if (sidebar && !sidebar.contains(target) && !menuButton?.contains(target)) {
          handleCloseSidebar();
        }
      }
    };

    if (sidebarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [sidebarOpen]);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar Container */}
      <div className={`
        ${sidebarOpen ? 'fixed inset-y-0 left-0 w-80 z-50' : 'hidden'} 
        lg:block lg:relative lg:z-auto
        ${sidebarOpen ? 'lg:w-80' : 'lg:w-0'} 
        transition-all duration-300 ease-in-out lg:overflow-hidden
      `}>
        <Sidebar 
          user={user} 
          isOpen={sidebarOpen} 
          onClose={handleCloseSidebar}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <Header
          user={user}
          onMenuClick={handleMenuClick}
          onSignOut={signOut}
          onSignIn={signIn}
        />
        
        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-gradient-to-br from-gray-50 to-blue-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
