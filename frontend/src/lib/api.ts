import { useWalletStore } from '@/store/walletStore';
import { refreshSessionToken } from '@/lib/sep10-auth';

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
  const send = () =>
    fetch(url, {
      ...options,
      headers: getAuthHeaders((options.headers as Record<string, string>) || {}),
      credentials: 'include',
    });

  const response = await send();
  if (response.status !== 401 || !useWalletStore.getState().address) return response;

  // Token may have lapsed between scheduled refreshes: refresh once and retry transparently.
  const fresh = await refreshSessionToken(useWalletStore.getState().token);
  if (!fresh) return response;
  useWalletStore.getState().setToken(fresh);
  return send();
}

export interface ProjectAuditEventRecord {
  id: string;
  type: string;
  action: string;
  description?: string;
  timestamp: string;
  signer?: string;
  txHash?: string;
  ledger?: number | string;
  verified?: boolean;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function readString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export async function fetchProjectAuditEvents(projectId: string): Promise<ProjectAuditEventRecord[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  try {
    const response = await authFetch(`${apiUrl}/api/projects/${encodeURIComponent(projectId)}/audit`);
    if (!response.ok) return [];

    const payload = asRecord(await response.json());
    const rawEvents = payload?.events ?? payload?.audit_events ?? payload;
    if (!Array.isArray(rawEvents)) return [];

    return rawEvents.flatMap((entry: unknown) => {
      const record = asRecord(entry);
      if (!record) return [];
      const id = readString(record.id ?? record.eventId ?? record.event_id);
      if (!id) return [];
      return [{
        id,
        type: readString(record.type ?? record.event_type ?? record.topic, 'project'),
        action: readString(record.action ?? record.title ?? readString(record.type, 'Project event')),
        description: readString(record.description ?? record.message) || undefined,
        timestamp: readString(record.timestamp ?? record.created_at ?? record.ledgerClosedAt, new Date().toISOString()),
        signer: readString(record.signer ?? record.signer_address ?? record.public_key) || undefined,
        txHash: readString(record.txHash ?? record.tx_hash ?? record.transaction_hash) || undefined,
        ledger: typeof record.ledger === 'number' || typeof record.ledger === 'string' ? record.ledger : undefined,
        verified: typeof record.verified === 'boolean' ? record.verified : undefined,
      }];
    });
  } catch {
    return [];
  }
}
