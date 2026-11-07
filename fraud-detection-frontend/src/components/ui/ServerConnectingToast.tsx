import React, { useEffect, useState } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';

export function ServerConnectingToast() {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected'>('idle');

  useEffect(() => {
    let hideTimer: any;

    const handleConnecting = (e: CustomEvent<{ active: boolean }>) => {
      if (e.detail?.active) {
        clearTimeout(hideTimer);
        setStatus('connecting');
      } else {
        setStatus(prev => {
          if (prev === 'connecting') {
            hideTimer = setTimeout(() => setStatus('idle'), 2500);
            return 'connected';
          }
          return 'idle';
        });
      }
    };

    window.addEventListener('zfe:connecting', handleConnecting as EventListener);
    return () => {
      window.removeEventListener('zfe:connecting', handleConnecting as EventListener);
      clearTimeout(hideTimer);
    };
  }, []);

  if (status === 'idle') return null;

  return (
    <div className="fixed top-5 right-5 z-50 animate-in fade-in slide-in-from-top-3 duration-300">
      <div
        className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border shadow-lg backdrop-blur-md font-mono text-xs transition-colors duration-200 ${
          status === 'connecting'
            ? 'bg-[#141618]/95 border-amber-500/30 text-amber-300 shadow-amber-500/5'
            : 'bg-[#141618]/95 border-emerald-500/30 text-emerald-300 shadow-emerald-500/5'
        }`}
      >
        {status === 'connecting' ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
            <span>Conectando con el servidor...</span>
          </>
        ) : (
          <>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Conexión establecida</span>
          </>
        )}
      </div>
    </div>
  );
}

