import { useEffect, useState } from 'react';
import type { Match, Tournament } from '../lib/types';
import { isFinished } from '../lib/standings';
import { teamName } from '../lib/tournament';
import { koRoundLabel } from '../lib/knockout';
import { matchDayRound } from '../lib/playDay';
import { Marble, TeamMarble } from './ui';
import { CardsBadge } from './CardsBadge';

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function MatchTimer({ startedAt, limitMin, big }: { startedAt: number; limitMin: number; big?: boolean }) {
  const now = useNow();
  const sec = Math.max(0, Math.floor((now - startedAt) / 1000));
  const over = limitMin > 0 && sec >= limitMin * 60;
  const show = limitMin > 0 ? Math.abs(limitMin * 60 - sec) : sec;
  const mm = String(Math.floor(show / 60)).padStart(2, '0');
  const ss = String(show % 60).padStart(2, '0');
  return (
    <span
      dir="ltr"
      className={`chip tabular-nums ${big ? 'px-3 py-1 text-2xl' : ''} ${over ? 'bg-loss text-white' : 'bg-ink/10 text-ink'}`}
      title={limitMin ? 'الوقت المتبقي' : 'الوقت المنقضي'}
    >
      ⏱ {over ? '+' : ''}
      {mm}:{ss}
    </span>
  );
}

export function StatusChip({ m, big }: { m: Match; big?: boolean }) {
  const cls = big ? 'px-3 py-1 text-xl' : '';
  if (isFinished(m)) return <span className={`chip bg-ink/10 text-ink/70 ${cls}`}>انتهت</span>;
  if (m.status === 'playing')
    return (
      <span className={`chip bg-loss text-white ${cls}`}>
        <span className="live-dot inline-block h-2 w-2 rounded-full bg-white" /> تُلعب الآن
      </span>
    );
  return <span className={`chip bg-primary/20 text-primary-ink ${cls}`}>قادمة</span>;
}

/** Remaining marbles of the loser drawn as marbles out of the max */
export function MarblesLeft({ n, max, size = 10 }: { n: number; max: number; size?: number }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-0.5" title={`${n} كرات متبقية للخاسر`}>
      {Array.from({ length: max }, (_, i) =>
        i < n ? <Marble key={i} color="red" size={size} /> : <span key={i} className="hole inline-block" style={{ width: size, height: size }} />,
      )}
    </span>
  );
}

export function MatchCard({
  t,
  m,
  onOpen,
  big = false,
  showRound = false,
}: {
  t: Tournament;
  m: Match;
  onOpen?: (m: Match) => void;
  big?: boolean;
  showRound?: boolean;
}) {
  const done = isFinished(m);
  const live = !done && m.status === 'playing';
  const ko = t.matches.filter(x => x.stage === 'knockout');
  const clickable = !!onOpen && !!m.teamA && !!m.teamB;
  const Tag = clickable ? 'button' : 'div';
  const team = (id: string | null) => {
    const winner = done && id === m.winnerId;
    const entry = t.teams.find(x => x.id === id);
    return <div className={`fixture-team ${done && !winner ? 'fixture-team-lost' : ''}`}>
      <div className={`fixture-crest ${winner ? 'fixture-crest-winner' : ''}`}>
        {id ? <TeamMarble teams={t.teams} id={id} size={entry?.logo ? big ? 68 : 48 : big ? 56 : 36} /> : <span className="text-2xl text-ink/40">؟</span>}
      </div>
      <span className={`fixture-name ${winner ? 'text-accent-ink' : ''}`}>{id ? teamName(t, id) : 'بانتظار المتأهل'}</span>
      <CardsBadge match={m} teamId={id} />
      {done && <span className={winner ? 'fixture-winner' : 'fixture-players'}>{winner ? '✓ فوز' : 'خسارة'}</span>}
      {entry && (entry.player1 || entry.player2) && <span className="fixture-players">{[entry.player1, entry.player2].filter(Boolean).join(' · ')}</span>}
    </div>;
  };
  const date = m.scheduledAt ? new Date(m.scheduledAt).toLocaleDateString('ar-PS', { timeZone: 'Asia/Hebron', day: 'numeric', month: 'long' }) : m.playDay ?? 'بانتظار تحديد الموعد';
  return <Tag onClick={clickable ? () => onOpen!(m) : undefined} className={`fixture-card ${live ? 'fixture-live' : ''} ${big ? 'fixture-big' : ''} ${clickable ? 'fixture-clickable' : ''}`}>
    <div className="fixture-heading">
      <span>{m.stage === 'group' ? `المجموعة ${m.group === 'A' ? 'أ' : 'ب'}` : koRoundLabel(m, ko)}{showRound && m.stage === 'group' && !m.playDay ? ` · الجولة ${m.round}` : ''}</span>
      <span className={`fixture-status ${live ? 'fixture-status-live' : ''}`}>{live && <span className="live-dot h-1.5 w-1.5 rounded-full bg-current" />}{done ? 'انتهت المباراة' : live ? 'مباشر' : 'قادمة'}</span>
    </div>
    <div className="fixture-matchup">
      {team(m.teamA)}
      <div className="fixture-center">
        {done ? <><span className="text-2xl" aria-hidden="true">🏆</span><span className="fixture-outcome">النتيجة النهائية</span><span className="text-xs text-ink/60">فوز / خسارة</span></> : live ? <><span className="fixture-versus">VS</span>{m.startedAt ? <MatchTimer startedAt={m.startedAt} limitMin={t.settings.matchTimeLimitMin} big={big} /> : <span className="text-xs text-loss">قيد اللعب</span>}</> : <>
          <span className="fixture-kickoff" dir="ltr">{m.scheduledAt ? new Date(m.scheduledAt).toLocaleTimeString('en-GB', { timeZone: 'Asia/Hebron', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : '— : —'}</span>
          <span className="fixture-timezone">{m.scheduledAt ? 'بتوقيت فلسطين' : 'الساعة لم تُحدد'}</span>
        </>}
      </div>
      {team(m.teamB)}
    </div>
    <div className="fixture-footer">
      <span>{date}{m.playDay ? ` · ${matchDayRound(m) === 1 ? 'الجولة الأولى' : 'الجولة الثانية'}` : ''}</span>
      {m.table != null && <span>طاولة {m.table}</span>}
    </div>
    {m.forfeit ? <div className="fixture-result font-bold text-loss">خسارة مباشرة: {teamName(t, m.forfeit.teamId)} — بطاقة حمراء</div> : done && <div className="fixture-result"><span>كرات الخاسر المتبقية</span><MarblesLeft n={m.loserMarbles ?? 0} max={t.settings.maxMarbles} size={big ? 15 : 9} /><strong>{m.loserMarbles ?? '—'}</strong></div>}
  </Tag>;
}
