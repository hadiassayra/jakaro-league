import type { Match, Tournament } from './types';
import { matchDay, matchDayRound } from './playDay';
import { formatMatchTime } from './matchTime';
import { isFinished } from './standings';
import fictionLogo from '../assets/brand/fiction-badge.png';
import tmaxLogo from '../assets/brand/tmax-energy-drink.svg';

export function dayImageMatches(t: Tournament, day: string): Match[] {
  return t.matches.filter(m => matchDay(m) === day).sort((a, b) =>
    Number(a.stage === 'knockout') - Number(b.stage === 'knockout') ||
    matchDayRound(a) - matchDayRound(b) || (a.scheduledAt ?? Infinity) - (b.scheduledAt ?? Infinity) ||
    (a.table ?? Infinity) - (b.table ?? Infinity) || a.id.localeCompare(b.id));
}

function loadImage(src: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise(resolve => {
    const img = new Image();
    const timer = window.setTimeout(() => finish(null), 8000);
    const finish = (value: HTMLImageElement | null) => { clearTimeout(timer); img.onload = null; img.onerror = null; resolve(value); };
    img.crossOrigin = 'anonymous';
    img.onload = () => finish(img.naturalWidth ? img : null);
    img.onerror = () => finish(null);
    img.src = src;
  });
}

export async function downloadDayImage(t: Tournament, day: string): Promise<void> {
  const matches = dayImageMatches(t, day);
  if (!matches.length) throw new Error('لا توجد مباريات في هذا اليوم.');
  await Promise.race([document.fonts.load('700 28px Cairo').catch(() => []), new Promise(resolve => setTimeout(resolve, 4000))]);
  const ids = new Set(matches.flatMap(m => [m.teamA, m.teamB]));
  const teams = t.teams.filter(team => ids.has(team.id));
  const [brand, fallback, partner, ...teamImages] = await Promise.all([
    loadImage(t.settings.logo), loadImage(fictionLogo), loadImage(tmaxLogo), ...teams.map(team => loadImage(team.logo)),
  ]);
  const logos = new Map(teams.map((team, i) => [team.id, teamImages[i]]));
  // Keep long tournament days within browser canvas limits; every match stays in one PNG.
  const columns = Math.ceil(matches.length / 32);
  const perColumn = Math.ceil(matches.length / columns);
  const width = 1080 * columns, height = 370 + perColumn * 190 + 80;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('تعذّر إنشاء الصورة في هذا المتصفح.');
  const text = (value: string, x: number, y: number, size = 24, color = '#182449', align: CanvasTextAlign = 'center', maxWidth?: number) => {
    ctx.direction = 'rtl'; ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.font = `700 ${size}px Cairo, Arial, sans-serif`; ctx.fillStyle = color;
    if (maxWidth) ctx.fillText(value, x, y, maxWidth); else ctx.fillText(value, x, y);
  };
  const image = (img: HTMLImageElement | null | undefined, x: number, y: number, w: number, h: number) => {
    if (!img) return;
    const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
    const iw = img.naturalWidth * scale, ih = img.naturalHeight * scale;
    ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  };
  const wrapName = (value: string, x: number, y: number, align: CanvasTextAlign) => {
    ctx.font = '700 27px Cairo, Arial, sans-serif';
    const words = value.split(/\s+/), lines: string[] = []; let line = '';
    for (const word of words) {
      if (line && ctx.measureText(`${line} ${word}`).width > 295) { lines.push(line); line = word; }
      else line = line ? `${line} ${word}` : word;
    }
    if (line) lines.push(line);
    lines.forEach((line, i) => text(line, x, y + (i - (lines.length - 1) / 2) * Math.min(32, 80 / lines.length), lines.length > 3 ? 20 : 27, '#182449', align, 295));
  };
  ctx.fillStyle = '#edf1f8'; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#10208e'; ctx.fillRect(0, 0, width, 14);
  image(brand ?? fallback, width / 2 + 28, 40, 320, 112);
  image(partner, width / 2 - 210, 42, 160, 108);
  text(t.settings.name, width / 2, 192, 38, '#10208e', 'center', width - 100);
  text('مباريات اليوم', width / 2, 246, 33);
  text(new Date(`${day}T12:00:00Z`).toLocaleDateString('ar-PS', { timeZone: 'Asia/Hebron', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), width / 2, 300, 26);
  text(`${matches.length} مباراة · جميع المواعيد بتوقيت فلسطين`, width / 2, 341, 19, '#66718b');
  matches.forEach((m, i) => {
    const column = Math.floor(i / perColumn), row = i % perColumn;
    const x = width - (column + 1) * 1080 + 32, y = 380 + row * 190, w = 1016;
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect(x, y, w, 174, 20); ctx.fill();
    ctx.fillStyle = m.group === 'A' ? '#de4556' : '#365ad6'; ctx.fillRect(x + w - 7, y + 20, 7, 134);
    const meta = m.stage === 'group' ? `المجموعة ${m.group === 'A' ? 'أ' : 'ب'} · الجولة ${matchDayRound(m) === 1 ? 'الأولى' : 'الثانية'}` : 'الأدوار الإقصائية';
    text(`${meta}${m.table ? ` · طاولة ${m.table}` : ''}`, x + w - 26, y + 24, 17, '#66718b', 'right');
    const team = (id: string | null, right: boolean) => {
      const info = t.teams.find(team => team.id === id), logo = id ? logos.get(id) : null;
      const lx = right ? x + w - 105 : x + 22;
      if (logo) image(logo, lx, y + 53, 78, 78);
      else { ctx.fillStyle = right ? '#10208e' : '#e5b827'; ctx.beginPath(); ctx.arc(lx + 39, y + 92, 34, 0, Math.PI * 2); ctx.fill(); text(info?.name.slice(0, 1) ?? '؟', lx + 39, y + 92, 30, right ? '#ffffff' : '#182449'); }
      wrapName(info?.name ?? 'لم يُحدد الفريق', right ? x + w - 124 : x + 124, y + 92, right ? 'right' : 'left');
      const cards = id ? m.cards?.[id] : undefined;
      const status = [isFinished(m) && m.winnerId === id ? 'الفائز' : '', cards?.yellow ? `${cards.yellow} صفراء` : '', cards?.red ? 'حمراء' : ''].filter(Boolean).join(' · ');
      if (status) text(status, right ? x + w - 124 : x + 124, y + 149, 16, cards?.red ? '#bb3145' : '#66718b', right ? 'right' : 'left', 295);
    };
    team(m.teamA, true); team(m.teamB, false);
    text(m.scheduledAt ? formatMatchTime(m.scheduledAt) : 'الوقت لاحقاً', x + w / 2, y + 58, 23, '#10208e');
    text('×', x + w / 2, y + 94, 26, '#66718b');
    text(isFinished(m) ? 'انتهت' : m.status === 'playing' ? 'تُلعب الآن' : 'قادمة', x + w / 2, y + 132, 17, m.status === 'playing' ? '#bb3145' : '#66718b');
    if (isFinished(m)) text(`كرات الخاسر: ${m.loserMarbles ?? 0}`, x + w / 2, y + 155, 13, '#66718b');
  });
  text('جدول مباريات اليوم', width / 2, height - 30, 18, '#66718b');
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('تعذّر حفظ الصورة.')), 'image/png'));
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = `jakaro-matches-${day}.png`;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
