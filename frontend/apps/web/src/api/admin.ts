import { apiClient } from './client';

const BASE = '/api/admin';

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  return apiClient<T>(`${BASE}${path}`, { method: 'GET', signal });
}

async function post<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  return apiClient<T>(`${BASE}${path}`, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
}

async function patch<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  return apiClient<T>(`${BASE}${path}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    signal,
  });
}

async function put<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  return apiClient<T>(`${BASE}${path}`, {
    method: 'PUT',
    body: JSON.stringify(body),
    signal,
  });
}

async function del<T>(path: string, signal?: AbortSignal): Promise<T> {
  return apiClient<T>(`${BASE}${path}`, { method: 'DELETE', signal });
}

export interface AdminMetrics {
  total_students: number;
  active_students: number;
  disabled_students: number;
  total_questions: number;
  active_questions: number;
  total_games: number;
  active_games: number;
  players_in_active_game: number;
  current_game: { id: string; name: string; game_pin: string; status: string } | null;
  current_round: { round_number: number; status: string } | null;
  current_question: { id: string | number; question: string; options: string[] } | null;
  leaderboard: any[];
  recent_actions: any[];
}

export interface ControlDeckData {
  has_game: boolean;
  game?: {
    id: string;
    name: string;
    game_pin: string;
    status: string;
    starting_capital: number;
    min_risk: number;
    max_risk: number;
    default_question_duration: number;
    total_rounds: number;
    current_round_number: number;
    round_status: string;
    round_id: string | null;
    round_started_at: string | null;
    questions: any[];
  };
  current_question?: {
    id: string;
    question_text: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    correct_option: string;
    explanation: string;
    category: string;
    duration_seconds: number;
    round_number: number;
    round_status: string;
  } | null;
  participants?: {
    total_joined: number;
    submitted_count: number;
    waiting_count: number;
    list: Array<{
      user_id: string;
      name: string;
      email: string;
      avatar: string;
      current_capital: number;
      total_profit_loss: number;
      score: number;
      status: string;
      submission?: {
        selected_option: string;
        risk_percent: number;
        bid_amount: number;
        potential_profit: number;
        potential_loss: number;
        is_correct: boolean | null;
        submitted_at: string;
        status: string;
      } | null;
    }>;
  };
  sentiment?: {
    counts: { A: number; B: number; C: number; D: number };
    percentages: { A: number; B: number; C: number; D: number };
    capital_by_option: { A: number; B: number; C: number; D: number };
    total_capital_at_risk: number;
    total_submissions: number;
  };
  movers?: {
    biggest_gainer: any | null;
    biggest_drawdown: any | null;
    high_conviction: any[];
  };
  leaderboard?: any[];
  recent_trades?: any[];
  recent_actions: any[];
  games_list: Array<{ id: string; name: string; game_pin: string; status: string }>;
  total_students: number;
  total_questions: number;
  total_games: number;
}

export const adminApi = {
  overview: (signal?: AbortSignal) => get<{ success: boolean; metrics: AdminMetrics }>('/overview', signal),
  controlDeck: (gameId?: string, signal?: AbortSignal) =>
    get<{ success: boolean; deck: ControlDeckData }>(`/deck${gameId ? `?game_id=${encodeURIComponent(gameId)}` : ''}`, signal),
  students: (params = '', signal?: AbortSignal) =>
    get<{ success: boolean; students: any[] }>(`/students${params}`, signal),
  student: (id: string, signal?: AbortSignal) => get<{ success: boolean; student: any }>(`/students/${id}`, signal),
  createStudent: (body: unknown, signal?: AbortSignal) =>
    post<{ success: boolean; student: any }>('/students', body, signal),
  updateStudent: (id: string, body: unknown, signal?: AbortSignal) =>
    patch<{ success: boolean; student: any }>(`/students/${id}`, body, signal),
  disableStudent: (id: string, signal?: AbortSignal) =>
    post<{ success: boolean; student: any }>(`/students/${id}/disable`, undefined, signal),
  enableStudent: (id: string, signal?: AbortSignal) =>
    post<{ success: boolean; student: any }>(`/students/${id}/enable`, undefined, signal),

  questions: (signal?: AbortSignal) => get<{ success: boolean; questions: any[] }>('/questions', signal),
  createQuestion: (body: unknown, signal?: AbortSignal) =>
    post<{ success: boolean; question: any }>('/questions', body, signal),
  updateQuestion: (id: string, body: unknown, signal?: AbortSignal) =>
    patch<{ success: boolean; question: any }>(`/questions/${id}`, body, signal),
  archiveQuestion: (id: string, signal?: AbortSignal) =>
    post<{ success: boolean; question: any }>(`/questions/${id}/archive`, undefined, signal),
  deleteQuestion: (id: string, signal?: AbortSignal) =>
    del<{ success: boolean }>(`/questions/${id}`, signal),

  games: (signal?: AbortSignal) => get<{ success: boolean; games: any[] }>('/games', signal),
  game: (id: string, signal?: AbortSignal) => get<{ success: boolean; game: any }>(`/games/${id}`, signal),
  createGame: (body: unknown, signal?: AbortSignal) =>
    post<{ success: boolean; game: any }>('/games', body, signal),
  updateGame: (id: string, body: unknown, signal?: AbortSignal) =>
    patch<{ success: boolean; game: any }>(`/games/${id}`, body, signal),
  deleteGame: (id: string, signal?: AbortSignal) => del<{ success: boolean }>(`/games/${id}`, signal),
  setGameQuestions: (id: string, question_ids: (string | number)[], signal?: AbortSignal) =>
    put<{ success: boolean; game: any }>(`/games/${id}/questions`, { question_ids }, signal),
  controlGame: (id: string, op: string, signal?: AbortSignal) =>
    post<{ success: boolean; game: any }>(`/games/${id}/${op}`, undefined, signal),
  gameLeaderboard: (id: string, signal?: AbortSignal) =>
    get<{ success: boolean; leaderboard: any[] }>(`/games/${id}/leaderboard`, signal),
  gameTrades: (id: string, signal?: AbortSignal) =>
    get<{ success: boolean; trades: any[] }>(`/games/${id}/trades`, signal),

  settings: (signal?: AbortSignal) => get<{ success: boolean; settings: any }>('/settings', signal),
  updateSettings: (body: unknown, signal?: AbortSignal) =>
    patch<{ success: boolean; settings: any }>('/settings', body, signal),
  actions: (limit = 50, signal?: AbortSignal) =>
    get<{ success: boolean; actions: any[] }>(`/actions?limit=${limit}`, signal),
};
