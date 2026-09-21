import React from 'react';
import { NavLink } from 'react-router-dom';
import { ShieldCheck, LayoutDashboard, Search, Bell, Activity, Settings, LogOut } from 'lucide-react';
import { cn } from '@/utils';

// ── Nav Items Config ──────────────────────────────────────────────────────────

const navItems = [
  { to: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
  { to: '/transactions', label: 'Explorador',   icon: Search },
  { to: '/alerts',       label: 'Centro Alertas', icon: Bell },
  { to: '/behavior',     label: 'Perfiles',     icon: Activity },
];

export function Sidebar() {
  return (
    <aside className="w-[260px] flex-shrink-0 flex flex-col bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] h-screen sticky top-0">
      
      {/* Logo Area */}
      <div className="h-16 flex items-center px-6 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--brand-light)] to-[var(--brand)] flex items-center justify-center shadow-[var(--glow-brand)]">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight text-[var(--text-primary)]">
            ZeroFraud<span className="text-[var(--brand-light)]">E</span>
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-6 px-4 flex flex-col gap-2">
        <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2 px-2">
          Análisis
        </div>
        
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'nav-pill flex items-center gap-3 px-3 py-2.5 text-sm font-medium outline-none',
                isActive ? 'active' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(99,179,237,0.05)]'
              )
            }
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Footer / User Area */}
      <div className="p-4 border-t border-[var(--border-subtle)] flex flex-col gap-2">
        <button className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(99,179,237,0.05)] rounded-md transition-colors w-full">
          <Settings className="w-4 h-4" />
          Configuración
        </button>
        <button 
          onClick={() => {
            localStorage.removeItem('zfe_token');
            window.location.href = '/login';
          }}
          className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-[var(--risk-high)] hover:bg-[rgba(239,68,68,0.1)] rounded-md transition-colors w-full"
        >
          <LogOut className="w-4 h-4" />
          Cerrar Sesión
        </button>
      </div>

    </aside>
  );
}
