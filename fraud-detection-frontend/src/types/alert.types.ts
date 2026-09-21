import type { RiskLevel, AlertStatus, AlertSeverity, PaginationParams } from './api.types';

// ── Alert Types ───────────────────────────────────────────────────────────────

export interface Alert {
  alertId: string;
  transactionId: string;
  severity: AlertSeverity;
  description: string;
  status: AlertStatus;
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
  reviewedAt: string;
  reviewedBy: string;
}

export interface AlertFilters extends PaginationParams {
  status?: AlertStatus;
  severity?: AlertSeverity;
  from?: string;
  to?: string;
}

export interface ReviewAlertRequest {
  notes?: string;
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
