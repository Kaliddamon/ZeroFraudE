import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, Navigate } from 'react-router-dom';
import { Sidebar } from '@/components/ui/Sidebar';
import { cn } from '@/utils';
import { Bell, Search } from 'lucide-react';

export function MainLayout() {
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  // Scroll effect — must be declared BEFORE any conditional return (Rules of Hooks)
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Basic Auth guard for frontend structure
  const token = localStorage.getItem('zfe_token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Title mapper based on route
  const getPageTitle = () => {
    if (location.pathname.includes('/dashboard')) return 'Dashboard General';
    if (location.pathname.includes('/transactions')) return 'Explorador de Transacciones';
    if (location.pathname.includes('/alerts')) return 'Centro de Alertas';
    if (location.pathname.includes('/behavior')) return 'Perfiles de Usuario';
    return 'Análisis';
  };

  return (
    <div className="flex min-h-screen bg-[var(--bg-base)]">
      <Sidebar />
      
      <main className="flex-1 flex flex-col min-w-0">
        
        {/* Sleek Swiss Navigation Bar */}
        <header 
          className={cn(
            'sticky top-0 z-40 w-full transition-all duration-200 border-b',
            scrolled 
              ? 'bg-[#0E1012]/95 backdrop-blur-md border-[#23272B] shadow-sm py-2.5'
              : 'bg-[#0C0D0E] border-[#1F2328] py-3'
          )}
        >
          <div className="px-6 md:px-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Context breadcrumb & status */}
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="text-[#808893] uppercase tracking-wider font-semibold">ZeroFraudE</span>
                <span className="text-[#3A4048]">/</span>
                <span className="text-[#D1D5DB] font-medium">{getPageTitle()}</span>
              </div>
              <div className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>ONLINE · LIGHTGBM V1.1.0</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Global Search */}
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#808893]" />
                <input 
                  type="text" 
                  placeholder="Buscar por ID, Usuario..." 
                  className="bg-[#141618] border border-[#23272B] rounded-lg py-1.5 pl-8 pr-3 text-xs font-mono text-[#F3F4F6] focus:outline-none focus:border-[#383E46] transition-all w-56 placeholder:text-[#606770]"
                />
              </div>
              
              {/* Notifications */}
              <button className="relative p-1.5 rounded-lg border border-[#23272B] bg-[#141618] hover:bg-[#1B1E21] transition-colors text-[#9CA3AF]">
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              </button>
              
              {/* Analyst Avatar */}
              <div className="w-7 h-7 rounded-lg bg-[#1B1E21] border border-[#2A3038] flex items-center justify-center text-xs font-mono font-semibold text-[#E5E7EB] shadow-sm cursor-pointer">
                AN
              </div>
            </div>
          </div>
        </header>

        {/* Page Content Container */}
        <div className="flex-1 p-8 md:p-10 page-enter overflow-x-hidden">
          <Outlet />
        </div>
        
      </main>
    </div>
  );
}
