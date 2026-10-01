import { apiClient } from './client';
import type { AuthResponse, User } from '../types/api';

export async function loginUser(
  userId: string,
  password: string
): Promise<AuthResponse> {
  const data = await apiClient<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, password }),
  });

  if (data.token) {
    localStorage.setItem('mm_auth_token', data.token);
  }
  if (data.user) {
    localStorage.setItem('mm_user', JSON.stringify(data.user));
  }

  return data;
}

export async function fetchCurrentUser(): Promise<User | null> {
  try {
    const data = await apiClient<{ success: boolean; user: User }>(
      '/api/auth/me',
      { method: 'GET' }
    );
    if (data.success && data.user) {
      localStorage.setItem('mm_user', JSON.stringify(data.user));
      return data.user;
    }
    return null;
  } catch {
    return null;
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await apiClient('/api/auth/logout', { method: 'POST' });
  } catch {
    // Ignore error on logout cleanup
  } finally {
    localStorage.removeItem('mm_auth_token');
    localStorage.removeItem('mm_user');
  }
}
