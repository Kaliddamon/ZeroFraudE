import React from 'react';
import { NavLink } from 'react-router-dom';
import { ShieldCheck, LayoutDashboard, Search, Bell, Activity, LogOut, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { cn } from '@/utils';

// ── Navegación agrupada por proceso (solo rutas existentes) ────────────────────
const sections = [
  {
    title: 'General',
    items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    title: 'Operaciones',
    items: [
      { to: '/transactions', label: 'Explorador', icon: Search },
      { to: '/alerts', label: 'Centro Alertas', icon: Bell },
    ],
  },
  {
    title: 'Análisis',
    items: [{ to: '/behavior', label: 'Perfiles', icon: Activity }],
  },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ collapsed = false, onToggleCollapse, mobileOpen = false, onMobileClose }: SidebarProps) {
  const effectiveCollapsed = collapsed;

  const sidebarContent = (
    <>
      {/* Logo Area */}
      <div className={cn('h-16 flex items-center border-b border-[var(--border-subtle)]', effectiveCollapsed ? 'justify-center px-2' : 'px-6')}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--brand-light)] to-[var(--brand)] flex items-center justify-center shadow-glow-brand shrink-0">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          {!effectiveCollapsed && (
            <span className="font-bold text-lg tracking-tight text-[var(--text-primary)]">
              ZeroFraud<span className="text-[var(--brand-light)]">E</span>
            </span>
          )}
        </div>
        {mobileOpen && (
          <button
            type="button"
            onClick={onMobileClose}
            className="ml-auto p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] md:hidden"
            aria-label="Cerrar menú"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav aria-label="Navegación principal" className="flex-1 py-4 px-3 flex flex-col gap-4 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.title} className="flex flex-col gap-1">
            {!effectiveCollapsed && (
              <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1 px-2">
                {section.title}
              </div>
            )}
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onMobileClose}
                  title={effectiveCollapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      'nav-pill flex items-center gap-3 rounded-md outline-none transition-colors',
                      effectiveCollapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5 text-sm font-medium',
                      isActive
                        ? 'active text-[var(--text-primary)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(99,179,237,0.05)]'
                    )
                  }
                  aria-label={effectiveCollapsed ? item.label : undefined}
                >
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  {!effectiveCollapsed && <span>{item.label}</span>}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-[var(--border-subtle)] flex flex-col gap-1">
        {onToggleCollapse && (
          <button
            type="button"
            onClick={() => {
              onToggleCollapse?.();
            }}
            className={cn(
              'flex items-center gap-3 px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(99,179,237,0.05)] rounded-md transition-colors w-full',
              effectiveCollapsed && 'justify-center px-2'
            )}
            aria-label={effectiveCollapsed ? 'Expandir menú' : 'Colapsar menú'}
            title={effectiveCollapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            {effectiveCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" aria-hidden="true" />
            ) : (
              <>
                <PanelLeftClose className="w-4 h-4" aria-hidden="true" />
                <span>Colapsar menú</span>
              </>
            )}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            localStorage.removeItem('zfe_token');
            window.location.href = '/login';
          }}
          className={cn(
            'flex items-center gap-3 px-3 py-2 text-sm font-medium text-[var(--risk-high)] hover:bg-[rgba(239,68,68,0.1)] rounded-md transition-colors w-full',
            effectiveCollapsed && 'justify-center px-2'
          )}
          title="Cerrar Sesión"
        >
          <LogOut className="w-4 h-4" aria-hidden="true" />
          {!effectiveCollapsed && <span>Cerrar Sesión</span>}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden md:flex flex-col bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] h-screen sticky top-0 transition-all duration-200',
          effectiveCollapsed ? 'w-16' : 'w-[260px]'
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-40 md:hidden"
            onClick={onMobileClose}
            aria-hidden="true"
          />
          <aside
            className="fixed inset-y-0 left-0 z-50 w-[260px] flex flex-col bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] md:hidden"
          >
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}