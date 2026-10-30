import { useState } from 'react';
import type { GroupId } from '../lib/types';
import { allStandings } from '../lib/tournament';
import { correctTeamPoints } from '../lib/discipline';
import { useStore } from '../store/useStore';
import { confirmDialog, toast } from '../store/ui';

export function PointsCorrection({ group }: { group: GroupId }) {
  const t = useStore(s => s.t);
  const apply = useStore(s => s.apply);
  const teams = t.teams.filter(team => team.group === group);
  const [teamId, setTeamId] = useState(teams[0]?.id ?? '');
  const [total, setTotal] = useState('');
  const [reason, setReason] = useState('');
  const current = allStandings(t)[group].find(row => row.teamId === teamId);
  return <details className="board mt-5 p-4">
    <summary className="cursor-pointer font-bold">تعديل أو خصم نقاط فريق — للإدارة</summary>
    <p className="mt-3 text-sm text-ink/65">أدخل المجموع الجديد لخصم نقاط أو تصحيح خطأ. التصحيح مستقل عن نتائج المباريات وخصومات البطاقات، ويظهر في السجل.</p>
    {t.groupsLocked && <p className="mt-2 text-sm text-loss">ألغِ اعتماد المجموعات أولاً للسماح بالتصحيح.</p>}
    <form className="mt-4 grid items-end gap-3 sm:grid-cols-2" onSubmit={async e => {
      e.preventDefault();
      if (!total.trim() || !reason.trim()) return;
      if (!await confirmDialog({ title: 'تأكيد تصحيح النقاط؟', message: `سيصبح مجموع نقاط ${teams.find(team => team.id === teamId)?.name} هو ${total} بدلاً من ${current?.points ?? 0}.`, confirmText: 'حفظ التصحيح' })) return;
      if (apply(x => correctTeamPoints(x, teamId, Number(total), reason), 'تصحيح النقاط')) { toast('تم تصحيح النقاط وتحديث الترتيب'); setTotal(''); setReason(''); }
    }}>
      <label className="text-sm">الفريق<select className="input mt-1" value={teamId} disabled={t.groupsLocked} onChange={e => { setTeamId(e.target.value); setTotal(''); }}>{teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
      <label className="text-sm">المجموع الصحيح <span className="text-ink/50">(الحالي: {current?.points ?? 0})</span><input type="number" step="1" className="input mt-1" required value={total} disabled={t.groupsLocked} onChange={e => setTotal(e.target.value)} /></label>
      <label className="text-sm sm:col-span-2">سبب التصحيح<input className="input mt-1" required value={reason} disabled={t.groupsLocked} onChange={e => setReason(e.target.value)} /></label>
      <button className="btn btn-primary" disabled={t.groupsLocked || !teamId || !total.trim() || !reason.trim()}>حفظ مجموع النقاط الصحيح</button>
    </form>
  </details>;
}
