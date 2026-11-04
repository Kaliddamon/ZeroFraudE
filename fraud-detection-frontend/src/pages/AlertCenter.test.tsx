import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import AlertCenter from './AlertCenter';
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

const renderAlertCenter = () => {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AlertCenter />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('AlertCenter', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  it('renderiza el título y la lista inicial de alertas desde el backend', async () => {
    renderAlertCenter();

    expect(screen.getByText('Centro de Alertas')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('ALT-001')).toBeInTheDocument();
      expect(screen.getByText('ALT-002')).toBeInTheDocument();
      expect(screen.getByText('ALT-003')).toBeInTheDocument();
      expect(screen.getByText('ALT-004')).toBeInTheDocument();
    });
  });

  it('permite filtrar alertas por estado', async () => {
    renderAlertCenter();

    await waitFor(() => {
      expect(screen.getByText('ALT-001')).toBeInTheDocument();
    });

    const statusSelect = screen.getByLabelText(/filtrar por estado/i);
    fireEvent.change(statusSelect, { target: { value: 'OPEN' } });

    await waitFor(() => {
      // Mock handler filters mockAlerts when status=OPEN
      expect(screen.getByText('ALT-001')).toBeInTheDocument();
      expect(screen.queryByText('ALT-004')).not.toBeInTheDocument();
    });
  });

  it('permite abrir el TransactionDetailDrawer al hacer clic en "Ver detalle"', async () => {
    renderAlertCenter();

    await waitFor(() => {
      expect(screen.getByLabelText('Ver detalle de alerta ALT-001')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Ver detalle de alerta ALT-001'));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'TX0000001' })).toBeInTheDocument();
    });
  });

  it('muestra mensaje de error cuando la API responde con fallo', async () => {
    server.use(
      http.get(`${BASE}/alerts`, () => {
        return new HttpResponse(null, { status: 500 });
      })
    );

    renderAlertCenter();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/error al cargar las alertas/i)).toBeInTheDocument();
    });
  });

  it('muestra estado vacío cuando no existen alertas', async () => {
    server.use(
      http.get(`${BASE}/alerts`, () => {
        return HttpResponse.json({
          content: [],
          page: 0,
          size: 20,
          totalElements: 0,
          totalPages: 0,
        });
      })
    );

    renderAlertCenter();

    await waitFor(() => {
      expect(screen.getByText(/no se encontraron alertas/i)).toBeInTheDocument();
    });
  });
});
