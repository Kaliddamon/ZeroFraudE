import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';

export function AuthLayout() {
  const token = localStorage.getItem('zfe_token');
  
  // If already logged in, redirect to dashboard
  if (token) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[var(--bg-base)]">
      {/* Background Decorators */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[var(--brand)] blur-[150px] opacity-[0.15]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[var(--gold)] blur-[150px] opacity-[0.08]" />
      
      {/* Subtle grid pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik0wIDBoNDB2NDBIMHoiIGZpbGw9Im5vbmUiLz4KPHBhdGggZD0iTTAgNDBoNDBNNDAgMHY0MCIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDMpIiBzdHJva2Utd2lkdGg9IjEiIGZpbGw9Im5vbmUiLz4KPC9zdmc+')] opacity-50" />

      <div className="relative z-10 w-full max-w-[420px] px-6">
        <Outlet />
      </div>
    </div>
  );
}
