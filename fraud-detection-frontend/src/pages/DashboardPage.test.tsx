import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from './DashboardPage';
import { server } from '@/test/setup';
import { http, HttpResponse } from 'msw';
import type { DashboardStatistics } from '@/types/alert.types';
import type { TransactionSummary } from '@/types/transaction.types';

const BASE = '/api/v1';

const mockDashboardData: DashboardStatistics = {
  period: { from: '2023-10-26T14:00:00Z', to: '2023-10-27T14:00:00Z' },
  totalTransactions: 1247,
  analyzedTransactions: 1247,
  fraudDetected: 48,
  fraudRate: 0.0385,
  averageRiskScore: 0.31,
  riskDistribution: { LOW: 980, MEDIUM: 219, HIGH: 41, CRITICAL: 7 },
  openAlerts: 14,
  amountAtRisk: 68420.50,
  protectedCapital: 42150.00,
  riskTrend: [
    { date: '2023-10-21', high: 6,  medium: 32, low: 178 },
    { date: '2023-10-22', high: 9,  medium: 40, low: 195 },
    { date: '2023-10-23', high: 11, medium: 38, low: 210 },
    { date: '2023-10-24', high: 7,  medium: 35, low: 188 },
    { date: '2023-10-25', high: 13, medium: 42, low: 201 },
    { date: '2023-10-26', high: 8,  medium: 38, low: 198 },
    { date: '2023-10-27', high: 12, medium: 45, low: 230 },
  ],
};

const mockRecentTxs: TransactionSummary[] = [
  {
    transactionId: 'TX-RECENT-01',
    externalUserId: 'U00042',
    amount: 1500.00,
    timestamp: '2023-10-27T12:00:00Z',
    country: 'US',
    merchantId: 'M001',
    riskLevel: 'CRITICAL',
    riskScore: 0.95,
  },
  {
    transactionId: 'TX-RECENT-02',
    externalUserId: 'U00099',
    amount: 85.50,
    timestamp: '2023-10-27T11:45:00Z',
    country: 'ES',
    merchantId: 'M002',
    riskLevel: 'LOW',
    riskScore: 0.05,
  },
];

const renderDashboard = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('DashboardPage', () => {
  afterEach(() => {
    server.resetHandlers();
  });

  it('renderiza correctamente las cuatro tarjetas KPI con datos reales', async () => {
    server.use(
      http.get(`${BASE}/statistics/dashboard`, () => HttpResponse.json(mockDashboardData)),
      http.get(`${BASE}/transactions`, () => HttpResponse.json({ content: mockRecentTxs }))
    );

    renderDashboard();

    await waitFor(() => {
      // KPI 1: Volumen Evaluado
      expect(screen.getByText('Volumen Evaluado')).toBeInTheDocument();
      expect(screen.getAllByText(/1[.,\s]?247/).length).toBeGreaterThan(0);

      // KPI 2: Capital Protegido (calculado desde backend: 42,150.00)
      expect(screen.getByText('Capital Protegido')).toBeInTheDocument();
      expect(screen.getByText('$42,150.00')).toBeInTheDocument();

      // KPI 3: Fraude Detectado
      expect(screen.getByText('Fraude Detectado')).toBeInTheDocument();
      expect(screen.getByText('48')).toBeInTheDocument();
      expect(screen.getByText(/3.85%/)).toBeInTheDocument();

      // KPI 4: Alertas en Cola
      expect(screen.getByText('Alertas en Cola')).toBeInTheDocument();
      expect(screen.getByText('14')).toBeInTheDocument();
    });
  });

  it('muestra "Monto en Riesgo" cuando no existe capital confirmado pero sí transacciones de alto riesgo', async () => {
    const unconfirmedData = {
      ...mockDashboardData,
      protectedCapital: 0,
      amountAtRisk: 68420.50,
    };

    server.use(
      http.get(`${BASE}/statistics/dashboard`, () => HttpResponse.json(unconfirmedData)),
      http.get(`${BASE}/transactions`, () => HttpResponse.json({ content: [] }))
    );

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Monto en Riesgo')).toBeInTheDocument();
      expect(screen.getByText('$68,420.50')).toBeInTheDocument();
      expect(screen.getByText(/Capital interceptado en transacciones alto\/crítico/i)).toBeInTheDocument();
    });
  });

  it('renderiza el gráfico Donut de distribución de riesgo con cantidades y porcentajes', async () => {
    server.use(
      http.get(`${BASE}/statistics/dashboard`, () => HttpResponse.json(mockDashboardData)),
      http.get(`${BASE}/transactions`, () => HttpResponse.json({ content: [] }))
    );

    renderDashboard();

    await waitFor(() => {
      const donutRegion = screen.getByRole('region', { name: /gráfico de distribución de riesgo/i });
      expect(donutRegion).toBeInTheDocument();

      // Verify legend contains labels and counts
      expect(within(donutRegion).getByText('Riesgo Crítico')).toBeInTheDocument();
      expect(within(donutRegion).getByText('7')).toBeInTheDocument();
      expect(within(donutRegion).getByText('Riesgo Alto')).toBeInTheDocument();
      expect(within(donutRegion).getByText('41')).toBeInTheDocument();
      expect(within(donutRegion).getByText('Riesgo Medio')).toBeInTheDocument();
      expect(within(donutRegion).getByText('219')).toBeInTheDocument();
      expect(within(donutRegion).getByText('Riesgo Bajo')).toBeInTheDocument();
      expect(within(donutRegion).getByText('980')).toBeInTheDocument();
    });
  });

  it('renderiza el gráfico de área temporal de 7 días', async () => {
    server.use(
      http.get(`${BASE}/statistics/dashboard`, () => HttpResponse.json(mockDashboardData)),
      http.get(`${BASE}/transactions`, () => HttpResponse.json({ content: [] }))
    );

    renderDashboard();

    await waitFor(() => {
      const trendRegion = screen.getByRole('region', { name: /gráfico de tendencia temporal de 7 días/i });
      expect(trendRegion).toBeInTheDocument();
      expect(within(trendRegion).getByText('Evolución Transaccional (7 Días)')).toBeInTheDocument();
      expect(within(trendRegion).getByText('Ventana 7D')).toBeInTheDocument();
    });
  });

  it('renderiza la tabla de inferencia en tiempo real y abre el drawer al hacer clic en una transacción', async () => {
    server.use(
      http.get(`${BASE}/statistics/dashboard`, () => HttpResponse.json(mockDashboardData)),
      http.get(`${BASE}/transactions`, () => HttpResponse.json({ content: mockRecentTxs })),
      http.get(`${BASE}/transactions/:id`, () =>
        HttpResponse.json({
          transactionId: 'TX-RECENT-01',
          externalUserId: 'U00042',
          amount: 1500.00,
          timestamp: '2023-10-27T12:00:00Z',
          country: 'US',
          deviceId: 'D01',
          merchantId: 'M001',
          currency: 'USD',
          createdAt: '2023-10-27T12:00:01Z',
          analysis: null,
        })
      )
    );

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('TX-RECENT-01')).toBeInTheDocument();
      expect(screen.getByText('TX-RECENT-02')).toBeInTheDocument();
    });

    // Click on TX-RECENT-01 to open drawer
    fireEvent.click(screen.getByText('TX-RECENT-01'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /cerrar panel de detalle/i })).toBeInTheDocument();
    });
  });

  it('muestra el estado de error cuando la llamada a la API falla', async () => {
    server.use(
      http.get(`${BASE}/statistics/dashboard`, () => {
        return new HttpResponse(null, { status: 500 });
      })
    );

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/error cargando métricas del dashboard/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
    });
  });
});
