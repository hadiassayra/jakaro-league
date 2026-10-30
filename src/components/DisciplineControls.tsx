import { useState } from 'react';
import type { Match } from '../lib/types';
import { cardsFor, correctLastCard, issueCard } from '../lib/discipline';
import { teamName } from '../lib/tournament';
import { useStore } from '../store/useStore';
import { confirmDialog, toast } from '../store/ui';
import { CardsBadge } from './CardsBadge';

export function DisciplineControls({ match, locked }: { match: Match; locked: boolean }) {
  const t = useStore(s => s.t);
  const apply = useStore(s => s.apply);
  const [reason, setReason] = useState('غش');
  const change = async (teamId: string, action: 'yellow' | 'red' | 'correct') => {
    const before = cardsFor(match, teamId);
    const red = action === 'red' || (action === 'yellow' && cardsFor(match, teamId).yellow === 2);
    if (red && !await confirmDialog({ title: 'بطاقة حمراء وخسارة مباشرة؟', message: `سيُحتسب ${teamName(t, teamId)} خاسراً وتُنهي المباراة فوراً. لا تُحتسب كرات للقرار الإداري.`, confirmText: 'إصدار الحمراء', danger: true })) return;
    if (action === 'correct' && !await confirmDialog({ title: 'تصحيح آخر بطاقة؟', message: 'إلغاء الأصفر الثاني يعيد النقطة المخصومة. إلغاء الحمراء يعيد حالة المباراة قبلها، وقد تتغير مواجهات الإقصائيات التابعة لها.', confirmText: 'تصحيح البطاقة' })) return;
    const ok = apply(current => {
      const fresh = current.matches.find(m => m.id === match.id);
      if (!fresh) throw new Error('المباراة غير موجودة.');
      const now = cardsFor(fresh, teamId);
      if (now.yellow !== before.yellow || now.red !== before.red) throw new Error('تغيّرت البطاقات على جهاز آخر. راجع الحالة الحالية ثم أعد القرار.');
      return action === 'correct' ? correctLastCard(current, match.id, teamId, reason) : issueCard(current, match.id, teamId, action, reason);
    }, 'تعديل البطاقات');
    if (ok) toast(action === 'correct' ? 'تم تصحيح البطاقة' : red ? 'تم إصدار الحمراء واحتساب الخسارة المباشرة' : 'تم إصدار البطاقة الصفراء');
  };
  return <section className="mb-5 space-y-3 rounded-xl border border-ink/15 p-3">
    <h3 className="text-xl">البطاقات والعقوبات</h3>
    <p className="text-xs text-ink/65">لكل مباراة عدّ مستقل: أصفر، ثم أصفر وخصم نقطة من المجموعة، ثم حمراء وخسارة مباشرة.</p>
    <label className="block text-sm">سبب القرار أو التصحيح<input className="input mt-1" value={reason} onChange={e => setReason(e.target.value)} disabled={locked} /></label>
    <div className="grid gap-3 sm:grid-cols-2">{[match.teamA, match.teamB].filter((id): id is string => !!id).map(id => {
      const cards = cardsFor(match, id);
      return <div key={id} className="space-y-2 rounded-xl bg-ink/5 p-3">
        <p className="font-bold">{teamName(t, id)}</p><CardsBadge match={match} teamId={id} />
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-sm bg-m-yellow text-black" disabled={locked || cards.red || !reason.trim()} onClick={() => change(id, 'yellow')}>{cards.yellow === 2 ? 'غش ثالث ← حمراء' : 'بطاقة صفراء'}</button>
          <button className="btn btn-danger btn-sm" disabled={locked || cards.red || !reason.trim()} onClick={() => change(id, 'red')}>حمراء مباشرة</button>
          <button className="btn btn-ghost btn-sm" disabled={locked || (!cards.yellow && !cards.red) || !reason.trim()} onClick={() => change(id, 'correct')}>تصحيح آخر بطاقة</button>
        </div>
      </div>;
    })}</div>
  </section>;
}
