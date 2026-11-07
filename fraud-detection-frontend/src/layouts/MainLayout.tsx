import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, Navigate } from 'react-router-dom';
import { Sidebar } from '@/components/ui/Sidebar';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { cn } from '@/utils';
import { Bell, Search, Menu } from 'lucide-react';

export function MainLayout() {
  const [scrolled, setScrolled] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('zfe_sidebar_collapsed') === 'true';
    }
    return false;
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const location = useLocation();

  // Scroll effect
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Atajos de teclado globales
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
      }
      if (isMod && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        setCollapsed((prev) => {
          const next = !prev;
          localStorage.setItem('zfe_sidebar_collapsed', String(next));
          return next;
        });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('zfe_sidebar_collapsed', String(next));
      return next;
    });
  };

  // Basic Auth guard
  const token = localStorage.getItem('zfe_token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const getPageTitle = () => {
    if (location.pathname.includes('/dashboard')) return 'Dashboard General';
    if (location.pathname.includes('/transactions')) return 'Explorador de Transacciones';
    if (location.pathname.includes('/alerts')) return 'Centro de Alertas';
    if (location.pathname.includes('/behavior') || location.pathname.includes('/profile')) return 'Perfiles de Usuario';
    return 'Análisis';
  };

  return (
    <div className="flex min-h-screen bg-[var(--bg-base)]">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <main id="main-content" className="flex-1 flex flex-col min-w-0">
        {/* Skip link (accessibility) */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-2 focus:rounded-md focus:bg-[var(--bg-elevated)] focus:text-[var(--text-primary)] focus:border focus:border-[var(--border-default)]"
        >
          Saltar al contenido principal
        </a>

        {/* Header */}
        <header
          className={cn(
            'sticky top-0 z-40 w-full transition-all duration-200 border-b',
            scrolled
              ? 'bg-[#0E1012]/95 backdrop-blur-md border-[#23272B] shadow-sm py-2.5'
              : 'bg-[#0C0D0E] border-[#1F2328] py-3'
          )}
        >
          <div className="px-4 md:px-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Mobile menu button */}
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="md:hidden p-1.5 rounded-lg border border-[#23272B] bg-[#141618] text-[#9CA3AF] hover:bg-[#1B1E21] transition-colors"
                aria-label="Abrir menú de navegación"
              >
                <Menu className="w-4 h-4" />
              </button>

              {/* Breadcrumb */}
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="text-[#808893] uppercase tracking-wider font-semibold">ZeroFraudE</span>
                <span className="text-[#3A4048]">/</span>
                <span className="text-[#D1D5DB] font-medium">{getPageTitle()}</span>
              </div>
              <div className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>ONLINE</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Global search */}
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#808893]" aria-hidden="true" />
                <input
                  type="text"
                  aria-label="Buscar por ID o usuario"
                  placeholder="Buscar por ID, Usuario..."
                  className="bg-[#141618] border border-[#23272B] rounded-lg py-1.5 pl-8 pr-3 text-xs font-mono text-[#F3F4F6] focus:outline-none focus:border-[#383E46] transition-all w-56 placeholder:text-[#606770]"
                />
              </div>

              {/* Notifications (placeholder, no fake badge) */}
              <button
                type="button"
                className="relative p-1.5 rounded-lg border border-[#23272B] bg-[#141618] hover:bg-[#1B1E21] transition-colors text-[#9CA3AF]"
                aria-label="Notificaciones"
              >
                <Bell className="w-4 h-4" aria-hidden="true" />
              </button>

              {/* Analyst avatar */}
              <button
                type="button"
                className="w-7 h-7 rounded-lg bg-[#1B1E21] border border-[#2A3038] flex items-center justify-center text-xs font-mono font-semibold text-[#E5E7EB] shadow-sm cursor-pointer"
                aria-label="Perfil del analista"
              >
                AN
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 p-4 md:p-8 lg:p-10 page-enter overflow-x-hidden">
          <Outlet />
        </div>
      </main>

      <CommandPalette
        key={commandOpen ? 'open' : 'closed'}
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        onToggleSidebar={() => {
          setCollapsed((prev) => {
            const next = !prev;
            localStorage.setItem('zfe_sidebar_collapsed', String(next));
            return next;
          });
        }}
      />
    </div>
  );
}