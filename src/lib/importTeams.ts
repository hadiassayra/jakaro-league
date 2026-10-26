import type { GroupId } from './types';

export interface ParsedTeamRow {
  rowNumber: number; // 1-based row in the sheet (header = 1)
  name: string;
  player1: string;
  player2: string;
  group: GroupId | null;
  issues: ('empty' | 'duplicate' | 'missingPlayers' | 'badGroup')[];
}

export interface ParseResult {
  rows: ParsedTeamRow[];
  hasGroupColumn: boolean;
  headerFound: boolean;
}

const norm = (s: unknown) =>
  String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/[ً-ْ]/g, '') // Arabic diacritics
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[_\-.]/g, ' ')
    .replace(/\s+/g, ' ');

const HEADERS = {
  name: ['اسم الفريق', 'الفريق', 'فريق', 'اسم', 'team', 'team name', 'name'],
  player1: ['اللاعب 1', 'اللاعب1', 'لاعب 1', 'اللاعب الاول', 'player 1', 'player1', 'p1'],
  player2: ['اللاعب 2', 'اللاعب2', 'لاعب 2', 'اللاعب الثاني', 'player 2', 'player2', 'p2'],
  group: ['المجموعه', 'مجموعه', 'group', 'grp'],
};

export const TEMPLATE_HEADERS = ['اسم الفريق', 'اللاعب 1', 'اللاعب 2', 'المجموعة'];

export function parseGroup(v: unknown): GroupId | null | 'bad' {
  const s = norm(v);
  if (!s) return null;
  if (['a', 'ا', '1', 'المجموعه ا', 'مجموعه ا', 'group a'].includes(s)) return 'A';
  if (['b', 'ب', '2', 'المجموعه ب', 'مجموعه ب', 'group b'].includes(s)) return 'B';
  return 'bad';
}

function findCol(header: string[], keys: string[]): number {
  const normKeys = keys.map(norm);
  return header.findIndex((h) => normKeys.includes(h));
}

/**
 * Turns raw sheet rows (array of arrays, first row = headers) into team rows.
 * If no known header is found, columns are assumed in template order.
 */
export function parseTeamRows(raw: unknown[][]): ParseResult {
  if (!raw.length) return { rows: [], hasGroupColumn: false, headerFound: false };
  const header = (raw[0] ?? []).map(norm);
  let cols = {
    name: findCol(header, HEADERS.name),
    player1: findCol(header, HEADERS.player1),
    player2: findCol(header, HEADERS.player2),
    group: findCol(header, HEADERS.group),
  };
  const headerFound = cols.name !== -1;
  let body = raw.slice(1);
  if (!headerFound) {
    cols = { name: 0, player1: 1, player2: 2, group: raw[0].length > 3 ? 3 : -1 };
    body = raw;
  }
  const hasGroupColumn = cols.group !== -1;
  const seen = new Map<string, number>();
  const rows: ParsedTeamRow[] = body.map((r, i) => {
    const get = (c: number) => (c === -1 ? '' : String(r?.[c] ?? '').trim());
    const name = get(cols.name);
    const player1 = get(cols.player1);
    const player2 = get(cols.player2);
    const g = hasGroupColumn ? parseGroup(r?.[cols.group]) : null;
    const issues: ParsedTeamRow['issues'] = [];
    if (!name && !player1 && !player2) issues.push('empty');
    else {
      const key = norm(name);
      if (!name) issues.push('empty');
      else if (seen.has(key)) issues.push('duplicate');
      else seen.set(key, i);
      if (!player1 || !player2) issues.push('missingPlayers');
      if (g === 'bad') issues.push('badGroup');
    }
    return {
      rowNumber: i + (headerFound ? 2 : 1),
      name,
      player1,
      player2,
      group: g === 'bad' ? null : g,
      issues,
    };
  });
  return { rows, hasGroupColumn, headerFound };
}

/** Rows that should be imported by default (not empty, not duplicate) */
export function importableRows(rows: ParsedTeamRow[]): ParsedTeamRow[] {
  return rows.filter((r) => !r.issues.includes('empty') && !r.issues.includes('duplicate'));
}

/** Random balanced split into two groups */
export function drawGroups<T>(items: T[], rand: () => number = Math.random): { A: T[]; B: T[] } {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return { A: a.filter((_, i) => i % 2 === 0), B: a.filter((_, i) => i % 2 === 1) };
}
