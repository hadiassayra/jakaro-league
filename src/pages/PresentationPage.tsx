import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GroupId, QualStatus, Tournament } from '../lib/types';
import { useViewTournament } from '../sync/useSync';
import { useTheme } from '../components/useTheme';
import { allStandings, nextMatches } from '../lib/tournament';
import { qualificationStatus } from '../lib/qualification';
import { champion, koMatches } from '../lib/knockout';
import { isFinished } from '../lib/standings';
import { playFanfare, playWin } from '../lib/sound';
import { StandingsTable } from '../components/StandingsTable';
import { MatchCard, useNow } from '../components/MatchCard';
import { Bracket } from '../components/Bracket';
import { Logo } from '../components/Logo';
import { BackButton } from '../components/BackButton';
import { RevealOverlay, type RevealItem } from '../components/Reveal';
import { StatsView } from './StatsPage';
import { HoleRow, MarbleLoader, PlayingCard } from '../components/ui';

type SlideKey = 'A' | 'B' | 'matches' | 'bracket' | 'stats';
const SLIDE_TITLES: Record<SlideKey, [string, string]> = {
  A: ['K', 'ترتيب المجموعة أ'],
  B: ['10', 'ترتيب المجموعة ب'],
  matches: ['7', 'المباريات'],
  bracket: ['A', 'الأدوار الإقصائية'],
  stats: ['5', 'أرقام البطولة'],
};

/** Scale rem units with the screen so the same layout fills a phone, laptop or 4K TV */
function useScreenScale() {
  useEffect(() => {
    const el = document.documentElement;
    const prev = el.style.fontSize;
    el.style.fontSize = 'min(calc(100vw / 120), calc(100vh / 67.5))';
    return () => {
      el.style.fontSize = prev;
    };
  }, []);
}

function useReveals(t: Tournament | null) {
  const [queue, setQueue] = useState<RevealItem[]>([]);
  const prevQual = useRef<Record<string, QualStatus> | null>(null);
  const prevChamp = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!t) return;
    const st = allStandings(t);
    const q: Record<string, QualStatus> = {};
    const groupOf: Record<string, GroupId> = {};
    (['A', 'B'] as const).forEach((g) => {
      Object.assign(q, qualificationStatus(t.teams, t.matches, g, t.settings.qualifiersPerGroup, st[g]));
      t.teams.filter((x) => x.group === g).forEach((x) => (groupOf[x.id] = g));
    });
    const champ = champion(t.matches);
    const items: RevealItem[] = [];
    if (prevQual.current) {
      Object.entries(q).forEach(([id, s]) => {
        if (s === 'qualified' && prevQual.current![id] && prevQual.current![id] !== 'qualified') {
          items.push({ kind: 'qualified', teamId: id, group: groupOf[id] });
        }
      });
    }
    if (prevChamp.current !== undefined && champ && champ !== prevChamp.current) {
      items.push({ kind: 'champion', teamId: champ });
    }
    prevQual.current = q;
    prevChamp.current = champ;
    if (items.length) setQueue((x) => [...x, ...items]);
  }, [t]);

  const current = queue[0] ?? null;
  useEffect(() => {
    if (!current) return;
    if (current.kind === 'champion') playFanfare();
    else playWin();
  }, [current]);
  const next = useCallback(() => setQueue((x) => x.slice(1)), []);
  const show = useCallback((item: RevealItem) => setQueue((x) => [...x, item]), []);
  return { current, next, show };
}

function Clock() {
  const now = useNow(10000);
  return (
    <span className="tabular-nums">{new Intl.DateTimeFormat('ar', { hour: 'numeric', minute: '2-digit' }).format(now)}</span>
  );
}

export default function PresentationPage() {
  const { t, remote, status } = useViewTournament();
  useTheme(t?.settings);
  useScreenScale();
  const nav = useNavigate();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [controls, setControls] = useState(true);
  const [tick, setTick] = useState(0);
  const { current, next: nextReveal, show } = useReveals(t);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const slides: SlideKey[] = useMemo(() => {
    if (!t) return [];
    const s: SlideKey[] = [];
    const hasGroups = t.matches.some((m) => m.stage === 'group');
    if (hasGroups) s.push('A', 'B');
    if (t.matches.some((m) => !isFinished(m) && m.teamA && m.teamB) || !hasGroups) s.push('matches');
    if (t.matches.some((m) => m.stage === 'knockout')) s.push('bracket');
    if (t.matches.some(isFinished)) s.push('stats');
    return s;
  }, [t]);
  const slide = slides[index % Math.max(1, slides.length)] ?? 'matches';

  const go = useCallback(
    (d: number) => {
      setIndex((i) => (i + d + slides.length) % Math.max(1, slides.length));
      setTick((x) => x + 1);
    },
    [slides.length],
  );

  // auto-rotate
  const seconds = t?.settings.rotationSeconds ?? 12;
  useEffect(() => {
    if (paused || current || slides.length < 2) return;
    const id = setTimeout(() => go(1), seconds * 1000);
    return () => clearTimeout(id);
  }, [paused, current, slides.length, seconds, go, index, tick]);

  // jump to the group whose result just came in
  const lastResult = useRef<string | null>(null);
  useEffect(() => {
    if (!t) return;
    const last = t.matches.filter(isFinished).sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0))[0];
    const sig = last ? `${last.id}:${last.winnerId}:${last.loserMarbles}` : null;
    if (lastResult.current !== null && sig && sig !== lastResult.current) {
      const target: SlideKey = last.stage === 'knockout' ? 'bracket' : (last.group as SlideKey);
      const i = slides.indexOf(target);
      if (i >= 0) {
        setIndex(i);
        setTick((x) => x + 1);
      }
    }
    lastResult.current = sig ?? '';
  }, [t, slides]);

  const exit = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    nav(remote ? `/live${window.location.hash.split('?')[1] ? `?${window.location.hash.split('?')[1]}` : ''}` : '/');
  }, [nav, remote]);

  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'PageDown') go(1);
      else if (e.key === 'ArrowRight' || e.key === 'PageUp') go(-1);
      else if (e.key === ' ') {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (e.key.toLowerCase() === 'f') fullscreen();
      else if (e.key === 'Escape' && !document.fullscreenElement) exit();
      else if (/^[1-5]$/.test(e.key)) {
        const i = Number(e.key) - 1;
        if (i < slides.length) {
          setIndex(i);
          setTick((x) => x + 1);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, exit, slides.length]);

  const poke = () => {
    setControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControls(false), 3000);
  };
  useEffect(() => {
    poke();
    return () => clearTimeout(hideTimer.current);
  }, []);

  if (!t)
    return (
      <div className="board-bg grid min-h-dvh place-items-center">
        <MarbleLoader label={status === 'error' ? 'تعذّر الاتصال بالمزامنة' : 'جارٍ تحميل النتائج…'} />
      </div>
    );

  const st = allStandings(t);
  const champ = champion(t.matches);
  const [rank, title] = SLIDE_TITLES[slide];
  const q = t.settings.qualifiersPerGroup;
  const upcoming = nextMatches(t, 6);
  const recent = t.matches
    .filter(isFinished)
    .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0))
    .slice(0, 4);
  const koCount = koMatches(t.matches).length;

  return (
    <div
      className={`board-bg relative flex h-dvh flex-col overflow-hidden ${controls ? '' : 'cursor-none'}`}
      onMouseMove={poke}
      onClick={poke}
    >
      <header className="flex items-center gap-6 bg-primary px-10 py-4 text-on-primary shadow-xl">
        <BackButton className="text-on-primary" />
        <Logo src={t.settings.logo} className="h-20 w-auto rounded-lg" />
        <div className="font-display text-5xl">{t.settings.name}</div>
        <div className="ms-auto flex items-center gap-6 text-3xl">
          <span className="flex items-center gap-2">
            <span className="live-dot inline-block h-4 w-4 rounded-full bg-loss" /> مباشر
          </span>
          <Clock />
        </div>
      </header>
      <HoleRow className="bg-[color-mix(in_srgb,var(--primary)_70%,black)] py-1" />

      <main className="relative min-h-0 flex-1 px-10 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={slide}
            className="flex h-full flex-col"
            initial={{ opacity: 0, x: -80 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 80 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          >
            <div className="mb-5 flex items-center gap-5">
              <PlayingCard rank={rank} className="text-5xl" />
              <h1 className="text-7xl">{title}</h1>
              {(slide === 'A' || slide === 'B') && (
                <span className="ms-auto text-3xl text-ink/70">يتأهل أول {q}</span>
              )}
            </div>
            <div className="min-h-0 flex-1">
              {(slide === 'A' || slide === 'B') && (
                <StandingsTable
                  t={t}
                  rows={st[slide]}
                  qual={qualificationStatus(t.teams, t.matches, slide, q, st[slide])}
                  big
                  linkTeams={false}
                />
              )}
              {slide === 'matches' && (
                <div className="grid h-full grid-cols-3 gap-8">
                  <div className="col-span-2">
                    <h2 className="mb-4 text-4xl text-accent-ink">تُلعب الآن والتالية</h2>
                    <div className="grid grid-cols-2 gap-5">
                      {upcoming.map((m) => (
                        <MatchCard key={m.id} t={t} m={m} showRound />
                      ))}
                      {!upcoming.length && <p className="text-3xl text-ink/60">لا توجد مباريات قادمة</p>}
                    </div>
                  </div>
                  <div>
                    <h2 className="mb-4 text-4xl text-accent-ink">آخر النتائج</h2>
                    <div className="flex flex-col gap-4">
                      {recent.map((m) => (
                        <MatchCard key={m.id} t={t} m={m} showRound />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {slide === 'bracket' && <Bracket t={t} big={koCount <= 8} />}
              {slide === 'stats' && <StatsView t={t} big />}
            </div>
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="flex items-center gap-4 px-10 pb-5">
        <div className="flex gap-3">
          {slides.map((s, i) => (
            <button
              key={s}
              onClick={() => {
                setIndex(i);
                setTick((x) => x + 1);
              }}
              className={`h-5 w-5 rounded-full transition ${slide === s ? 'scale-125 bg-accent' : 'bg-ink/25'}`}
              aria-label={SLIDE_TITLES[s][1]}
            />
          ))}
        </div>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink/10">
          {!paused && slides.length > 1 && !current && (
            <motion.div
              key={`${index}-${tick}`}
              className="h-full bg-accent"
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: seconds, ease: 'linear' }}
            />
          )}
        </div>
        {paused && <span className="text-2xl text-ink/70">⏸ متوقف</span>}
      </footer>

      {/* floating controls */}
      <AnimatePresence>
        {controls && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-16 left-1/2 z-50 flex -translate-x-1/2 gap-2 rounded-full bg-black/70 p-2 text-white shadow-2xl"
            style={{ fontSize: 16 }}
          >
            <button className="btn btn-ghost text-white" onClick={() => go(-1)} title="السابق (→)">
              →
            </button>
            <button className="btn btn-ghost text-white" onClick={() => setPaused((p) => !p)} title="إيقاف/تشغيل (مسافة)">
              {paused ? '▶' : '⏸'}
            </button>
            <button className="btn btn-ghost text-white" onClick={() => go(1)} title="التالي (←)">
              ←
            </button>
            <button className="btn btn-ghost text-white" onClick={fullscreen} title="ملء الشاشة (F)">
              ⛶
            </button>
            {champ && (
              <button className="btn btn-ghost text-white" onClick={() => show({ kind: 'champion', teamId: champ })}>
                🏆
              </button>
            )}
            <button className="btn btn-ghost text-white" onClick={exit} title="خروج (Esc)">
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <RevealOverlay t={t} item={current} onDone={nextReveal} />
    </div>
  );
}
