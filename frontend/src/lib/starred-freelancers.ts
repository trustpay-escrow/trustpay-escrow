/**
 * Starred freelancers and private notes (#255), kept in localStorage per
 * client wallet so each client's list and notes stay private to them.
 */
import type { StarredFreelancer } from '@/types';

export const MAX_NOTE_LENGTH = 1000;

export const starredStorageKey = (clientAddress: string) =>
  `trustpay.starredFreelancers.v1.${clientAddress || 'anonymous'}`;

export function isStarred(list: StarredFreelancer[], address: string): boolean {
  return list.some((f) => f.address === address);
}

/** Adds the freelancer if missing, removes them if present. Notes are kept only while starred. */
export function toggleStar(
  list: StarredFreelancer[],
  freelancer: { address: string; name?: string; lastProjectTitle?: string },
  now = new Date()
): StarredFreelancer[] {
  if (!freelancer.address) return list;
  if (isStarred(list, freelancer.address)) {
    return list.filter((f) => f.address !== freelancer.address);
  }
  return [
    ...list,
    {
      address: freelancer.address,
      name: freelancer.name,
      lastProjectTitle: freelancer.lastProjectTitle,
      notes: '',
      starredAt: now.toISOString(),
    },
  ];
}

export function setNotes(list: StarredFreelancer[], address: string, notes: string): StarredFreelancer[] {
  return list.map((f) => (f.address === address ? { ...f, notes: notes.slice(0, MAX_NOTE_LENGTH) } : f));
}

function isEntry(value: unknown): value is StarredFreelancer {
  const v = value as StarredFreelancer;
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof v.address === 'string' &&
    v.address.length > 0 &&
    typeof v.notes === 'string' &&
    typeof v.starredAt === 'string'
  );
}

export function loadStarred(
  clientAddress: string,
  storage: Pick<Storage, 'getItem'> | undefined = safeStorage()
): StarredFreelancer[] {
  try {
    const raw = storage?.getItem(starredStorageKey(clientAddress));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch {
    return [];
  }
}

export function saveStarred(
  clientAddress: string,
  list: StarredFreelancer[],
  storage: Pick<Storage, 'setItem'> | undefined = safeStorage()
): void {
  try {
    storage?.setItem(starredStorageKey(clientAddress), JSON.stringify(list));
  } catch {
    /* storage unavailable: changes last for this session only */
  }
}

function safeStorage(): Storage | undefined {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}
