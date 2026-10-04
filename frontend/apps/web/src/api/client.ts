export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Returns the base API URL based on environment.
 * - In local development: defaults to 'http://127.0.0.1:5000' unless overridden.
 * - In production (e.g. Vercel): defaults to '' (same-origin /api rewrites).
 */
export function getApiBaseUrl(): string {
  const envUrl = (import.meta as any).env?.VITE_API_BASE_URL;
  if (typeof envUrl === 'string') {
    return envUrl.trim();
  }
  const isDev = Boolean((import.meta as any).env?.DEV);
  return isDev ? 'http://127.0.0.1:5000' : '';
}

/**
 * Resolves an API endpoint into a safe, normalized URL.
 * Avoids any accidental `/api/api/...` duplication.
 */
export function buildApiUrl(endpoint: string): string {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }

  const baseUrl = getApiBaseUrl();
  const normalizedPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  if (!baseUrl) {
    return normalizedPath;
  }

  return `${baseUrl.replace(/\/$/, '')}${normalizedPath}`;
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = localStorage.getItem('mm_auth_token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = buildApiUrl(endpoint);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Ensures Flask session cookies are passed
    });

    const contentType = response.headers.get('content-type');
    let data: any = null;

    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text || response.statusText };
      }
    }

    if (!response.ok) {
      const message =
        data?.message || `Request failed with status ${response.status}`;
      throw new ApiError(message, response.status, data);
    }

    return data as T;
  } catch (error: any) {
    if (error?.name === 'AbortError' || error?.message?.includes('aborted')) {
      const abortErr = new Error('Request aborted');
      abortErr.name = 'AbortError';
      throw abortErr;
    }
    if (error instanceof ApiError) {
      if ((import.meta as any).env?.DEV) {
        console.warn(`[API ${options.method || 'GET'}] ${url} -> ${error.status}:`, error.message);
      }
      throw error;
    }
    if ((import.meta as any).env?.DEV) {
      console.error(`[API Network Error ${options.method || 'GET'}] ${url}:`, error?.message);
    }
    throw new ApiError(
      error?.message || 'Network error. Please check server connection.',
      0,
      error
    );
  }
}

