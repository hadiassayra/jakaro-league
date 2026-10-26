import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Tournament } from '../lib/types';
import { defaultSettings, newTournament } from '../lib/tournament';
import { sampleTournament } from '../lib/sample';
import { importRegisteredTeams } from '../lib/registeredTeams';

const UNDO_LIMIT = 40;
export const STORAGE_KEY = 'jakaro-league-v1';

interface StoreState {
  t: Tournament;
  undoStack: { t: Tournament; label: string }[];
  /** Apply a change; pushes the previous state to the undo stack */
  apply: (fn: (t: Tournament) => Tournament, label?: string) => boolean;
  undo: () => string | null;
  /** Replace the whole tournament (backup import, remote sync) */
  replace: (t: Tournament, opts?: { undoable?: boolean }) => void;
}

function normalize(t: Tournament): Tournament {
  // merge in settings added in newer versions
  return {
    ...t,
    settings: { ...defaultSettings(), ...t.settings },
    tieOverrides: t.tieOverrides ?? { A: [], B: [] },
    log: t.log ?? [],
  };
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      t: importRegisteredTeams(),
      undoStack: [],
      apply: (fn, label = '') => {
        const prev = get().t;
        let next: Tournament;
        try {
          next = fn(prev);
        } catch (e) {
          alert((e as Error).message);
          return false;
        }
        if (next === prev) return false;
        set({
          t: { ...next, updatedAt: Date.now() },
          undoStack: [{ t: prev, label }, ...get().undoStack].slice(0, UNDO_LIMIT),
        });
        return true;
      },
      undo: () => {
        const [last, ...rest] = get().undoStack;
        if (!last) return null;
        set({ t: { ...last.t, updatedAt: Date.now() }, undoStack: rest });
        return last.label || 'آخر إجراء';
      },
      replace: (t, opts) => {
        const prev = get().t;
        set({
          t: normalize(t),
          undoStack: opts?.undoable ? [{ t: prev, label: 'استبدال البيانات' }, ...get().undoStack] : get().undoStack,
        });
      },
    }),
    {
      name: STORAGE_KEY,
      version: 2,
      migrate: (persisted) => {
        const p = persisted as { t?: Tournament };
        if (!p?.t) return { t: importRegisteredTeams() };
        const demo = sampleTournament('groups');
        const isDemo = p.t.teams.length === demo.teams.length && p.t.teams.every((team, i) =>
          team.id === demo.teams[i].id && team.name === demo.teams[i].name &&
          team.player1 === demo.teams[i].player1 && team.player2 === demo.teams[i].player2,
        );
        return { t: importRegisteredTeams(isDemo ? newTournament(p.t.settings) : p.t) };
      },
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ t: s.t }),
      merge: (persisted, current) => {
        const p = persisted as { t?: Tournament } | undefined;
        return p?.t ? { ...current, t: normalize(p.t) } : current;
      },
    },
  ),
);

// Keep other tabs/windows (e.g. presentation on a second screen) in sync.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) useStore.persist.rehydrate();
  });
}

export function resetTournament(keepSettings: boolean) {
  const cur = useStore.getState().t;
  useStore.getState().apply(() => newTournament(keepSettings ? cur.settings : undefined), 'بطولة جديدة');
}
