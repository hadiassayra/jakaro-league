import { useEffect, useState } from 'react';
import { assignedDate, assertAvailable, planByAvailability, slotOf, type AvailabilityPlan } from '../lib/availability';
import { teamName, withLog } from '../lib/tournament';
import { useStore } from '../store/useStore';
import { toast } from '../store/ui';

export function AvailabilityScheduler({ day }: { day: string }) {
  const t = useStore(s => s.t);
  const apply = useStore(s => s.apply);
  const [first, setFirst] = useState('16:00');
  const [second, setSecond] = useState('18:00');
  const [horizon, setHorizon] = useState(120);
  const [preview, setPreview] = useState<{ plan: AvailabilityPlan; version: number } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { setPreview(null); }, [day, first, second, horizon, t.updatedAt]);
  const conflicts = t.matches.filter(m => m.stage === 'group' && m.status === 'upcoming' && assignedDate(m)).filter(m => {
    try { assertAvailable(t.teams, m, assignedDate(m)!); return false; } catch { return true; }
  });
  const plannedIds = new Set(t.matches.filter(m => !assignedDate(m)).map(m => m.id));
  const proposed = preview?.plan.matches.filter(m => plannedIds.has(m.id) && assignedDate(m)).sort((a, b) => assignedDate(a)!.localeCompare(assignedDate(b)!) || slotOf(a) - slotOf(b) || (a.table ?? 0) - (b.table ?? 0)) ?? [];
  const reasons = { missingDays: 'أيام غير محددة للفريقين أو أحدهما', noCommonDays: 'لا يوجد يوم مشترك — يلزم الاتفاق على يوم إضافي', horizon: 'لم يتوفر مكان ضمن المدة والطاولات المحددة' };
  return <details className="board mb-5 p-4">
    <summary className="cursor-pointer font-bold">📅 اقتراح مواعيد حسب أيام الفرق</summary>
    <p className="mt-3 text-sm text-ink/65">يبدأ من {day}، ويختار مواجهات متوافقة في جولتين يومياً. يحافظ على المباريات التي بدأت ونتائجها والمواعيد المحددة سابقاً. كل فريق مباراة واحدة كحد أقصى بالجولة؛ توفر مباراتين في اليوم يعتمد على الخصوم والأيام والطاولات.</p>
    <div className="my-4 grid gap-3 sm:grid-cols-3">
      <label className="text-sm">بداية الجولة الأولى<input type="time" className="input mt-1" value={first} onChange={e => setFirst(e.target.value)} /></label>
      <label className="text-sm">بداية الجولة الثانية<input type="time" className="input mt-1" value={second} onChange={e => setSecond(e.target.value)} /></label>
      <label className="text-sm">مدة البحث<select className="input mt-1" value={horizon} onChange={e => setHorizon(Number(e.target.value))}>{[30, 60, 120, 180].map(n => <option key={n} value={n}>{n} يوم</option>)}</select></label>
    </div>
    <p className="mb-3 text-xs text-ink/60">توقيت فلسطين · {t.settings.tablesCount || 'بدون حد'} طاولات · لا تُحجز الطاولة لأكثر من مباراة في الجولة نفسها.</p>
    <button className="btn btn-primary" disabled={t.groupsLocked || !t.matches.some(m => m.stage === 'group')} onClick={() => {
      setError('');
      try {
        if (!first || !second || first >= second) throw new Error('اختر وقتين صحيحين، والجولة الثانية بعد الأولى.');
        setPreview({ plan: planByAvailability(t, day, { horizon, times: { 1: first, 2: second } }), version: t.updatedAt });
      } catch (e) { setError((e as Error).message); }
    }}>معاينة المواعيد المقترحة</button>
    {error && <p role="alert" className="mt-3 text-sm text-loss">{error}</p>}
    {conflicts.length > 0 && <p className="mt-3 text-sm text-loss">يوجد {conflicts.length} موعد سابق لا يوافق أيام الفرق الحالية. لم يُنقل تلقائياً؛ راجعه من تعديل الموعد.</p>}
    {preview && <div className="mt-4 space-y-3 border-t border-ink/10 pt-4">
      <p className="font-bold">{preview.plan.added} مباراة مقترحة في {preview.plan.days} يوم لعب · {preview.plan.unscheduled.length} مباراة متبقية بدون موعد</p>
      <details><summary className="cursor-pointer text-sm text-primary-ink">مراجعة المباريات والتواريخ</summary><ul className="mt-2 max-h-72 space-y-1 overflow-auto text-sm">{proposed.map(m => <li key={m.id}>{assignedDate(m)} · الجولة {slotOf(m)} · {teamName(t, m.teamA)} × {teamName(t, m.teamB)}{m.table ? ` · طاولة ${m.table}` : ''}</li>)}</ul></details>
      {preview.plan.unscheduled.length > 0 && <details><summary className="cursor-pointer text-sm font-bold text-loss">المواجهات التي تحتاج مراجعة</summary><ul className="mt-2 max-h-64 space-y-2 overflow-auto text-sm">{preview.plan.unscheduled.map(item => {
        const m = t.matches.find(match => match.id === item.matchId)!;
        return <li key={item.matchId}>{teamName(t, m.teamA)} × {teamName(t, m.teamB)}: {reasons[item.reason]}</li>;
      })}</ul></details>}
      <button className="btn btn-accent" disabled={!preview.plan.added || t.groupsLocked} onClick={() => {
        if (apply(current => {
          if (current.updatedAt !== preview.version || current.groupsLocked) throw new Error('تغيّرت بيانات البطولة. أعد معاينة المواعيد قبل الاعتماد.');
          const nextDay = proposed.map(m => assignedDate(m)!).sort()[0] ?? day;
          return withLog({ ...current, matches: preview.plan.matches, currentPlayDay: nextDay }, `جدولة ${preview.plan.added} مباراة حسب الأيام المشتركة في ${preview.plan.days} يوم لعب`);
        }, 'اعتماد مواعيد الأيام المشتركة')) { setPreview(null); toast('تم اعتماد المواعيد المتوافقة'); }
      }}>اعتماد المواعيد المقترحة</button>
    </div>}
  </details>;
}
