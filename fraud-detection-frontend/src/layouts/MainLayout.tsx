import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, Navigate } from 'react-router-dom';
import { Sidebar } from '@/components/ui/Sidebar';
import { cn } from '@/utils';
import { Bell, Search } from 'lucide-react';

export function MainLayout() {
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  
  // Basic Auth guard for frontend structure
  const token = localStorage.getItem('zfe_token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
        
        {/* Aurora Header with Scroll Effect */}
        <header 
          className={cn(
            'sticky top-0 z-40 w-full transition-all duration-300 border-b border-transparent',
            scrolled 
              ? 'bg-[rgba(11,20,38,0.85)] backdrop-blur-md border-[var(--border-subtle)] shadow-sm py-3'
              : 'aurora-bg py-5'
          )}
        >
          <div className="px-8 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
                {getPageTitle()}
              </h1>
              {!scrolled && (
                <p className="text-sm text-[var(--text-muted)] mt-0.5">
                  Análisis de riesgo en tiempo real
                </p>
              )}
            </div>

            <div className="flex items-center gap-4">
              {/* Global Search Mock */}
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input 
                  type="text" 
                  placeholder="Buscar TX, Usuario..." 
                  className="bg-[rgba(17,32,57,0.5)] border border-[var(--border-default)] rounded-full py-1.5 pl-9 pr-4 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)] transition-all w-64 placeholder:text-transparent placeholder-shown:placeholder:text-[var(--text-muted)]"
                />
              </div>
              
              {/* Notifications */}
              <button className="relative p-2 rounded-full hover:bg-[rgba(255,255,255,0.05)] transition-colors text-[var(--text-secondary)]">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[var(--risk-high)] animate-pulse" />
              </button>
              
              {/* User Avatar */}
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[var(--bg-elevated)] to-[var(--border-strong)] border border-[var(--border-default)] flex items-center justify-center text-sm font-semibold text-[var(--text-primary)] shadow-sm ml-2 cursor-pointer">
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
