import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Match } from '../lib/types';
import { useStore } from '../store/useStore';
import { confirmDialog, toast } from '../store/ui';
import { allStandings, generateKnockout, teamName } from '../lib/tournament';
import { crossSeedPairs, koMatches, roundName } from '../lib/knockout';
import { isFinished } from '../lib/standings';
import { Bracket } from '../components/Bracket';
import { ResultModal } from '../components/ResultModal';
import { Empty, SectionTitle, TeamMarble } from '../components/ui';

export default function KnockoutPage() {
  const t = useStore((s) => s.t);
  const apply = useStore((s) => s.apply);
  const [open, setOpen] = useState<Match | null>(null);
  const ko = koMatches(t.matches);
  const q = t.settings.qualifiersPerGroup;
  const st = allStandings(t);
  const pairs = crossSeedPairs(q);
  const g = (x: 'A' | 'B') => (x === 'A' ? 'أ' : 'ب');

  const generate = async () => {
    if (ko.some(isFinished)) {
      const ok = await confirmDialog({
        title: 'إعادة توليد الشجرة؟',
        message: 'سيتم حذف كل نتائج الأدوار الإقصائية.',
        confirmText: 'إعادة التوليد',
        danger: true,
      });
      if (!ok) return;
    }
    apply(generateKnockout, 'توليد الشجرة');
    toast('تم توليد شجرة الأدوار الإقصائية');
  };

  return (
    <div>
      <SectionTitle
        rank="A"
        title="الأدوار الإقصائية"
        sub={`${q} من كل مجموعة · ${roundName(q)} أولاً${t.settings.thirdPlaceMatch ? ' · مع مباراة المركز الثالث' : ''}`}
        actions={
          t.groupsLocked ? (
            <button className="btn btn-primary" onClick={generate}>
              {ko.length ? '↻ إعادة توليد الشجرة' : '⚙ توليد الشجرة'}
            </button>
          ) : undefined
        }
      />

      {!t.groupsLocked && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl bg-accent/20 p-3">
          <span className="flex-1">
            يجب اعتماد نتائج المجموعات أولاً («اعتماد نتائج المجموعات») قبل توليد الشجرة.
          </span>
          <Link className="btn btn-sm btn-primary" to="/standings">
            صفحة الترتيب
          </Link>
        </div>
      )}

      {ko.length > 0 ? (
        <div className="board p-4">
          <Bracket t={t} onOpen={setOpen} />
        </div>
      ) : (
        <section className="board p-4">
          <h3 className="mb-1 text-2xl">المواجهات المتوقعة ({roundName(q)})</h3>
          <p className="mb-4 text-sm text-ink/65">
            حسب الترتيب الحالي — نظام التوزيع المتقاطع يضمن ألا يلتقي متصدرا المجموعتين إلا في النهائي.
          </p>
          {st.A.length < q || st.B.length < q ? (
            <Empty>عدد الفرق في كل مجموعة يجب أن يكون {q} على الأقل.</Empty>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {pairs.map(([a, b], i) => {
                const ta = st[a.group][a.pos - 1]?.teamId ?? null;
                const tb = st[b.group][b.pos - 1]?.teamId ?? null;
                return (
                  <div key={i} className="flex items-center gap-2 rounded-xl bg-ink/5 p-3">
                    <span className="chip bg-primary text-on-primary">
                      {g(a.group)}
                      {a.pos}
                    </span>
                    <TeamMarble teams={t.teams} id={ta} size={24} />
                    <span className="flex-1 truncate font-bold">{teamName(t, ta)}</span>
                    <span className="font-display text-ink/50">×</span>
                    <span className="flex-1 truncate text-end font-bold">{teamName(t, tb)}</span>
                    <TeamMarble teams={t.teams} id={tb} size={24} />
                    <span className="chip bg-primary text-on-primary">
                      {g(b.group)}
                      {b.pos}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
      <ResultModal match={open} onClose={() => setOpen(null)} />
    </div>
  );
}
