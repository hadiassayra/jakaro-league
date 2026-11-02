const formatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Hebron', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function palestineDateTime(at: number): string {
  return formatter.format(at).replace(' ', 'T');
}

export function formatTime12(time: string): string {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return '';
  const [hour, minute] = time.split(':').map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'ص' : 'م'}`;
}

export function formatMatchTime(at: number): string {
  return formatTime12(palestineDateTime(at).slice(11));
}

export function timeFrom12(hour: number, minute: number, period: 'AM' | 'PM'): string {
  return `${String(hour % 12 + (period === 'PM' ? 12 : 0)).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function parseMatchTime(day: string, time: string): number {
  const input = `${day}T${time}`;
  const wall = Date.parse(input + 'Z');
  if (!Number.isFinite(wall)) throw new Error('اختر تاريخاً وساعة صحيحين.');
  let at = wall;
  for (let i = 0; i < 3; i++) at += wall - Date.parse(palestineDateTime(at) + 'Z');
  if (palestineDateTime(at) !== input) throw new Error('هذه الساعة غير متاحة بسبب تغيير التوقيت. اختر ساعة أخرى.');
  return at;
}
