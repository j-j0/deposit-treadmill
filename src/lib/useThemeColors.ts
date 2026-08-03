import { useEffect, useState } from 'react';

/**
 * Resolve palette roles to concrete hex values.
 *
 * SVG presentation attributes do not resolve `var()`, so Recharts and the canvas
 * share card both need real colours. Reading them back off the document keeps
 * one source of truth in app.css rather than a second copy of the palette in JS,
 * and picks up both the OS setting and the data-theme override.
 */

const ROLES = [
  'series-savings',
  'series-target',
  'text-primary',
  'text-secondary',
  'text-muted',
  'grid',
  'axis',
  'surface-1',
  'surface-2',
  'page',
  'status-good-text',
  'status-critical-text',
] as const;

export type ThemeRole = (typeof ROLES)[number];
export type ThemeColors = Record<ThemeRole, string>;

const FALLBACK: ThemeColors = {
  'series-savings': '#2a78d6',
  'series-target': '#eb6834',
  'text-primary': '#0b0b0b',
  'text-secondary': '#52514e',
  'text-muted': '#898781',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  'surface-1': '#fcfcfb',
  'surface-2': '#f2f2ee',
  page: '#f9f9f7',
  'status-good-text': '#006300',
  'status-critical-text': '#b32c2c',
};

function readColors(): ThemeColors {
  if (typeof window === 'undefined') return FALLBACK;
  const computed = getComputedStyle(document.documentElement);
  const out = {} as ThemeColors;
  for (const role of ROLES) {
    const value = computed.getPropertyValue(`--${role}`).trim();
    out[role] = value || FALLBACK[role];
  }
  return out;
}

export function useThemeColors(): ThemeColors {
  const [colors, setColors] = useState<ThemeColors>(FALLBACK);

  useEffect(() => {
    const update = () => setColors(readColors());
    update();

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', update);

    // The viewer's theme toggle stamps data-theme on <html>; it must win.
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => {
      mq.removeEventListener('change', update);
      observer.disconnect();
    };
  }, []);

  return colors;
}
