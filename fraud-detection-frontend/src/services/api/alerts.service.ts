import { apiClient } from './apiClient';
import type { Alert, AlertDetail, AlertFilters, AlertReviewResponse, ReviewAlertRequest } from '@/types/alert.types';
import type { PagedResponse } from '@/types/api.types';

export const fetchAlerts = async (
  filters?: AlertFilters
): Promise<PagedResponse<Alert>> => {
  const { data } = await apiClient.get<PagedResponse<Alert>>('/alerts', {
    params: filters,
  });
  return data;
};

export const fetchAlertDetail = async (id: string): Promise<AlertDetail> => {
  const { data } = await apiClient.get<AlertDetail>(`/alerts/${id}`);
  return data;
};

export const reviewAlert = async (
  id: string,
  request?: ReviewAlertRequest
): Promise<AlertReviewResponse> => {
  const { data } = await apiClient.patch<AlertReviewResponse>(`/alerts/${id}/review`, request ?? {});
  return data;
};
