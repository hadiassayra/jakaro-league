import { useState } from 'react';
import { useStore } from '../store/useStore';
import { dayImageMatches, downloadDayImage } from '../lib/dayImage';
import { Modal } from './ui';
import { toast } from '../store/ui';

export function DayImageButton({ day }: { day: string }) {
  const [open, setOpen] = useState(false);
  return <><button className="btn btn-primary" onClick={() => setOpen(true)}>🖼 تنزيل صورة مباريات اليوم</button>{open && <DayImageModal initialDay={day} onClose={() => setOpen(false)} />}</>;
}

function DayImageModal({ initialDay, onClose }: { initialDay: string; onClose: () => void }) {
  const t = useStore(s => s.t);
  const [day, setDay] = useState(initialDay), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const count = dayImageMatches(t, day).length;
  return <Modal open onClose={() => { if (!busy) onClose(); }} title="صورة مباريات اليوم">
    <form className="space-y-4" onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError('');
      try { await downloadDayImage(t, day); toast('تم تجهيز صورة مباريات اليوم للتنزيل'); onClose(); }
      catch (e) { setError((e as Error).message); }
      finally { setBusy(false); }
    }}>
      <label className="block text-sm font-bold">اختر اليوم<input type="date" required className="input mt-2" value={day} disabled={busy} onChange={e => setDay(e.target.value)} /></label>
      <p className="rounded-xl bg-ink/5 p-3 text-sm">{count ? `${count} مباراة من كل المجموعات والجولات في صورة PNG واحدة، مع الشعارات والمواعيد وحالة المباراة.` : 'لا توجد مباريات محددة لهذا اليوم.'}</p>
      <p className="text-xs text-ink/60">تشمل الصورة كل مباريات التاريخ المختار، بغض النظر عن فلاتر الشاشة أو الأيام الظاهرة للجمهور.</p>
      {error && <p role="alert" className="text-sm text-loss">{error}</p>}
      <div className="flex gap-2"><button className="btn btn-primary" disabled={busy || !count}>{busy ? 'جارٍ تجهيز الصورة…' : 'تنزيل الصورة'}</button><button type="button" disabled={busy} className="btn btn-ghost" onClick={onClose}>إلغاء</button></div>
    </form>
  </Modal>;
}
