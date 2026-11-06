import { apiClient } from './apiClient';
import type { TransactionFilters, TransactionSummary, TransactionDetail } from '../../types/transaction.types';
import type { PagedResponse } from '../../types/api.types';

export const fetchTransactions = async (
  filters: TransactionFilters
): Promise<PagedResponse<TransactionSummary>> => {
  const { data } = await apiClient.get<PagedResponse<TransactionSummary>>('/transactions', {
    params: filters,
  });
  return data;
};

export const fetchTransactionDetail = async (
  id: string
): Promise<TransactionDetail> => {
  const { data } = await apiClient.get<TransactionDetail>(`/transactions/${id}`);
  return data;
};

export const fetchUserTransactions = async (
  externalUserId: string,
  params?: { page?: number; size?: number }
): Promise<PagedResponse<TransactionSummary>> => {
  const { data } = await apiClient.get<PagedResponse<TransactionSummary>>(
    `/users/${externalUserId}/transactions`,
    { params }
  );
  return data;
};
