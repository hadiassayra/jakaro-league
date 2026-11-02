import { useState } from 'react';
import { useStore } from '../store/useStore';
import { toast } from '../store/ui';
import { saveManualMatch } from '../lib/manualMatches';
import { daysLabel } from '../lib/availability';
import { Modal } from './ui';

export function ManualMatchModal({ day, round, onClose, initialTeamA = '', initialTeamB = '' }: { day: string; round: 1 | 2; onClose: () => void; initialTeamA?: string; initialTeamB?: string }) {
  const t = useStore(s => s.t);
  const apply = useStore(s => s.apply);
  const [teamA, setA] = useState(initialTeamA), [teamB, setB] = useState(initialTeamB);
  const [date, setDate] = useState(day), [time, setTime] = useState('16:00');
  const [slot, setSlot] = useState<1 | 2>(round), [table, setTable] = useState<number | null>(null);
  const [error, setError] = useState('');
  const a = t.teams.find(x => x.id === teamA), b = t.teams.find(x => x.id === teamB);
  const existing = t.matches.find(m => m.stage === 'group' && ((m.teamA === teamA && m.teamB === teamB) || (m.teamA === teamB && m.teamB === teamA)));
  return <Modal open onClose={onClose} title="إنشاء مباراة واختيار موعدها"><form className="space-y-4" onSubmit={e => {
    e.preventDefault(); setError('');
    try {
      // Validate against the latest state; apply repeats the check before saving.
      saveManualMatch(useStore.getState().t, { teamA, teamB, day: date, time, dayRound: slot, table });
      if (apply(x => saveManualMatch(x, { teamA, teamB, day: date, time, dayRound: slot, table }), 'إضافة أو جدولة مباراة يدوياً')) { toast('تم حفظ المباراة وموعدها'); onClose(); }
    } catch (e) { setError((e as Error).message); }
  }}>
    <p className="text-sm text-ink/60">اختر فريقين من المجموعة نفسها. إذا كانت المواجهة موجودة، يُعدّل موعدها دون تكرارها.</p>
    <label className="block text-sm font-bold">الفريق الأول<select className="input mt-1" required value={teamA} onChange={e => { setA(e.target.value); setB(''); }}><option value="">اختر الفريق</option>{t.teams.filter(x => x.group).map(x => <option key={x.id} value={x.id}>{x.name} — المجموعة {x.group === 'A' ? 'أ' : 'ب'}</option>)}</select></label>
    <label className="block text-sm font-bold">الفريق الثاني<select className="input mt-1" required value={teamB} disabled={!a} onChange={e => setB(e.target.value)}><option value="">اختر الفريق</option>{t.teams.filter(x => x.id !== teamA && x.group && x.group === a?.group).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
    {(a || b) && <p className="text-xs text-ink/60">{[a, b].filter(Boolean).map(x => `${x!.name}: ${daysLabel(x!.availableDays)}`).join(' · ')}</p>}
    {existing && <p role="status" className="rounded-xl bg-accent/15 p-3 text-sm">{existing.status === 'upcoming' ? 'المواجهة موجودة في الجدول؛ سيتم حفظ الموعد على نفس المباراة.' : 'هذه المواجهة بدأت أو انتهت، ولا يمكن إنشاء نسخة مكررة منها.'}</p>}
    <div className="grid grid-cols-2 gap-3"><label className="text-sm font-bold">اليوم<input className="input mt-1" type="date" required value={date} onChange={e => setDate(e.target.value)} /></label><label className="text-sm font-bold">الساعة بتوقيت فلسطين<input className="input mt-1" type="time" dir="ltr" required value={time} onChange={e => setTime(e.target.value)} /></label></div>
    <label className="block text-sm font-bold">الجولة<select className="input mt-1" value={slot} onChange={e => setSlot(Number(e.target.value) as 1 | 2)}><option value={1}>الجولة الأولى من اليوم</option><option value={2}>الجولة الثانية من اليوم</option></select></label>
    <label className="block text-sm font-bold">الطاولة<select className="input mt-1" value={table ?? ''} onChange={e => setTable(e.target.value ? Number(e.target.value) : null)}><option value="">بدون تحديد</option>{Array.from({ length: t.settings.tablesCount }, (_, i) => <option key={i + 1} value={i + 1}>طاولة {i + 1}</option>)}</select></label>
    <p className="text-xs text-ink/60">مباراة واحدة لكل فريق بالجولة، وبحد أقصى مباراتين باليوم، حسب أيام توفر الفريقين.</p>
    {error && <p role="alert" className="text-sm text-loss">{error}</p>}
    <div className="flex gap-2"><button className="btn btn-primary" disabled={t.groupsLocked || (!!existing && existing.status !== 'upcoming')}>{existing ? 'حفظ موعد المواجهة' : 'إنشاء المباراة'}</button><button type="button" className="btn btn-ghost" onClick={onClose}>إلغاء</button></div>
  </form></Modal>;
}
