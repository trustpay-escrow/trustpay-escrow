import { useWalletStore } from '@/store/walletStore';

/**
 * Returns Authorization header with the active SEP-0010 JWT token if available.
 */
export function getAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const token = useWalletStore.getState().token;
  const headers: Record<string, string> = { ...extraHeaders };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Custom fetch wrapper that automatically includes httpOnly credentials/cookies
 * and Authorization: Bearer <token> headers for all backend API calls.
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = getAuthHeaders((options.headers as Record<string, string>) || {});
  return fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });
}
