import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { GroupId, Team, Tournament } from '../lib/types';
import { useStore } from '../store/useStore';
import { confirmDialog, toast } from '../store/ui';
import { uid } from '../lib/id';
import { removeTeam, upsertTeam, withLog } from '../lib/tournament';
import { importableRows, parseTeamRows, type ParsedTeamRow } from '../lib/importTeams';
import { downloadTemplate, readSheet } from '../lib/excel';
import { groupLabel } from '../components/StandingsTable';
import { processTeamLogo } from '../lib/imageColors';
import { Empty, Field, MarbleLoader, Modal, SectionTitle, TeamMarble } from '../components/ui';

export function scheduleOutdated(t: Tournament): boolean {
  const gm = t.matches.filter((m) => m.stage === 'group');
  if (!gm.length) return false;
  const inSchedule = new Map<string, GroupId>();
  gm.forEach((m) => {
    inSchedule.set(m.teamA!, m.group!);
    inSchedule.set(m.teamB!, m.group!);
  });
  const grouped = t.teams.filter((x) => x.group);
  return grouped.length !== inSchedule.size || grouped.some((x) => inSchedule.get(x.id) !== x.group);
}

const ISSUE_TEXT: Record<ParsedTeamRow['issues'][number], string> = {
  empty: 'صف فارغ',
  duplicate: 'اسم مكرر',
  missingPlayers: 'لاعب ناقص',
  badGroup: 'مجموعة غير معروفة',
};

function TeamForm({ team, onClose }: { team: Team | null; onClose: () => void }) {
  const apply = useStore((s) => s.apply);
  const teams = useStore((s) => s.t.teams);
  const [form, setForm] = useState<Team>(team ?? { id: uid('team'), name: '', player1: '', player2: '', group: null });
  const [logoLoading, setLogoLoading] = useState(false);
  const [logoError, setLogoError] = useState('');
  const logoRef = useRef<HTMLInputElement>(null);
  const dup = teams.some((x) => x.id !== form.id && x.name.trim() === form.name.trim());
  const set = (k: keyof Team, v: string | null) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.name.trim() || dup || logoLoading) return;
        if (apply((t) => upsertTeam(t, { ...form, name: form.name.trim() }), team ? 'تعديل فريق' : 'إضافة فريق')) onClose();
      }}
    >
      <div className="flex items-center gap-4 rounded-xl border border-ink/10 p-4">
        <TeamMarble teams={[form]} id={form.id} size={72} />
        <div className="min-w-0 flex-1">
          <p className="mb-2 text-sm font-bold">لوجو الفريق</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-ghost btn-sm" disabled={logoLoading} onClick={() => logoRef.current?.click()}>{logoLoading ? 'جارٍ تجهيز الصورة…' : form.logo ? 'تغيير اللوجو' : 'رفع لوجو'}</button>
            {form.logo && <button type="button" className="btn btn-ghost btn-sm text-loss" disabled={logoLoading} onClick={() => { set('logo', null); setLogoError(''); }}>إزالة</button>}
          </div>
          <p className="mt-2 text-xs text-ink/50">PNG أو JPG أو WebP · يظهر في المباريات والنتائج</p>
          <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" aria-label="اختيار لوجو الفريق" onChange={async e => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            setLogoLoading(true);
            setLogoError('');
            try { set('logo', await processTeamLogo(file)); }
            catch (error) { setLogoError((error as Error).message); }
            finally { setLogoLoading(false); }
          }} />
        </div>
      </div>
      {logoError && <p role="alert" className="text-sm text-loss">{logoError}</p>}
      <Field label="اسم الفريق">
        <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus required />
      </Field>
      {dup && <p className="text-sm text-loss">يوجد فريق بنفس الاسم</p>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="اللاعب 1">
          <input className="input" value={form.player1} onChange={(e) => set('player1', e.target.value)} />
        </Field>
        <Field label="اللاعب 2">
          <input className="input" value={form.player2} onChange={(e) => set('player2', e.target.value)} />
        </Field>
      </div>
      <Field label="المجموعة">
        <select className="input" value={form.group ?? ''} onChange={(e) => set('group', e.target.value || null)}>
          <option value="">بدون (تُحدد بالقرعة)</option>
          <option value="A">المجموعة أ</option>
          <option value="B">المجموعة ب</option>
        </select>
      </Field>
      <button className="btn btn-primary w-full" disabled={!form.name.trim() || dup || logoLoading}>
        حفظ
      </button>
    </form>
  );
}

function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useStore((s) => s.t);
  const apply = useStore((s) => s.apply);
  const nav = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedTeamRow[] | null>(null);
  const [include, setInclude] = useState<Set<number>>(new Set());
  const [hasGroup, setHasGroup] = useState(false);
  const [mode, setMode] = useState<'replace' | 'append'>('replace');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setRows(null);
    setError('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setLoading(true);
    setError('');
    try {
      const raw = await readSheet(f);
      const res = parseTeamRows(raw);
      setRows(res.rows);
      setHasGroup(res.hasGroupColumn && res.rows.some((r) => r.group));
      setInclude(new Set(importableRows(res.rows).map((r) => r.rowNumber)));
      if (!res.rows.length) setError('الملف لا يحتوي على بيانات');
    } catch (e) {
      setError(`تعذّرت قراءة الملف: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const doImport = async () => {
    if (!rows) return;
    const chosen = rows.filter((r) => include.has(r.rowNumber));
    if (mode === 'replace' && t.matches.length) {
      const ok = await confirmDialog({
        title: 'استبدال الفرق؟',
        message: 'سيتم حذف الفرق الحالية وجدول المباريات وكل النتائج.',
        confirmText: 'استبدال',
        danger: true,
      });
      if (!ok) return;
    }
    const existing = new Set(t.teams.map((x) => x.name.trim()));
    const newTeams: Team[] = chosen
      .filter((r) => mode === 'replace' || !existing.has(r.name.trim()))
      .map((r) => ({ id: uid('team'), name: r.name, player1: r.player1, player2: r.player2, group: r.group }));
    apply(
      (x) =>
        withLog(
          mode === 'replace'
            ? { ...x, teams: newTeams, matches: [], groupsLocked: false, tieOverrides: { A: [], B: [] } }
            : { ...x, teams: [...x.teams, ...newTeams] },
          `استيراد ${newTeams.length} فريق من ملف`,
        ),
      'استيراد الفرق',
    );
    toast(`تم استيراد ${newTeams.length} فريق`);
    reset();
    onClose();
    if (!newTeams.every((x) => x.group)) nav('/admin/draw');
  };

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="استيراد الفرق من Excel" wide>
      {!rows && (
        <div className="space-y-4">
          <p className="text-ink/75">
            الأعمدة المتوقعة: <b>اسم الفريق</b>، <b>اللاعب 1</b>، <b>اللاعب 2</b>، و<b>المجموعة</b> (اختياري: A/B أو أ/ب). يدعم ملفات
            ‎.xlsx و ‎.csv.
          </p>
          <label className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-ink/25 p-8 text-center hover:border-accent">
            <span className="text-5xl">📄</span>
            <span className="font-bold">اختر ملف Excel أو CSV</span>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </label>
          <button className="btn btn-ghost" onClick={downloadTemplate}>
            ⬇ تنزيل قالب Excel
          </button>
          {loading && <MarbleLoader label="جارٍ قراءة الملف…" />}
          {error && <p className="font-bold text-loss">{error}</p>}
        </div>
      )}
      {rows && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="chip bg-win text-white">{include.size} سيتم استيرادها</span>
            <span className="chip bg-ink/10">{rows.length} صف في الملف</span>
            {!hasGroup && <span className="chip bg-accent text-on-accent">لا يوجد عمود مجموعة — ستنتقل إلى القرعة</span>}
          </div>
          <div className="scrollbar-thin max-h-[50dvh] overflow-auto rounded-xl border border-ink/10">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface">
                <tr className="text-ink/60">
                  <th className="p-2"></th>
                  <th className="p-2 text-start">#</th>
                  <th className="p-2 text-start">اسم الفريق</th>
                  <th className="p-2 text-start">اللاعب 1</th>
                  <th className="p-2 text-start">اللاعب 2</th>
                  <th className="p-2 text-start">المجموعة</th>
                  <th className="p-2 text-start">ملاحظات</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const bad = r.issues.includes('empty') || r.issues.includes('duplicate');
                  return (
                    <tr key={r.rowNumber} className={`border-t border-ink/10 ${bad ? 'bg-loss/10' : ''}`}>
                      <td className="p-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[var(--primary)]"
                          disabled={r.issues.includes('empty')}
                          checked={include.has(r.rowNumber)}
                          onChange={(e) => {
                            const s = new Set(include);
                            if (e.target.checked) s.add(r.rowNumber);
                            else s.delete(r.rowNumber);
                            setInclude(s);
                          }}
                        />
                      </td>
                      <td className="p-2 text-ink/50">{r.rowNumber}</td>
                      <td className="p-2 font-bold">{r.name || '—'}</td>
                      <td className="p-2">{r.player1}</td>
                      <td className="p-2">{r.player2}</td>
                      <td className="p-2">{r.group ? (r.group === 'A' ? 'أ' : 'ب') : '—'}</td>
                      <td className="p-2">
                        <span className="flex flex-wrap gap-1">
                          {r.issues.map((i) => (
                            <span key={i} className={`chip ${i === 'empty' || i === 'duplicate' ? 'bg-loss text-white' : 'bg-accent text-on-accent'}`}>
                              {ISSUE_TEXT[i]}
                            </span>
                          ))}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2">
              <input type="radio" checked={mode === 'replace'} onChange={() => setMode('replace')} /> استبدال الفرق الحالية
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={mode === 'append'} onChange={() => setMode('append')} /> إضافة إلى الفرق الحالية
            </label>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary flex-1" disabled={!include.size} onClick={doImport}>
              استيراد {include.size} فريق
            </button>
            <button className="btn btn-ghost" onClick={reset}>
              ملف آخر
            </button>
          </div>
          <p className="text-xs text-ink/60">يمكنك تعديل أسماء الفرق واللاعبين بعد الاستيراد من قائمة الفرق.</p>
        </div>
      )}
    </Modal>
  );
}

export default function TeamsPage() {
  const t = useStore((s) => s.t);
  const apply = useStore((s) => s.apply);
  const [editing, setEditing] = useState<Team | null | 'new'>(null);
  const [importOpen, setImportOpen] = useState(false);
  const outdated = scheduleOutdated(t);

  const del = async (team: Team) => {
    const played = t.matches.some((m) => (m.teamA === team.id || m.teamB === team.id) && m.status === 'finished');
    const ok = await confirmDialog({
      title: `حذف فريق «${team.name}»؟`,
      message: played ? 'سيتم حذف مبارياته ونتائجه أيضاً.' : undefined,
      confirmText: 'حذف',
      danger: true,
    });
    if (ok) apply((x) => removeTeam(x, team.id), 'حذف فريق');
  };

  const sections: { key: GroupId | null; title: string }[] = [
    { key: 'A', title: groupLabel('A') },
    { key: 'B', title: groupLabel('B') },
    { key: null, title: 'بدون مجموعة' },
  ];

  return (
    <div>
      <SectionTitle
        rank="A"
        title="الفرق"
        sub={`${t.teams.length} فريق`}
        actions={
          <>
            <button className="btn btn-primary" onClick={() => setEditing('new')}>
              + فريق
            </button>
            <button className="btn btn-accent" onClick={() => setImportOpen(true)}>
              📥 استيراد من Excel
            </button>
            <button className="btn btn-ghost" onClick={downloadTemplate}>
              ⬇ القالب
            </button>
            <Link className="btn btn-ghost" to="/admin/draw">
              🎲 القرعة
            </Link>
          </>
        }
      />
      {outdated && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-accent/20 p-3">
          <span className="flex-1">تغيّرت الفرق أو المجموعات بعد توليد الجدول. أعد توليد الجدول من صفحة المباريات.</span>
          <Link className="btn btn-sm btn-primary" to="/admin/matches">
            المباريات
          </Link>
        </div>
      )}
      {!t.teams.length && (
        <Empty action={<button className="btn btn-accent" onClick={() => setImportOpen(true)}>استيراد من Excel</button>}>
          لا توجد فرق بعد. أضف الفرق يدوياً أو استوردها من ملف.
        </Empty>
      )}
      <div className="space-y-6">
        {sections.map(({ key, title }) => {
          const list = t.teams.filter((x) => x.group === key);
          if (!list.length) return null;
          return (
            <section key={title}>
              <h3 className="mb-2 text-2xl">
                {title} <span className="text-base text-ink/60">({list.length})</span>
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((team) => (
                  <div key={team.id} className="board flex items-center gap-3 p-3">
                    <TeamMarble teams={t.teams} id={team.id} size={42} />
                    <Link to={`/admin/team/${team.id}`} className="min-w-0 flex-1">
                      <div className="truncate font-display text-2xl leading-tight">{team.name}</div>
                      <div className="truncate text-sm text-ink/65">
                        {team.player1 || '—'} · {team.player2 || '—'}
                      </div>
                    </Link>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing(team)} aria-label="تعديل">
                      ✏️
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => del(team)} aria-label="حذف">
                      🗑
                    </button>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'فريق جديد' : 'تعديل الفريق'}>
        {editing && <TeamForm team={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      </Modal>
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
