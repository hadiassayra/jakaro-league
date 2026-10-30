import type * as XLSXTypes from 'xlsx';

type X = typeof XLSXTypes;
const loadXlsx = (): Promise<X> => import('xlsx');
import type { Tournament } from './types';
import { TEMPLATE_HEADERS } from './importTeams';
import { allStandings, teamName } from './tournament';
import { koMatches, koRoundLabel } from './knockout';
import { isFinished } from './standings';

function rtlBook(XLSX: X): XLSXTypes.WorkBook {
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  return wb;
}

function addSheet(XLSX: X, wb: XLSXTypes.WorkBook, name: string, rows: (string | number | null)[][], widths?: number[]) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  if (widths) ws['!cols'] = widths.map((w) => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
}

export async function downloadTemplate() {
  const XLSX = await loadXlsx();
  const wb = rtlBook(XLSX);
  addSheet(
    XLSX,
    wb,
    'الفرق',
    [TEMPLATE_HEADERS, ['الصقور', 'أحمد', 'خالد', 'أ'], ['النمور', 'محمد', 'سعد', 'ب']],
    [24, 18, 18, 10],
  );
  XLSX.writeFile(wb, 'قالب-فرق-جاكرو.xlsx');
}

/** Reads the first sheet of an .xlsx/.csv file as an array of rows */
export async function readSheet(file: File): Promise<unknown[][]> {
  const XLSX = await loadXlsx();
  // CSV: decode as UTF-8 text ourselves so Arabic survives with or without a BOM
  const isCsv = /\.csv$/i.test(file.name) || file.type === 'text/csv';
  const wb = isCsv
    ? XLSX.read((await file.text()).replace(/^﻿/, ''), { type: 'string' })
    : XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: true, defval: '' });
}

const gName = (g: string | undefined | null) => (g === 'A' ? 'أ' : g === 'B' ? 'ب' : '');

export async function exportTournament(t: Tournament) {
  const XLSX = await loadXlsx();
  const wb = rtlBook(XLSX);
  const st = allStandings(t);
  (['A', 'B'] as const).forEach((g) => {
    addSheet(
      XLSX,
      wb,
      `ترتيب المجموعة ${gName(g)}`,
      [
        ['المركز', 'الفريق', 'لعب', 'فاز', 'خسر', 'النقاط', 'نقاط الفرق', 'آخر النتائج'],
        ...st[g].map((r) => [
          r.rank,
          teamName(t, r.teamId),
          r.played,
          r.won,
          r.lost,
          r.points,
          r.marblePoints,
          r.form.map((f) => (f === 'W' ? '✓' : '✗')).join(' '),
        ]),
      ],
      [8, 24, 6, 6, 6, 8, 12, 20],
    );
  });
  const group = t.matches
    .filter((m) => m.stage === 'group')
    .sort((a, b) => a.round - b.round || (a.table ?? 0) - (b.table ?? 0));
  addSheet(
    XLSX,
    wb,
    'مباريات المجموعات',
    [
      ['الجولة', 'المجموعة', 'الطاولة', 'الفريق الأول', 'الفريق الثاني', 'الفائز', 'كرات الخاسر المتبقية', 'الحالة'],
      ...group.map((m) => [
        m.round,
        gName(m.group),
        m.table ?? '',
        teamName(t, m.teamA),
        teamName(t, m.teamB),
        m.winnerId ? teamName(t, m.winnerId) : '',
        m.forfeit ? 'خسارة إدارية بالحمراء' : m.loserMarbles ?? '',
        isFinished(m) ? 'انتهت' : m.status === 'playing' ? 'تُلعب الآن' : 'قادمة',
      ]),
    ],
    [8, 10, 8, 22, 22, 22, 18, 12],
  );
  const ko = koMatches(t.matches);
  if (ko.length) {
    addSheet(
      XLSX,
      wb,
      'الأدوار الإقصائية',
      [
        ['الدور', 'الفريق الأول', 'الفريق الثاني', 'الفائز', 'كرات الخاسر المتبقية'],
        ...ko.map((m) => [
          koRoundLabel(m, ko),
          teamName(t, m.teamA),
          teamName(t, m.teamB),
          m.winnerId ? teamName(t, m.winnerId) : '',
          m.forfeit ? 'خسارة إدارية بالحمراء' : m.loserMarbles ?? '',
        ]),
      ],
      [20, 22, 22, 22, 18],
    );
  }
  addSheet(
    XLSX,
    wb,
    'الفرق',
    [TEMPLATE_HEADERS, ...t.teams.map((tm) => [tm.name, tm.player1, tm.player2, gName(tm.group)])],
    [24, 18, 18, 10],
  );
  addSheet(XLSX, wb, 'البطاقات والعقوبات', [
    ['المباراة', 'الفريق', 'المرحلة', 'الصفراء', 'الحمراء', 'خصم النقاط', 'خسارة مباشرة'],
    ...t.matches.flatMap(m => Object.entries(m.cards ?? {}).filter(([, cards]) => cards.yellow || cards.red).map(([id, cards]) => [
      `${teamName(t, m.teamA)} × ${teamName(t, m.teamB)}`,
      teamName(t, id), m.stage === 'group' ? 'مجموعات' : 'إقصائيات', cards.yellow,
      cards.red ? 'نعم' : '', m.stage === 'group' && cards.yellow >= 2 ? 1 : 0, m.forfeit?.teamId === id ? 'نعم' : '',
    ])),
  ], [45, 24, 14, 10, 10, 14, 16]);
  XLSX.writeFile(wb, `${t.settings.name || 'دوري جاكرو'} - النتائج.xlsx`);
}

export function downloadJson(t: Tournament) {
  const blob = new Blob([JSON.stringify(t, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const d = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  a.download = `jakaro-backup-${d}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
