import { Link } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { computeStats } from '../lib/stats';
import { teamName } from '../lib/tournament';
import { MarblesLeft } from '../components/MatchCard';
import { Empty, Marble, SectionTitle, TeamMarble } from '../components/ui';
import type { Tournament } from '../lib/types';

export function StatsView({ t, big = false, links = true }: { t: Tournament; big?: boolean; links?: boolean }) {
  const s = computeStats(t.teams, t.matches);
  const tile = `board flex flex-col gap-2 ${big ? 'p-6' : 'p-4'}`;
  const h = big ? 'text-3xl' : 'text-xl';
  const val = big ? 'text-7xl' : 'text-5xl';
  const teamRow = (id: string, right: React.ReactNode) => (
    <div key={id} className={`flex items-center gap-2 ${big ? 'text-3xl' : ''}`}>
      <TeamMarble teams={t.teams} id={id} size={big ? 40 : 24} />
      {big || !links ? (
        <span className="flex-1 truncate font-bold">{teamName(t, id)}</span>
      ) : (
        <Link to={`/admin/team/${id}`} className="flex-1 truncate font-bold hover:underline">
          {teamName(t, id)}
        </Link>
      )}
      {right}
    </div>
  );
  if (!s.finished) return <Empty>ستظهر الإحصائيات بعد تسجيل أول نتيجة.</Empty>;
  return (
    <div className={`grid gap-4 ${big ? 'grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
      <div className={tile}>
        <h3 className={h}>🎯 أكبر فوز</h3>
        <p className="text-sm text-ink/60">أكثر كرات متبقية للخاسر</p>
        {s.biggestWins.slice(0, 3).map((m) => (
          <div key={m.id} className={big ? 'text-3xl' : ''}>
            <div className="font-bold">
              {teamName(t, m.winnerId)} <span className="text-ink/50">على</span> {teamName(t, m.winnerId === m.teamA ? m.teamB : m.teamA)}
            </div>
            <MarblesLeft n={m.loserMarbles ?? 0} max={t.settings.maxMarbles} size={big ? 22 : 14} />
          </div>
        ))}
      </div>
      <div className={tile}>
        <h3 className={h}>🛡️ بلا خسارة</h3>
        {s.unbeaten.length ? (
          s.unbeaten.map((u) => teamRow(u.teamId, <span className="chip bg-win text-white">{u.played} فوز</span>))
        ) : (
          <p className="text-ink/60">لا يوجد فريق بلا خسارة</p>
        )}
      </div>
      <div className={tile}>
        <h3 className={h}>🔄 العودة بعد الخسارة</h3>
        <p className="text-sm text-ink/60">فوز مباشرة بعد خسارة · المجموع {s.totalComebacks}</p>
        {s.comebacks.slice(0, 4).map((c) => teamRow(c.teamId, <span className="chip bg-ink/10">{c.count}×</span>))}
      </div>
      <div className={tile}>
        <h3 className={h}>⚪ متوسط الكرات المتبقية</h3>
        <div className="flex items-end gap-3">
          <span className={`font-display ${val} text-accent-ink`}>{s.avgMarblesLeft}</span>
          <span className="pb-2 text-ink/60">من {t.settings.maxMarbles} لكل مباراة</span>
        </div>
        <p className="text-sm text-ink/60">
          {s.finished}/{s.total} مباراة منتهية · {s.shutouts} مباراة انتهت والخاسر بلا كرات متبقية
        </p>
      </div>
      <div className={tile}>
        <h3 className={h}>📈 الأعلى في نقاط الفرق</h3>
        {s.marbleLeaders.map((l) =>
          teamRow(
            l.teamId,
            <span dir="ltr" className={`font-bold ${l.marblePoints >= 0 ? 'text-win' : 'text-loss'}`}>
              {l.marblePoints > 0 ? `+${l.marblePoints}` : l.marblePoints}
            </span>,
          ),
        )}
      </div>
      <div className={tile}>
        <h3 className={h}>🔥 أطول سلسلة انتصارات</h3>
        {s.longestStreak ? (
          teamRow(
            s.longestStreak.teamId,
            <span className="flex items-center gap-1">
              {Array.from({ length: s.longestStreak.length }, (_, i) => (
                <Marble key={i} color="green" size={big ? 22 : 14} />
              ))}
            </span>,
          )
        ) : (
          <p className="text-ink/60">—</p>
        )}
      </div>
    </div>
  );
}

export default function StatsPage() {
  const t = useStore((s) => s.t);
  return (
    <div>
      <SectionTitle rank="10" title="الإحصائيات" />
      <StatsView t={t} />
    </div>
  );
}
