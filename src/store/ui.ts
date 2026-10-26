import { create } from 'zustand';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  danger?: boolean;
}

interface Toast {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}

interface UiState {
  confirm: (ConfirmOptions & { resolve: (ok: boolean) => void }) | null;
  toasts: Toast[];
  adminUnlocked: boolean;
  setAdminUnlocked: (v: boolean) => void;
}

export const useUi = create<UiState>()((set) => ({
  confirm: null,
  toasts: [],
  adminUnlocked: sessionStorage.getItem('jakaro-admin') === '1',
  setAdminUnlocked: (v) => {
    sessionStorage.setItem('jakaro-admin', v ? '1' : '0');
    set({ adminUnlocked: v });
  },
}));

export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    useUi.setState({
      confirm: {
        ...opts,
        resolve: (ok) => {
          useUi.setState({ confirm: null });
          resolve(ok);
        },
      },
    });
  });
}

let toastId = 0;
export function toast(text: string, action?: Toast['action'], ms = 4000) {
  const id = ++toastId;
  useUi.setState((s) => ({ toasts: [...s.toasts, { id, text, action }] }));
  setTimeout(() => useUi.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), ms);
}

export function dismissToast(id: number) {
  useUi.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
}

export async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  if (crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // fallback for insecure contexts (http on LAN): simple FNV hash
  let h = 0x811c9dc5;
  data.forEach((b) => {
    h ^= b;
    h = Math.imul(h, 0x01000193);
  });
  return `fnv${(h >>> 0).toString(16)}`;
}
