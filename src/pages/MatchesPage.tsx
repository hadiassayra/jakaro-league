import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { GroupId, Match } from '../lib/types';
import { useStore } from '../store/useStore';
import { confirmDialog, toast } from '../store/ui';
import { isFinished } from '../lib/standings';
import { generateSchedule, hasGroupResults, withLog } from '../lib/tournament';
import { MatchCard } from '../components/MatchCard';
import { ResultModal } from '../components/ResultModal';
import { Empty, Modal, SectionTitle } from '../components/ui';
import { scheduleOutdated } from './TeamsPage';
import { assignPlayDay, dayCounts, matchDay, matchDayRound } from '../lib/playDay';
import { palestineDateTime, parseMatchTime } from '../lib/matchTime';
import { teamName } from '../lib/tournament';

type StatusFilter = 'all' | 'upcoming' | 'playing' | 'finished';

export default function MatchesPage() {
  const t = useStore((s) => s.t);
  const apply = useStore((s) => s.apply);
  const [schedule, setSchedule] = useState<Match | null>(null);
  const [open, setOpen] = useState<Match | null>(null);
  const [group, setGroup] = useState<GroupId | 'all'>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [dayOnly, setDayOnly] = useState(true);
  const [dayRound, setDayRound] = useState<1 | 2>(1);
  const day = t.currentPlayDay ?? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Hebron' }).format(new Date());
  const counts = dayCounts(t, day);
  const assign = (ids: string[], target: string | null) => apply(x => assignPlayDay(x, ids, target, dayRound), 'تعديل مباريات يوم اللعب');

  const gm = t.matches.filter((m) => m.stage === 'group');
  const ungrouped = t.teams.filter((x) => !x.group).length;
  const outdated = scheduleOutdated(t);

  const regenerate = async () => {
    if (gm.length) {
      const results = hasGroupResults(t);
      const ok = await confirmDialog({
        title: 'إعادة توليد الجدول؟',
        message: results ? 'سيتم حذف كل نتائج المجموعات المسجلة!' : 'سيتم استبدال الجدول الحالي.',
        confirmText: 'توليد',
        danger: results,
      });
      if (!ok) return;
    }
    apply((x) => generateSchedule({ ...x, matches: x.matches.filter((m) => m.stage !== 'group') }), 'توليد الجدول');
    toast('تم توليد الجدول');
  };

  const reassignTables = () => {
    const n = t.settings.tablesCount;
    apply((x) => {
      const byRound = new Map<number, number>();
      const matches = x.matches.map((m) => {
        if (m.stage !== 'group') return m;
        const i = byRound.get(m.round) ?? 0;
        byRound.set(m.round, i + 1);
        return { ...m, table: n > 0 ? (i % n) + 1 : null };
      });
      return withLog({ ...x, matches }, `إعادة توزيع الطاولات (${n})`);
    }, 'توزيع الطاولات');
  };

  const filterStatus = (m: Match) =>
    status === 'all' ||
    (status === 'finished' ? isFinished(m) : status === 'playing' ? m.status === 'playing' && !isFinished(m) : m.status === 'upcoming');
  const filtered = gm.filter((m) => (group === 'all' || m.group === group) && filterStatus(m) && (!dayOnly || matchDay(m) === day)).sort((a, b) => (a.scheduledAt ?? Infinity) - (b.scheduledAt ?? Infinity) || a.round - b.round);
  const rounds = dayOnly ? [1, 2] : [...new Set(filtered.map((m) => m.round))].sort((a, b) => a - b);
  const ko = group === 'all' && !dayOnly ? t.matches.filter((m) => m.stage === 'knockout' && m.teamA && m.teamB && filterStatus(m)) : [];

  const pill = (active: boolean) =>
    `rounded-full px-3 py-1 text-sm font-bold transition ${active ? 'bg-primary text-on-primary' : 'bg-ink/8 hover:bg-ink/15'}`;

  return (
    <div>
      <SectionTitle
        rank="7"
        title="المباريات"
        sub={gm.length ? `${gm.filter(isFinished).length}/${gm.length} مباراة مجموعات منتهية` : undefined}
        actions={
          <details className="relative">
            <summary className="btn btn-ghost cursor-pointer">إدارة الجدول</summary>
            <div className="absolute end-0 z-20 mt-2 flex w-64 flex-col gap-2 rounded-xl border border-ink/15 bg-surface p-3 shadow-xl">
            <button className="btn btn-primary" onClick={regenerate} disabled={ungrouped > 0 || t.teams.length < 2 || t.groupsLocked}>
              {gm.length ? '↻ إعادة توليد الجدول' : '⚙ توليد الجدول'}
            </button>
            {gm.length > 0 && (
              <button className="btn btn-ghost" onClick={reassignTables} disabled={t.groupsLocked}>
                🪑 توزيع الطاولات ({t.settings.tablesCount || 'بدون'})
              </button>
            )}
            </div>
          </details>
        }
      />
      <section className="board mb-5 space-y-4 p-4">
        <h2 className="text-2xl">جدول يوم اللعب</h2>
        <p className="text-sm text-ink/70">جولتان باليوم، ومباراة واحدة لكل فريق في كل جولة.</p>
        <div className="flex flex-wrap items-center gap-3">
          <label>تاريخ يوم اللعب<input type="date" className="input mt-1" value={day} onChange={e => {
            if (e.target.value) apply(x => ({ ...x, currentPlayDay: e.target.value }), 'تغيير يوم اللعب الحالي');
          }} /></label>
          <button className={`btn ${dayOnly ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={dayOnly} onClick={() => setDayOnly(!dayOnly)}>{dayOnly ? 'عرض كل المباريات' : 'عرض مباريات هذا اليوم فقط'}</button>
          <span className="chip bg-primary/15">{gm.filter(m => matchDay(m) === day).length} مباراة في اليوم</span>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="اختيار جولة اليوم">
          {([1, 2] as const).map(slot => <button key={slot} className={`btn ${dayRound === slot ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={dayRound === slot} onClick={() => setDayRound(slot)}>{slot === 1 ? 'الجولة الأولى' : 'الجولة الثانية'} — {gm.filter(m => matchDay(m) === day && matchDayRound(m) === slot).length} مباراة</button>)}
        </div>
        <details>
          <summary className="cursor-pointer text-sm text-ink/70">عدد مباريات كل فريق</summary>
        <div className="mt-3 flex flex-wrap gap-2">
          {t.teams.filter(team => team.group && (group === 'all' || team.group === group)).map(team => {
            const n = counts.get(team.id) ?? 0;
            return <span key={team.id} className={`chip ${n > 2 ? 'bg-loss text-white' : n === 2 ? 'bg-win text-white' : 'bg-ink/10'}`}>{team.name}: {n}/2</span>;
          })}
        </div>
        </details>
      </section>
      <div className="mb-5 flex flex-wrap gap-2" aria-label="أقسام المباريات">
        {([['all', 'المباريات ومواعيدها'], ['upcoming', 'المباريات الجاية'], ['playing', 'تُلعب الآن'], ['finished', 'المباريات اللي انلعبت']] as const).map(([key, label]) => (
          <button key={key} className={`btn ${status === key ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={status === key} onClick={() => setStatus(key)}>{label}</button>
        ))}
      </div>
      {ungrouped > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-accent/20 p-3">
          <span className="flex-1">يوجد {ungrouped} فريق بدون مجموعة. أجرِ القرعة أولاً.</span>
          <Link className="btn btn-sm btn-primary" to="/admin/draw">القرعة</Link>
        </div>
      )}
      {outdated && (
        <div className="mb-4 rounded-xl bg-loss/15 p-3">الجدول لا يطابق الفرق/المجموعات الحالية. أعد توليد الجدول.</div>
      )}
      {t.groupsLocked && (
        <div className="mb-4 rounded-xl bg-primary/15 p-3">🔒 نتائج المجموعات معتمدة ومقفلة.</div>
      )}

      {gm.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {(['all', 'A', 'B'] as const).map((g) => (
            <button key={g} className={pill(group === g)} onClick={() => setGroup(g)}>
              {g === 'all' ? 'كل المجموعات' : g === 'A' ? 'المجموعة أ' : 'المجموعة ب'}
            </button>
          ))}
        </div>
      )}

      {!gm.length && <Empty>لم يتم توليد الجدول بعد. وزّع الفرق على المجموعتين ثم اضغط «توليد الجدول».</Empty>}

      <div className="space-y-6">
        {t.matches.length > 0 && filtered.length === 0 && ko.length === 0 && <Empty>لا توجد مباريات في هذا القسم.</Empty>}
        {ko.length > 0 && (
          <section>
            <h3 className="mb-2 text-2xl">
              الأدوار الإقصائية <Link to="/admin/knockout" className="text-sm underline">(الشجرة)</Link>
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ko.map((m) => (
                <div key={m.id} className="space-y-2">
                  <MatchCard t={t} m={m} onOpen={setOpen} showRound />
                  <button className="btn btn-ghost btn-sm w-full" disabled={isFinished(m) || m.status === 'playing' || (m.stage === 'group' && t.groupsLocked)} onClick={() => setSchedule(m)}>{matchDay(m) ? 'تعديل الموعد والجولة' : 'تحديد الموعد والجولة'}</button>
                </div>
              ))}
            </div>
          </section>
        )}
        {rounds.map((r) => {
          const list = filtered.filter((m) => (dayOnly ? matchDayRound(m) : m.round) === r).sort((a, b) => (a.table ?? 99) - (b.table ?? 99));
          const doneCount = dayOnly ? list.filter(isFinished).length : gm.filter((m) => m.round === r && isFinished(m)).length;
          const total = dayOnly ? list.length : gm.filter((m) => m.round === r).length;
          return (
            <section key={r}>
              <div className="mb-2 flex flex-wrap items-center gap-3">
                <h3 className="text-2xl">{dayOnly ? r === 1 ? 'الجولة الأولى من اليوم' : 'الجولة الثانية من اليوم' : `جولة الجدول ${r}`}</h3>
                {!dayOnly && <button className="btn btn-ghost btn-sm" disabled={t.groupsLocked} onClick={() => assign(gm.filter(m => m.round === r && (group === 'all' || m.group === group) && !isFinished(m) && m.status !== 'playing').map(m => m.id), day)}>إضافة إلى الجولة {dayRound} من اليوم</button>}
                <span className="chip bg-ink/10">
                  {doneCount}/{total}
                </span>
                <div className="h-px flex-1 bg-ink/10" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((m) => (
                  <div key={m.id} className="space-y-2">
                    <MatchCard t={t} m={m} onOpen={setOpen} showRound />
                    <button className="btn btn-ghost btn-sm w-full" disabled={isFinished(m) || m.status === 'playing' || (m.stage === 'group' && t.groupsLocked)} onClick={() => setSchedule(m)}>{matchDay(m) ? 'تعديل الموعد والجولة' : 'تحديد الموعد والجولة'}</button>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      {schedule && <ScheduleModal key={schedule.id} match={schedule} day={day} round={dayRound} onClose={() => setSchedule(null)} />}
      <ResultModal match={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function ScheduleModal({ match, day, round, onClose }: { match: Match; day: string; round: 1 | 2; onClose: () => void }) {
  const t = useStore(s => s.t);
  const apply = useStore(s => s.apply);
  const [date, setDate] = useState(matchDay(match) ?? day);
  const [time, setTime] = useState(match.scheduledAt ? palestineDateTime(match.scheduledAt).slice(11) : '');
  const [slot, setSlot] = useState<1 | 2>(matchDay(match) ? matchDayRound(match) : round);
  const [error, setError] = useState('');
  const locked = (match.stage === 'group' && t.groupsLocked) || isFinished(match) || match.status === 'playing';

  const save = () => {
    setError('');
    try {
      if (!date) throw new Error('اختر يوم المباراة.');
      const scheduledAt = time ? parseMatchTime(date, time) : null;
      const ok = apply(current => {
        const currentMatch = current.matches.find(m => m.id === match.id);
        if (!currentMatch || isFinished(currentMatch) || currentMatch.status === 'playing') throw new Error('لا يمكن تعديل موعد مباراة بدأت أو انتهت.');
        const next = match.stage === 'group' ? assignPlayDay(current, [match.id], date, slot) : current;
        return withLog({ ...next, matches: next.matches.map(m => m.id === match.id ? { ...m, playDay: date, scheduledAt, dayRound: m.stage === 'group' ? slot : null } : m) }, 'تعديل موعد مباراة');
      }, 'تعديل موعد مباراة');
      if (ok) { toast('تم حفظ موعد المباراة'); onClose(); }
    } catch (e) { setError((e as Error).message); }
  };

  const clear = () => {
    const ok = apply(current => {
      const next = match.stage === 'group' ? assignPlayDay(current, [match.id], null) : current;
      return withLog({ ...next, matches: next.matches.map(m => m.id === match.id ? { ...m, playDay: null, dayRound: null, scheduledAt: null } : m) }, 'إلغاء موعد مباراة');
    }, 'إلغاء موعد مباراة');
    if (ok) onClose();
  };

  return <Modal open onClose={onClose} title="موعد المباراة">
    <p className="mb-5 font-bold">{teamName(t, match.teamA)} × {teamName(t, match.teamB)}</p>
    <form className="space-y-5" onSubmit={e => { e.preventDefault(); save(); }}>
      <label className="block text-sm font-bold">يوم المباراة
        <input type="date" className="input mt-2" required value={date} onChange={e => setDate(e.target.value)} disabled={locked} />
      </label>
      {match.stage === 'group' && <fieldset>
        <legend className="mb-2 text-sm font-bold">الجولة في هذا اليوم</legend>
        <div className="grid grid-cols-2 gap-2">{([1, 2] as const).map(n => <button key={n} type="button" disabled={locked} aria-pressed={slot === n} className={`btn ${slot === n ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setSlot(n)}>{n === 1 ? 'الجولة الأولى' : 'الجولة الثانية'}</button>)}</div>
      </fieldset>}
      <label className="block text-sm font-bold">ساعة البداية <span className="font-normal text-ink/50">(اختياري)</span>
        <input type="time" className="input mt-2" dir="ltr" value={time} onChange={e => setTime(e.target.value)} disabled={locked} />
      </label>
      <div className="flex flex-wrap gap-2">{['16:00', '17:00', '18:00', '19:00', '20:00'].map(value => <button key={value} type="button" disabled={locked} aria-pressed={time === value} className={`btn btn-sm ${time === value ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTime(value)}>{Number(value.slice(0, 2)) - 12}:00 م</button>)}</div>
      <p className="text-xs text-ink/60">جميع المواعيد بتوقيت فلسطين. يمكنك حفظ اليوم والجولة وتحديد الساعة لاحقاً.</p>
      {error && <p role="alert" className="text-sm text-loss">{error}</p>}
      <div className="flex flex-wrap gap-2 border-t border-ink/10 pt-4">
        <button className="btn btn-primary flex-1" disabled={locked}>حفظ الموعد</button>
        <button type="button" className="btn btn-ghost" onClick={onClose}>إلغاء</button>
        {matchDay(match) && <button type="button" className="btn btn-ghost text-loss" disabled={locked} onClick={clear}>إزالة الموعد</button>}
      </div>
    </form>
  </Modal>;
}
