import { useMemo, useState } from 'react';
import type { Match } from '../lib/types';
import { matchDay, matchDayRound } from '../lib/playDay';
import { palestineDateTime } from '../lib/matchTime';
import { applyReplacement, replacementSuggestions } from '../lib/replacementMatches';
import { teamName } from '../lib/tournament';
import { useStore } from '../store/useStore';
import { toast } from '../store/ui';
import { Modal, TeamMarble } from './ui';

export function ReplacementMatchesModal({ cancelled, onClose }: { cancelled: Match; onClose: () => void }) {
  const t = useStore(s => s.t);
  const apply = useStore(s => s.apply);
  const [time, setTime] = useState(cancelled.scheduledAt ? palestineDateTime(cancelled.scheduledAt).slice(11) : '');
  const [error, setError] = useState('');
  const slot = useMemo(() => ({ day: matchDay(cancelled)!, time, dayRound: matchDayRound(cancelled), table: cancelled.table }), [cancelled, time]);
  const suggestions = useMemo(() => replacementSuggestions(t, cancelled, slot), [t, cancelled, slot]);
  return <Modal open onClose={onClose} title="مواجهات بديلة للموعد الشاغر" wide>
    <div className="mb-4 rounded-xl bg-accent/15 p-4"><p className="font-bold">{slot.day} · الجولة {slot.dayRound === 1 ? 'الأولى' : 'الثانية'}{time ? ` · ${time} بتوقيت فلسطين` : ''}{slot.table ? ` · طاولة ${slot.table}` : ''}</p><p className="mt-2 text-sm text-ink/65">تم إلغاء {teamName(t, cancelled.teamA)} × {teamName(t, cancelled.teamB)}. اختر مواجهة متبقية لاعتمادها في هذا الموعد.</p></div>
    {!cancelled.scheduledAt && <label className="mb-4 block text-sm font-bold">حدّد ساعة البداية لعرض البدائل<input type="time" className="input mt-2" dir="ltr" value={time} onChange={e => setTime(e.target.value)} /></label>}
    <p className="mb-3 text-sm text-ink/60">الاقتراحات تراعي أيام توفر الفريقين، مباراة واحدة في الجولة ومباراتين باليوم كحد أقصى. تُعرض مواجهات المجموعة نفسها أولاً، ولا تُنقل المباريات المحجوزة سابقاً.</p>
    {error && <p role="alert" className="mb-3 text-sm text-loss">{error}</p>}
    {time && <p className="mb-2 text-sm font-bold">{suggestions.length} مواجهة متاحة</p>}
    <div className="max-h-[50dvh] space-y-2 overflow-y-auto">{suggestions.map(s => <div key={`${s.teamA}-${s.teamB}`} className="flex flex-wrap items-center gap-3 rounded-xl border border-ink/10 p-3">
      <span className="chip bg-ink/10">{s.group === 'A' ? 'أ' : 'ب'}</span><div className="flex min-w-0 flex-1 flex-wrap items-center gap-2"><TeamMarble teams={t.teams} id={s.teamA} size={28} /><span className="font-bold">{teamName(t, s.teamA)}</span><span className="text-ink/40">×</span><TeamMarble teams={t.teams} id={s.teamB} size={28} /><span className="font-bold">{teamName(t, s.teamB)}</span></div>
      <button className="btn btn-primary btn-sm" onClick={() => {
        setError('');
        try {
          applyReplacement(useStore.getState().t, cancelled, slot, s.teamA, s.teamB);
          if (apply(x => applyReplacement(x, cancelled, slot, s.teamA, s.teamB), 'اعتماد مواجهة بديلة في الموعد الشاغر')) { toast('تم اعتماد المواجهة البديلة بنفس الموعد'); onClose(); }
        } catch (e) { setError((e as Error).message); }
      }}>اعتماد بهذا الموعد</button>
    </div>)}</div>
    {time && !suggestions.length && <p role="status" className="rounded-xl bg-ink/5 p-5 text-center text-ink/65">لا توجد مواجهات بديلة متاحة لهذا الموعد حسب توفر الفرق والمواعيد الحالية.</p>}
    <div className="mt-4 border-t border-ink/10 pt-4"><button className="btn btn-ghost" onClick={onClose}>إغلاق وترك الموعد فارغاً</button></div>
  </Modal>;
}
