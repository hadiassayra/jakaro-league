import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { Match } from '../lib/types';
import { isFinished } from '../lib/standings';
import { clearResult, recordResult, setMatchStatus, setMatchTable, teamName } from '../lib/tournament';
import { champion } from '../lib/knockout';
import { playClick, playFanfare, playWin } from '../lib/sound';
import { useStore } from '../store/useStore';
import { confirmDialog, toast } from '../store/ui';
import { Marble, Modal, TeamMarble } from './ui';

export function undoToast(text: string) {
  toast(text, {
    label: 'تراجع',
    run: () => {
      const l = useStore.getState().undo();
      if (l) toast('تم التراجع');
    },
  });
}

export function ResultModal({ match, onClose }: { match: Match | null; onClose: () => void }) {
  const t = useStore((s) => s.t);
  const apply = useStore((s) => s.apply);
  const m = match ? (t.matches.find((x) => x.id === match.id) ?? null) : null;
  const [winner, setWinner] = useState<string | null>(null);
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    setWinner(m?.winnerId ?? null);
    setLeft(m?.loserMarbles ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.id]);

  if (!m) return <Modal open={false} onClose={onClose}>{null}</Modal>;
  const locked = m.stage === 'group' && t.groupsLocked;
  const max = t.settings.maxMarbles;
  const done = isFinished(m);

  const save = () => {
    if (!winner || left === null) return;
    const wasChampion = champion(t.matches);
    const ok = apply((x) => recordResult(x, m.id, winner, left), 'تسجيل نتيجة');
    if (!ok) return;
    const after = useStore.getState().t;
    if (!wasChampion && champion(after.matches)) playFanfare();
    else playWin();
    undoToast(`${done ? 'عُدّلت' : 'سُجّلت'} النتيجة: فوز ${teamName(t, winner)}`);
    onClose();
  };

  const remove = async () => {
    const ok = await confirmDialog({
      title: 'حذف النتيجة؟',
      message: m.stage === 'knockout' ? 'سيتم أيضاً مسح نتائج المباريات اللاحقة التي تعتمد عليها.' : undefined,
      confirmText: 'حذف',
      danger: true,
    });
    if (!ok) return;
    apply((x) => clearResult(x, m.id), 'حذف نتيجة');
    undoToast('حُذفت النتيجة');
    onClose();
  };

  const teamBtn = (id: string) => {
    const sel = winner === id;
    return (
      <button
        key={id}
        disabled={locked}
        onClick={() => {
          setWinner(id);
          playClick();
        }}
        className={`relative flex flex-1 flex-col items-center gap-2 rounded-2xl border-2 p-4 transition ${
          sel ? 'border-accent bg-accent/15 shadow-[0_0_0_4px_color-mix(in_srgb,var(--accent)_25%,transparent)]' : 'border-ink/15 bg-ink/5 hover:border-ink/30'
        }`}
      >
        <TeamMarble teams={t.teams} id={id} size={48} />
        <span className="font-display text-2xl leading-tight">{teamName(t, id)}</span>
        <span className="text-xs text-ink/60">
          {t.teams.find((x) => x.id === id)?.player1} و {t.teams.find((x) => x.id === id)?.player2}
        </span>
        {sel && (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="chip absolute -top-3 bg-win px-3 py-1 text-sm text-white">
            الفائز ✓
          </motion.span>
        )}
      </button>
    );
  };

  return (
    <Modal open={!!match} onClose={onClose} title={done ? 'تعديل النتيجة' : 'إدخال النتيجة'}>
      {locked && (
        <p className="mb-3 rounded-xl bg-accent/20 p-3 text-sm">
          نتائج المجموعات معتمدة ومقفلة. ألغِ الاعتماد من صفحة الترتيب للتعديل.
        </p>
      )}
      <div className="mb-2 text-sm font-bold text-ink/70">١. اضغط على الفريق الفائز</div>
      <div className="mb-5 flex gap-3">
        {teamBtn(m.teamA!)}
        <span className="self-center font-display text-2xl text-ink/40">×</span>
        {teamBtn(m.teamB!)}
      </div>

      <div className="mb-2 text-sm font-bold text-ink/70">
        ٢. كم كرة بقيت للفريق الخاسر{winner ? ` (${teamName(t, winner === m.teamA ? m.teamB : m.teamA)})` : ''} ولم يُدخلها؟
      </div>
      <div className="mb-5 grid grid-cols-5 gap-2 sm:grid-cols-9">
        {Array.from({ length: max + 1 }, (_, n) => (
          <button
            key={n}
            disabled={locked}
            onClick={() => {
              setLeft(n);
              playClick();
            }}
            className={`grid place-items-center rounded-full transition ${left === n ? 'scale-110' : 'opacity-80 hover:opacity-100'}`}
            aria-label={`${n} كرات`}
            aria-pressed={left === n}
          >
            <Marble color={left === n ? 'accent' : (['red', 'blue', 'green', 'yellow'] as const)[n % 4]} size={50}>
              <span className="font-display text-2xl" style={{ color: left === n ? 'var(--on-accent)' : 'white', textShadow: '0 1px 2px rgb(0 0 0 / .4)' }}>
                {n}
              </span>
            </Marble>
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-ink/5 p-3 text-sm">
        <label className="flex items-center gap-2">
          الطاولة
          <input
            type="number"
            min={1}
            className="input w-20 py-1"
            value={m.table ?? ''}
            onChange={(e) => apply((x) => setMatchTable(x, m.id, e.target.value ? Number(e.target.value) : null))}
          />
        </label>
        {!done && (
          <button
            className={`btn btn-sm ${m.status === 'playing' ? 'btn-ghost' : 'btn-accent'}`}
            onClick={() => apply((x) => setMatchStatus(x, m.id, m.status === 'playing' ? 'upcoming' : 'playing'))}
          >
            {m.status === 'playing' ? '⏸ إيقاف (قادمة)' : '▶ بدء المباراة الآن'}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary flex-1 py-3 text-lg" disabled={!winner || left === null || locked} onClick={save}>
          حفظ النتيجة
        </button>
        {done && !locked && (
          <button className="btn btn-danger" onClick={remove}>
            حذف النتيجة
          </button>
        )}
      </div>
    </Modal>
  );
}
