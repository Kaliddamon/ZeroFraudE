import { describe, it, expect } from 'vitest';
import { createAlert, fetchAlerts, fetchAlertDetail, reviewAlert } from './alerts.service';
import { server } from '@/test/setup';
import { http, HttpResponse } from 'msw';
import type { CreateAlertRequest } from '@/types/alert.types';

const BASE = '/api/v1';

describe('alerts.service', () => {
  describe('createAlert', () => {
    it('envÃ­a POST /alerts con payload correcto y devuelve la alerta creada', async () => {
      const payload: CreateAlertRequest = {
        transactionId: 'TX0000008',
        severity: 'HIGH',
        description: 'Alerta manual creada para validaciÃ³n',
      };

      const result = await createAlert(payload);

      expect(result).toBeDefined();
      expect(result.transactionId).toBe(payload.transactionId);
      expect(result.severity).toBe('HIGH');
      expect(result.status).toBe('OPEN');
    });

    it('propaga error cuando la API devuelve conflicto 409', async () => {
      server.use(
        http.post(`${BASE}/alerts`, () =>
          HttpResponse.json(
            { title: 'Conflict', detail: 'Ya existe una alerta activa para esta transacciÃ³n' },
            { status: 409 }
          )
        )
      );

      const payload: CreateAlertRequest = {
        transactionId: 'TX0000001',
        severity: 'CRITICAL',
        description: 'Intento duplicado',
      };

      await expect(createAlert(payload)).rejects.toThrow();
    });
  });

  describe('fetchAlerts', () => {
    it('obtiene la lista paginada de alertas', async () => {
      const result = await fetchAlerts();
      expect(result.content).toBeInstanceOf(Array);
      expect(result.content.length).toBeGreaterThan(0);
    });
  });

  describe('fetchAlertDetail', () => {
    it('obtiene el detalle de una alerta existente', async () => {
      const result = await fetchAlertDetail('ALT-001');
      expect(result.alertId).toBe('ALT-001');
      expect(result.transaction).toBeDefined();
    });
  });

  describe('reviewAlert', () => {
    it('registra la revisión de la alerta con decisión y devuelve estado REVIEWED', async () => {
      const result = await reviewAlert('ALT-001', {
        decision: 'FRAUD_CONFIRMED',
        notes: 'Revisión satisfactoria',
      });
      expect(result.alertId).toBe('ALT-001');
      expect(result.status).toBe('REVIEWED');
      expect(result.decision).toBe('FRAUD_CONFIRMED');
      expect(result.notes).toBe('Revisión satisfactoria');
    });

    it('rechaza la revisión cuando falta la decisión obligatoria', async () => {
      // @ts-expect-error probando rechazo de payload sin decisión
      await expect(reviewAlert('ALT-001', { notes: 'Sin decisión' })).rejects.toThrow();
    });
  });
});
