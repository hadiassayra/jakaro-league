import { Link, useParams } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { allStandings, teamName } from '../lib/tournament';
import { teamResults, countComebacks } from '../lib/stats';
import { koMatches, koRoundLabel, champion } from '../lib/knockout';
import { qualificationStatus } from '../lib/qualification';
import { isFinished } from '../lib/standings';
import { MarblesLeft } from '../components/MatchCard';
import { QualBadge, groupLabel } from '../components/StandingsTable';
import { Empty, FormStrip, HoleRow, SectionTitle, TeamMarble } from '../components/ui';

export default function TeamProfilePage() {
  const { id } = useParams();
  const t = useStore((s) => s.t);
  const team = t.teams.find((x) => x.id === id);
  if (!team) return <Empty action={<Link to="/admin/teams" className="btn btn-primary">الفرق</Link>}>الفريق غير موجود</Empty>;

  const st = team.group ? allStandings(t)[team.group] : [];
  const row = st.find((r) => r.teamId === team.id);
  const qual = team.group
    ? qualificationStatus(t.teams, t.matches, team.group, t.settings.qualifiersPerGroup, st)[team.id]
    : undefined;
  const results = teamResults(team.id, t.matches);
  const upcoming = t.matches.filter((m) => !isFinished(m) && (m.teamA === team.id || m.teamB === team.id) && m.teamA && m.teamB);
  const ko = koMatches(t.matches);
  const path = ko.filter((m) => m.teamA === team.id || m.teamB === team.id);
  const champ = champion(t.matches) === team.id;
  const marblesFor = results.filter((m) => m.winnerId === team.id).reduce((s, m) => s + (m.loserMarbles ?? 0), 0);
  const marblesAgainst = results.filter((m) => m.winnerId !== team.id).reduce((s, m) => s + (m.loserMarbles ?? 0), 0);

  const label = (m: (typeof results)[number]) =>
    m.stage === 'group' ? `الجولة ${m.round}` : koRoundLabel(m, ko);

  return (
    <div className="space-y-6">
      <section className="board overflow-hidden">
        <div className="flex flex-col items-center gap-4 p-6 text-center sm:flex-row sm:text-start">
          <TeamMarble teams={t.teams} id={team.id} size={96} />
          <div className="flex-1">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              {team.group && <span className="chip bg-primary text-on-primary">{groupLabel(team.group)}</span>}
              {row && <span className="chip bg-ink/10">المركز {row.rank}</span>}
              <QualBadge status={qual} />
              {champ && <span className="chip bg-accent text-on-accent">🏆 البطل</span>}
            </div>
            <h1 className="mt-1 text-5xl">{team.name}</h1>
            <p className="text-lg text-ink/75">
              👤 {team.player1 || '—'} · 👤 {team.player2 || '—'}
            </p>
          </div>
          {row && (
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ['النقاط', row.points],
                ['فوز', row.won],
                ['خسارة', row.lost],
                ['نقاط الفرق', row.marblePoints > 0 ? `+${row.marblePoints}` : row.marblePoints],
                ['كرات لصالحه', marblesFor],
                ['كرات عليه', marblesAgainst],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-ink/5 px-3 py-2">
                  <div className="font-display text-3xl" dir="ltr">
                    {v}
                  </div>
                  <div className="text-xs text-ink/60">{k}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <HoleRow />
        <div className="flex flex-wrap items-center gap-3 p-4 text-sm">
          <span>آخر النتائج:</span>
          <FormStrip form={results.map((m) => (m.winnerId === team.id ? 'W' : 'L'))} max={10} />
          <span className="text-ink/60">· العودة بعد الخسارة: {countComebacks(team.id, t.matches)}</span>
        </div>
      </section>

      {path.length > 0 && (
        <section>
          <SectionTitle rank="A" title="المسار في الأدوار الإقصائية" />
          <div className="flex flex-wrap items-center gap-2">
            {path.map((m, i) => {
              const won = isFinished(m) && m.winnerId === team.id;
              const lost = isFinished(m) && m.winnerId !== team.id;
              return (
                <div key={m.id} className="flex items-center gap-2">
                  {i > 0 && <span className="text-ink/40">←</span>}
                  <div className={`rounded-xl border-2 p-3 ${won ? 'border-win' : lost ? 'border-loss' : 'border-ink/15'}`}>
                    <div className="text-xs text-ink/60">{koRoundLabel(m, ko)}</div>
                    <div className="font-bold">ضد {teamName(t, m.teamA === team.id ? m.teamB : m.teamA)}</div>
                    <div className="text-sm">{won ? '✓ فوز' : lost ? '✗ خسارة' : 'لم تُلعب'}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <SectionTitle rank="7" title="النتائج" />
        {results.length ? (
          <div className="board divide-y divide-ink/10">
            {results.map((m) => {
              const won = m.winnerId === team.id;
              const opp = m.teamA === team.id ? m.teamB : m.teamA;
              return (
                <div key={m.id} className="flex flex-wrap items-center gap-3 p-3">
                  <span className={`chip ${won ? 'bg-win' : 'bg-loss'} text-white`}>{won ? 'فوز' : 'خسارة'}</span>
                  <span className="text-xs text-ink/60">{label(m)}</span>
                  <TeamMarble teams={t.teams} id={opp} size={22} />
                  <Link to={`/admin/team/${opp}`} className="flex-1 font-bold hover:underline">
                    {teamName(t, opp)}
                  </Link>
                  <MarblesLeft n={m.loserMarbles ?? 0} max={t.settings.maxMarbles} size={10} />
                  <span dir="ltr" className={`w-10 text-end font-bold ${won ? 'text-win' : 'text-loss'}`}>
                    {won ? '+' : '-'}
                    {m.loserMarbles}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty>لم يلعب الفريق أي مباراة بعد</Empty>
        )}
      </section>

      {upcoming.length > 0 && (
        <section>
          <SectionTitle rank="5" title="المباريات القادمة" />
          <div className="board divide-y divide-ink/10">
            {upcoming.map((m) => (
              <div key={m.id} className="flex items-center gap-3 p-3">
                <span className="text-xs text-ink/60">{label(m)}</span>
                {m.table != null && <span className="chip bg-accent text-on-accent">طاولة {m.table}</span>}
                <span className="font-bold">ضد {teamName(t, m.teamA === team.id ? m.teamB : m.teamA)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
