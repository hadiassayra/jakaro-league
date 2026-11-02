import { timeFrom12 } from '../lib/matchTime';

/** Keep the saved HH:mm value while exposing explicit 12-hour controls on every device. */
export function Time12Input({ value, onChange, disabled = false, required = false, label = 'الوقت' }: {
  value: string; onChange: (value: string) => void; disabled?: boolean; required?: boolean; label?: string;
}) {
  const [hour24, minute = 0] = value ? value.split(':').map(Number) : [12, 0];
  const hour = hour24 % 12 || 12, period = hour24 < 12 ? 'AM' : 'PM';
  const update = (h = hour, m = minute, p = period) => onChange(timeFrom12(h, m, p as 'AM' | 'PM'));
  return <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label={label}>
    <div className="grid min-w-0 flex-1 grid-cols-[1fr_auto_1fr_1fr] items-center gap-1" dir="ltr">
      <select className="input min-w-0 px-1 text-center" aria-label={`${label} — الساعة`} value={value ? hour : ''} disabled={disabled} required={required} onChange={e => update(Number(e.target.value))}><option value="" disabled>--</option>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select>
      <span aria-hidden="true">:</span>
      <select className="input min-w-0 px-1 text-center" aria-label={`${label} — الدقائق`} value={minute} disabled={disabled} onChange={e => update(hour, Number(e.target.value))}>{Array.from({ length: 60 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}</option>)}</select>
      <select className="input min-w-0 px-1 text-center" aria-label={`${label} — صباحاً أو مساءً`} value={period} disabled={disabled} onChange={e => update(hour, minute, e.target.value)}><option value="AM">ص</option><option value="PM">م</option></select>
    </div>
    {!required && value && <button type="button" className="btn btn-ghost btn-sm" disabled={disabled} onClick={() => onChange('')}>مسح</button>}
  </div>;
}
