import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Tournament } from '../lib/types';
import { groupOpponents } from '../lib/opponents';
import { matchDay } from '../lib/playDay';
import { formatMatchTime } from '../lib/matchTime';
import { TeamMarble } from './ui';

export function GroupOpponents({ t, teamId, onSchedule }: { t: Tournament; teamId?: string; onSchedule?: (a: string, b: string) => void }) {
  const [selected, setSelected] = useState('');
  const [filter, setFilter] = useState<'all' | 'played' | 'remaining'>('all');
  const id = teamId ?? (t.teams.some(x => x.id === selected) ? selected : t.teams.find(x => x.group)?.id ?? '');
  const opponents = groupOpponents(t, id);
  const played = opponents.filter(x => x.status === 'played').length;
  const labels = { played: 'لعب معه', playing: 'يلعب الآن', scheduled: 'مجدولة — لم تُلعب', pending: 'لم يلعب معه — دون موعد', missing: 'لم يلعب معه — المواجهة غير مضافة' };
  return <section className="board mb-5 space-y-4 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl">متابعة مواجهات المجموعة</h2><p className="mt-1 text-sm text-ink/60">كل فريق يواجه كل فرق مجموعته مرة واحدة، حتى لو لم يُحدد موعد المباراة بعد.</p></div>{!teamId && <label className="text-sm">اختر الفريق<select className="input mt-1" value={id} onChange={e => setSelected(e.target.value)}>{t.teams.filter(x => x.group).map(team => <option key={team.id} value={team.id}>{team.name} — المجموعة {team.group === 'A' ? 'أ' : 'ب'}</option>)}</select></label>}</div>
    <div className="flex flex-wrap items-center gap-2"><span className="chip bg-win/15">لعب مع {played} من {opponents.length}</span><span className="chip bg-accent/15">متبقي {opponents.length - played} مواجهة</span>{!teamId && id && <Link className="ms-auto text-sm text-primary-ink underline" to={`/admin/team/${id}`}>ملف الفريق ←</Link>}</div>
    <div className="flex flex-wrap gap-2">{([['all', 'كل الخصوم'], ['played', 'لعب معهم'], ['remaining', 'لم يلعب معهم']] as const).map(([value, label]) => <button key={value} className={`btn btn-sm ${filter === value ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
    <div className="max-h-96 divide-y divide-ink/10 overflow-y-auto">{opponents.filter(x => filter === 'all' || (filter === 'played' ? x.status === 'played' : x.status !== 'played')).map(x => <div key={x.team.id} className="flex flex-wrap items-center gap-3 py-3">
      <TeamMarble teams={t.teams} id={x.team.id} size={30} /><Link className="min-w-0 flex-1 font-bold hover:underline" to={`/admin/team/${x.team.id}`}>{x.team.name}</Link>
      <div className="text-end text-xs"><span className={x.status === 'played' ? 'text-win' : x.status === 'playing' ? 'text-loss' : 'text-ink/65'}>{labels[x.status]}{x.status === 'played' ? x.match?.winnerId === id ? ' · فوز' : ' · خسارة' : ''}</span>{x.match && matchDay(x.match) && <p className="mt-1 text-ink/50">{matchDay(x.match)}{x.match.scheduledAt ? ` · ${formatMatchTime(x.match.scheduledAt)}` : ''}</p>}</div>
      {onSchedule && !t.groupsLocked && x.status !== 'played' && x.status !== 'playing' && <button className="btn btn-ghost btn-sm" onClick={() => onSchedule(id, x.team.id)}>{x.status === 'scheduled' ? 'تعديل الموعد' : 'اختيار لهذا اليوم'}</button>}
    </div>)}</div>
    {!opponents.length && <p className="text-sm text-ink/60">لا توجد فرق أخرى في مجموعة هذا الفريق.</p>}
  </section>;
}
