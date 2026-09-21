import { http, HttpResponse, delay } from 'msw';
import type {
  TransactionSummary,
  TransactionDetail,
  TransactionCreateResponse,
} from '@/types/transaction.types';
import type { Alert, AlertDetail, DashboardStatistics, UserBehavior } from '@/types/alert.types';
import type { AuthResponse, PagedResponse } from '@/types/api.types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockAuth: AuthResponse = {
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock',
  tokenType: 'Bearer',
  expiresIn: 86400,
  userId: '550e8400-e29b-41d4-a716-446655440000',
  role: 'ANALYST',
};

const mockTransactions: TransactionSummary[] = [
  { transactionId: 'TX0000001', externalUserId: 'U00042', amount: 4850.00, timestamp: '2023-10-27T03:14:00Z', country: 'NG', merchantId: 'M0172', riskLevel: 'CRITICAL', riskScore: 0.93 },
  { transactionId: 'TX0000002', externalUserId: 'U00118', amount: 1250.50, timestamp: '2023-10-27T14:32:00Z', country: 'CO', merchantId: 'M0018', riskLevel: 'HIGH',     riskScore: 0.72 },
  { transactionId: 'TX0000003', externalUserId: 'U00203', amount:  320.00, timestamp: '2023-10-27T11:15:00Z', country: 'ES', merchantId: 'M0044', riskLevel: 'MEDIUM',   riskScore: 0.48 },
  { transactionId: 'TX0000004', externalUserId: 'U00315', amount:   79.99, timestamp: '2023-10-27T09:30:00Z', country: 'US', merchantId: 'M0099', riskLevel: 'LOW',      riskScore: 0.12 },
  { transactionId: 'TX0000005', externalUserId: 'U00422', amount:  540.25, timestamp: '2023-10-27T16:45:00Z', country: 'DE', merchantId: 'M0033', riskLevel: 'HIGH',     riskScore: 0.68 },
  { transactionId: 'TX0000006', externalUserId: 'U00087', amount:   29.50, timestamp: '2023-10-27T10:00:00Z', country: 'US', merchantId: 'M0005', riskLevel: 'LOW',      riskScore: 0.08 },
  { transactionId: 'TX0000007', externalUserId: 'U00512', amount: 2100.00, timestamp: '2023-10-26T02:22:00Z', country: 'RU', merchantId: 'M0241', riskLevel: 'CRITICAL', riskScore: 0.97 },
  { transactionId: 'TX0000008', externalUserId: 'U00338', amount:  155.80, timestamp: '2023-10-26T14:10:00Z', country: 'FR', merchantId: 'M0067', riskLevel: 'MEDIUM',   riskScore: 0.43 },
];

const mockTransactionDetail: TransactionDetail = {
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
    explanations: [
      'Amount 32.3× above user average ($150)',
      'First transaction from this device (D_NEW_823461)',
      'Country NG not in user\'s recent history',
      'Transaction at unusual hour (03:14 AM)',
    ],
    modelVersion: '1.0.0',
    analyzedAt: '2023-10-27T03:14:02Z',
    analyzedBy: 'analyst@frauddetect.io',
  },
};

const mockAlerts: Alert[] = [
  { alertId: 'ALT-001', transactionId: 'TX0000001', severity: 'CRITICAL', description: 'Critical fraud probability 0.94 detected — New device + unusual country + night transaction', status: 'OPEN',     createdAt: '2023-10-27T03:14:02Z', riskScore: 0.93 },
  { alertId: 'ALT-002', transactionId: 'TX0000002', severity: 'HIGH',     description: 'High-risk transaction: amount 8.3× above user average with new country',                     status: 'OPEN',     createdAt: '2023-10-27T14:32:01Z', riskScore: 0.72 },
  { alertId: 'ALT-003', transactionId: 'TX0000005', severity: 'HIGH',     description: 'Velocity burst detected: 4 transactions in 5 minutes from the same device',                  status: 'OPEN',     createdAt: '2023-10-27T16:45:02Z', riskScore: 0.68 },
  { alertId: 'ALT-004', transactionId: 'TX0000007', severity: 'CRITICAL', description: 'Critical: transaction from high-risk country with known fraud device signature',              status: 'REVIEWED', createdAt: '2023-10-26T02:22:01Z', riskScore: 0.97,
    reviewedAt: '2023-10-26T09:00:00Z', reviewedBy: 'analyst@frauddetect.io' },
];

const mockDashboard: DashboardStatistics = {
  period: { from: '2023-10-26T14:00:00Z', to: '2023-10-27T14:00:00Z' },
  totalTransactions: 1247,
  analyzedTransactions: 1247,
  fraudDetected: 48,
  fraudRate: 0.0385,
  averageRiskScore: 0.31,
  riskDistribution: { LOW: 980, MEDIUM: 219, HIGH: 41, CRITICAL: 7 },
  openAlerts: 14,
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

const mockUserBehavior: UserBehavior = {
  externalUserId: 'U00042',
  transactionCount: 47,
  averageAmount: 150.20,
  typicalHourRange: '08:00–22:00',
  typicalCountries: ['US', 'ES'],
  knownDevices: ['D00042A', 'D00042B'],
  topMerchants: ['M0005', 'M0012', 'M0044'],
  lastActivityAt: '2023-10-26T19:45:00Z',
  riskSummary: { totalHighRisk: 2, totalMediumRisk: 5, fraudConfirmed: 0 },
};

// ── MSW Handlers ──────────────────────────────────────────────────────────────

const BASE = '/api/v1';
const LAT  = { min: 120, max: 420 };

async function fakeDelay() {
  return delay(Math.floor(Math.random() * (LAT.max - LAT.min) + LAT.min));
}

export const handlers = [

  // POST /auth/login
  http.post(`${BASE}/auth/login`, async () => {
    await fakeDelay();
    return HttpResponse.json(mockAuth);
  }),

  // GET /transactions
  http.get(`${BASE}/transactions`, async ({ request }) => {
    await fakeDelay();
    const url     = new URL(request.url);
    const page    = parseInt(url.searchParams.get('page') ?? '0');
    const size    = parseInt(url.searchParams.get('size') ?? '20');
    const rlParam = url.searchParams.get('riskLevel') ?? '';
    const filtered = rlParam
      ? mockTransactions.filter(t => t.riskLevel === rlParam)
      : mockTransactions;
    const paged = filtered.slice(page * size, (page + 1) * size);
    const response: PagedResponse<TransactionSummary> = {
      content: paged, page, size,
      totalElements: filtered.length,
      totalPages: Math.ceil(filtered.length / size),
    };
    return HttpResponse.json(response);
  }),

  // GET /transactions/:id
  http.get(`${BASE}/transactions/:id`, async ({ params }) => {
    await fakeDelay();
    const found = mockTransactions.find(t => t.transactionId === params['id']);
    if (!found) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json({ ...mockTransactionDetail, transactionId: params['id'] as string });
  }),

  // POST /transactions (análisis)
  http.post(`${BASE}/transactions`, async () => {
    await fakeDelay();
    const response: TransactionCreateResponse = {
      transactionId: `TX${Date.now()}`,
      status: 'ANALYZED',
      analysis: mockTransactionDetail.analysis!,
      alertGenerated: true,
    };
    return HttpResponse.json(response, { status: 201 });
  }),

  // GET /alerts
  http.get(`${BASE}/alerts`, async ({ request }) => {
    await fakeDelay();
    const url    = new URL(request.url);
    const status = url.searchParams.get('status');
    const filtered = status ? mockAlerts.filter(a => a.status === status) : mockAlerts;
    const response: PagedResponse<Alert> = {
      content: filtered, page: 0, size: 20,
      totalElements: filtered.length, totalPages: 1,
    };
    return HttpResponse.json(response);
  }),

  // GET /alerts/:id
  http.get(`${BASE}/alerts/:id`, async ({ params }) => {
    await fakeDelay();
    const alert = mockAlerts.find(a => a.alertId === params['id']);
    if (!alert) return new HttpResponse(null, { status: 404 });
    const detail: AlertDetail = { ...alert, transaction: mockTransactionDetail };
    return HttpResponse.json(detail);
  }),

  // PATCH /alerts/:id/review
  http.patch(`${BASE}/alerts/:id/review`, async ({ params }) => {
    await fakeDelay();
    return HttpResponse.json({
      alertId: params['id'],
      status: 'REVIEWED',
      reviewedAt: new Date().toISOString(),
      reviewedBy: 'analyst@frauddetect.io',
    });
  }),

  // GET /statistics/dashboard
  http.get(`${BASE}/statistics/dashboard`, async () => {
    await fakeDelay();
    return HttpResponse.json(mockDashboard);
  }),

  // GET /users/:id/transactions
  http.get(`${BASE}/users/:id/transactions`, async () => {
    await fakeDelay();
    const response: PagedResponse<TransactionSummary> = {
      content: mockTransactions.slice(0, 4), page: 0, size: 20,
      totalElements: 4, totalPages: 1,
    };
    return HttpResponse.json(response);
  }),

  // GET /users/:id/behavior
  http.get(`${BASE}/users/:id/behavior`, async () => {
    await fakeDelay();
    return HttpResponse.json(mockUserBehavior);
  }),

  // GET /fraud-analysis/:id
  http.get(`${BASE}/fraud-analysis/:id`, async () => {
    await fakeDelay();
    return HttpResponse.json(mockTransactionDetail.analysis);
  }),
];
