import { apiClient } from './client';
import type {
  CurrentGameResponse,
  SubmitPositionPayload,
  PendingPosition,
  RoundResult,
  GameSummary,
} from '../types/api';

export async function joinGame(
  gameCode: string,
  playerName: string,
  avatar = '🦊'
): Promise<{ success: boolean; player: any; game_code: string; message?: string }> {
  return apiClient('/api/game/join', {
    method: 'POST',
    body: JSON.stringify({
      game_code: gameCode,
      player_name: playerName,
      avatar,
    }),
  });
}

export async function fetchCurrentGameState(): Promise<CurrentGameResponse> {
  return apiClient<CurrentGameResponse>('/api/game/current', {
    method: 'GET',
  });
}

export async function submitPosition(
  payload: SubmitPositionPayload
): Promise<{
  success: boolean;
  message?: string;
  pending_position: PendingPosition;
  deadline?: number;
  time_remaining?: number;
  market_closed?: boolean;
}> {
  return apiClient('/api/game/submit', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function submitTimeout(): Promise<{
  success: boolean;
  result: RoundResult;
  round_info: any;
}> {
  return apiClient('/api/game/timeout', {
    method: 'POST',
  });
}

export async function fetchMarketStatus(): Promise<{
  success: boolean;
  no_position?: boolean;
  pending_position?: PendingPosition;
  deadline: number;
  time_remaining: number;
  market_closed: boolean;
  server_time?: number;
}> {
  return apiClient('/api/game/market', {
    method: 'GET',
  });
}

export async function fetchRoundResult(): Promise<{
  success: boolean;
  result: RoundResult;
  capital?: number;
  score?: number;
  round_info: {
    current_number: number;
    total_questions: number;
    is_last_question: boolean;
    score: number;
    capital: number;
  };
}> {
  return apiClient('/api/game/result', {
    method: 'GET',
  });
}

export async function advanceNextRound(): Promise<{
  success: boolean;
  game_state: 'question' | 'gameover';
  message?: string;
  summary?: GameSummary;
  current_index?: number;
}> {
  return apiClient('/api/game/next', {
    method: 'POST',
  });
}

export async function resetGameSession(): Promise<{
  success: boolean;
  capital: number;
  score: number;
  question_index: number;
}> {
  return apiClient('/api/game/reset', {
    method: 'POST',
  });
}
