import { apiClient } from './client';
import type { LeaderboardResponse } from '../types/api';

export async function fetchLeaderboard(signal?: AbortSignal): Promise<LeaderboardResponse> {
  return apiClient<LeaderboardResponse>('/api/leaderboard', {
    method: 'GET',
    signal,
  });
}
