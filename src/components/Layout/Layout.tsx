import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAuth } from '../../hooks/useAuth';

const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  const handleSignIn = () => {
    // This will be handled by routing to auth page
    window.location.href = '/auth';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        user={profile}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      
      <div className="lg:ml-64">
        <Header
          user={profile}
          onMenuClick={() => setSidebarOpen(true)}
          onSignOut={handleSignOut}
          onSignIn={handleSignIn}
        />
        
        <main className="p-6">
          <Outlet />
        </main>
      </div>

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
        }}
      />
    </div>
  );
};

export default Layout;