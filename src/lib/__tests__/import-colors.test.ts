import { describe, expect, it } from 'vitest';
import { drawGroups, importableRows, parseGroup, parseTeamRows } from '../importTeams';
import { buildTheme, contrast, extractPalette, hexToRgb, pickBrandColors, readableOn, rgbToHex } from '../colors';
import { seededRandom } from '../id';

describe('team import parsing', () => {
  it('reads Arabic headers, groups and flags problems', () => {
    const res = parseTeamRows([
      ['اسم الفريق', 'اللاعب 1', 'اللاعب 2', 'المجموعة'],
      ['الصقور', 'أحمد', 'خالد', 'أ'],
      ['النمور', 'محمد', 'سعد', 'B'],
      ['', '', '', ''],
      ['الصقور ', 'x', 'y', 'ب'],
      ['البرق', 'سلطان', '', 'Z'],
    ]);
    expect(res.headerFound).toBe(true);
    expect(res.hasGroupColumn).toBe(true);
    expect(res.rows.map((r) => r.group)).toEqual(['A', 'B', null, 'B', null]);
    expect(res.rows[2].issues).toContain('empty');
    expect(res.rows[3].issues).toContain('duplicate');
    expect(res.rows[4].issues).toEqual(expect.arrayContaining(['missingPlayers', 'badGroup']));
    expect(importableRows(res.rows).map((r) => r.name)).toEqual(['الصقور', 'النمور', 'البرق']);
  });

  it('accepts English headers and no group column', () => {
    const res = parseTeamRows([
      ['Team Name', 'Player 1', 'Player 2'],
      ['Eagles', 'A', 'B'],
    ]);
    expect(res.hasGroupColumn).toBe(false);
    expect(res.rows[0]).toMatchObject({ name: 'Eagles', player1: 'A', player2: 'B', group: null });
  });

  it('falls back to column order with no header', () => {
    const res = parseTeamRows([['الفهود', 'a', 'b']]);
    expect(res.headerFound).toBe(false);
    expect(res.rows[0].name).toBe('الفهود');
  });

  it('parses group values', () => {
    expect(['A', 'a', 'أ', 'ا', 'ب', 'b', '', 'x'].map(parseGroup)).toEqual(['A', 'A', 'A', 'A', 'B', 'B', null, 'bad']);
  });

  it('draws balanced groups', () => {
    const g = drawGroups([1, 2, 3, 4, 5, 6, 7], seededRandom(1));
    expect(g.A.length).toBe(4);
    expect(g.B.length).toBe(3);
    expect([...g.A, ...g.B].sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});

describe('logo colors and theme', () => {
  const fill = (colors: [string, number][]) => {
    const px: number[] = [];
    colors.forEach(([hex, n]) => {
      const [r, g, b] = hexToRgb(hex);
      for (let i = 0; i < n; i++) px.push(r, g, b, 255);
    });
    return px;
  };

  it('extracts dominant colors and picks brand colors (logo: blue, yellow, white)', () => {
    const px = fill([
      ['#13208f', 7000],
      ['#ffde00', 1500],
      ['#ffffff', 1500],
    ]);
    const pal = extractPalette(px, 6, 1);
    expect(pal[0].hex).toBe('#13208f');
    expect(pal).toHaveLength(3);
    expect(pickBrandColors(pal)).toEqual({ primary: '#13208f', accent: '#ffde00' });
  });

  it('ignores transparent pixels', () => {
    const px = [0, 0, 0, 0, 0, 0, 0, 0, 255, 0, 0, 255];
    expect(extractPalette(px, 3, 1).map((p) => p.hex)).toEqual(['#ff0000']);
  });

  it('builds readable light/dark themes and honors overrides', () => {
    const brand = { primary: '#13208f', accent: '#ffde00' };
    const dark = buildTheme(brand, true);
    const light = buildTheme(brand, false);
    expect(contrast(dark.text, dark.bg)).toBeGreaterThan(7);
    expect(contrast(light.text, light.bg)).toBeGreaterThan(7);
    expect(buildTheme(brand, true, { bg: '#000000' }).bg).toBe('#000000');
    expect(contrast(readableOn('#13208f', dark.surface), dark.surface)).toBeGreaterThanOrEqual(4.5);
    expect(rgbToHex([255, 222, 0])).toBe('#ffde00');
  });
});
