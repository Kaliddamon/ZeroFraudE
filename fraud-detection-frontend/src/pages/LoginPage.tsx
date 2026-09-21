import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Mail, Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { apiClient } from '@/services/api/apiClient';
import type { AuthResponse, LoginRequest } from '@/types/api.types';

export function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    const formData = new FormData(e.currentTarget);
    const payload: LoginRequest = {
      email:    formData.get('email') as string,
      password: formData.get('password') as string,
    };

    try {
      const { data } = await apiClient.post<AuthResponse>('/auth/login', payload);
      localStorage.setItem('zfe_token', data.token);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Credenciales inválidas. Intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full animate-[fade-in_0.5s_ease-out]">
      <div className="flex flex-col items-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--brand-light)] to-[var(--brand)] flex items-center justify-center shadow-[var(--glow-brand)] mb-4">
          <ShieldCheck className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          ZeroFraud<span className="text-[var(--brand-light)]">E</span>
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Inteligencia Institucional de Riesgos
        </p>
      </div>

      <Card className="shadow-2xl">
        <CardContent className="p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            
            {error && (
              <div className="p-3 rounded-md bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.25)] text-[var(--risk-high)] text-sm font-medium text-center">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-5">
              <Input
                name="email"
                type="email"
                label="Correo Institucional"
                leftIcon={<Mail className="w-4 h-4" />}
                required
                defaultValue="analyst@frauddetect.io"
              />
              <Input
                name="password"
                type="password"
                label="Contraseña"
                leftIcon={<Lock className="w-4 h-4" />}
                required
                defaultValue="password123"
              />
            </div>

            <Button type="submit" className="w-full mt-2" size="lg" loading={loading}>
              Ingresar al Sistema
            </Button>
            
          </form>
        </CardContent>
      </Card>
      
      <p className="text-center text-xs text-[var(--text-disabled)] mt-8">
        Uso exclusivo para personal autorizado.
        <br />Todas las actividades son monitoreadas.
      </p>
    </div>
  );
}
