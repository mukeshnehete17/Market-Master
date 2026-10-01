import { apiClient } from './client';
import type { ProfileResponse, TradeHistoryItem } from '../types/api';

export async function fetchPlayerProfile(): Promise<ProfileResponse> {
  return apiClient<ProfileResponse>('/api/player/profile', {
    method: 'GET',
  });
}

export async function fetchTradeHistory(): Promise<{
  success: boolean;
  history: TradeHistoryItem[];
}> {
  return apiClient('/api/player/history', {
    method: 'GET',
  });
}
