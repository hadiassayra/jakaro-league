import { motion } from 'framer-motion';
import type { Match, Tournament } from '../lib/types';
import { bracketRounds, champion, koMatches, roundName } from '../lib/knockout';
import { isFinished } from '../lib/standings';
import { allStandings, teamName } from '../lib/tournament';
import { TeamMarble } from './ui';

function seedLabels(t: Tournament): Map<string, string> {
  const st = allStandings(t);
  const map = new Map<string, string>();
  (['A', 'B'] as const).forEach((g) =>
    st[g].forEach((r) => map.set(r.teamId, `${g === 'A' ? 'أ' : 'ب'}${r.rank}`)),
  );
  return map;
}

function BracketMatch({
  t,
  m,
  seeds,
  onOpen,
  big,
}: {
  t: Tournament;
  m: Match;
  seeds: Map<string, string> | null;
  onOpen?: (m: Match) => void;
  big?: boolean;
}) {
  const done = isFinished(m);
  const clickable = !!onOpen && !!m.teamA && !!m.teamB;
  const line = (id: string | null) => {
    const win = done && m.winnerId === id;
    return (
      <div
        className={`flex items-center gap-2 rounded-lg px-2 ${big ? 'py-2' : 'py-1'} ${
          win ? 'bg-accent/20' : done ? 'opacity-50' : ''
        }`}
      >
        {id ? (
          <TeamMarble teams={t.teams} id={id} size={big ? 34 : 20} />
        ) : (
          <span className="hole inline-block" style={{ width: big ? 34 : 20, height: big ? 34 : 20 }} />
        )}
        <span className={`min-w-0 flex-1 truncate ${big ? 'font-display text-3xl' : 'text-sm font-bold'} ${id ? '' : 'text-ink/40'}`}>
          {id ? teamName(t, id) : '—'}
        </span>
        {seeds && id && <span className={`chip bg-ink/10 ${big ? 'text-lg' : 'text-[10px]'}`}>{seeds.get(id)}</span>}
        {win && <span className={`font-black text-win ${big ? 'text-3xl' : ''}`}>✓</span>}
      </div>
    );
  };
  return (
    <motion.button
      layout
      type="button"
      disabled={!clickable}
      onClick={() => clickable && onOpen!(m)}
      className={`board block w-full p-1.5 text-start ${clickable ? 'cursor-pointer hover:border-accent/60' : 'cursor-default'} ${
        m.status === 'playing' && !done ? 'ring-2 ring-loss/70' : ''
      }`}
    >
      {line(m.teamA)}
      <div className="mx-2 h-px bg-ink/10" />
      {line(m.teamB)}
      {done && (
        <div className={`px-2 text-center text-ink/60 ${big ? 'text-lg' : 'text-[11px]'}`}>
          كرات الخاسر: {m.loserMarbles}
        </div>
      )}
    </motion.button>
  );
}

export function Bracket({ t, onOpen, big = false }: { t: Tournament; onOpen?: (m: Match) => void; big?: boolean }) {
  const rounds = bracketRounds(t.matches);
  const third = koMatches(t.matches).find((m) => m.thirdPlace);
  const champ = champion(t.matches);
  const seeds = seedLabels(t);
  if (!rounds.length) return null;
  const colW = big ? 'w-[22rem]' : 'w-52 sm:w-56';

  return (
    <div className="scrollbar-thin overflow-x-auto pb-3">
      <div className="flex min-w-max items-stretch gap-6 px-1">
        {rounds.map((round, r) => {
          const pairs: Match[][] = [];
          for (let i = 0; i < round.length; i += 2) pairs.push(round.slice(i, i + 2));
          const isFinal = round.length === 1;
          return (
            <div key={r} className={`flex ${colW} flex-col`}>
              <div className={`mb-3 text-center font-display ${big ? 'text-4xl' : 'text-xl'} text-accent-ink`}>
                {roundName(round.length)}
              </div>
              <div className="flex flex-1 flex-col justify-around gap-4">
                {pairs.map((p, i) => (
                  <div key={i} className={`bracket-pair ${p.length === 1 ? 'single' : ''}`}>
                    {p.map((m) => (
                      <BracketMatch key={m.id} t={t} m={m} seeds={r === 0 ? seeds : null} onOpen={onOpen} big={big} />
                    ))}
                  </div>
                ))}
                {isFinal && third && (
                  <div className="mt-2">
                    <div className={`mb-1 text-center font-display text-ink/70 ${big ? 'text-2xl' : 'text-base'}`}>
                      المركز الثالث
                    </div>
                    <BracketMatch t={t} m={third} seeds={null} onOpen={onOpen} big={big} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div className={`flex ${big ? 'w-72' : 'w-40'} flex-col items-center justify-center gap-2 text-center`}>
          <span className={big ? 'text-8xl' : 'text-5xl'}>🏆</span>
          {champ ? (
            <>
              <TeamMarble teams={t.teams} id={champ} size={big ? 70 : 40} />
              <span className={`font-display text-accent-ink ${big ? 'text-5xl' : 'text-2xl'}`}>{teamName(t, champ)}</span>
              <span className={`text-ink/60 ${big ? 'text-2xl' : 'text-sm'}`}>البطل</span>
            </>
          ) : (
            <span className={`text-ink/50 ${big ? 'text-2xl' : 'text-sm'}`}>البطل؟</span>
          )}
        </div>
      </div>
    </div>
  );
}
