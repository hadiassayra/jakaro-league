/**
 * Optional real-time sync through Firebase Realtime Database.
 * The app works fully offline without it. Configure with VITE_FIREBASE_CONFIG
 * (build time) or paste the config in Settings (stored in this browser only).
 * Data is stored at /jakaro/{tournamentId} as { json, updatedAt }.
 */
import type { Tournament } from '../lib/types';
import { defaultFirebaseConfig } from './defaultConfig';

const LS_KEY = 'jakaro-firebase-config';

export interface FirebaseWebConfig {
  apiKey: string;
  databaseURL: string;
  [k: string]: string;
}

function parse(raw: string | null | undefined): FirebaseWebConfig | null {
  if (!raw) return null;
  try {
    // accept JSON or a JS object literal copied from the Firebase console
    const cleaned = raw
      .trim()
      .replace(/^const\s+\w+\s*=\s*/, '')
      .replace(/;\s*$/, '')
      .replace(/([{,]\s*)([A-Za-z_]\w*)\s*:/g, '$1"$2":')
      .replace(/'/g, '"')
      .replace(/,\s*}/g, '}');
    const obj = JSON.parse(cleaned);
    return obj?.databaseURL && obj?.apiKey ? obj : null;
  } catch {
    return null;
  }
}

export function encodeConfig(c: FirebaseWebConfig): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(c))));
}

function decodeConfig(s: string): FirebaseWebConfig | null {
  try {
    return parse(decodeURIComponent(escape(atob(s))));
  } catch {
    return null;
  }
}

export function getSyncConfig(urlParam?: string | null): FirebaseWebConfig | null {
  if (urlParam) {
    const fromUrl = decodeConfig(urlParam);
    if (fromUrl) return fromUrl;
  }
  return parse(import.meta.env.VITE_FIREBASE_CONFIG) ?? parse(localStorage.getItem(LS_KEY)) ?? defaultFirebaseConfig;
}

export function hasBuildConfig(): boolean {
  return !!parse(import.meta.env.VITE_FIREBASE_CONFIG) || !!defaultFirebaseConfig;
}

export function saveSyncConfig(raw: string): boolean {
  if (!raw.trim()) {
    localStorage.removeItem(LS_KEY);
    return true;
  }
  const c = parse(raw);
  if (!c) return false;
  localStorage.setItem(LS_KEY, JSON.stringify(c));
  return true;
}

export function rawSyncConfig(): string {
  return localStorage.getItem(LS_KEY) ?? '';
}

type DbApi = typeof import('firebase/database');
let cached: Promise<{ db: ReturnType<DbApi['getDatabase']>; api: DbApi; app: import('firebase/app').FirebaseApp }> | null = null;
let cachedUrl = '';

async function connect(config: FirebaseWebConfig) {
  if (!cached || cachedUrl !== config.databaseURL) {
    cachedUrl = config.databaseURL;
    cached = (async () => {
      const [{ initializeApp, getApps }, api] = await Promise.all([
        import('firebase/app'),
        import('firebase/database'),
      ]);
      const name = `jakaro-${config.databaseURL}`;
      const app = getApps().find((a) => a.name === name) ?? initializeApp(config, name);
      return { db: api.getDatabase(app), api, app };
    })();
  }
  return cached;
}

export async function getFirebaseApp(config: FirebaseWebConfig) {
  return (await connect(config)).app;
}

export type SyncStatus = 'off' | 'connecting' | 'live' | 'error';

/** Subscribe to remote updates. Returns an unsubscribe function. */
export function subscribeRemote(
  config: FirebaseWebConfig,
  id: string,
  onData: (t: Tournament | null) => void,
  onStatus: (s: SyncStatus, err?: string) => void,
): () => void {
  let unsub: (() => void) | null = null;
  let cancelled = false;
  onStatus('connecting');
  connect(config)
    .then(({ db, api }) => {
      if (cancelled) return;
      unsub = api.onValue(
        api.ref(db, `jakaro/${id}`),
        (snap) => {
          onStatus('live');
          const v = snap.val() as { json?: string } | null;
          if (!v?.json) return onData(null);
          try {
            onData(JSON.parse(v.json));
          } catch {
            onStatus('error', 'بيانات غير صالحة');
          }
        },
        (err) => onStatus('error', err.message),
      );
    })
    .catch((e) => onStatus('error', String(e?.message ?? e)));
  return () => {
    cancelled = true;
    unsub?.();
  };
}

export async function pushRemote(config: FirebaseWebConfig, t: Tournament): Promise<void> {
  const { db, api } = await connect(config);
  await api.set(api.ref(db, `jakaro/${t.id}`), { json: JSON.stringify(t), updatedAt: t.updatedAt });
}
