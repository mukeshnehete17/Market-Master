import { apiClient } from './client';

const BASE = '/api/admin';

async function get<T>(path: string): Promise<T> {
  return apiClient<T>(`${BASE}${path}`, { method: 'GET' });
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  return apiClient<T>(`${BASE}${path}`, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  return apiClient<T>(`${BASE}${path}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

async function put<T>(path: string, body: unknown): Promise<T> {
  return apiClient<T>(`${BASE}${path}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

async function del<T>(path: string): Promise<T> {
  return apiClient<T>(`${BASE}${path}`, { method: 'DELETE' });
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
  overview: () => get<{ success: boolean; metrics: AdminMetrics }>('/overview'),
  controlDeck: (gameId?: string) =>
    get<{ success: boolean; deck: ControlDeckData }>(`/deck${gameId ? `?game_id=${encodeURIComponent(gameId)}` : ''}`),
  students: (params = '') =>
    get<{ success: boolean; students: any[] }>(`/students${params}`),
  student: (id: string) => get<{ success: boolean; student: any }>(`/students/${id}`),
  createStudent: (body: unknown) =>
    post<{ success: boolean; student: any }>('/students', body),
  updateStudent: (id: string, body: unknown) =>
    patch<{ success: boolean; student: any }>(`/students/${id}`, body),
  disableStudent: (id: string) =>
    post<{ success: boolean; student: any }>(`/students/${id}/disable`),
  enableStudent: (id: string) =>
    post<{ success: boolean; student: any }>(`/students/${id}/enable`),

  questions: () => get<{ success: boolean; questions: any[] }>('/questions'),
  createQuestion: (body: unknown) =>
    post<{ success: boolean; question: any }>('/questions', body),
  updateQuestion: (id: string, body: unknown) =>
    patch<{ success: boolean; question: any }>(`/questions/${id}`, body),
  archiveQuestion: (id: string) =>
    post<{ success: boolean; question: any }>(`/questions/${id}/archive`),
  deleteQuestion: (id: string) =>
    del<{ success: boolean }>(`/questions/${id}`),

  games: () => get<{ success: boolean; games: any[] }>('/games'),
  game: (id: string) => get<{ success: boolean; game: any }>(`/games/${id}`),
  createGame: (body: unknown) =>
    post<{ success: boolean; game: any }>('/games', body),
  updateGame: (id: string, body: unknown) =>
    patch<{ success: boolean; game: any }>(`/games/${id}`, body),
  deleteGame: (id: string) => del<{ success: boolean }>(`/games/${id}`),
  setGameQuestions: (id: string, question_ids: (string | number)[]) =>
    put<{ success: boolean; game: any }>(`/games/${id}/questions`, { question_ids }),
  controlGame: (id: string, op: string) =>
    post<{ success: boolean; game: any }>(`/games/${id}/${op}`),
  gameLeaderboard: (id: string) =>
    get<{ success: boolean; leaderboard: any[] }>(`/games/${id}/leaderboard`),
  gameTrades: (id: string) =>
    get<{ success: boolean; trades: any[] }>(`/games/${id}/trades`),

  settings: () => get<{ success: boolean; settings: any }>('/settings'),
  updateSettings: (body: unknown) =>
    patch<{ success: boolean; settings: any }>('/settings', body),
  actions: (limit = 50) =>
    get<{ success: boolean; actions: any[] }>(`/actions?limit=${limit}`),
};
