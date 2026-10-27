import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import type { Tournament } from '../lib/types';
import { isTransferMessage } from './authTransferMessage';

const REQUEST = 'jakaro-request-local-tournament';
const RESPONSE = 'jakaro-local-tournament';

/** Transfer the existing browser's tournament only between this app's origins.
 * Credentials never travel in the URL or in these messages. */
export function openDirectLogin(url: string): boolean {
  const target = new URL(url);
  const params = new URLSearchParams(target.hash.split('?')[1] ?? '');
  const nonce = crypto.randomUUID();
  params.set('transfer', nonce);
  params.set('from', window.location.origin);
  target.hash = `${target.hash.split('?')[0] || '#/'}?${params}`;
  let child: Window | null = null;
  const receive = (event: MessageEvent) => {
    if (!isTransferMessage(event, child, target.origin, REQUEST, nonce)) return;
    child!.postMessage({ type: RESPONSE, nonce, tournament: useStore.getState().t }, target.origin);
    window.removeEventListener('message', receive);
    clearTimeout(timer);
  };
  window.addEventListener('message', receive);
  const timer = window.setTimeout(() => window.removeEventListener('message', receive), 60000);
  child = window.open(target.href, 'jakaro-direct-login');
  if (!child) { window.removeEventListener('message', receive); clearTimeout(timer); }
  return !!child;
}

export function useAuthTransfer() {
  const [pending, setPending] = useState(() => new URLSearchParams(window.location.hash.split('?')[1] ?? '').has('transfer'));
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
    const nonce = params.get('transfer');
    const from = params.get('from');
    const allowed = ['https://hadiassayra.github.io', 'http://localhost:5173', 'http://127.0.0.1:5173'];
    if (!nonce || !from || !allowed.includes(from) || !window.opener) { setPending(false); return; }
    const finish = () => {
      setPending(false);
      params.delete('transfer'); params.delete('from');
      const route = window.location.hash.split('?')[0] || '#/';
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${route}${params.size ? `?${params}` : ''}`);
    };
    const receive = (event: MessageEvent) => {
      if (!isTransferMessage(event, window.opener, from, RESPONSE, nonce)) return;
      const t = event.data.tournament as Tournament | undefined;
      if (t && typeof t.id === 'string' && t.settings && Array.isArray(t.teams) && Array.isArray(t.matches) && t.tieOverrides) useStore.getState().replace(t);
      window.removeEventListener('message', receive);
      clearTimeout(timer);
      finish();
    };
    window.addEventListener('message', receive);
    const timer = window.setTimeout(() => { window.removeEventListener('message', receive); finish(); }, 10000);
    window.opener.postMessage({ type: REQUEST, nonce }, from);
    return () => { window.removeEventListener('message', receive); clearTimeout(timer); };
  }, []);
  return pending;
}
