import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Auth, User } from 'firebase/auth';
import { Link } from 'react-router-dom';
import { getFirebaseApp, getSyncConfig } from '../sync/firebaseSync';
import { Logo } from './Logo';
import { MarbleLoader } from './ui';
import { useStore } from '../store/useStore';
import { openDirectLogin, useAuthTransfer } from '../sync/authTransfer';

export function SyncAccountGate({ children }: { children: ReactNode }) {
  const config = getSyncConfig();
  const transferring = useAuthTransfer();
  const owner = config?.ownerEmail;
  const tournamentId = config?.tournamentId;
  const logo = useStore(s => s.t.settings.logo);
  const [auth, setAuth] = useState<Auth | null>(null);
  const authApi = useRef<typeof import('firebase/auth') | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sameAuthDomain = config?.authDomain === window.location.hostname;
  const directLoginUrl = config?.authDomain ? `https://${config.authDomain}/${window.location.hash || '#/'}` : null;
  const showError = (e: unknown) => {
    const code = (e as { code?: string }).code;
    const messages: Record<string, string> = {
      'auth/popup-blocked': 'المتصفح منع نافذة Google. استخدم رابط الدخول المباشر أدناه.',
      'auth/popup-closed-by-user': 'لم ترجع جلسة Google للموقع. جرّب الدخول من الرابط المباشر أدناه.',
      'auth/unauthorized-domain': 'هذا الرابط غير مسموح لتسجيل الدخول. استخدم رابط الدخول المباشر أدناه.',
      'auth/web-storage-unsupported': 'تعذّر حفظ جلسة الدخول في هذا المتصفح. افتح الرابط المباشر في متصفح عادي.',
      'auth/network-request-failed': 'تعذّر الاتصال. تحقق من الإنترنت وحاول مرة أخرى.',
      'auth/operation-not-allowed': 'تسجيل الدخول بحساب Google غير متاح حالياً.',
      'auth/cancelled-popup-request': 'هناك محاولة دخول أخرى مفتوحة. أكملها ثم حاول مرة أخرى.',
    };
    setError(messages[code ?? ''] ?? `تعذّر تسجيل الدخول. حاول من الرابط المباشر${code ? ` (${code})` : ''}.`);
  };
  useEffect(() => {
    if (!config || !owner) { setReady(true); return; }
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    void Promise.all([getFirebaseApp(config), import('firebase/auth')]).then(async ([app, api]) => {
      if (cancelled) return;
      authApi.current = api;
      const instance = api.getAuth(app);
      instance.languageCode = 'ar';
      setAuth(instance);
      try { await api.getRedirectResult(instance); }
      catch (e) { if (!cancelled) showError(e); }
      if (cancelled) return;
      unsubscribe = api.onAuthStateChanged(instance, next => { setUser(next); setReady(true); });
    }).catch(() => { if (!cancelled) { setError('تعذّر الاتصال. تحقق من الإنترنت وأعد تحميل الصفحة.'); setReady(true); } });
    return () => { cancelled = true; unsubscribe?.(); };
    // Config is fixed for the lifetime of this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner]);
  if (!transferring && (!owner || (ready && user?.emailVerified && user.email?.toLowerCase() === owner.toLowerCase()))) return <>{children}</>;
  const login = async () => {
    const api = authApi.current;
    if (!auth || !api || busy || !owner) return;
    setBusy(true); setError('');
    try {
      const provider = new api.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account', login_hint: owner });
      // Keep popup creation inside the click gesture; on Firebase Hosting use
      // same-origin redirect to avoid third-party storage and popup callbacks.
      if (sameAuthDomain) await api.signInWithRedirect(auth, provider);
      else await api.signInWithPopup(auth, provider);
    } catch (e) {
      showError(e);
    } finally { setBusy(false); }
  };
  return <div className="board-bg grid min-h-dvh place-items-center px-4 py-8">
    <section className="board w-full max-w-md space-y-5 p-7 text-center">
      <Logo src={logo} className="mx-auto h-20 w-auto rounded-xl" />
      <div><h1 className="text-3xl">إدارة البطولة</h1><p className="mt-2 text-sm text-ink/65">سجّل بحسابك لإدارة المباريات ومزامنة النتائج بين أجهزتك.</p></div>
      <p className="text-sm font-bold" dir="ltr">{owner}</p>
      {!ready || transferring ? <MarbleLoader label={transferring ? 'جارٍ نقل بيانات البطولة من نافذتك…' : 'جارٍ التحقق من الحساب…'} /> : <button className="btn btn-primary w-full" disabled={!auth || busy} onClick={login}>{busy ? 'جارٍ تسجيل الدخول…' : 'تسجيل الدخول بحساب Google'}</button>}
      {user && <p className="text-sm text-loss">هذا الحساب غير مخوّل لإدارة البطولة. اختر حساب صاحب البطولة.</p>}
      {error && <p role="alert" className="text-sm text-loss">{error}</p>}
      {!sameAuthDomain && directLoginUrl && <a className="btn btn-ghost w-full" href={directLoginUrl} onClick={e => {
        e.preventDefault();
        if (!openDirectLogin(directLoginUrl)) setError('اسمح بفتح رابط الدخول المباشر، ثم اضغط الزر مرة أخرى.');
      }}>الدخول من الرابط المباشر ←</a>}
      {sameAuthDomain && <p className="text-xs text-ink/50">سيتم فتح Google في الصفحة نفسها، ثم الرجوع تلقائياً للبطولة.</p>}
      <Link className="inline-block text-sm text-primary-ink underline" to={`/live${tournamentId ? `?t=${tournamentId}` : ''}`}>متابعة المباريات والنتائج</Link>
    </section>
  </div>;
}
