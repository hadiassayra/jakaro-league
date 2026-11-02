import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GroupId, Team } from '../lib/types';
import { useStore } from '../store/useStore';
import { confirmDialog, toast } from '../store/ui';
import { daysLabel, drawByAvailability, groupAvailability } from '../lib/availability';
import { draftTeamsFromRows, parseTeamRows, type ParsedTeamRow } from '../lib/importTeams';
import { readSheet } from '../lib/excel';
import { sourceAvailabilityRows } from '../lib/availabilityRoster';
import { generateSchedule, hasGroupResults, withLog } from '../lib/tournament';
import { playDrop, playWin } from '../lib/sound';
import { groupLabel } from '../components/StandingsTable';
import { Empty, Marble, SectionTitle, TeamMarble } from '../components/ui';

type Slot = GroupId | null;

function Chip({
  team,
  teams,
  selected,
  onSelect,
  rolling,
}: {
  team: Team;
  teams: Team[];
  selected: boolean;
  onSelect: () => void;
  rolling: boolean;
}) {
  return (
    <motion.div
      layoutId={team.id}
      layout
      transition={{ type: 'spring', stiffness: 170, damping: 20 }}
      onClick={onSelect}
      className={`cursor-grab select-none rounded-full border active:cursor-grabbing ${
        selected ? 'border-accent bg-accent/25' : 'border-ink/10 bg-surface'
      } shadow`}
    >
      <div
        draggable
        onDragStart={(e) => e.dataTransfer.setData('text/plain', team.id)}
        className="flex items-center gap-2 px-2 py-1.5 pe-4"
      >
        <motion.span animate={rolling ? { rotate: [0, 360, 720] } : { rotate: 0 }} transition={{ duration: 0.8 }}>
          <TeamMarble teams={teams} id={team.id} size={30} />
        </motion.span>
        <span className="min-w-0"><span className="block truncate font-bold">{team.name}</span><span className="block text-xs text-ink/55">{daysLabel(team.availableDays)}</span></span>
      </div>
    </motion.div>
  );
}

export default function DrawPage() {
  const t = useStore((s) => s.t);
  const apply = useStore((s) => s.apply);
  const nav = useNavigate();
  const [draftTeams, setDraftTeams] = useState<Team[] | null>(null);
  const teams = draftTeams ?? t.teams;
  const [draftSource, setDraftSource] = useState('');
  const [fileError, setFileError] = useState('');
  const [loading, setLoading] = useState(false);
  const loadRows = (rows: ParsedTeamRow[], source: string) => {
    const invalid = rows.filter(row => row.issues.includes('badDays') || row.issues.includes('duplicate'));
    if (invalid.length) throw new Error(`راجع صفوف الأيام أو الأسماء المتكررة: ${invalid.map(r => r.rowNumber).join('، ')}`);
    const next = draftTeamsFromRows(rows, t.teams);
    if (next.length < 2) throw new Error('الملف لا يحتوي على فريقين صالحين على الأقل.');
    setDraftTeams(next); setAssign(drawByAvailability(next)); setDraftSource(source); setFileError('');
  };
  const [assign, setAssign] = useState<Record<string, Slot>>(() =>
    Object.fromEntries(teams.map((x) => [x.id, x.group])),
  );
  const [running, setRunning] = useState(false);
  const [lastPlaced, setLastPlaced] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [fast, setFast] = useState(true);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  // keep new/removed teams in sync
  useEffect(() => {
    setAssign((a) => Object.fromEntries(teams.map((x) => [x.id, x.id in a ? a[x.id] : x.group])));
  }, [teams]);

  const startDraw = () => {
    if (teams.filter(team => team.availableDays?.length).length < 2) { setFileError('حمّل الشيت أو حدّد أيام فريقين على الأقل أولاً.'); return; }
    timers.current.forEach(clearTimeout);
    const target = drawByAvailability(teams);
    const order = teams.map(x => x.id);
    setAssign(Object.fromEntries(teams.map((x) => [x.id, null])));
    setRunning(true);
    setSelected(null);
    const step = fast ? 250 : 900;
    order.forEach((id, i) => {
      timers.current.push(
        setTimeout(() => {
          const g = target[id];
          setAssign((a) => ({ ...a, [id]: g }));
          setLastPlaced(id);
          playDrop();
          if (i === order.length - 1) {
            setRunning(false);
            playWin();
          }
        }, 600 + i * step),
      );
    });
  };

  const move = (id: string, g: Slot) => {
    if (running || !teams.some(team => team.id === id)) return;
    setAssign((a) => ({ ...a, [id]: g }));
    setSelected(null);
    playDrop();
  };

  const counts = { A: 0, B: 0, pool: 0 };
  teams.forEach((x) => {
    const g = assign[x.id];
    if (g) counts[g]++;
    else counts.pool++;
  });
  const changed = !!draftTeams || teams.some((x) => (assign[x.id] ?? null) !== x.group);

  const save = async () => {
    const results = hasGroupResults(t);
    if (t.matches.some((m) => m.stage === 'group')) {
      const ok = await confirmDialog({
        title: 'اعتماد التوزيع وإعادة توليد الجدول؟',
        message: results ? 'سيتم حذف جدول المجموعات الحالي وكل النتائج المسجلة.' : 'سيتم إعادة توليد جدول المجموعات.',
        confirmText: 'اعتماد',
        danger: results,
      });
      if (!ok) return;
    }
    const saved = apply((x) => {
      const updatedTeams = teams.map((tm) => ({ ...tm, group: assign[tm.id] ?? null }));
      if (x.updatedAt !== t.updatedAt) throw new Error('تغيّرت بيانات البطولة أثناء المعاينة. راجع الاقتراح ثم أعد الاعتماد.');
      let next = withLog({ ...x, teams: updatedTeams, tieOverrides: { A: [], B: [] } }, 'اعتماد توزيع المجموعات حسب الأيام');
      if (updatedTeams.every((tm) => tm.group)) next = generateSchedule({ ...next, matches: [] });
      return next;
    }, 'اعتماد القرعة');
    if (!saved) return;
    toast('تم اعتماد المجموعات وتوليد الجدول');
    nav('/admin/matches');
  };

  const renderColumn = (g: GroupId) => {
    const list = teams.filter((x) => assign[x.id] === g);
    const compatibility = groupAvailability(list);
    const holes = Math.max(0, Math.ceil(teams.length / 2) - list.length);
    return (
      <div
        key={g}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const id = e.dataTransfer.getData('text/plain');
          if (id) move(id, g);
        }}
        className="board flex min-h-64 flex-1 flex-col gap-2 p-4"
      >
        <div className="mb-1 flex items-center gap-2">
          <Marble color={g === 'A' ? 'red' : 'blue'} size={26}>
            <span className="font-display text-sm text-white">{g === 'A' ? 'أ' : 'ب'}</span>
          </Marble>
          <h3 className="flex-1 text-3xl">{groupLabel(g)}</h3>
          <span className="chip bg-ink/10">{list.length}</span>
        </div>
        {!running && list.length > 0 && <div className="space-y-2 rounded-xl bg-ink/5 p-3 text-xs">
          <p>{compatibility.common.length ? `أيام مشتركة لكل المجموعة: ${daysLabel(compatibility.common)}` : 'لا يوجد يوم واحد مؤكّد مناسب لكل المجموعة؛ تُجدول كل مواجهة حسب يوم الفريقين.'}</p>
          {compatibility.missing.length > 0 && <p className="text-loss">أيام غير محددة لـ {compatibility.missing.length} فريق.</p>}
          {compatibility.conflicts.length > 0 ? <details><summary className="cursor-pointer font-bold text-loss">{compatibility.conflicts.length} مواجهة بلا يوم مشترك — تحتاج اتفاقاً إضافياً</summary><ul className="mt-2 space-y-1">{compatibility.conflicts.map(([a, b]) => <li key={`${a.id}-${b.id}`}>{a.name} × {b.name}</li>)}</ul></details> : <p className="text-win">كل المواجهات ذات الأيام المحددة لها يوم مشترك.</p>}
        </div>}
        {selected && assign[selected] !== g && (
          <button className="btn btn-accent btn-sm" onClick={() => move(selected, g)}>
            نقل الفريق المحدد إلى هنا
          </button>
        )}
        <div className="flex flex-col gap-2">
          {list.map((team) => (
            <Chip
              key={team.id}
              team={team}
              teams={teams}
              selected={selected === team.id}
              rolling={lastPlaced === team.id}
              onSelect={() => !running && setSelected(selected === team.id ? null : team.id)}
            />
          ))}
          {Array.from({ length: holes }, (_, i) => (
            <div key={`h${i}`} className="flex items-center gap-2 rounded-full border border-dashed border-ink/15 px-2 py-1.5">
              <span className="hole inline-block h-[30px] w-[30px]" />
              <span className="text-sm text-ink/35">…</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div>
      <SectionTitle
        rank="K"
        title="القرعة"
        sub="توزيع متوازن يفضّل الأيام المشتركة ويقلّل المواجهات المتعارضة. يمكنك مراجعة الاقتراح ونقل الفرق يدوياً."
        actions={
          <>
            <button className="btn btn-accent" onClick={startDraw} disabled={running || teams.filter(team => team.availableDays?.length).length < 2 || t.groupsLocked}>
              📅 توزيع حسب الأيام
            </button>
            <button className="btn btn-primary" onClick={save} disabled={running || counts.pool > 0 || !changed || t.groupsLocked}>
              ✓ اعتماد التوزيع
            </button>
          </>
        }
      />
      <section className="board mb-4 space-y-3 p-4">
        <h2 className="text-xl">أيام الفرق من الشيت</h2>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" disabled={running || loading || t.groupsLocked} onClick={() => {
            try { loadRows(sourceAvailabilityRows, 'شيت التسجيل المرفق — ٢٨ فريق'); } catch (e) { setFileError((e as Error).message); }
          }}>معاينة الشيت المرفق (٢٨ فريق)</button>
          <label className={`btn btn-ghost ${running || t.groupsLocked ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}>{loading ? 'جارٍ قراءة الملف…' : 'رفع شيت أيام آخر'}<input type="file" accept=".xlsx,.xls,.csv" className="hidden" disabled={running || loading || t.groupsLocked} onChange={async e => {
            const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
            setLoading(true); setFileError('');
            try { loadRows(parseTeamRows(await readSheet(file)).rows, file.name); } catch (error) { setFileError((error as Error).message); } finally { setLoading(false); }
          }} /></label>
          {draftTeams && <button className="btn btn-ghost" disabled={running} onClick={() => { setDraftTeams(null); setDraftSource(''); setAssign(Object.fromEntries(t.teams.map(team => [team.id, team.group]))); }}>إلغاء المعاينة</button>}
        </div>
        <p className="text-sm text-ink/65">هذه معاينة فقط. عند الاعتماد تُستبدل قائمة الفرق والتوزيع حسب الشيت ويُعاد توليد الجدول، بعد تأكيد حذف النتائج الحالية إن وجدت. الأيام واللاعبون ظاهرة للمراجعة؛ لا تُستورد أرقام الهواتف.</p>
        {draftTeams && <p className="text-sm font-bold">{draftSource} · {teams.length} فريق · فرق حالية غير موجودة بالشيت: {t.teams.filter(team => !teams.some(next => next.id === team.id)).map(team => team.name).join('، ') || 'لا يوجد'}</p>}
        {draftTeams && draftSource.startsWith('شيت التسجيل المرفق') && <p className="text-xs text-ink/60">تم تمييز الفريقين «منحددوا بعدين» بأسماء أعضائهما. تسجيل «لا يوجد» فردي، وأسماء «حذيفه ليث» محفوظة كما وردت وتحتاج مراجعة فصل اللاعبين.</p>}
        {fileError && <p role="alert" className="text-sm text-loss">{fileError}</p>}
        {t.groupsLocked && <p className="text-sm text-loss">ألغِ اعتماد نتائج المجموعات أولاً لتغيير التوزيع.</p>}
      </section>
      {!teams.length && <Empty>حمّل الشيت المرفق أو أضف الفرق أولاً.</Empty>}
      <label className="mb-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} /> عرض سريع للتوزيع
      </label>
      <LayoutGroup>
        <div
          className="board mb-4 p-4"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            const id = e.dataTransfer.getData('text/plain');
            if (id) move(id, null);
          }}
        >
          <div className="mb-2 flex items-center gap-2">
            <span className="text-2xl">🫙</span>
            <h3 className="flex-1 text-2xl">وعاء القرعة</h3>
            <span className="chip bg-ink/10">{counts.pool}</span>
            {selected && assign[selected] && (
              <button className="btn btn-ghost btn-sm" onClick={() => move(selected, null)}>
                إرجاع للوعاء
              </button>
            )}
          </div>
          <div className="flex min-h-14 flex-wrap justify-center gap-2 rounded-[2rem] bg-black/15 p-3">
            <AnimatePresence>
              {teams
                .filter((x) => !assign[x.id])
                .map((team) => (
                  <Chip
                    key={team.id}
                    team={team}
                    teams={teams}
                    selected={selected === team.id}
                    rolling={false}
                    onSelect={() => !running && setSelected(selected === team.id ? null : team.id)}
                  />
                ))}
            </AnimatePresence>
            {counts.pool === 0 && <span className="self-center text-sm text-ink/50">الوعاء فارغ</span>}
          </div>
        </div>
        <div className="flex flex-col gap-4 md:flex-row">
          {renderColumn('A')}
          {renderColumn('B')}
        </div>
      </LayoutGroup>
      {Math.abs(counts.A - counts.B) > 1 && (
        <p className="mt-3 rounded-xl bg-accent/20 p-3 text-sm">تنبيه: المجموعتان غير متوازنتين ({counts.A} مقابل {counts.B}).</p>
      )}
    </div>
  );
}
