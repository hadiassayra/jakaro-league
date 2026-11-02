import { useState } from 'react';
import { useStore } from '../store/useStore';
import { toast } from '../store/ui';
import { matchDay } from '../lib/playDay';
import { withLog } from '../lib/tournament';

export function PublicDaysControl() {
  const t = useStore(s => s.t);
  const apply = useStore(s => s.apply);
  const [editing, setEditing] = useState(false);
  const [all, setAll] = useState(true);
  const [days, setDays] = useState<string[]>([]);
  const [date, setDate] = useState('');
  const available = [...new Set([...t.matches.map(matchDay).filter((x): x is string => !!x), ...days])].sort();
  const start = () => { setAll(t.settings.publicMatchDays == null); setDays(t.settings.publicMatchDays ?? []); setEditing(true); };
  return <section className="board mb-5 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl">الأيام الظاهرة للجمهور</h2><p className="mt-1 text-sm text-ink/60">{t.settings.publicMatchDays == null ? 'كل الأيام والمباريات ظاهرة حالياً.' : t.settings.publicMatchDays.length ? `ظاهر ${t.settings.publicMatchDays.length} يوم فقط؛ المباريات دون موعد مخفية.` : 'قوائم المباريات مخفية حالياً.'}</p></div><button className="btn btn-ghost" onClick={start}>تحديد أيام العرض</button></div>
    {editing && <div className="mt-4 space-y-4 border-t border-ink/10 pt-4">
      <label className="flex items-center gap-2"><input type="checkbox" checked={all} onChange={e => setAll(e.target.checked)} />إظهار كل الأيام، بما فيها المباريات دون موعد</label>
      {!all && <>
        <p className="text-sm text-ink/70">اختر التواريخ التي تريد نشر مبارياتها. بدون اختيار أيام، لن تظهر مباريات للجمهور.</p>
        <div className="flex flex-wrap gap-2"><button className="btn btn-ghost btn-sm" onClick={() => setDays(available)}>اختيار كل التواريخ</button><button className="btn btn-ghost btn-sm" onClick={() => setDays([])}>إلغاء اختيار الكل</button></div>
        <div className="grid max-h-60 gap-2 overflow-y-auto sm:grid-cols-2">{available.map(day => <label key={day} className="flex items-center gap-3 rounded-xl bg-ink/5 p-3"><input type="checkbox" checked={days.includes(day)} onChange={e => setDays(prev => e.target.checked ? [...prev, day] : prev.filter(x => x !== day))} /><span>{new Date(day + 'T12:00:00Z').toLocaleDateString('ar-PS', { timeZone: 'Asia/Hebron', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span><span className="ms-auto text-xs text-ink/50">{t.matches.filter(m => matchDay(m) === day).length} مباراة</span></label>)}</div>
        <div className="flex flex-wrap items-end gap-2"><label className="text-sm">إضافة تاريخ<input type="date" className="input mt-1" value={date} onChange={e => setDate(e.target.value)} /></label><button className="btn btn-ghost" disabled={!date} onClick={() => { setDays(prev => [...new Set([...prev, date])].sort()); setDate(''); }}>إضافة اليوم</button></div>
      </>}
      <p className="text-xs text-ink/60">الاختيار يطبّق على قوائم المباريات والمواعيد والنتائج في رابط الجمهور ووضع العرض. النقاط والترتيب وشجرة الإقصائيات والإحصائيات تبقى شاملة للبطولة.</p>
      <div className="flex gap-2"><button className="btn btn-primary" onClick={() => {
        if (apply(x => withLog({ ...x, settings: { ...x.settings, publicMatchDays: all ? null : [...new Set(days)].sort() } }, 'تعديل أيام المباريات الظاهرة للجمهور'), 'تعديل أيام الجمهور')) { setEditing(false); toast('تم حفظ الأيام الظاهرة للجمهور'); }
      }}>حفظ أيام العرض</button><button className="btn btn-ghost" onClick={() => setEditing(false)}>إلغاء</button></div>
    </div>}
  </section>;
}
