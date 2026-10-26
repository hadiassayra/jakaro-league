const formatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Hebron', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function palestineDateTime(at: number): string {
  return formatter.format(at).replace(' ', 'T');
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
