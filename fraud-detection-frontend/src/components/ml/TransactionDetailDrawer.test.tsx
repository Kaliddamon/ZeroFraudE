import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TransactionDetailDrawer } from './TransactionDetailDrawer';
import { server } from '@/test/setup';
import { http, HttpResponse } from 'msw';
import type { TransactionSummary } from '@/types/transaction.types';

const BASE = '/api/v1';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const mockTransaction: TransactionSummary = {
  transactionId: 'TX0000001',
  externalUserId: 'U00042',
  amount: 4850.00,
  timestamp: '2023-10-27T03:14:00Z',
  country: 'NG',
  merchantId: 'M0172',
  riskLevel: 'CRITICAL',
  riskScore: 0.93,
};

const renderDrawer = (transaction: TransactionSummary = mockTransaction) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <TransactionDetailDrawer transaction={transaction} onClose={() => {}} />
    </QueryClientProvider>
  );
};

describe('TransactionDetailDrawer', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  it('muestra las explicaciones proporcionadas por el backend', async () => {
    renderDrawer();
    await waitFor(() => {
      expect(screen.getByText('Explicación del modelo')).toBeInTheDocument();
    });
    expect(screen.getByText('Amount 32.3× above user average ($150)')).toBeInTheDocument();
    expect(screen.getByText('First transaction from this device (D_NEW_823461)')).toBeInTheDocument();
    expect(screen.getByText('Country NG not in user\'s recent history')).toBeInTheDocument();
  });

  it('no muestra las atribuciones numéricas hardcodeadas anteriores', async () => {
    renderDrawer();
    await waitFor(() => {
      expect(screen.getByText('Explicación del modelo')).toBeInTheDocument();
    });
    expect(screen.queryByText('amount_ratio_to_user_avg')).not.toBeInTheDocument();
    expect(screen.queryByText('+0.42')).not.toBeInTheDocument();
    expect(screen.queryByText('device_is_new_flag')).not.toBeInTheDocument();
  });

  it('muestra la transacción seleccionada y su nivel de riesgo autoritativo', async () => {
    renderDrawer();
    expect(screen.getByText('TX0000001')).toBeInTheDocument();
    expect(screen.getByText('Riesgo Crítico')).toBeInTheDocument();
  });

  it('muestra un indicador de carga y luego el detalle', async () => {
    renderDrawer();
    // El detalle debe aparecer eventualmente (MSW fakeDelay)
    await waitFor(() => {
      expect(screen.getByText('Explicación del modelo')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('muestra estado de error cuando falla la consulta', async () => {
    server.use(
      http.get(`${BASE}/transactions/:id`, () => new HttpResponse(null, { status: 500 }))
    );
    renderDrawer();
    await waitFor(() => {
      expect(screen.getByText('Error al cargar detalles')).toBeInTheDocument();
    });
    expect(screen.getByText('Reintentar')).toBeInTheDocument();
  });

  it('muestra estado vacío cuando no existen explicaciones', async () => {
    server.use(
      http.get(`${BASE}/transactions/:id`, async () => {
        return HttpResponse.json({
          transactionId: 'TX0000001',
          externalUserId: 'U00042',
          amount: 4850.00,
          timestamp: '2023-10-27T03:14:00Z',
          country: 'NG',
          deviceId: 'D_NEW_823461',
          merchantId: 'M0172',
          currency: 'USD',
          createdAt: '2023-10-27T03:14:01Z',
          analysis: {
            analysisId: 'ANA-0001',
            transactionId: 'TX0000001',
            fraudProbability: 0.94,
            anomalyScore: 0.88,
            behavioralDeviation: 0.96,
            riskScore: 0.93,
            riskLevel: 'CRITICAL',
            explanations: [],
            modelVersion: '1.0.0',
            analyzedAt: '2023-10-27T03:14:02Z',
            analyzedBy: 'analyst@frauddetect.io',
          },
        });
      })
    );
    renderDrawer();
    await waitFor(() => {
      expect(screen.getByText('El modelo no proporcionó explicaciones para esta transacción.')).toBeInTheDocument();
    });
  });

  it('renderiza el botón de cierre del drawer', () => {
    renderDrawer();
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons[0]).toBeInTheDocument();
  });
});
