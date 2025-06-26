import React, { useState, useEffect } from 'react';
import { 
  Star, 
  CheckCircle, 
  Clock, 
  ArrowUp, 
  MapPin, 
  Timer, 
  ChevronRight, 
  Play,
  Menu,
  X
} from 'lucide-react';

const Dashboard = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-white bg-opacity-95 backdrop-blur-md z-50 border-b border-amber-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">FV</span>
              </div>
              <span className="text-xl font-bold text-amber-900">Faculty Portal</span>
            </div>
            
            <div className="hidden md:flex items-center space-x-8">
              <a href="#" className="text-amber-700 hover:text-amber-900 font-medium transition-colors">Home</a>
              <a href="#" className="text-amber-700 hover:text-amber-900 font-medium transition-colors">Services</a>
              <a href="#" className="text-amber-700 hover:text-amber-900 font-medium transition-colors">About</a>
              <a href="#" className="text-amber-700 hover:text-amber-900 font-medium transition-colors">Contact</a>
              <button className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-2 rounded-full font-medium hover:from-amber-600 hover:to-orange-600 transition-all duration-300">
                Login
              </button>
            </div>

            <button 
              className="md:hidden p-2 text-amber-700"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="fixed inset-0 bg-white z-40 pt-16">
          <div className="flex flex-col space-y-4 p-4">
            <a href="#" className="text-amber-700 hover:text-amber-900 font-medium py-2">Home</a>
            <a href="#" className="text-amber-700 hover:text-amber-900 font-medium py-2">Services</a>
            <a href="#" className="text-amber-700 hover:text-amber-900 font-medium py-2">About</a>
            <a href="#" className="text-amber-700 hover:text-amber-900 font-medium py-2">Contact</a>
            <button className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-3 rounded-full font-medium mt-4">
              Login
            </button>
          </div>
        </div>
      )}

      <div>
        {/* Hero Section */}
        <section className="relative min-h-screen bg-gradient-to-br from-stone-200 via-amber-100 to-yellow-100 overflow-hidden">
          {/* Background Shape */}
          <div className="absolute inset-0">
            {/* Main diagonal shape */}
            <div 
              className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-stone-100 via-amber-50 to-yellow-50 opacity-60"
              style={{
                clipPath: 'polygon(40% 0%, 100% 0%, 100% 100%, 0% 100%)'
              }}
            ></div>
            {/* Secondary diagonal shape for depth */}
            <div 
              className="absolute top-0 right-0 w-4/5 h-full bg-gradient-to-br from-stone-50 via-amber-25 to-yellow-25 opacity-40"
              style={{
                clipPath: 'polygon(60% 0%, 100% 0%, 100% 100%, 20% 100%)'
              }}
            ></div>
            {/* Light accent shape */}
            <div 
              className="absolute top-0 right-0 w-2/3 h-full bg-gradient-to-br from-stone-25 via-yellow-25 to-amber-25 opacity-20"
              style={{
                clipPath: 'polygon(75% 0%, 100% 0%, 100% 100%, 40% 100%)'
              }}
            ></div>
          </div>

          <div className="relative z-10 pt-20 px-4 sm:px-6 lg:px-8 h-screen flex items-center">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-8 items-center">
              {/* Left Content */}
              <div className="text-stone-800 space-y-6">
                <div className="space-y-4">
                  <div className="inline-flex items-center px-4 py-2 bg-white bg-opacity-20 backdrop-blur-sm rounded-full text-sm font-medium">
                    <Star className="w-4 h-4 mr-2 text-amber-700" />
                    Best Faculty Management System
                  </div>
                  <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold leading-tight">
                    Faculty of 
                    <span className="block bg-gradient-to-r from-amber-700 to-yellow-700 bg-clip-text text-transparent">
                      Vocational
                    </span>
                  </h1>
                  <h2 className="text-lg sm:text-xl lg:text-2xl font-semibold text-stone-700">
                    Yogyakarta State University
                  </h2>
                  <p className="text-sm sm:text-base lg:text-lg text-stone-600 leading-relaxed max-w-lg">
                    SIMPEL kuliah or Sistem Pelayanan kuliah is an Innovation to improve our services.
                  </p>
                </div>

                {/* Contact Info */}
                <div className="flex items-center space-x-6 text-sm text-stone-500">
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4" />
                    <span>Faculty of Vocational</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Timer className="w-4 h-4" />
                    <span>24/7 Online</span>
                  </div>
                </div>
              </div>

              {/* Right Content - Hero Image */}
              <div className="relative flex justify-center lg:justify-end">
                <div className="relative">
                  {/* Main image container */}
                  <div className="relative w-full max-w-md lg:max-w-lg">
                    <img 
                      src="/src/assets/people.svg" 
                      alt="Faculty Student" 
                      className="w-full h-auto relative z-10"
                      onError={(e) => {
                        // Fallback if image doesn't load
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling.style.display = 'flex';
                      }}
                    />
                    
                    {/* Fallback content */}
                    <div 
                      className="w-full h-96 bg-gradient-to-br from-amber-200 to-orange-300 rounded-2xl flex items-center justify-center relative z-10"
                      style={{display: 'none'}}
                    >
                      <div className="text-center text-amber-800">
                        <div className="w-20 h-20 bg-amber-400 rounded-full mx-auto mb-4 flex items-center justify-center">
                          <Star className="w-10 h-10 text-white" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">Faculty Portal</h3>
                        <p className="text-sm">Student Success System</p>
                      </div>
                    </div>

                    {/* Building Text - Top Left Corner (2x bigger, moved down and further right from people) */}
                    <div 
                      className="absolute top-16 -left-8 lg:top-20 lg:-left-12 z-20"
                      style={{ animation: 'float 6s ease-in-out infinite' }}
                    >
                      <img 
                        src="/src/assets/Build.png" 
                        alt="Building Career" 
                        className="w-80 h-auto lg:w-104 drop-shadow-lg"
                        onError={(e) => {
                          // Fallback text if image doesn't load
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling.style.display = 'block';
                        }}
                      />
                      <div 
                        className="bg-white rounded-2xl p-3 shadow-xl border border-gray-100"
                        style={{display: 'none'}}
                      >
                        <span className="text-base font-bold text-amber-700">
                          BUILDING CAREER
                        </span>
                      </div>
                    </div>
                    
                    {/* Shaping Text - Bottom Right Corner (2x bigger, moved down and further right) */}
                    <div 
                      className="absolute bottom-2 -right-12 lg:bottom-4 lg:-right-20 z-20"
                      style={{ animation: 'float 6s ease-in-out infinite 3s' }}
                    >
                      <img 
                        src="/src/assets/Shape.png" 
                        alt="Shaping Future" 
                        className="w-80 h-auto lg:w-104 drop-shadow-lg"
                        onError={(e) => {
                          // Fallback text if image doesn't load
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling.style.display = 'block';
                        }}
                      />
                      <div 
                        className="bg-white rounded-2xl p-3 shadow-xl border border-gray-100"
                        style={{display: 'none'}}
                      >
                        <span className="text-base font-bold text-orange-700">
                          SHAPING FUTURE
                        </span>
                      </div>
                    </div>

                    {/* Floating Elements */}
                    <div className="absolute -top-4 -right-4 w-16 h-16 bg-amber-400 rounded-full flex items-center justify-center shadow-lg z-20" style={{ animation: 'bounce 2s infinite' }}>
                      <Star className="w-8 h-8 text-white" />
                    </div>
                    
                    <div className="absolute -bottom-6 -left-6 w-12 h-12 bg-orange-400 rounded-full flex items-center justify-center shadow-lg z-20" style={{ animation: 'pulse 3s infinite' }}>
                      <CheckCircle className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        </section>
      </div>
      
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(1deg); }
        }
        
        @keyframes bounce {
          0%, 20%, 53%, 80%, 100% { transform: translateY(0); }
          40%, 43% { transform: translateY(-15px); }
          70% { transform: translateY(-7px); }
        }
        
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;