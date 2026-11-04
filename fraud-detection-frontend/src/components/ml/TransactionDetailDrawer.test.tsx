import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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
  amount: 4850.0,
  timestamp: '2023-10-27T03:14:00Z',
  country: 'NG',
  merchantId: 'M0172',
  riskLevel: 'CRITICAL',
  riskScore: 0.93,
};

const renderDrawer = (transaction: TransactionSummary = mockTransaction, onClose = () => { }) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <TransactionDetailDrawer transaction={transaction} onClose={onClose} />
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

  // ── 7 Pruebas Originales Preservadas ──────────────────────────────────────────

  it('muestra las explicaciones proporcionadas por el backend', async () => {
    renderDrawer();
    await waitFor(() => {
      expect(screen.getByText('Explicación del modelo')).toBeInTheDocument();
    });
    expect(screen.getByText('Amount 32.3× above user average ($150)')).toBeInTheDocument();
    expect(screen.getByText('First transaction from this device (D_NEW_823461)')).toBeInTheDocument();
    expect(screen.getByText("Country NG not in user's recent history")).toBeInTheDocument();
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
    await waitFor(
      () => {
        expect(screen.getByText('Explicación del modelo')).toBeInTheDocument();
      },
      { timeout: 5000 }
    );
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
          amount: 4850.0,
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
      expect(
        screen.getByText('El modelo no proporcionó explicaciones para esta transacción.')
      ).toBeInTheDocument();
    });
  });

  it('renderiza el botón de cierre del drawer', () => {
    renderDrawer();
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons[0]).toBeInTheDocument();
  });

  // ── Pruebas Nuevas de FE-06 ──────────────────────────────────────────────────

  it('renderiza la información comercial completa del panel izquierdo', async () => {
    renderDrawer();
    expect(screen.getByText('Información Comercial')).toBeInTheDocument();
    expect(screen.getByText('Monto y Divisa')).toBeInTheDocument();
    expect(screen.getByText('Cliente')).toBeInTheDocument();
    expect(screen.getByText('Comercio')).toBeInTheDocument();
    expect(screen.getByText('Canal')).toBeInTheDocument();
    expect(screen.getByText('Tarjeta')).toBeInTheDocument();
    expect(screen.getByText('IP de Origen')).toBeInTheDocument();

    // Enlace contextual al perfil del cliente
    const clientLink = screen.getByTitle('Ver perfil comportamental del usuario');
    expect(clientLink).toHaveAttribute('href', '/profile/U00042');

    // Tarjeta enmascarada para protección de datos
    expect(screen.getByText('•••• •••• •••• 4242')).toBeInTheDocument();
  });

  it('renderiza el gauge semicircular del score consolidado con accesibilidad', async () => {
    renderDrawer();
    const meter = screen.getByRole('meter', { name: /puntuación consolidada de riesgo/i });
    expect(meter).toBeInTheDocument();
    expect(meter).toHaveAttribute('aria-valuenow', '93');
    expect(meter).toHaveAttribute('aria-valuemin', '0');
    expect(meter).toHaveAttribute('aria-valuemax', '100');
    expect(screen.getByText('93%')).toBeInTheDocument();
  });

  it('presenta los tres bloques analíticos: Machine Learning, Anomalías y Conductual', async () => {
    renderDrawer();
    await waitFor(() => {
      expect(screen.getByText('1. Machine Learning')).toBeInTheDocument();
      expect(screen.getByText('2. Análisis de Anomalías')).toBeInTheDocument();
      expect(screen.getByText('3. Análisis Conductual')).toBeInTheDocument();
    });
  });

  it('diferencia entre anomaly_score y el indicador booleano anomaly_alert', async () => {
    renderDrawer();
    await waitFor(() => {
      // Con anomalyScore = 0.88 y anomalyAlert activo
      expect(screen.getByText('Anomalía Detectada')).toBeInTheDocument();
      expect(screen.getByText('Score de atipicidad: 0.8800')).toBeInTheDocument();
    });
  });

  it('muestra estado regular cuando no hay alerta de anomalía', async () => {
    server.use(
      http.get(`${BASE}/transactions/:id`, async () => {
        return HttpResponse.json({
          transactionId: 'TX0000004',
          externalUserId: 'U00315',
          amount: 79.99,
          timestamp: '2023-10-27T09:30:00Z',
          country: 'US',
          deviceId: 'D00099',
          merchantId: 'M0099',
          currency: 'USD',
          createdAt: '2023-10-27T09:30:01Z',
          analysis: {
            analysisId: 'ANA-0004',
            transactionId: 'TX0000004',
            fraudProbability: 0.08,
            anomalyScore: 0.05,
            anomalyAlert: false,
            behavioralDeviation: 0.04,
            riskScore: 0.08,
            riskLevel: 'LOW',
            explanations: ['Transaction within acceptable risk parameters'],
            modelVersion: '1.0.0',
            analyzedAt: '2023-10-27T09:30:02Z',
            analyzedBy: 'analyst@frauddetect.io',
          },
        });
      })
    );

    const lowTx: TransactionSummary = {
      transactionId: 'TX0000004',
      externalUserId: 'U00315',
      amount: 79.99,
      timestamp: '2023-10-27T09:30:00Z',
      country: 'US',
      merchantId: 'M0099',
      riskLevel: 'LOW',
      riskScore: 0.08,
    };

    renderDrawer(lowTx);
    await waitFor(() => {
      expect(screen.getByText('Patrón Regular')).toBeInTheDocument();
      expect(screen.getByText('Comportamiento Habitual')).toBeInTheDocument();
    });
  });

  it('maneja valores nulos de análisis de forma segura', async () => {
    server.use(
      http.get(`${BASE}/transactions/:id`, async () => {
        return HttpResponse.json({
          transactionId: 'TX0000001',
          externalUserId: 'U00042',
          amount: 4850.0,
          timestamp: '2023-10-27T03:14:00Z',
          country: 'NG',
          deviceId: 'D_NEW_823461',
          merchantId: 'M0172',
          currency: 'USD',
          createdAt: '2023-10-27T03:14:01Z',
          analysis: null,
        });
      })
    );

    renderDrawer();
    await waitFor(() => {
      expect(screen.getByText('Información Comercial')).toBeInTheDocument();
      expect(screen.getByText('Evaluación de Riesgo')).toBeInTheDocument();
    });
  });

  it('maneja respuesta HTTP 404 con mensaje claro y botón para volver al explorador', async () => {
    const handleClose = () => { };
    server.use(
      http.get(`${BASE}/transactions/:id`, () => new HttpResponse(null, { status: 404 }))
    );

    renderDrawer(mockTransaction, handleClose);
    await waitFor(() => {
      expect(screen.getByText(/Transacción no encontrada \(404\)/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /volver al explorador/i })).toBeInTheDocument();
  });

  it('permite crear una alerta manual con severidad, descripción y confirmación Toast', async () => {
    const txWithoutAlert: TransactionSummary = {
      transactionId: 'TX0000003',
      externalUserId: 'U00203',
      amount: 320.0,
      timestamp: '2023-10-27T11:15:00Z',
      country: 'ES',
      merchantId: 'M0044',
      riskLevel: 'MEDIUM',
      riskScore: 0.48,
    };

    renderDrawer(txWithoutAlert);
    await waitFor(() => {
      expect(screen.getByText('TX0000003')).toBeInTheDocument();
      expect(screen.getByText('Información Comercial')).toBeInTheDocument();
    });

    const createBtn = screen.getByRole('button', { name: /crear alerta manual/i });
    expect(createBtn).toBeInTheDocument();
    expect(createBtn).not.toBeDisabled();

    fireEvent.click(createBtn);

    // Debe abrirse el formulario modal contextual
    expect(screen.getByText('Crear Alerta Manual de Fraude')).toBeInTheDocument();

    // Seleccionar severidad CRITICAL
    const criticalBtn = screen.getByRole('button', { name: 'CRITICAL' });
    fireEvent.click(criticalBtn);

    // Escribir descripción y comprobar contador de caracteres
    const textarea = screen.getByPlaceholderText(/detalla el patrón o anomalía observada/i);
    fireEvent.change(textarea, { target: { value: 'Transacción anómala verificada manualmente por analista.' } });
    expect(screen.getByText('56/1000')).toBeInTheDocument();

    // Enviar formulario
    const submitBtn = screen.getByRole('button', { name: /confirmar alerta/i });
    fireEvent.click(submitBtn);

    // Debe mostrar Toast de confirmación y cerrarse el modal
    await waitFor(() => {
      expect(screen.getByText(/creada exitosamente/i)).toBeInTheDocument();
    });
    expect(screen.queryByText('Crear Alerta Manual de Fraude')).not.toBeInTheDocument();
  });

  it('deshabilita el botón de crear alerta cuando ya existe una alerta activa', async () => {
    renderDrawer(mockTransaction);
    await waitFor(() => {
      const createBtn = screen.getByRole('button', { name: /alerta abierta existente/i });
      expect(createBtn).toBeDisabled();
      expect(createBtn).toHaveAttribute('title', 'Ya existe una alerta activa para esta transacción');
    });
  });

  it('muestra mensaje de error cuando falla la creación de alerta manual', async () => {
    server.use(
      http.post(`${BASE}/alerts`, () =>
        HttpResponse.json(
          { title: 'Conflict', detail: 'Ya existe una alerta abierta para esta transacción' },
          { status: 409 }
        )
      )
    );

    const txWithoutAlert: TransactionSummary = {
      transactionId: 'TX0000003',
      externalUserId: 'U00203',
      amount: 320.0,
      timestamp: '2023-10-27T11:15:00Z',
      country: 'ES',
      merchantId: 'M0044',
      riskLevel: 'MEDIUM',
      riskScore: 0.48,
    };

    renderDrawer(txWithoutAlert);
    await waitFor(() => {
      expect(screen.getByText('TX0000003')).toBeInTheDocument();
      expect(screen.getByText('Información Comercial')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /crear alerta manual/i }));
    expect(screen.getByText('Crear Alerta Manual de Fraude')).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText(/detalla el patrón o anomalía observada/i);
    fireEvent.change(textarea, { target: { value: 'Intento de alerta duplicada' } });

    fireEvent.click(screen.getByRole('button', { name: /confirmar alerta/i }));

    await waitFor(() => {
      expect(screen.getByText(/conflicto/i)).toBeInTheDocument();
    });
  });

  it('permite registrar la revisión de una alerta asociada con notas y muestra Toast de éxito', async () => {
    renderDrawer();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /marcar alerta como revisada/i })).toBeInTheDocument();
    });

    const reviewBtn = screen.getByRole('button', { name: /marcar alerta como revisada/i });
    fireEvent.click(reviewBtn);

    // Debe abrirse el formulario de revisión
    expect(screen.getByText('Registrar Revisión de Alerta')).toBeInTheDocument();
    const textarea = screen.getByPlaceholderText(/detalla las conclusiones de la investigación/i);
    expect(textarea).toBeInTheDocument();

    fireEvent.change(textarea, { target: { value: 'Comercio habitual verificado telefónicamente.' } });

    const confirmBtn = screen.getByRole('button', { name: /confirmar revisión/i });
    fireEvent.click(confirmBtn);

    // Debe mostrarse el Toast con confirmación
    await waitFor(() => {
      expect(screen.getByText(/marcada como REVISADA/i)).toBeInTheDocument();
    });
  });

  it('muestra estado de carga y previene envíos duplicados durante la revisión', async () => {
    server.use(
      http.patch(`${BASE}/alerts/:id/review`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
        return HttpResponse.json({
          alertId: 'ALT-001',
          status: 'REVIEWED',
          reviewedAt: new Date().toISOString(),
          reviewedBy: 'analyst@frauddetect.io',
        });
      })
    );

    renderDrawer();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /marcar alerta como revisada/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /marcar alerta como revisada/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /confirmar revisión/i })).toBeInTheDocument();
    });

    const confirmBtn = screen.getByRole('button', { name: /confirmar revisión/i });
    fireEvent.click(confirmBtn);

    // El botón debe deshabilitarse y mostrar spinner
    await waitFor(() => {
      expect(screen.getByText(/guardando/i)).toBeInTheDocument();
    });
    expect(confirmBtn).toBeDisabled();

    await waitFor(() => {
      expect(screen.getByText(/marcada como REVISADA/i)).toBeInTheDocument();
    });
  });

  it('cumple con atributos de accesibilidad ARIA modal y semántica', () => {
    renderDrawer();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'drawer-title');
  });
});
