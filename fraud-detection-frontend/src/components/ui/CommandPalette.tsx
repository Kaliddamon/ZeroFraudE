import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Search,
  Bell,
  Activity,
  PanelLeftClose,
  LogOut,
  Command,
} from 'lucide-react';


interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  icon: React.ElementType;
  action: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onToggleSidebar: () => void;
}

export function CommandPalette({ open, onClose, onToggleSidebar }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const commands: CommandItem[] = useMemo(
    () => [
      { id: 'dashboard', label: 'Ir a Dashboard', icon: LayoutDashboard, action: () => navigate('/dashboard') },
      { id: 'transactions', label: 'Ir a Explorador de Transacciones', icon: Search, action: () => navigate('/transactions') },
      { id: 'alerts', label: 'Ir a Centro de Alertas', icon: Bell, action: () => navigate('/alerts') },
      { id: 'profiles', label: 'Ir a Perfiles de Usuario', icon: Activity, action: () => navigate('/behavior') },
      { id: 'toggle-sidebar', label: 'Colapsar/expandir menú', icon: PanelLeftClose, action: onToggleSidebar },
      {
        id: 'logout',
        label: 'Cerrar sesión',
        icon: LogOut,
        action: () => {
          localStorage.removeItem('zfe_token');
          window.location.href = '/login';
        },
      },
    ],
    [navigate, onToggleSidebar]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q));
  }, [commands, query]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Paleta de comandos"
    >
      <div
        className="w-full max-w-lg bg-[#141618] border border-[#2D333B] rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#23272B]">
          <Command className="w-4 h-4 text-[#808893]" aria-hidden="true" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar comando o navegación..."
            aria-label="Buscar comando"
            className="flex-1 bg-transparent text-sm font-mono text-[#F3F4F6] placeholder:text-[#606770] focus:outline-none"
          />
          <kbd className="text-[10px] font-mono text-[#808893] bg-[#1F2328] border border-[#2D333B] rounded px-1.5 py-0.5">
            Esc
          </kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto py-2" role="listbox">
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-xs font-mono text-[#808893]">Sin resultados</li>
          ) : (
            filtered.map((cmd) => {
              const Icon = cmd.icon;
              return (
                <li key={cmd.id} role="option">
                  <button
                    type="button"
                    onClick={() => {
                      cmd.action();
                      onClose();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-[#D1D5DB] hover:bg-[#1B1E21] hover:text-[#F3F4F6] transition-colors text-left"
                  >
                    <Icon className="w-4 h-4 text-[#808893]" aria-hidden="true" />
                    <span>{cmd.label}</span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
        <div className="px-4 py-2 border-t border-[#23272B] text-[10px] font-mono text-[#606770] flex items-center justify-between">
          <span>Navegación y acciones reales</span>
          <span>Ctrl/Cmd + K</span>
        </div>
      </div>
    </div>
  );
}