import type { ThemeColors } from './types';

export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: RGB): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

export function hslToRgb(h: number, s: number, l: number): RGB {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

export function luminance([r, g, b]: RGB): number {
  const f = (v: number) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrast(a: string, b: string): number {
  const la = luminance(hexToRgb(a));
  const lb = luminance(hexToRgb(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Best readable text color (dark ink or white) on a background */
export function onColor(bg: string, dark = '#111111', light = '#ffffff'): string {
  return contrast(bg, dark) >= contrast(bg, light) ? dark : light;
}

function dist(a: RGB, b: RGB) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

export interface PaletteColor {
  hex: string;
  rgb: RGB;
  share: number; // 0..1 of sampled pixels
}

/**
 * Dominant colors from RGBA pixel data: bucket quantization (5 bits/channel),
 * then merge buckets closer than `mergeDistance`.
 */
export function extractPalette(
  pixels: Uint8ClampedArray | number[],
  maxColors = 6,
  step = 4,
  mergeDistance = 48,
): PaletteColor[] {
  const buckets = new Map<number, { r: number; g: number; b: number; n: number }>();
  let total = 0;
  for (let i = 0; i < pixels.length; i += 4 * step) {
    const a = pixels[i + 3];
    if (a < 125) continue;
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const bk = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 };
    bk.r += r;
    bk.g += g;
    bk.b += b;
    bk.n++;
    buckets.set(key, bk);
    total++;
  }
  const sorted = [...buckets.values()]
    .map((b) => ({ rgb: [b.r / b.n, b.g / b.n, b.b / b.n] as RGB, n: b.n }))
    .sort((a, b) => b.n - a.n);
  const merged: { rgb: RGB; n: number }[] = [];
  sorted.forEach((c) => {
    const near = merged.find((m) => dist(m.rgb, c.rgb) < mergeDistance);
    if (near) near.n += c.n;
    else merged.push({ ...c });
  });
  return merged
    .sort((a, b) => b.n - a.n)
    .slice(0, maxColors)
    .map((c) => ({ rgb: c.rgb.map(Math.round) as RGB, hex: rgbToHex(c.rgb), share: total ? c.n / total : 0 }));
}

function hueDistance(a: number, b: number) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** Picks brand primary + accent from a palette */
export function pickBrandColors(palette: PaletteColor[]): { primary: string; accent: string } {
  const info = palette.map((p) => ({ ...p, hsl: rgbToHsl(p.rgb) }));
  const colorful = info.filter((p) => p.hsl[1] >= 0.25 && p.hsl[2] >= 0.12 && p.hsl[2] <= 0.88);
  const primary = colorful[0] ?? info[0];
  if (!primary) return { ...DEFAULT_BRAND };
  const accent =
    colorful.find((p) => p !== primary && hueDistance(p.hsl[0], primary.hsl[0]) >= 40) ??
    colorful.find((p) => p !== primary);
  const accentHex = accent
    ? accent.hex
    : rgbToHex(hslToRgb(primary.hsl[0] + 180, 0.85, 0.55));
  return { primary: primary.hex, accent: accentHex };
}

export const DEFAULT_BRAND = { primary: '#13208f', accent: '#ffde00' };

/** Builds the full theme for light or dark mode from brand colors (+ manual overrides) */
export function buildTheme(
  brand: { primary: string; accent: string },
  dark: boolean,
  overrides: Partial<ThemeColors> = {},
): ThemeColors {
  const [h, s] = rgbToHsl(hexToRgb(brand.primary));
  const sat = Math.min(s, 0.6);
  const auto: ThemeColors = dark
    ? {
        primary: brand.primary,
        accent: brand.accent,
        bg: rgbToHex(hslToRgb(h, sat * 0.55, 0.06)),
        surface: rgbToHex(hslToRgb(h, sat * 0.45, 0.11)),
        text: '#f6efe0',
      }
    : {
        primary: brand.primary,
        accent: brand.accent,
        bg: '#f4f5f7',
        surface: '#ffffff',
        text: rgbToHex(hslToRgb(h, sat * 0.6, 0.13)),
      };
  const clean = Object.fromEntries(Object.entries(overrides).filter(([, v]) => !!v));
  return { ...auto, ...clean };
}

/** A version of `color` readable on `bg` (adjusts lightness until contrast ≥ min) */
export function readableOn(color: string, bg: string, min = 4.5): string {
  if (contrast(color, bg) >= min) return color;
  const [h, s, l] = rgbToHsl(hexToRgb(color));
  const bgDark = luminance(hexToRgb(bg)) < 0.2;
  for (let i = 1; i <= 20; i++) {
    const nl = bgDark ? Math.min(1, l + i * 0.04) : Math.max(0, l - i * 0.04);
    const c = rgbToHex(hslToRgb(h, s, nl));
    if (contrast(c, bg) >= min) return c;
  }
  return bgDark ? '#ffffff' : '#000000';
}

export function themeToCssVars(t: ThemeColors): Record<string, string> {
  return {
    '--primary': t.primary,
    '--accent': t.accent,
    '--bg': t.bg,
    '--surface': t.surface,
    '--text': t.text,
    '--on-primary': onColor(t.primary),
    '--on-accent': onColor(t.accent),
    '--primary-ink': readableOn(t.primary, t.surface),
    '--accent-ink': readableOn(t.accent, t.surface, 3),
  };
}
