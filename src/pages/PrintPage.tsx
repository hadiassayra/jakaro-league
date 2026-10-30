import { useState, type ReactNode } from 'react';
import type { Match, Tournament } from '../lib/types';
import { useStore } from '../store/useStore';
import { allStandings, teamName } from '../lib/tournament';
import { koMatches } from '../lib/knockout';
import { exportTournament, downloadJson } from '../lib/excel';
import { Bracket } from '../components/Bracket';
import { Logo } from '../components/Logo';
import { SectionTitle } from '../components/ui';

const PAPER_VARS = {
  '--bg': '#ffffff',
  '--surface': '#ffffff',
  '--text': '#111111',
  '--primary-ink': '#13208f',
  '--accent-ink': '#8a6d00',
  '--line': '#cccccc',
} as React.CSSProperties;

function Page({ t, title, children }: { t: Tournament; title: string; children: ReactNode }) {
  return (
    <div className="print-page mb-6 rounded-lg bg-white p-6 text-black shadow-lg print:mb-0 print:rounded-none print:p-0 print:shadow-none">
      <div className="mb-4 flex items-center gap-4 border-b-2 border-black/80 pb-3">
        <Logo src={t.settings.logo} variant="badge" className="h-14 w-auto" />
        <div className="flex-1">
          <div className="font-display text-3xl">{t.settings.name}</div>
          <div className="text-lg font-bold">{title}</div>
        </div>
        <div className="text-xs text-black/60">{new Date().toLocaleDateString('ar')}</div>
      </div>
      {children}
    </div>
  );
}

const th = 'border border-black/40 bg-black/5 p-1.5 text-center text-sm font-bold';
const td = 'border border-black/40 p-1.5 text-center text-sm';

function MarbleCircles({ max }: { max: number }) {
  return (
    <span className="inline-flex gap-1" dir="ltr">
      {Array.from({ length: max + 1 }, (_, i) => (
        <span key={i} className="inline-grid h-6 w-6 place-items-center rounded-full border border-black/60 text-xs">
          {i}
        </span>
      ))}
    </span>
  );
}

function ScoreSheet({ t, title, matches, blankRows = 0 }: { t: Tournament; title: string; matches: Match[]; blankRows?: number }) {
  return (
    <Page t={t} title={title}>
      <p className="mb-3 text-sm">ضع ✓ بجانب الفريق الفائز، ثم ضع دائرة على عدد كرات الفريق الخاسر المتبقية (التي لم يُدخلها).</p>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={th}>الجولة</th>
            <th className={th}>الفريق الأول</th>
            <th className={th}>✓</th>
            <th className={th}>الفريق الثاني</th>
            <th className={th}>✓</th>
            <th className={th}>كرات الخاسر المتبقية</th>
            <th className={th}>توقيع الحكم</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((m) => (
            <tr key={m.id} className="h-12">
              <td className={td}>{m.stage === 'group' ? `${m.round} (${m.group === 'A' ? 'أ' : 'ب'})` : '—'}</td>
              <td className={`${td} font-bold`}>{teamName(t, m.teamA)}</td>
              <td className={`${td} w-8`}></td>
              <td className={`${td} font-bold`}>{teamName(t, m.teamB)}</td>
              <td className={`${td} w-8`}></td>
              <td className={td}>
                <MarbleCircles max={t.settings.maxMarbles} />
              </td>
              <td className={`${td} w-24`}></td>
            </tr>
          ))}
          {Array.from({ length: blankRows }, (_, i) => (
            <tr key={`b${i}`} className="h-12">
              <td className={td}></td>
              <td className={td}></td>
              <td className={td}></td>
              <td className={td}></td>
              <td className={td}></td>
              <td className={td}>
                <MarbleCircles max={t.settings.maxMarbles} />
              </td>
              <td className={td}></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Page>
  );
}

export default function PrintPage() {
  const t = useStore((s) => s.t);
  const [opts, setOpts] = useState({ tables: true, schedule: true, bracket: true, sheets: false });
  const st = allStandings(t);
  const gm = t.matches.filter((m) => m.stage === 'group').sort((a, b) => a.round - b.round || (a.table ?? 0) - (b.table ?? 0));
  const ko = koMatches(t.matches);
  const tableNos = [...new Set(gm.map((m) => m.table).filter((x): x is number => x != null))].sort((a, b) => a - b);
  const rounds = [...new Set(gm.map((m) => m.round))];
  const toggle = (k: keyof typeof opts) => setOpts((o) => ({ ...o, [k]: !o[k] }));

  return (
    <div>
      <div className="no-print">
        <SectionTitle
          rank="Q"
          title="الطباعة والتصدير"
          sub="اختر ما تريد طباعته ثم «طباعة / PDF» (اختر «حفظ كـ PDF» من نافذة الطباعة)"
          actions={
            <>
              <button className="btn btn-primary" onClick={() => window.print()}>
                🖨️ طباعة / PDF
              </button>
              <button className="btn btn-accent" onClick={() => exportTournament(t)}>
                📊 تصدير Excel
              </button>
              <button className="btn btn-ghost" onClick={() => downloadJson(t)}>
                ⬇ JSON
              </button>
            </>
          }
        />
        <div className="mb-5 flex flex-wrap gap-4">
          {(
            [
              ['tables', 'جداول المجموعات'],
              ['schedule', 'جدول المباريات'],
              ['bracket', 'شجرة الإقصائيات'],
              ['sheets', 'أوراق تسجيل فارغة لكل طاولة'],
            ] as const
          ).map(([k, l]) => (
            <label key={k} className="flex items-center gap-2 font-bold">
              <input type="checkbox" className="h-4 w-4" checked={opts[k]} onChange={() => toggle(k)} /> {l}
            </label>
          ))}
        </div>
      </div>

      <div style={PAPER_VARS} className="mx-auto max-w-4xl text-black">
        {opts.tables &&
          (['A', 'B'] as const).map((g) => (
            <Page key={g} t={t} title={`ترتيب ${g === 'A' ? 'المجموعة أ' : 'المجموعة ب'}`}>
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {['#', 'الفريق', 'اللاعبان', 'لعب', 'فاز', 'خسر', 'النقاط', 'نقاط الفرق', 'آخر النتائج'].map((h) => (
                      <th key={h} className={th}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {st[g].map((r) => {
                    const tm = t.teams.find((x) => x.id === r.teamId);
                    return (
                      <tr key={r.teamId} className={r.rank <= t.settings.qualifiersPerGroup ? 'bg-black/5' : ''}>
                        <td className={`${td} font-bold`}>{r.rank}</td>
                        <td className={`${td} font-bold`}>{tm?.name}</td>
                        <td className={`${td} text-xs`}>
                          {tm?.player1} · {tm?.player2}
                        </td>
                        <td className={td}>{r.played}</td>
                        <td className={td}>{r.won}</td>
                        <td className={td}>{r.lost}</td>
                        <td className={`${td} font-bold`}>{r.points}</td>
                        <td className={td}>
                          <span dir="ltr" className="inline-block">
                            {r.marblePoints > 0 ? `+${r.marblePoints}` : r.marblePoints}
                          </span>
                        </td>
                        <td className={td}>{r.form.map((f) => (f === 'W' ? '✓' : '✗')).join(' ')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Page>
          ))}

        {opts.schedule && gm.length > 0 && (
          <Page t={t} title="جدول مباريات المجموعات">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['الجولة', 'المجموعة', 'الطاولة', 'الفريق الأول', 'الفريق الثاني', 'الفائز', 'كرات الخاسر'].map((h) => (
                    <th key={h} className={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gm.map((m) => (
                  <tr key={m.id}>
                    <td className={td}>{m.round}</td>
                    <td className={td}>{m.group === 'A' ? 'أ' : 'ب'}</td>
                    <td className={td}>{m.table ?? ''}</td>
                    <td className={td}>{teamName(t, m.teamA)}</td>
                    <td className={td}>{teamName(t, m.teamB)}</td>
                    <td className={`${td} font-bold`}>{m.winnerId ? teamName(t, m.winnerId) : ''}</td>
                    <td className={td}>{m.loserMarbles ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Page>
        )}

        {opts.bracket && ko.length > 0 && (
          <Page t={t} title="الأدوار الإقصائية">
            <div className="origin-top-right print:scale-[0.8]">
              <Bracket t={t} />
            </div>
          </Page>
        )}

        {opts.sheets &&
          (tableNos.length
            ? tableNos.map((no) => (
                <ScoreSheet key={no} t={t} title={`ورقة تسجيل — طاولة ${no}`} matches={gm.filter((m) => m.table === no)} />
              ))
            : rounds.map((r) => (
                <ScoreSheet key={r} t={t} title={`ورقة تسجيل — الجولة ${r}`} matches={gm.filter((m) => m.round === r)} />
              )))}
        {opts.sheets && <ScoreSheet t={t} title="ورقة تسجيل فارغة" matches={[]} blankRows={12} />}
      </div>
    </div>
  );
}
