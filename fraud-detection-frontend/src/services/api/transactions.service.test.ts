import { describe, it, expect } from 'vitest';
import { fetchTransactionDetail } from './transactions.service';
import { server } from '@/test/setup';
import { http, HttpResponse } from 'msw';

const BASE = '/api/v1';

describe('fetchTransactionDetail', () => {
  it('solicita el endpoint correcto y devuelve el detalle con explicaciones', async () => {
    let capturedUrl = '';
    server.events.on('request:start', (event) => {
      capturedUrl = event.request.url;
    });

    const detail = await fetchTransactionDetail('TX0000001');

    expect(capturedUrl).toContain(`${BASE}/transactions/TX0000001`);
    expect(detail.transactionId).toBe('TX0000001');
    expect(detail.analysis).not.toBeNull();
    expect(detail.analysis?.explanations).toContain(
      'Amount 32.3× above user average ($150)'
    );
    expect(detail.analysis?.riskLevel).toBe('CRITICAL');
  });

  it('lanza error cuando el endpoint devuelve 404', async () => {
    server.use(
      http.get(`${BASE}/transactions/:id`, () => new HttpResponse(null, { status: 404 }))
    );

    await expect(fetchTransactionDetail('TX-INEXISTENTE')).rejects.toThrow();
  });
});
