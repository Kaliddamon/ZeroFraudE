import type { RiskLevel, PaginationParams } from './api.types';

// ── Transaction Types ─────────────────────────────────────────────────────────

export interface TransactionSummary {
  transactionId: string;
  externalUserId: string;
  amount: number;
  timestamp: string;         // ISO 8601
  country: string;
  merchantId: string;
  riskLevel: RiskLevel;
  riskScore: number;         // 0–1
}

export interface TransactionDetail {
  transactionId: string;
  externalUserId: string;
  amount: number;
  timestamp: string;
  country: string;
  deviceId: string;
  merchantId: string;
  currency: string;
  createdAt: string;
  channel?: string;
  maskedCard?: string;
  ipAddress?: string;
  analysis: FraudAnalysis | null;
}

export interface CreateTransactionRequest {
  externalUserId: string;
  amount: number;
  timestamp: string;
  country: string;
  deviceId: string;
  merchantId: string;
  currency?: string;
}

export interface TransactionCreateResponse {
  transactionId: string;
  status: string;
  analysis: FraudAnalysis;
  alertGenerated: boolean;
}

export interface TransactionFilters extends PaginationParams {
  riskLevel?: RiskLevel;
  externalUserId?: string;
  country?: string;
  from?: string;
  to?: string;
  minAmount?: number;
  maxAmount?: number;
}

// ── Fraud Analysis ────────────────────────────────────────────────────────────

export interface FraudAnalysis {
  analysisId: string;
  transactionId: string;
  fraudProbability: number;      // 0–1
  anomalyScore: number;          // 0–1
  anomalyAlert?: boolean;
  behavioralDeviation: number;   // 0–1
  riskScore: number;             // 0–1
  riskLevel: RiskLevel;
  explanations: string[];
  modelVersion: string;
  analyzedAt: string;
  analyzedBy: string;
}
