import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState, type ReactNode } from 'react';
import { dismissToast, useUi } from '../store/ui';
import type { Team } from '../lib/types';

export const MARBLE_COLORS = ['red', 'blue', 'green', 'yellow'] as const;
export type MarbleColor = (typeof MARBLE_COLORS)[number] | 'primary' | 'accent';

export function Marble({
  color = 'red',
  size = 20,
  className = '',
  children,
}: {
  color?: MarbleColor;
  size?: number;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <span
      className={`marble marble-${color} ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.48 }}
    >
      {children}
    </span>
  );
}

export function MarbleLoader({ label = 'جارٍ التحميل…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10" role="status">
      <div className="flex gap-2">
        {MARBLE_COLORS.map((c, i) => (
          <span key={c} className="loader-marble" style={{ animationDelay: `${i * 0.12}s` }}>
            <Marble color={c} size={18} />
          </span>
        ))}
      </div>
      <span className="text-sm text-ink/70">{label}</span>
    </div>
  );
}

/** Simple divider line (kept name for existing call sites) */
export function HoleRow({ className = '' }: { className?: string; marbles?: boolean }) {
  return <div className={`h-px bg-ink/10 ${className}`} aria-hidden />;
}

const CARD_SUITS: Record<string, { s: string; red: boolean }> = {
  A: { s: '♠', red: false },
  K: { s: '♥', red: true },
  '5': { s: '♣', red: false },
  '7': { s: '♦', red: true },
  '10': { s: '♥', red: true },
  Q: { s: '♠', red: false },
  J: { s: '♦', red: true },
};

export function PlayingCard({ rank, className = '' }: { rank: string; className?: string }) {
  const suit = CARD_SUITS[rank] ?? { s: '♠', red: false };
  return (
    <span className={`pcard ${suit.red ? 'red' : 'black'} ${className}`} aria-hidden>
      <span className="r">{rank}</span>
      <span className="s">{suit.s}</span>
    </span>
  );
}

export function SectionTitle({
  title,
  sub,
  actions,
  className = '',
}: {
  /** Kept for older call sites; no longer shown */
  rank?: string;
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-3 flex flex-wrap items-center gap-3 ${className}`}>
      <div className="min-w-0 flex-1">
        <h2 className="text-xl leading-tight sm:text-2xl">{title}</h2>
        {sub && <p className="text-sm text-ink/65">{sub}</p>}
      </div>
      {actions && <div className="flex w-full flex-wrap gap-2 sm:w-auto">{actions}</div>}
    </div>
  );
}

export function teamColor(teams: Team[], id: string | null | undefined): MarbleColor {
  const team = teams.find((t) => t.id === id);
  if (!team) return 'primary';
  // index inside the team's own group so each group shows all four colors
  const i = teams.filter((t) => t.group === team.group).indexOf(team);
  return MARBLE_COLORS[i % 4];
}

/** Team logo, with the first letter as a fallback for teams without a badge. */
export function TeamMarble({ teams, id, size = 30 }: { teams: Team[]; id: string | null; size?: number }) {
  const team = teams.find((t) => t.id === id);
  const [failedLogo, setFailedLogo] = useState<string | null>(null);
  const color = teamColor(teams, id);
  const letter = team?.name.replace(/^ال/, '').trim().charAt(0) ?? '؟';
  if (team?.logo && failedLogo !== team.logo) return <img
    src={team.logo} alt={`شعار ${team.name}`} width={size} height={size}
    className="inline-block shrink-0 rounded-lg object-contain"
    style={{ width: size, height: size }}
    onError={() => setFailedLogo(team.logo ?? null)}
  />;
  return (
    <Marble color={color} size={size}>
      <span
        className="font-display leading-none"
        style={{ color: color === 'yellow' ? '#3a2b00' : 'white', textShadow: '0 1px 2px rgb(0 0 0 / .35)' }}
      >
        {letter}
      </span>
    </Marble>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal
            className={`board max-h-[92dvh] w-full overflow-y-auto rounded-b-none p-5 sm:rounded-b-[1.25rem] ${wide ? 'sm:max-w-4xl' : 'sm:max-w-lg'}`}
            initial={{ y: 40, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 40, opacity: 0 }}
          >
            <div className="mb-3 flex items-center gap-3">
              {title && <h3 className="flex-1 text-2xl">{title}</h3>}
              <button className="btn btn-ghost btn-sm ms-auto" onClick={onClose} aria-label="إغلاق">
                ✕
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ConfirmHost() {
  const c = useUi((s) => s.confirm);
  return (
    <Modal open={!!c} onClose={() => c?.resolve(false)} title={c?.title}>
      {c?.message && <p className="mb-5 whitespace-pre-line text-ink/80">{c.message}</p>}
      <div className="flex justify-end gap-2">
        <button className="btn btn-ghost" onClick={() => c?.resolve(false)}>
          إلغاء
        </button>
        <button className={`btn ${c?.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => c?.resolve(true)} autoFocus>
          {c?.confirmText ?? 'تأكيد'}
        </button>
      </div>
    </Modal>
  );
}

export function ToastHost() {
  const toasts = useUi((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="pointer-events-auto flex items-center gap-3 rounded-full bg-ink px-4 py-2 text-sm font-bold text-bg shadow-xl"
          >
            <Marble color="green" size={12} />
            <span>{t.text}</span>
            {t.action && (
              <button
                className="rounded-full bg-accent px-3 py-0.5 text-on-accent"
                onClick={() => {
                  t.action!.run();
                  dismissToast(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 py-1.5">
      <span className="flex-1">
        <span className="block font-semibold">{label}</span>
        {hint && <span className="block text-xs text-ink/60">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-primary' : 'bg-ink/20'}`}
      >
        <span
          className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all"
          style={{ insetInlineStart: checked ? 'calc(100% - 1.6rem)' : '0.15rem' }}
        />
      </button>
    </label>
  );
}

export function Field({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink/60">{hint}</span>}
    </label>
  );
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-ink/20 px-6 py-10 text-center text-ink/70">
      <div>{children}</div>
      {action}
    </div>
  );
}

export function FormStrip({ form, max = 5, size = 'sm' }: { form: ('W' | 'L')[]; max?: number; size?: 'sm' | 'lg' }) {
  const last = form.slice(-max);
  const dim = size === 'lg' ? 'h-8 w-8 text-lg' : 'h-5 w-5 text-[11px]';
  return (
    <span className="inline-flex gap-1" dir="ltr" aria-label="آخر النتائج">
      {last.map((f, i) => (
        <span
          key={i}
          className={`inline-grid place-items-center rounded-full font-black text-white ${dim} ${f === 'W' ? 'bg-win' : 'bg-loss'}`}
        >
          {f === 'W' ? '✓' : '✗'}
        </span>
      ))}
      {!last.length && <span className="text-ink/40">—</span>}
    </span>
  );
}
