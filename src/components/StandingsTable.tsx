import { motion, LayoutGroup } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { GroupId, QualStatus, StandingRow, Tournament } from '../lib/types';
import { FormStrip, TeamMarble } from './ui';

export const groupLabel = (g: GroupId) => (g === 'A' ? 'المجموعة أ' : 'المجموعة ب');

const TIE_LABEL: Partial<Record<StandingRow['tiebreak'], { text: string; cls: string; title: string }>> = {
  h2h: { text: 'مواجهة', cls: 'bg-m-blue/20 text-ink', title: 'حُسم الترتيب بالمواجهة المباشرة' },
  override: { text: '🪙 يدوي', cls: 'bg-accent text-on-accent', title: 'حُسم الترتيب بقرار المنظم (قرعة)' },
  unresolved: { text: '⚠ تعادل', cls: 'bg-loss text-white', title: 'تعادل كامل — يحتاج قرار المنظم' },
};

export function QualBadge({ status, big }: { status: QualStatus | undefined; big?: boolean }) {
  if (!status || status === 'open') return null;
  const q = status === 'qualified';
  return (
    <span
      className={`chip ${big ? 'px-3 py-1 text-xl' : ''} ${q ? 'bg-win text-white' : 'bg-ink/15 text-ink/70'}`}
      title={q ? 'تأهل رسمياً' : 'خرج رسمياً من المنافسة'}
    >
      {q ? '✓ متأهل' : 'خارج'}
    </span>
  );
}

/** Remembers each team's points to flash rows that just changed */
function useChanged(rows: StandingRow[]) {
  const prev = useRef<Map<string, string> | null>(null);
  const [changed, setChanged] = useState<Set<string>>(new Set());
  const sig = rows.map((r) => `${r.teamId}:${r.played}:${r.points}:${r.marblePoints}`).join('|');
  useEffect(() => {
    const now = new Map(rows.map((r) => [r.teamId, `${r.played}:${r.points}:${r.marblePoints}`]));
    if (prev.current) {
      const c = new Set<string>();
      now.forEach((v, k) => prev.current!.get(k) !== v && c.add(k));
      if (c.size) {
        setChanged(c);
        const id = setTimeout(() => setChanged(new Set()), 2300);
        prev.current = now;
        return () => clearTimeout(id);
      }
    }
    prev.current = now;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  return changed;
}

export function StandingsTable({
  t,
  rows,
  qual,
  big = false,
  linkTeams = true,
}: {
  t: Tournament;
  rows: StandingRow[];
  qual?: Record<string, QualStatus>;
  big?: boolean;
  linkTeams?: boolean;
}) {
  const changed = useChanged(rows);
  const q = t.settings.qualifiersPerGroup;
  const cols = big
    ? 'grid-cols-[4rem_minmax(0,1fr)_4.5rem_4.5rem_4.5rem_5.5rem_7rem_13rem]'
    : 'grid-cols-[1.8rem_minmax(0,1fr)_2rem_2.4rem_2.8rem] @md:grid-cols-[2rem_minmax(0,1fr)_2.2rem_2.6rem_3.4rem_7.5rem] @2xl:grid-cols-[2.4rem_minmax(0,1fr)_2.4rem_2.4rem_2.4rem_3rem_4.5rem_7.5rem]';
  const hideSm = big ? '' : 'hidden @2xl:block';
  const hideForm = big ? '' : 'hidden @md:block';
  const cell = 'text-center tabular-nums';
  const team = (id: string) => t.teams.find((x) => x.id === id);

  return (
    <div className={big ? 'text-3xl' : '@container text-sm sm:text-base'}>
      <div className={`grid ${cols} items-center gap-x-2 px-3 pb-2 font-bold text-ink/60 ${big ? 'text-2xl' : 'text-xs sm:text-sm'}`}>
        <span className={cell}>#</span>
        <span>الفريق</span>
        <span className={cell} title="لعب">لعب</span>
        <span className={`${cell} ${hideSm}`}>فاز</span>
        <span className={`${cell} ${hideSm}`}>خسر</span>
        <span className={cell}>نقاط</span>
        <span className={cell} title="مجموع كرات الخصوم المتبقية عند الفوز ناقص كراتنا المتبقية عند الخسارة">
          {big ? 'نقاط الفرق' : <><span className="@2xl:hidden">الفرق</span><span className="hidden @2xl:inline">نقاط الفرق</span></>}
        </span>
        <span className={`${hideForm} text-center`}>آخر النتائج</span>
      </div>
      <LayoutGroup>
        <div className="flex flex-col gap-1.5">
          {rows.map((r) => {
            const tm = team(r.teamId);
            const tie = TIE_LABEL[r.tiebreak];
            const status = qual?.[r.teamId];
            const name = (
              <span className={`truncate font-bold ${big ? 'text-4xl font-display' : ''}`}>{tm?.name ?? '؟'}</span>
            );
            return (
              <motion.div
                layout
                key={r.teamId}
                transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                className={`relative grid ${cols} items-center gap-x-2 rounded-xl px-3 ${big ? 'py-3' : 'py-2'} ${
                  r.rank <= q ? 'bg-primary/15 dark:bg-primary/25' : 'bg-ink/5'
                } ${status === 'eliminated' ? 'opacity-60' : ''} ${changed.has(r.teamId) ? 'flash' : ''}`}
              >
                <span className={`${cell} font-display ${big ? 'text-5xl' : 'text-xl'} ${r.rank <= q ? 'text-accent-ink' : ''}`}>
                  {r.rank}
                </span>
                <span className="flex min-w-0 items-center gap-2">
                  <TeamMarble teams={t.teams} id={r.teamId} size={big ? 52 : 28} />
                  <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                    {linkTeams && !big ? (
                      <Link to={`/admin/team/${r.teamId}`} className="min-w-0 truncate hover:underline">
                        {name}
                      </Link>
                    ) : (
                      name
                    )}
                    {(tie || status !== 'open') && (
                      <span className="flex flex-wrap gap-1">
                        {tie && (
                          <span className={`chip ${tie.cls} ${big ? 'text-lg' : ''}`} title={tie.title}>
                            {tie.text}
                          </span>
                        )}
                        <QualBadge status={status} big={big} />
                      </span>
                    )}
                  </span>
                </span>
                <span className={cell}>{r.played}</span>
                <span className={`${cell} ${hideSm} text-win`}>{r.won}</span>
                <span className={`${cell} ${hideSm} text-loss`}>{r.lost}</span>
                <span className={`${cell} font-display ${big ? 'text-5xl' : 'text-2xl'}`}>{r.points}</span>
                <span className={`${cell} font-bold ${r.marblePoints > 0 ? 'text-win' : r.marblePoints < 0 ? 'text-loss' : ''}`}>
                  <span dir="ltr">
                    {r.marblePoints > 0 ? `+${r.marblePoints}` : r.marblePoints}
                  </span>
                </span>
                <span className={`${hideForm} text-center`}>
                  <FormStrip form={r.form} size={big ? 'lg' : 'sm'} max={big ? 5 : 5} />
                </span>
                {r.rank === q && rows.length > q && (
                  <span className="pointer-events-none absolute inset-x-2 -bottom-[5px] h-[3px] rounded bg-accent/80" title="خط التأهل" />
                )}
              </motion.div>
            );
          })}
        </div>
      </LayoutGroup>
    </div>
  );
}
