import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import UserProfile from './UserProfile';
import { server } from '@/test/setup';
import { http, HttpResponse } from 'msw';
import type { PagedResponse } from '@/types/api.types';
import type { TransactionSummary, TransactionDetail } from '@/types/transaction.types';

const BASE = '/api/v1';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockTxSummaries: TransactionSummary[] = [
  { transactionId: 'TX0000001', externalUserId: 'U00042', amount: 4850.00, timestamp: '2023-10-27T03:14:00Z', country: 'NG', merchantId: 'M0172', riskLevel: 'CRITICAL', riskScore: 0.93 },
  { transactionId: 'TX0000002', externalUserId: 'U00042', amount: 1250.50, timestamp: '2023-10-26T14:32:00Z', country: 'US', merchantId: 'M0005', riskLevel: 'HIGH',     riskScore: 0.72 },
];

const mockTxDetail: TransactionDetail = {
  transactionId: 'TX0000001',
  externalUserId: 'U00042',
  amount: 4850.00,
  timestamp: '2023-10-27T03:14:00Z',
  country: 'NG',
  deviceId: 'D_NEW_823461',
  merchantId: 'M0172',
  currency: 'USD',
  createdAt: '2023-10-27T03:14:01Z',
  analysis: null,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } });

const renderProfile = (userId = 'U00042', search = '') => {
  const qc = makeQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/profile/${userId}${search}`]}>
        <Routes>
          <Route path="/profile/:userId" element={<UserProfile />} />
          <Route path="/profile" element={<UserProfile />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('UserProfile', () => {
  afterEach(() => {
    server.resetHandlers();
  });

  // ── Existing tests (preserved) ────────────────────────────────────────────

  it('renderiza las métricas de comportamiento histórico del usuario', async () => {
    renderProfile('U00042');

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

    renderProfile('U_NEW_99');

    await waitFor(() => {
      expect(screen.getByRole('note', { name: /perfil de arranque en frío/i })).toBeInTheDocument();
      expect(screen.getByText('Perfil Cold Start')).toBeInTheDocument();
    });
  });

  it('muestra mensaje cuando no se especifica un ID de usuario', () => {
    const qc = makeQueryClient();
    render(
      <QueryClientProvider client={qc}>
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

    renderProfile('UNKNOWN_USER');

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/no se encontró un perfil para el usuario "UNKNOWN_USER"/i)).toBeInTheDocument();
    });
  });

  // ── New: Transaction History table ────────────────────────────────────────

  it('muestra la tabla de historial de transacciones del usuario', async () => {
    server.use(
      http.get(`${BASE}/users/:id/transactions`, () => {
        const response: PagedResponse<TransactionSummary> = {
          content: mockTxSummaries,
          page: 0, size: 5,
          totalElements: 2, totalPages: 1,
        };
        return HttpResponse.json(response);
      })
    );

    renderProfile('U00042');

    await waitFor(() => {
      const table = screen.getByRole('table', { name: /historial de transacciones/i });
      expect(table).toBeInTheDocument();
      expect(within(table).getByText('TX0000001')).toBeInTheDocument();
      expect(within(table).getByText('TX0000002')).toBeInTheDocument();
      // RiskBadge labels
      expect(within(table).getByRole('status', { name: /riesgo crítico/i })).toBeInTheDocument();
      expect(within(table).getByRole('status', { name: /riesgo alto/i })).toBeInTheDocument();
    });
  });

  it('muestra estado vacío cuando el usuario no tiene transacciones', async () => {
    server.use(
      http.get(`${BASE}/users/:id/transactions`, () => {
        const response: PagedResponse<TransactionSummary> = {
          content: [], page: 0, size: 5, totalElements: 0, totalPages: 0,
        };
        return HttpResponse.json(response);
      })
    );

    renderProfile('U00042');

    await waitFor(() => {
      expect(screen.getByText('No hay transacciones registradas')).toBeInTheDocument();
    });
  });

  it('muestra paginación cuando hay más de una página de transacciones', async () => {
    const page1: TransactionSummary[] = [
      { transactionId: 'TX_P1', externalUserId: 'U00042', amount: 100, timestamp: '2023-10-27T10:00:00Z', country: 'US', merchantId: 'M001', riskLevel: 'LOW', riskScore: 0.1 },
    ];
    const page2: TransactionSummary[] = [
      { transactionId: 'TX_P2', externalUserId: 'U00042', amount: 200, timestamp: '2023-10-26T10:00:00Z', country: 'ES', merchantId: 'M002', riskLevel: 'MEDIUM', riskScore: 0.4 },
    ];

    let currentPage = 0;
    server.use(
      http.get(`${BASE}/users/:id/transactions`, ({ request }) => {
        const url = new URL(request.url);
        currentPage = parseInt(url.searchParams.get('page') ?? '0');
        const content = currentPage === 0 ? page1 : page2;
        const response: PagedResponse<TransactionSummary> = {
          content, page: currentPage, size: 5, totalElements: 2, totalPages: 2,
        };
        return HttpResponse.json(response);
      })
    );

    renderProfile('U00042');

    // Page 1 visible
    await waitFor(() => {
      expect(screen.getByText('TX_P1')).toBeInTheDocument();
    });
    expect(screen.getByText(/página 1 de 2/i)).toBeInTheDocument();

    // Navigate to page 2
    fireEvent.click(screen.getByRole('button', { name: /página siguiente/i }));

    await waitFor(() => {
      expect(screen.getByText('TX_P2')).toBeInTheDocument();
    });
    expect(screen.getByText(/página 2 de 2/i)).toBeInTheDocument();
  });

  // ── New: Comparison Panel ─────────────────────────────────────────────────

  it('muestra el panel de comparación cuando txId está en la URL', async () => {
    server.use(
      http.get(`${BASE}/transactions/:id`, () => {
        return HttpResponse.json(mockTxDetail);
      })
    );

    renderProfile('U00042', '?txId=TX0000001');

    await waitFor(() => {
      expect(
        screen.getByRole('region', { name: /comparación con perfil histórico/i })
      ).toBeInTheDocument();
    });
  });

  it('muestra Desviación cuando el monto es más del doble del promedio', async () => {
    // TX amount = 4850 vs average 150.20 → ratio ≈ 32× → deviation
    server.use(
      http.get(`${BASE}/transactions/:id`, () => HttpResponse.json(mockTxDetail))
    );

    renderProfile('U00042', '?txId=TX0000001');

    await waitFor(() => {
      const panel = screen.getByRole('region', { name: /comparación con perfil histórico/i });
      expect(within(panel).getAllByText('Desviación').length).toBeGreaterThan(0);
    });
  });

  it('muestra etiqueta Habitual para país dentro del perfil', async () => {
    // country US is in behavior.typicalCountries ['US','ES']
    const txUSDetail: TransactionDetail = {
      ...mockTxDetail,
      transactionId: 'TX_US',
      country: 'US',
      amount: 150,       // near average → match
      deviceId: 'D00042A', // known device → match
      merchantId: 'M0005',  // top merchant → match
      timestamp: '2023-10-27T10:00:00Z', // 10 UTC, within 08–22 → match
    };
    server.use(
      http.get(`${BASE}/transactions/:id`, () => HttpResponse.json(txUSDetail))
    );

    renderProfile('U00042', '?txId=TX_US');

    await waitFor(() => {
      const panel = screen.getByRole('region', { name: /comparación con perfil histórico/i });
      // should have at least one "Habitual" badge
      expect(within(panel).getAllByText('Habitual').length).toBeGreaterThan(0);
    });
  });

  it('muestra aviso de Cold Start con txId para usuario nuevo', async () => {
    server.use(
      http.get(`${BASE}/users/:id/behavior`, () =>
        HttpResponse.json({
          externalUserId: 'U_NEW',
          transactionCount: 2,
          averageAmount: 50.0,
          typicalHourRange: '10:00–12:00',
          typicalCountries: ['CO'],
          knownDevices: ['DEV_1'],
          topMerchants: ['M001'],
          lastActivityAt: '2023-10-27T10:00:00Z',
          riskSummary: { totalHighRisk: 0, totalMediumRisk: 0, fraudConfirmed: 0 },
        })
      ),
      http.get(`${BASE}/transactions/:id`, () => HttpResponse.json(mockTxDetail))
    );

    renderProfile('U_NEW', '?txId=TX0000001');

    await waitFor(() => {
      expect(
        screen.getByRole('region', { name: /comparación — cold start/i })
      ).toBeInTheDocument();
      expect(screen.getByText(/perfil tiene/i)).toBeInTheDocument();
    });
  });

  it('muestra aviso sin transacción cuando no hay txId en la URL', async () => {
    renderProfile('U00042');

    await waitFor(() => {
      expect(
        screen.getByRole('region', { name: /sin transacción seleccionada para comparación/i })
      ).toBeInTheDocument();
    });
  });

  // ── New: ExplainabilityPanel link propagation ─────────────────────────────

  it('abre el detalle de una transacción del historial al hacer clic en Ver', async () => {
    server.use(
      http.get(`${BASE}/users/:id/transactions`, () => {
        const response: PagedResponse<TransactionSummary> = {
          content: [mockTxSummaries[0]],
          page: 0, size: 5, totalElements: 1, totalPages: 1,
        };
        return HttpResponse.json(response);
      }),
      http.get(`${BASE}/transactions/:id`, () => HttpResponse.json(mockTxDetail))
    );

    renderProfile('U00042');

    await waitFor(() => {
      expect(screen.getByText('TX0000001')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /ver detalle de TX0000001/i }));

    // Wait for the drawer detail to load — it fetches /transactions/:id and renders the analysis panel
    await waitFor(() => {
      // The drawer is open: "Cerrar panel de detalle" button exists
      expect(
        screen.getByRole('button', { name: /cerrar panel de detalle/i })
      ).toBeInTheDocument();
    });
  });
});
