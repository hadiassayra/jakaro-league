import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { GroupId } from '../lib/types';
import { useStore } from '../store/useStore';
import { confirmDialog, toast } from '../store/ui';
import { unresolvedTies } from '../lib/standings';
import { allStandings, canLockGroups, lockGroups, teamName, unlockGroups, withLog } from '../lib/tournament';
import { qualificationStatus } from '../lib/qualification';
import { shuffle } from '../lib/id';
import { playClick } from '../lib/sound';
import { StandingsTable, groupLabel } from '../components/StandingsTable';
import { Empty, SectionTitle, TeamMarble } from '../components/ui';

function TieResolver({ group, ids }: { group: GroupId; ids: string[] }) {
  const t = useStore((s) => s.t);
  const apply = useStore((s) => s.apply);
  const [order, setOrder] = useState(ids);
  const moveUp = (i: number) => {
    if (i === 0) return;
    const o = order.slice();
    [o[i - 1], o[i]] = [o[i], o[i - 1]];
    setOrder(o);
  };
  const save = (o = order) => {
    apply((x) => {
      const rest = x.tieOverrides[group].filter((id) => !o.includes(id));
      return withLog(
        { ...x, tieOverrides: { ...x.tieOverrides, [group]: [...o, ...rest] } },
        `قرار يدوي لكسر التعادل في ${groupLabel(group)}: ${o.map((id) => teamName(x, id)).join(' ثم ')}`,
      );
    }, 'كسر تعادل يدوي');
    toast('تم حفظ الترتيب اليدوي');
  };
  return (
    <div className="rounded-xl border-2 border-loss/50 bg-loss/10 p-3">
      <p className="mb-2 text-sm font-bold">
        ⚠ تعادل كامل (نقاط + نقاط الفرق + مواجهة مباشرة). رتّب الفرق يدوياً أو اسحب قرعة:
      </p>
      <ol className="mb-3 space-y-1">
        {order.map((id, i) => (
          <li key={id} className="flex items-center gap-2 rounded-lg bg-surface p-1.5">
            <span className="w-6 text-center font-display text-xl">{i + 1}</span>
            <TeamMarble teams={t.teams} id={id} size={24} />
            <span className="flex-1 font-bold">{teamName(t, id)}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => moveUp(i)} disabled={i === 0} aria-label="للأعلى">
              ▲
            </button>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <button
          className="btn btn-accent btn-sm"
          onClick={() => {
            const o = shuffle(order);
            setOrder(o);
            playClick();
          }}
        >
          🪙 قرعة عشوائية
        </button>
        <button className="btn btn-primary btn-sm" onClick={() => save()}>
          حفظ الترتيب
        </button>
      </div>
    </div>
  );
}

export default function StandingsPage() {
  const t = useStore((s) => s.t);
  const apply = useStore((s) => s.apply);
  const st = allStandings(t);
  const [group, setGroup] = useState<GroupId>('A');
  const lockError = canLockGroups(t);
  const hasSchedule = t.matches.some((m) => m.stage === 'group');
  const hasKo = t.matches.some((m) => m.stage === 'knockout');

  const unlock = async () => {
    const ok = await confirmDialog({
      title: 'إلغاء اعتماد نتائج المجموعات؟',
      message: hasKo
        ? 'سيتم حذف شجرة الأدوار الإقصائية وكل نتائجها، ويمكن بعدها تعديل نتائج المجموعات.'
        : 'سيصبح بالإمكان تعديل نتائج المجموعات مرة أخرى.',
      confirmText: 'إلغاء الاعتماد',
      danger: true,
    });
    if (ok) apply(unlockGroups, 'إلغاء اعتماد المجموعات');
  };

  const clearOverride = (g: GroupId) =>
    apply((x) => withLog({ ...x, tieOverrides: { ...x.tieOverrides, [g]: [] } }, `إلغاء القرارات اليدوية في ${groupLabel(g)}`));

  return (
    <div>
      <SectionTitle
        rank="K"
        title="ترتيب المجموعات"
        sub={`يتأهل أول ${t.settings.qualifiersPerGroup} من كل مجموعة`}
        actions={
          t.groupsLocked ? (
            <>
              <span className="chip bg-win px-3 py-1.5 text-sm text-white">🔒 النتائج معتمدة</span>
              <button className="btn btn-ghost" onClick={unlock}>
                إلغاء الاعتماد
              </button>
              <Link className="btn btn-accent" to="/knockout">
                الأدوار الإقصائية ←
              </Link>
            </>
          ) : (
            <button
              className="btn btn-primary"
              disabled={!!lockError}
              title={lockError ?? ''}
              onClick={() => {
                apply(lockGroups, 'اعتماد المجموعات');
                toast('تم اعتماد نتائج المجموعات');
              }}
            >
              ✓ اعتماد نتائج المجموعات
            </button>
          )
        }
      />
      {!t.groupsLocked && lockError && hasSchedule && (
        <p className="mb-4 text-sm text-ink/65">للاعتماد: {lockError}</p>
      )}
      <div className="mb-5 flex gap-2" aria-label="نقاط المجموعات">
        {(['A', 'B'] as const).map(g => (
          <button key={g} className={`btn ${group === g ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={group === g} onClick={() => setGroup(g)}>
            نقاط {groupLabel(g)}
          </button>
        ))}
      </div>
      {!hasSchedule && <Empty>لم تبدأ المباريات بعد. تظهر نقاط الفرق بعد توزيع المجموعات.</Empty>}

      {t.teams.some(team => team.group) && (
        <div className="grid gap-6">
          {([group]).map((g) => {
            const ties = unresolvedTies(st[g]);
            const qual = qualificationStatus(t.teams, t.matches, g, t.settings.qualifiersPerGroup, st[g]);
            return (
              <section key={g} className="board p-4">
                <SectionTitle
                  rank={g === 'A' ? 'A' : '10'}
                  title={groupLabel(g)}
                  actions={
                    t.tieOverrides[g].length > 0 && !t.groupsLocked ? (
                      <button className="btn btn-ghost btn-sm" onClick={() => clearOverride(g)}>
                        إلغاء القرارات اليدوية
                      </button>
                    ) : undefined
                  }
                />
                <StandingsTable t={t} rows={st[g]} qual={qual} />
                {!t.groupsLocked && ties.length > 0 && (
                  <div className="mt-4 space-y-3">
                    {ties.map((ids) => (
                      <TieResolver key={ids.join()} group={g} ids={ids} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      <section className="board mt-6 p-4 text-sm">
        <h3 className="mb-2 text-xl">طريقة الترتيب</h3>
        <ol className="list-inside list-decimal space-y-1 text-ink/80">
          <li>النقاط (الفوز = 1، الخسارة = 0).</li>
          <li>
            نقاط الفرق: مجموع كرات الخصوم المتبقية عندما يفوز الفريق، ناقص كرات الفريق المتبقية عندما يخسر.
          </li>
          <li>
            المواجهة المباشرة بين الفرق المتعادلة <span className="chip bg-m-blue/20">مواجهة</span>.
          </li>
          <li>
            قرار المنظم (قرعة/عملة) <span className="chip bg-accent text-on-accent">🪙 يدوي</span>.
          </li>
        </ol>
        <p className="mt-2 text-ink/60">
          <span className="chip bg-win text-white">✓ متأهل</span> = تأهل رياضياً مهما كانت النتائج القادمة.{' '}
          <span className="chip bg-ink/15">خارج</span> = لا يمكنه التأهل رياضياً.
        </p>
      </section>
    </div>
  );
}
