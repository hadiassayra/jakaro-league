import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useViewTournament } from '../sync/useSync';
import { useTheme } from '../components/useTheme';
import { MatchCard, useNow } from '../components/MatchCard';
import { Logo } from '../components/Logo';
import { Empty, MarbleLoader } from '../components/ui';
import { isFinished } from '../lib/standings';
import { matchDay, matchDayRound } from '../lib/playDay';
import type { Match } from '../lib/types';
import { BackButton } from '../components/BackButton';

export default function MatchDisplayPage() {
  const { t, remote, status } = useViewTournament();
  useTheme(t?.settings);
  const [tab, setTab] = useState<'playing' | 'upcoming' | 'results'>('playing');
  const [fullscreenError, setFullscreenError] = useState('');
  const now = useNow(1000);
  if (!t) return <div className="board-bg grid min-h-dvh place-items-center"><MarbleLoader label={status === 'error' ? 'تعذّر الاتصال بالبطولة' : 'جارٍ تحميل المباريات…'} /></div>;
  const ready = t.matches.filter(m => m.teamA && m.teamB && !isFinished(m));
  const playing = ready.filter(m => m.status === 'playing');
  const results = t.matches.filter(isFinished).sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0));
  const upcoming = ready.filter(m => m.status === 'upcoming').sort((a, b) => {
    const dayOrder = (matchDay(a) ?? '9999').localeCompare(matchDay(b) ?? '9999');
    return dayOrder || matchDayRound(a) - matchDayRound(b) || (a.scheduledAt ?? Infinity) - (b.scheduledAt ?? Infinity) || a.round - b.round;
  });
  const groups = new Map<string, { title: string; matches: Match[] }>();
  for (const m of tab === 'playing' ? playing : tab === 'results' ? results : upcoming) {
    const day = matchDay(m) ?? (tab === 'results' && m.finishedAt ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Hebron' }).format(m.finishedAt) : null);
    const slot = m.stage === 'group' && day ? matchDayRound(m) : null;
    const key = `${day ?? 'unscheduled'}-${slot ?? 'ko'}`;
    if (!groups.has(key)) {
      const date = day ? new Date(day + 'T12:00:00Z').toLocaleDateString('ar-PS', { timeZone: 'Asia/Hebron', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'لم يُحدد يوم اللعب';
      groups.set(key, { title: `${date}${slot ? ` · ${slot === 1 ? 'الجولة الأولى' : 'الجولة الثانية'}` : ''}`, matches: [] });
    }
    groups.get(key)!.matches.push(m);
  }
  const query = window.location.hash.split('?')[1];
  const fullScreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
      setFullscreenError('');
    } catch { setFullscreenError('تعذّر فتح ملء الشاشة. يمكنك تكبير نافذة المتصفح.'); }
  };
  return <div className="board-bg min-h-dvh pb-12">
    <header className="border-b border-ink/10 bg-surface">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-5 py-5">
        <BackButton />
        <Logo src={t.settings.logo} className="h-12 w-auto max-w-24 rounded-lg" />
        <div className="flex-1"><p className="text-xs font-bold tracking-widest text-primary-ink">مركز المباريات</p><h1 className="text-3xl sm:text-4xl">{t.settings.name}</h1></div>
        <div className="text-end"><p className="text-2xl font-bold tabular-nums" dir="ltr">{new Date(now).toLocaleTimeString('en-GB', { timeZone: 'Asia/Hebron', hour: '2-digit', minute: '2-digit' })}</p><p className="text-xs text-ink/50">توقيت فلسطين</p></div>
        <button className="btn btn-ghost btn-sm" onClick={fullScreen}>⛶ ملء الشاشة</button>
        <Link className="btn btn-ghost btn-sm" to={`/live${query ? `?${query}` : ''}`}>الترتيب والنتائج</Link>
      </div>
      <nav className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-5" aria-label="عرض المباريات">
        {([['playing', 'مباشر الآن', playing.length], ['upcoming', 'المباريات القادمة', upcoming.length], ['results', 'عرض النتائج', results.length]] as const).map(([key, label, count]) => <button key={key} aria-pressed={tab === key} onClick={() => setTab(key)} className={`flex shrink-0 items-center gap-3 border-b-2 px-4 py-4 text-sm font-bold sm:text-lg ${tab === key ? 'border-primary-ink text-primary-ink' : 'border-transparent text-ink/50'}`}>
          {key === 'playing' && <span className="live-dot h-2 w-2 rounded-full bg-loss" />}{label}<span className="chip bg-ink/10 text-xs">{count}</span>
        </button>)}
      </nav>
    </header>
    <main className="mx-auto max-w-7xl space-y-8 px-5 py-7">
      {remote && status !== 'live' && <p role="status" className="rounded-xl bg-accent/15 p-3 text-sm">{status === 'error' ? 'انقطع الاتصال. جارٍ عرض آخر بيانات وصلت.' : 'جارٍ الاتصال لتحديث المباريات…'}</p>}
      {fullscreenError && <p role="status" className="text-sm text-ink/60">{fullscreenError}</p>}
      {tab === 'results' && <div className="rounded-2xl border border-ink/10 bg-surface p-5"><h2 className="text-3xl">نتائج المباريات</h2><p className="mt-2 text-sm text-ink/60">{results.length} مباراة منتهية · الأحدث أولاً. الفائز مميّز، وتظهر كرات الخاسر المتبقية أسفل كل مواجهة.</p></div>}
      {groups.size ? [...groups].map(([key, group]) => <section key={key}>
        <div className="mb-4 flex items-center gap-4"><h2 className="text-xl sm:text-2xl">{group.title}</h2><span className="h-px flex-1 bg-ink/10" /></div>
        <div className="grid gap-5 lg:grid-cols-2">{group.matches.map(m => <MatchCard key={m.id} t={t} m={m} big showRound />)}</div>
      </section>) : <div className="py-16"><Empty>{tab === 'playing' ? 'لا توجد مباريات بدأت حالياً. تظهر المباراة هنا فور تشغيلها من لوحة الإدارة.' : tab === 'results' ? 'لم تُسجّل نتائج بعد. ستظهر هنا عند انتهاء المباريات وتسجيل نتائجها.' : 'لا توجد مباريات قادمة حالياً.'}</Empty></div>}
    </main>
  </div>;
}
