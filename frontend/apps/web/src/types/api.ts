export interface User {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  role: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  token?: string;
  user?: User;
}

export interface SignupPayload {
  name: string;
  email: string;
  password: string;
  confirm_password: string;
}

export interface Player {
  name: string;
  avatar: string;
  capital: number;
  starting_capital?: number;
  net_pl?: number;
  score: number;
  rounds_played?: number;
  total_rounds?: number;
  status?: string;
}

export interface Question {
  id: string | number;
  question: string;
  options: string[];
  category?: string;
  duration_seconds: number;
}

export interface RoundInfo {
  index: number;
  current_number: number;
  total_questions: number;
  question: Question;
  deadline: number;
  time_remaining: number;
  server_time: number;
}

export interface PendingPosition {
  answer: string;
  risk: string;
  risk_multiplier: number;
  exposure: number;
  bid_amount: number;
}

export interface RoundResult {
  valid: boolean;
  is_correct: boolean;
  is_timeout?: boolean;
  user_answer: string;
  correct_answer: string;
  explanation: string;
  financial_change: string;
  delta: number;
  previous_capital: number;
  new_capital: number;
  selected_risk: string;
  risk_multiplier: number;
  bid_amount: number;
}

export interface GameSummary {
  starting_capital: number;
  final_capital: number;
  net_pl: number;
  score: number;
  total_questions: number;
}

export interface CurrentGameResponse {
  success: boolean;
  game_state: 'not_joined' | 'waiting' | 'paused' | 'question' | 'market' | 'result' | 'gameover';
  reason?: 'bankrupt' | 'completed' | 'cancelled';
  player?: Player;
  game_code?: string;
  round?: RoundInfo;
  pending_position?: PendingPosition;
  deadline?: number;
  time_remaining?: number;
  server_time?: number;
  result?: RoundResult;
  round_info?: {
    current_number: number;
    total_questions: number;
    is_last_question: boolean;
    score?: number;
    capital?: number;
  };
  summary?: GameSummary;
  message?: string;
}

export interface SubmitPositionPayload {
  question_id: string | number;
  option: string;
  risk_multiplier: number;
  bid_amount: number;
  risk_percent?: number;
}

export interface RankedPlayer {
  rank?: number;
  name: string;
  avatar: string;
  capital: number;
  profit_loss?: number;
  score?: number;
  rounds_played?: number;
  is_me: boolean;
  badge?: string;
}

export interface TradeHistoryItem {
  round: number;
  question_id?: number;
  question_text: string;
  selected_option: string;
  correct_answer: string;
  is_correct: boolean;
  risk_multiplier: number;
  bid_amount: number;
  financial_change: string;
  capital_after: number;
  timestamp: number;
}

export interface ProfileResponse {
  success: boolean;
  player: Player & {
    history?: TradeHistoryItem[];
  };
}

export interface LeaderboardResponse {
  success: boolean;
  rankings: RankedPlayer[];
}
