'use client';

import { useCallback, useEffect, useState } from 'react';
import type { StarredFreelancer } from '@/types';
import {
  isStarred as isStarredIn,
  loadStarred,
  saveStarred,
  setNotes as setNotesIn,
  starredStorageKey,
  toggleStar as toggleStarIn,
} from '@/lib/starred-freelancers';

/** The client's starred freelancers, persisted per wallet and synced across tabs (#255). */
export function useStarredFreelancers(clientAddress: string | null | undefined) {
  const owner = clientAddress || '';
  const [list, setList] = useState<StarredFreelancer[]>([]);

  useEffect(() => {
    setList(loadStarred(owner));
    const onStorage = (event: StorageEvent) => {
      if (event.key === starredStorageKey(owner)) setList(loadStarred(owner));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [owner]);

  const update = useCallback(
    (fn: (prev: StarredFreelancer[]) => StarredFreelancer[]) => {
      setList((prev) => {
        const next = fn(prev);
        saveStarred(owner, next);
        return next;
      });
    },
    [owner]
  );

  const toggle = useCallback(
    (freelancer: { address: string; name?: string; lastProjectTitle?: string }) =>
      update((prev) => toggleStarIn(prev, freelancer)),
    [update]
  );

  const setNotes = useCallback(
    (address: string, notes: string) => update((prev) => setNotesIn(prev, address, notes)),
    [update]
  );

  const isStarred = useCallback((address: string) => isStarredIn(list, address), [list]);

  return { starred: list, isStarred, toggle, setNotes };
}
