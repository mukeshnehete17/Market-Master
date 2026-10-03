import { apiClient } from './client';
import type { AuthResponse, SignupPayload, User } from '../types/api';

function persistAuth(data: AuthResponse): AuthResponse {
  if (data.token) {
    localStorage.setItem('mm_auth_token', data.token);
  }
  if (data.user) {
    localStorage.setItem('mm_user', JSON.stringify(data.user));
  }
  return data;
}

export async function signupUser(payload: SignupPayload): Promise<AuthResponse> {
  const data = await apiClient<AuthResponse>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({
      name: payload.name,
      email: payload.email,
      password: payload.password,
      confirm_password: payload.confirm_password,
    }),
  });

  return persistAuth(data);
}

export async function loginUser(
  email: string,
  password: string
): Promise<AuthResponse> {
  const data = await apiClient<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  return persistAuth(data);
}

export async function fetchCurrentUser(): Promise<User | null> {
  const token = localStorage.getItem('mm_auth_token');
  if (!token) {
    return null;
  }
  try {
    const data = await apiClient<{ success: boolean; user: User }>(
      '/api/auth/me',
      { method: 'GET' }
    );
    if (data.success && data.user) {
      localStorage.setItem('mm_user', JSON.stringify(data.user));
      return data.user;
    }
    localStorage.removeItem('mm_auth_token');
    localStorage.removeItem('mm_user');
    return null;
  } catch {
    localStorage.removeItem('mm_auth_token');
    localStorage.removeItem('mm_user');
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
