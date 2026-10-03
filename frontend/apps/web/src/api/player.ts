import { apiClient } from './client';
import type { ProfileResponse, TradeHistoryItem } from '../types/api';

export async function fetchPlayerProfile(signal?: AbortSignal): Promise<ProfileResponse> {
  return apiClient<ProfileResponse>('/api/player/profile', {
    method: 'GET',
    signal,
  });
}

export async function fetchTradeHistory(signal?: AbortSignal): Promise<{
  success: boolean;
  history: TradeHistoryItem[];
}> {
  return apiClient('/api/player/history', {
    method: 'GET',
    signal,
  });
}
