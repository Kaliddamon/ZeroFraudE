import type { RiskLevel, AlertStatus, AlertSeverity, PaginationParams } from './api.types';

// ── Alert Decisions ───────────────────────────────────────────────────────────

export type AlertDecision = 'FRAUD_CONFIRMED' | 'FALSE_POSITIVE' | 'REQUIRES_FOLLOWUP';

// ── Alert Types ───────────────────────────────────────────────────────────────

export interface Alert {
  alertId: string;
  transactionId: string;
  severity: AlertSeverity;
  description: string;
  status: AlertStatus;
  decision?: AlertDecision;
  notes?: string;
  createdAt: string;
  riskScore: number;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface AlertDetail extends Alert {
  transaction: import('./transaction.types').TransactionDetail;
}

export interface AlertReviewResponse {
  alertId: string;
  status: AlertStatus;
  decision: AlertDecision;
  reviewedAt: string;
  reviewedBy: string;
  notes?: string;
}

export interface AlertFilters extends PaginationParams {
  status?: AlertStatus;
  severity?: AlertSeverity;
  from?: string;
  to?: string;
}

export interface ReviewAlertRequest {
  decision: AlertDecision;
  notes?: string;
}

export interface CreateAlertRequest {
  transactionId: string;
  severity: 'HIGH' | 'CRITICAL';
  description: string;
}

export interface CreateAlertResponse {
  alertId: string;
  transactionId: string;
  severity: AlertSeverity;
  description: string;
  status: AlertStatus;
  createdAt: string;
  riskScore: number;
}

// ── Dashboard Statistics ──────────────────────────────────────────────────────

export interface DashboardStatistics {
  period: {
    from: string;
    to: string;
  };
  totalTransactions: number;
  analyzedTransactions: number;
  fraudDetected: number;
  fraudRate: number;
  averageRiskScore: number;
  riskDistribution: Record<RiskLevel, number>;
  openAlerts: number;
  riskTrend: Array<{
    date: string;
    high: number;
    medium: number;
    low: number;
  }>;
  amountAtRisk?: number;
  protectedCapital?: number;
}

// ── User Behavior ─────────────────────────────────────────────────────────────

export interface UserBehavior {
  externalUserId: string;
  transactionCount: number;
  averageAmount: number;
  typicalHourRange: string;
  typicalCountries: string[];
  knownDevices: string[];
  topMerchants: string[];
  lastActivityAt: string;
  riskSummary: {
    totalHighRisk: number;
    totalMediumRisk: number;
    fraudConfirmed: number;
  };
}
