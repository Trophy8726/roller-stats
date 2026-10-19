import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSync } from '../events/SyncContext';
import { loadCurrentClub, loadMemberships, saveCurrentClub, saveMemberships } from '../settings';
import type { Membership } from './api';

export interface ClubState {
  /** 'error': no copy on the device and the server could not be reached. */
  status: 'loading' | 'ready' | 'error';
  memberships: Membership[];
  /** The remembered club if still a membership, else the first one; null when the account has no club. */
  current: Membership | null;
  select(clubId: string): void;
  reload(): Promise<void>;
}

const Ctx = createContext<ClubState | null>(null);

/** `initial` gives the first list synchronously (tests); the server list then replaces it. The last list seen is kept on the device for offline starts. */
export function ClubProvider({ userId, initial, children }: { userId: string; initial?: Membership[]; children: ReactNode }) {
  const { clubs } = useSync();
  const [memberships, setMemberships] = useState<Membership[]>(() => initial ?? loadMemberships(userId));
  const [status, setStatus] = useState<ClubState['status']>(() => (initial || loadMemberships(userId).length > 0 ? 'ready' : 'loading'));
  const [currentId, setCurrentId] = useState<string | null>(() => loadCurrentClub(userId));

  const reload = useCallback(async () => {
    try {
      const list = await clubs.mine(userId);
      saveMemberships(userId, list);
      setMemberships(list);
      setStatus('ready');
    } catch {
      setStatus((s) => (s === 'ready' ? 'ready' : 'error'));
    }
  }, [clubs, userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const select = useCallback(
    (clubId: string) => {
      saveCurrentClub(userId, clubId);
      setCurrentId(clubId);
    },
    [userId],
  );

  const value = useMemo<ClubState>(() => {
    const current = memberships.find((m) => m.clubId === currentId) ?? memberships[0] ?? null;
    return { status, memberships, current, select, reload };
  }, [status, memberships, currentId, select, reload]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useClub(): ClubState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useClub must be used inside ClubProvider');
  return v;
}
