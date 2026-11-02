import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GroupId, Team } from '../lib/types';
import { drawRevealOrder } from '../lib/drawReveal';
import { playDrop, playFanfare } from '../lib/sound';
import { useViewTournament } from '../sync/useSync';
import { useTheme } from '../components/useTheme';
import { BrandLogos } from '../components/BrandLogos';
import { BackButton } from '../components/BackButton';
import { MarbleLoader, TeamMarble } from '../components/ui';

export default function DrawShowPage() {
  const { t, remote, status } = useViewTournament();
  useTheme(t?.settings);
  const reducedMotion = useReducedMotion();
  const [order, setOrder] = useState<Team[]>([]);
  const [revealed, setRevealed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [delay, setDelay] = useState(2500);
  const [notice, setNotice] = useState('');
  const [startedSignature, setStartedSignature] = useState('');
  const autoStarted = useRef(false);
  const celebrated = useRef(false);
  const aList = useRef<HTMLDivElement>(null), bList = useRef<HTMLDivElement>(null);
  const signature = JSON.stringify(t?.teams ?? []);
  const valid = !!t?.teams.length && t.teams.every(team => team.group === 'A' || team.group === 'B');
  const connected = !remote || status === 'live';
  const start = useCallback(() => {
    if (!t || !connected) return;
    try {
      setOrder(drawRevealOrder(t.teams)); setRevealed(0); setPlaying(true); setNotice('');
      setStartedSignature(JSON.stringify(t.teams)); celebrated.current = false;
      if (aList.current) aList.current.scrollTop = 0;
      if (bList.current) bList.current.scrollTop = 0;
    } catch (e) { setNotice((e as Error).message); }
  }, [t, connected]);

  useEffect(() => {
    if (valid && connected && !autoStarted.current && new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('autostart') === '1') {
      autoStarted.current = true; start();
    }
  }, [valid, connected, start]);
  useEffect(() => {
    if (startedSignature && signature !== startedSignature) {
      setPlaying(false); setOrder([]); setRevealed(0); setStartedSignature('');
      setNotice('تم تغيير توزيع الفرق. شغّل العرض من جديد لعرض النسخة المعتمدة الحالية.');
    }
  }, [signature, startedSignature]);
  useEffect(() => {
    if (!playing || !order.length || revealed >= order.length) return;
    const timer = window.setTimeout(() => setRevealed(n => Math.min(n + 1, order.length)), delay);
    return () => clearTimeout(timer);
  }, [playing, revealed, order.length, delay]);
  useEffect(() => {
    if (!revealed || !order.length) return;
    playDrop();
    const list = order[revealed - 1]?.group === 'A' ? aList.current : bList.current;
    list?.scrollTo({ top: list.scrollHeight, behavior: reducedMotion ? 'auto' : 'smooth' });
    if (revealed === order.length && !celebrated.current) { celebrated.current = true; setPlaying(false); playFanfare(); }
  }, [revealed, order, reducedMotion]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('button, input, select, a')) return;
      if (event.key === ' ' && order.length && revealed < order.length) { event.preventDefault(); setPlaying(value => !value); }
      if (event.key === 'ArrowLeft' && order.length && revealed < order.length) { setPlaying(false); setRevealed(n => Math.min(n + 1, order.length)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [order.length, revealed]);

  if (!t) return <div className="board-bg grid min-h-dvh place-items-center"><MarbleLoader label={status === 'error' ? 'تعذّر الاتصال بالبطولة' : 'جارٍ تحميل القرعة…'} /></div>;
  const current = order[revealed - 1];
  const finished = order.length > 0 && revealed === order.length;
  const shown = order.slice(0, revealed);
  const fullscreen = async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
    catch { setNotice('تعذّر فتح ملء الشاشة. يمكنك تكبير نافذة المتصفح.'); }
  };
  const group = (id: GroupId) => {
    const list = shown.filter(team => team.group === id);
    const total = (order.length ? order : t.teams).filter(team => team.group === id).length;
    return <section className={`board min-w-0 overflow-hidden border-t-4 ${id === 'A' ? 'border-t-m-red' : 'border-t-m-blue'}`}>
      <div className="flex items-center justify-between gap-2 border-b border-ink/10 p-4">
        <h2 className="text-2xl sm:text-3xl">المجموعة {id === 'A' ? 'أ' : 'ب'}</h2><span className="chip bg-ink/10">{list.length} / {total}</span>
      </div>
      <div ref={id === 'A' ? aList : bList} className="presentation-scroll max-h-[calc(100dvh-16rem)] min-h-48 space-y-2 overflow-y-auto p-3" tabIndex={0} role="region" aria-label={`فرق المجموعة ${id === 'A' ? 'أ' : 'ب'}`}>
        {list.map((team, i) => <motion.div key={team.id} initial={reducedMotion ? false : { opacity: 0, x: id === 'A' ? 25 : -25 }} animate={{ opacity: 1, x: 0 }} className={`flex items-center gap-2 rounded-xl p-2 ${team.id === current?.id ? 'bg-accent/15 ring-1 ring-accent/50' : 'bg-ink/5'}`}>
          <span className="w-5 shrink-0 text-center text-xs text-ink/40">{i + 1}</span><TeamMarble teams={t.teams} id={team.id} size={28} /><span className="min-w-0 break-words text-sm font-bold sm:text-base">{team.name}</span>
        </motion.div>)}
        {!list.length && <p className="py-12 text-center text-sm text-ink/40">بانتظار كشف الفرق</p>}
      </div>
    </section>;
  };
  return <div className="board-bg min-h-dvh pb-24">
    <header className="border-b border-ink/10 bg-surface/95">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4"><BackButton /><BrandLogos src={t.settings.logo} /><span className="font-display text-xl sm:text-2xl">{t.settings.name}</span><button className="btn btn-ghost btn-sm" onClick={fullscreen}>⛶ ملء الشاشة</button></div>
    </header>
    <div className="mx-auto max-w-7xl px-4 py-5">
      <div className="mb-5 text-center"><h1 className="text-3xl sm:text-5xl">قرعة المجموعات</h1><p className="mt-2 text-sm text-ink/60">عرض التوزيع المعتمد حسب توافق أيام الفرق — ترتيب الكشف فقط يتغيّر.</p></div>
      {notice && <p role="status" className="mb-4 rounded-xl bg-accent/15 p-3 text-center text-sm">{notice}</p>}
      {!valid && <p className="mb-4 rounded-xl bg-accent/15 p-3 text-center">لم يُعتمد توزيع كل الفرق بعد.</p>}
      <main className="grid grid-cols-2 items-start gap-3 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,.8fr)_minmax(0,1fr)]">
        {group('A')}
        <section className="order-first col-span-2 flex min-h-64 flex-col items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 p-6 text-center lg:order-none lg:col-span-1 lg:mt-12" aria-live="polite" aria-atomic="true">
          <AnimatePresence mode="wait"><motion.div key={current?.id ?? 'ready'} initial={reducedMotion ? false : { opacity: 0, scale: .85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex w-full flex-col items-center gap-4">
            {current ? <><TeamMarble teams={t.teams} id={current.id} size={76} /><h2 className="break-words font-display text-3xl sm:text-4xl">{current.name}</h2><span className={`rounded-full px-5 py-2 font-bold text-white ${current.group === 'A' ? 'bg-m-red' : 'bg-m-blue'}`}>المجموعة {current.group === 'A' ? 'أ' : 'ب'}</span></> : <><span className="text-5xl" aria-hidden="true">🎲</span><h2 className="text-3xl">جاهزون للقرعة؟</h2><p className="text-sm text-ink/60">تظهر الفرق واحداً تلو الآخر في مجموعاتها.</p></>}
          </motion.div></AnimatePresence>
          <p className="mt-6 text-sm font-bold text-ink/65">{finished ? '✓ اكتمل عرض المجموعات' : order.length ? `تم كشف ${revealed} من ${order.length} فريق` : `${t.teams.length} فريق`}</p>
          {order.length > 0 && <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-ink/10"><div className="h-full bg-accent transition-all" style={{ width: `${revealed / order.length * 100}%` }} /></div>}
        </section>
        {group('B')}
      </main>
    </div>
    <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/10 bg-surface/95 p-3 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-2">
        {!order.length || finished ? <button className="btn btn-accent" disabled={!valid || !connected} onClick={start}>{finished ? '↻ إعادة عرض القرعة' : '▶ ابدأ عرض القرعة'}</button> : <><button className="btn btn-accent" onClick={() => setPlaying(v => !v)}>{playing ? '⏸ إيقاف مؤقت' : '▶ متابعة'}</button><button className="btn btn-ghost" onClick={() => { setPlaying(false); setRevealed(n => Math.min(n + 1, order.length)); }}>الفريق التالي ←</button></>}
        <label className="flex items-center gap-2 text-sm text-ink/70">السرعة<select className="input w-auto py-1" value={delay} onChange={e => setDelay(Number(e.target.value))}><option value={1500}>سريع</option><option value={2500}>عادي</option><option value={4000}>بطيء</option></select></label>
      </div>
    </footer>
  </div>;
}
