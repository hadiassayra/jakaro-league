import { useEffect } from 'react';
import type { Settings } from '../lib/types';
import { buildTheme, themeToCssVars } from '../lib/colors';
import { setSoundEnabled } from '../lib/sound';

export function applyTheme(settings: Settings, el: HTMLElement = document.documentElement) {
  const theme = buildTheme(settings.palette, settings.dark, settings.overrides);
  Object.entries(themeToCssVars(theme)).forEach(([k, v]) => el.style.setProperty(k, v));
  if (el === document.documentElement) {
    el.classList.toggle('dark', settings.dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.primary);
  }
}

export function useTheme(settings: Settings | undefined) {
  useEffect(() => {
    if (!settings) return;
    applyTheme(settings);
    setSoundEnabled(settings.sound);
    document.title = settings.name || 'دوري جاكرو';
  }, [settings]);
}
