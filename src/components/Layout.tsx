import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../store/useStore';
import { sha256, toast, useUi } from '../store/ui';
import { useSyncStatus } from '../sync/useSync';
import { Logo } from './Logo';
import { Marble } from './ui';

export const NAV = [
  { to: '/admin', label: 'الرئيسية', icon: '🏠', end: true },
  { to: '/admin/teams', label: 'الفرق', icon: '👥' },
  { to: '/admin/draw', label: 'القرعة', icon: '🎲' },
  { to: '/admin/matches', label: 'المباريات', icon: '🎯' },
  { to: '/match-display', label: 'شاشة المباريات', icon: '📺' },
  { to: '/admin/standings', label: 'نقاط المجموعات', icon: '📊' },
  { to: '/admin/rules', label: 'تعليمات البطولة', icon: '📋' },
  { to: '/admin/knockout', label: 'الإقصائيات', icon: '🏆' },
  { to: '/admin/stats', label: 'الإحصائيات', icon: '📈' },
  { to: '/admin/log', label: 'السجل', icon: '📝' },
  { to: '/admin/print', label: 'الطباعة والتصدير', icon: '🖨️' },
  { to: '/admin/settings', label: 'الإعدادات', icon: '⚙️' },
];
const MOBILE_MAIN = ['/admin', '/admin/matches', '/admin/standings', '/admin/knockout'];

function SyncBadge() {
  const { status, error } = useSyncStatus();
  if (status === 'off') return null;
  const map = {
    connecting: ['bg-m-yellow', 'جارٍ الاتصال'],
    live: ['bg-m-green', 'مزامنة مباشرة'],
    error: ['bg-loss', 'خطأ في المزامنة'],
  } as const;
  const [cls, text] = map[status];
  return (
    <span className="chip bg-ink/5 text-ink/80" title={error ?? text}>
      <span className={`live-dot inline-block h-2 w-2 rounded-full ${cls}`} />
      <span className="hidden sm:inline">{text}</span>
    </span>
  );
}

function IconBtn({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="grid h-9 w-9 place-items-center rounded-lg text-lg text-ink transition hover:bg-ink/10"
    >
      {children}
    </button>
  );
}

export function Layout() {
  const t = useStore((s) => s.t);
  const apply = useStore((s) => s.apply);
  const undo = useStore((s) => s.undo);
  const canUndo = useStore((s) => s.undoStack.length > 0);
  const [more, setMore] = useState(false);
  const loc = useLocation();
  const s = t.settings;

  const toggle = (key: 'dark' | 'sound') =>
    apply((x) => ({ ...x, settings: { ...x.settings, [key]: !x.settings[key] } }));

  return (
    <div className="board-bg min-h-dvh pb-24 lg:pb-8">
      <header className="no-print sticky top-0 z-40 border-b border-ink/10 bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2">
          <Link to="/admin" className="flex min-w-0 items-center gap-3">
            <Logo src={s.logo} className="h-11 w-auto max-w-[8rem] sm:h-12 sm:max-w-[10rem]" />
            <span className="truncate font-display text-xl leading-none sm:text-2xl">{s.name}</span>
          </Link>
          <div className="ms-auto flex items-center gap-1.5">
            <SyncBadge />
            {canUndo && (
              <IconBtn
                label="تراجع عن آخر إجراء"
                onClick={() => {
                  const l = undo();
                  if (l) toast(`تم التراجع: ${l}`);
                }}
              >
                ↶
              </IconBtn>
            )}
            <IconBtn label={s.sound ? 'كتم الصوت' : 'تشغيل الصوت'} onClick={() => toggle('sound')}>
              {s.sound ? '🔊' : '🔇'}
            </IconBtn>
            <IconBtn label={s.dark ? 'الوضع الفاتح' : 'الوضع الداكن'} onClick={() => toggle('dark')}>
              {s.dark ? '☀️' : '🌙'}
            </IconBtn>
            <Link to="/show" className="btn btn-primary btn-sm hidden sm:inline-flex">
              عرض النتائج
            </Link>
          </div>
        </div>
        <nav className="mx-auto hidden max-w-7xl gap-1 overflow-x-auto px-3 lg:flex">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `-mb-px border-b-2 px-3 py-2 text-sm font-bold whitespace-nowrap transition ${
                  isActive ? 'border-primary-ink text-primary-ink' : 'border-transparent text-ink/60 hover:text-ink'
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5">
        <motion.div
          key={loc.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <Outlet />
        </motion.div>
      </main>

      {/* Mobile bottom navigation */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="grid grid-cols-6">
          {NAV.filter((n) => MOBILE_MAIN.includes(n.to)).map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 text-[11px] font-bold ${isActive ? 'text-accent-ink' : 'text-ink/70'}`
              }
            >
              <span className="text-lg">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
          <Link to="/show" className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-bold text-ink/70">
            <span className="text-lg">📺</span>عرض
          </Link>
          <button onClick={() => setMore(true)} className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-bold text-ink/70">
            <span className="text-lg">☰</span>المزيد
          </button>
        </div>
      </nav>
      <AnimatePresence>
        {more && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/50 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMore(false)}
          >
            <motion.div
              className="board absolute inset-x-0 bottom-0 rounded-b-none p-4 pb-8"
              initial={{ y: 300 }}
              animate={{ y: 0 }}
              exit={{ y: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="grid grid-cols-3 gap-2">
                {NAV.map((n) => (
                  <NavLink
                    key={n.to}
                    to={n.to}
                    end={n.end}
                    onClick={() => setMore(false)}
                    className={({ isActive }) =>
                      `flex flex-col items-center gap-1 rounded-xl p-3 text-sm font-bold ${isActive ? 'bg-accent text-on-accent' : 'bg-ink/5'}`
                    }
                  >
                    <span className="text-2xl">{n.icon}</span>
                    {n.label}
                  </NavLink>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Blocks the admin area until the PIN is entered (client-side only) */
export function PinGate({ children }: { children: React.ReactNode }) {
  const pinHash = useStore((s) => s.t.settings.pinHash);
  const logo = useStore((s) => s.t.settings.logo);
  const name = useStore((s) => s.t.settings.name);
  const unlocked = useUi((s) => s.adminUnlocked);
  const setUnlocked = useUi((s) => s.setAdminUnlocked);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  if (!pinHash || unlocked) return <>{children}</>;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((await sha256(pin)) === pinHash) setUnlocked(true);
    else {
      setError(true);
      setPin('');
    }
  };
  return (
    <div className="board-bg grid min-h-dvh place-items-center p-4">
      <form onSubmit={submit} className="board flex w-full max-w-sm flex-col items-center gap-4 p-6 text-center">
        <Logo src={logo} className="h-24 w-auto rounded-xl" />
        <h1 className="text-3xl">{name}</h1>
        <p className="text-ink/70">لوحة الإدارة محمية برمز PIN</p>
        <input
          className="input text-center text-2xl tracking-[0.5em]"
          type="password"
          inputMode="numeric"
          autoFocus
          value={pin}
          onChange={(e) => {
            setPin(e.target.value);
            setError(false);
          }}
          placeholder="••••"
        />
        {error && <p className="text-sm font-bold text-loss">الرمز غير صحيح</p>}
        <button className="btn btn-primary w-full">دخول</button>
        <div className="flex gap-1">
          {(['red', 'blue', 'green', 'yellow'] as const).map((c) => (
            <Marble key={c} color={c} size={14} />
          ))}
        </div>
        <Link to="/live" className="text-sm underline">
          متابعة النتائج فقط (عرض عام)
        </Link>
      </form>
    </div>
  );
}
