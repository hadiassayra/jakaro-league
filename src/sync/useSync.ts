import { useEffect, useState } from 'react';
import { create } from 'zustand';
import type { Tournament } from '../lib/types';
import { useStore } from '../store/useStore';
import { getSyncConfig, pushRemote, subscribeRemote, type SyncStatus } from './firebaseSync';

export const useSyncStatus = create<{ status: SyncStatus; error?: string; version: number }>()(() => ({
  status: 'off',
  version: 0,
}));

/** Call after the config changes in Settings */
export function restartSync() {
  useSyncStatus.setState((s) => ({ version: s.version + 1 }));
}

/** Reads `?key=` from the hash route (#/path?key=value) */
export function hashParam(key: string): string | null {
  const q = window.location.hash.split('?')[1] ?? '';
  return new URLSearchParams(q).get(key);
}

/**
 * Admin-side sync: pushes local changes and pulls changes made on other
 * admin devices. `?join=<id>` adopts a tournament from another device.
 */
export function useAdminSync() {
  const version = useSyncStatus((s) => s.version);
  useEffect(() => {
    const config = getSyncConfig(hashParam('fb'));
    if (!config) {
      useSyncStatus.setState({ status: 'off', error: undefined });
      return;
    }
    const joinId = hashParam('join');
    const id = joinId ?? useStore.getState().t.id;
    let remoteSeen = false;
    let lastRemote = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const push = () => {
      const t = useStore.getState().t;
      if (!remoteSeen || t.id !== id || t.updatedAt <= lastRemote) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        const cur = useStore.getState().t;
        lastRemote = cur.updatedAt;
        pushRemote(config, cur).catch((e) =>
          useSyncStatus.setState({ status: 'error', error: String(e?.message ?? e) }),
        );
      }, 350);
    };

    const unsubRemote = subscribeRemote(
      config,
      id,
      (remote) => {
        const first = !remoteSeen;
        remoteSeen = true;
        const local = useStore.getState().t;
        if (remote && (remote.updatedAt > local.updatedAt || (first && joinId && local.id !== remote.id))) {
          lastRemote = remote.updatedAt;
          useStore.getState().replace(remote);
        } else {
          push();
        }
      },
      (status, error) => useSyncStatus.setState({ status, error }),
    );
    const unsubStore = useStore.subscribe((s, prev) => {
      if (s.t !== prev.t) push();
    });
    return () => {
      clearTimeout(timer);
      unsubRemote();
      unsubStore();
    };
  }, [version]);
}

/**
 * Read-only data for the public view / presentation. With `?t=<id>` and sync
 * configured it follows the remote copy; otherwise it reads this browser's data.
 */
export function useViewTournament(): { t: Tournament | null; remote: boolean; status: SyncStatus } {
  const local = useStore((s) => s.t);
  const id = hashParam('t');
  const fb = hashParam('fb');
  const config = id ? getSyncConfig(fb) : null;
  const useRemote = !!config && !!id;
  const [remote, setRemote] = useState<Tournament | null>(null);
  const [status, setStatus] = useState<SyncStatus>(useRemote ? 'connecting' : 'off');

  useEffect(() => {
    if (!useRemote || !config || !id) return;
    return subscribeRemote(config, id, setRemote, (s) => setStatus(s));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useRemote, id, fb]);

  if (!useRemote) return { t: local, remote: false, status: 'off' };
  // while connecting, fall back to local data when it is the same tournament
  return { t: remote ?? (local.id === id ? local : null), remote: true, status };
}
