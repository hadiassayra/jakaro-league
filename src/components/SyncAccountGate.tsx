import { useEffect, useState, type ReactNode } from 'react';
import type { Auth, User } from 'firebase/auth';
import { Link } from 'react-router-dom';
import { getFirebaseApp, getSyncConfig } from '../sync/firebaseSync';
import { Logo } from './Logo';
import { MarbleLoader } from './ui';
import { useStore } from '../store/useStore';

export function SyncAccountGate({ children }: { children: ReactNode }) {
  const config = getSyncConfig();
  const owner = config?.ownerEmail;
  const tournamentId = config?.tournamentId;
  const logo = useStore(s => s.t.settings.logo);
  const [auth, setAuth] = useState<Auth | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!config || !owner) { setReady(true); return; }
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    void Promise.all([getFirebaseApp(config), import('firebase/auth')]).then(([app, api]) => {
      if (cancelled) return;
      const instance = api.getAuth(app);
      instance.languageCode = 'ar';
      setAuth(instance);
      unsubscribe = api.onAuthStateChanged(instance, next => { setUser(next); setReady(true); });
    }).catch(() => { if (!cancelled) { setError('تعذّر الاتصال. تحقق من الإنترنت وأعد تحميل الصفحة.'); setReady(true); } });
    return () => { cancelled = true; unsubscribe?.(); };
    // Config is fixed for the lifetime of this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner]);
  if (!owner || (ready && user?.emailVerified && user.email?.toLowerCase() === owner.toLowerCase())) return <>{children}</>;
  const login = async () => {
    if (!auth) return;
    setBusy(true); setError('');
    try {
      const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account', login_hint: owner });
      await signInWithPopup(auth, provider);
    } catch (e) {
      const code = (e as { code?: string }).code;
      setError(code === 'auth/popup-blocked' ? 'اسمح بالنافذة المنبثقة ثم حاول مرة أخرى.' : code === 'auth/popup-closed-by-user' ? 'لم يكتمل تسجيل الدخول. حاول مرة أخرى.' : 'تعذّر تسجيل الدخول بحساب Google. حاول مرة أخرى.');
    } finally { setBusy(false); }
  };
  return <div className="board-bg grid min-h-dvh place-items-center px-4 py-8">
    <section className="board w-full max-w-md space-y-5 p-7 text-center">
      <Logo src={logo} className="mx-auto h-20 w-auto rounded-xl" />
      <div><h1 className="text-3xl">إدارة البطولة</h1><p className="mt-2 text-sm text-ink/65">سجّل بحسابك لإدارة المباريات ومزامنة النتائج بين أجهزتك.</p></div>
      <p className="text-sm font-bold" dir="ltr">{owner}</p>
      {!ready ? <MarbleLoader label="جارٍ التحقق من الحساب…" /> : <button className="btn btn-primary w-full" disabled={!auth || busy} onClick={login}>{busy ? 'جارٍ تسجيل الدخول…' : 'تسجيل الدخول بحساب Google'}</button>}
      {user && <p className="text-sm text-loss">هذا الحساب غير مخوّل لإدارة البطولة. اختر حساب صاحب البطولة.</p>}
      {error && <p role="alert" className="text-sm text-loss">{error}</p>}
      <Link className="inline-block text-sm text-primary-ink underline" to={`/live${tournamentId ? `?t=${tournamentId}` : ''}`}>متابعة المباريات والنتائج</Link>
    </section>
  </div>;
}
