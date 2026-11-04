import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import UserProfile from './UserProfile';
import { server } from '@/test/setup';
import { http, HttpResponse } from 'msw';

const BASE = '/api/v1';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const renderUserProfile = (userId = 'U00042') => {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/profile/${userId}`]}>
        <Routes>
          <Route path="/profile/:userId" element={<UserProfile />} />
          <Route path="/profile" element={<UserProfile />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('UserProfile', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  it('renderiza las métricas de comportamiento histórico del usuario', async () => {
    renderUserProfile('U00042');

    await waitFor(() => {
      expect(screen.getByText('Perfil de Comportamiento')).toBeInTheDocument();
      expect(screen.getByText('U00042')).toBeInTheDocument();
      expect(screen.getByText('47')).toBeInTheDocument(); // transactionCount
      expect(screen.getByText('$150,20')).toBeInTheDocument(); // averageAmount
      expect(screen.getByText(/08:00.*22:00/)).toBeInTheDocument(); // typicalHourRange
      expect(screen.getByText('US')).toBeInTheDocument(); // country
      expect(screen.getByText('ES')).toBeInTheDocument(); // country
      expect(screen.getByText('D00042A')).toBeInTheDocument(); // device
      expect(screen.getByText('M0005')).toBeInTheDocument(); // merchant
    });
  });

  it('muestra el banner de Cold Start cuando el usuario tiene menos de 5 transacciones', async () => {
    server.use(
      http.get(`${BASE}/users/:id/behavior`, () => {
        return HttpResponse.json({
          externalUserId: 'U_NEW_99',
          transactionCount: 2,
          averageAmount: 50.0,
          typicalHourRange: '10:00—12:00',
          typicalCountries: ['CO'],
          knownDevices: ['DEV_1'],
          topMerchants: ['M001'],
          lastActivityAt: '2023-10-27T10:00:00Z',
          riskSummary: { totalHighRisk: 0, totalMediumRisk: 0, fraudConfirmed: 0 },
        });
      })
    );

    renderUserProfile('U_NEW_99');

    await waitFor(() => {
      expect(screen.getByRole('note', { name: /perfil de arranque en frío/i })).toBeInTheDocument();
      expect(screen.getByText('Perfil Cold Start')).toBeInTheDocument();
    });
  });

  it('muestra mensaje cuando no se especifica un ID de usuario', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/profile']}>
          <Routes>
            <Route path="/profile" element={<UserProfile />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText(/no se especificó un ID de usuario/i)).toBeInTheDocument();
  });

  it('maneja error 404 cuando el usuario no existe', async () => {
    server.use(
      http.get(`${BASE}/users/:id/behavior`, () => {
        return new HttpResponse(null, { status: 404 });
      })
    );

    renderUserProfile('UNKNOWN_USER');

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/no se encontró un perfil para el usuario "UNKNOWN_USER"/i)).toBeInTheDocument();
    });
  });
});
