import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GroupId, Team } from '../lib/types';
import { useStore } from '../store/useStore';
import { confirmDialog, toast } from '../store/ui';
import { shuffle } from '../lib/id';
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
        <span className="truncate font-bold">{team.name}</span>
      </div>
    </motion.div>
  );
}

export default function DrawPage() {
  const t = useStore((s) => s.t);
  const apply = useStore((s) => s.apply);
  const nav = useNavigate();
  const [assign, setAssign] = useState<Record<string, Slot>>(() =>
    Object.fromEntries(t.teams.map((x) => [x.id, x.group])),
  );
  const [running, setRunning] = useState(false);
  const [lastPlaced, setLastPlaced] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [fast, setFast] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  // keep new/removed teams in sync
  useEffect(() => {
    setAssign((a) => Object.fromEntries(t.teams.map((x) => [x.id, x.id in a ? a[x.id] : x.group])));
  }, [t.teams]);

  const startDraw = () => {
    timers.current.forEach(clearTimeout);
    const order = shuffle(t.teams.map((x) => x.id));
    const startWith: GroupId = Math.random() < 0.5 ? 'A' : 'B';
    setAssign(Object.fromEntries(t.teams.map((x) => [x.id, null])));
    setRunning(true);
    setSelected(null);
    const step = fast ? 250 : 900;
    order.forEach((id, i) => {
      timers.current.push(
        setTimeout(() => {
          const g: GroupId = i % 2 === 0 ? startWith : startWith === 'A' ? 'B' : 'A';
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
    setAssign((a) => ({ ...a, [id]: g }));
    setSelected(null);
    playDrop();
  };

  const counts = { A: 0, B: 0, pool: 0 };
  t.teams.forEach((x) => {
    const g = assign[x.id];
    if (g) counts[g]++;
    else counts.pool++;
  });
  const changed = t.teams.some((x) => (assign[x.id] ?? null) !== x.group);

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
    apply((x) => {
      const teams = x.teams.map((tm) => ({ ...tm, group: assign[tm.id] ?? null }));
      let next = withLog({ ...x, teams, tieOverrides: { A: [], B: [] } }, 'اعتماد توزيع المجموعات');
      if (teams.every((tm) => tm.group)) next = generateSchedule({ ...next, matches: [] });
      return next;
    }, 'اعتماد القرعة');
    toast('تم اعتماد المجموعات وتوليد الجدول');
    nav('/admin/matches');
  };

  const renderColumn = (g: GroupId) => {
    const list = t.teams.filter((x) => assign[x.id] === g);
    const holes = Math.max(0, Math.ceil(t.teams.length / 2) - list.length);
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
              teams={t.teams}
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

  if (!t.teams.length)
    return (
      <div>
        <SectionTitle rank="K" title="القرعة" />
        <Empty>أضف الفرق أولاً ثم عُد لإجراء القرعة.</Empty>
      </div>
    );

  return (
    <div>
      <SectionTitle
        rank="K"
        title="القرعة"
        sub="سحب عشوائي حي لتوزيع الفرق على المجموعتين — يمكنك السحب والإفلات أو الضغط على فريق لنقله"
        actions={
          <>
            <button className="btn btn-accent" onClick={startDraw} disabled={running}>
              🎲 {counts.pool === t.teams.length ? 'ابدأ القرعة' : 'إعادة القرعة'}
            </button>
            <button className="btn btn-primary" onClick={save} disabled={running || counts.pool > 0 || !changed}>
              ✓ اعتماد التوزيع
            </button>
          </>
        }
      />
      <label className="mb-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} /> قرعة سريعة
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
              {t.teams
                .filter((x) => !assign[x.id])
                .map((team) => (
                  <Chip
                    key={team.id}
                    team={team}
                    teams={t.teams}
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
