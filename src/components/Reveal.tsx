import confetti from 'canvas-confetti';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import type { Tournament } from '../lib/types';
import { teamName } from '../lib/tournament';
import { groupLabel } from './StandingsTable';
import { Logo } from './Logo';
import { MARBLE_COLORS, Marble, TeamMarble } from './ui';

const CONFETTI_COLORS = ['#e53935', '#1e6fe0', '#2e9e46', '#f5c400', '#ffffff'];

export function burst(power = 1) {
  const base = { colors: CONFETTI_COLORS, shapes: ['circle' as const], scalar: 1.2, disableForReducedMotion: true };
  confetti({ ...base, particleCount: Math.round(140 * power), spread: 100, origin: { y: 0.6 } });
  confetti({ ...base, particleCount: Math.round(60 * power), angle: 60, spread: 70, origin: { x: 0, y: 0.7 } });
  confetti({ ...base, particleCount: Math.round(60 * power), angle: 120, spread: 70, origin: { x: 1, y: 0.7 } });
}

export type RevealItem = { kind: 'qualified'; teamId: string; group: 'A' | 'B' } | { kind: 'champion'; teamId: string };

export function RevealOverlay({ t, item, onDone }: { t: Tournament; item: RevealItem | null; onDone: () => void }) {
  useEffect(() => {
    if (!item) return;
    if (item.kind === 'champion') {
      burst(1.4);
      const iv = setInterval(() => burst(0.7), 1600);
      const end = setTimeout(onDone, 20000);
      return () => {
        clearInterval(iv);
        clearTimeout(end);
      };
    }
    burst(0.6);
    const end = setTimeout(onDone, 5500);
    return () => clearTimeout(end);
  }, [item, onDone]);

  const team = item ? t.teams.find((x) => x.id === item.teamId) : null;
  return (
    <AnimatePresence>
      {item && team && (
        <motion.div
          key={`${item.kind}-${item.teamId}`}
          className="fixed inset-0 z-[70] grid cursor-pointer place-items-center bg-black/75 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onDone}
        >
          {item.kind === 'champion' ? (
            <motion.div
              initial={{ scale: 0.3, rotate: -8, y: 80 }}
              animate={{ scale: 1, rotate: 0, y: 0 }}
              transition={{ type: 'spring', stiffness: 120, damping: 12 }}
              className="board relative flex w-[min(90vw,60rem)] flex-col items-center gap-6 border-4 border-accent p-12 text-center"
            >
              <Logo src={t.settings.logo} className="h-24 w-auto rounded-xl" />
              <motion.div
                className="text-[9rem] leading-none"
                animate={{ rotate: [0, -8, 8, 0], scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 2.2 }}
              >
                🏆
              </motion.div>
              <div className="font-display text-5xl text-accent-ink">بطل {t.settings.name}</div>
              <div className="flex items-center gap-5">
                <TeamMarble teams={t.teams} id={team.id} size={110} />
                <div className="font-display text-8xl leading-tight">{team.name}</div>
              </div>
              <div className="text-4xl text-ink/80">
                {team.player1} · {team.player2}
              </div>
              <div className="flex gap-3">
                {MARBLE_COLORS.map((c, i) => (
                  <motion.span key={c} animate={{ y: [0, -24, 0] }} transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.12 }}>
                    <Marble color={c} size={40} />
                  </motion.span>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ scale: 0.5, y: 60 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 160, damping: 14 }}
              className="board flex flex-col items-center gap-5 border-4 border-win p-12 text-center"
            >
              <div className="chip bg-win px-6 py-2 text-4xl text-white">✓ تأهل رسمياً</div>
              <motion.div initial={{ rotate: -720, x: -400 }} animate={{ rotate: 0, x: 0 }} transition={{ duration: 1.2, ease: 'easeOut' }}>
                <TeamMarble teams={t.teams} id={team.id} size={130} />
              </motion.div>
              <div className="font-display text-8xl">{teamName(t, team.id)}</div>
              <div className="text-4xl text-ink/70">إلى الأدوار الإقصائية من {groupLabel(item.group)}</div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
