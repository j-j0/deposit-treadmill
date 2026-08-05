import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { percentCompact } from '../src/lib/format';

/**
 * Copy guards.
 *
 * Every editable assumption has a default, and it is very easy to write that
 * default into a sentence — "20% of the median", "over 30 years" — where it
 * then silently contradicts the user's own setting. That happened: the
 * goalposts panel read "20% of the median" while showing a 10% target.
 *
 * These tests read the component sources and fail if a default is hardcoded
 * into prose again. Crude, but it catches the whole class in one pass, and no
 * DOM-rendering harness is needed to run it.
 */

const COMPONENT_DIR = 'src/components';

/**
 * Strip comments before matching — the guard is about what renders, not about
 * documentation. A doc comment saying "NOT assumed to be 20%" is exactly the
 * right thing to write and must not trip the check.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '') // block, JSDoc and {/* JSX */} comments
    .replace(/(^|[^:])\/\/.*$/gm, '$1'); // line comments, sparing https:// URLs
}

function componentSources(): Array<[string, string]> {
  return readdirSync(COMPONENT_DIR)
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => [f, stripComments(readFileSync(join(COMPONENT_DIR, f), 'utf8'))] as [string, string]);
}

describe('editable defaults are never written into prose', () => {
  it('no component hardcodes the deposit percentage', () => {
    // One literal 20% is legitimate: "a 20% deposit" is the threshold below
    // which lenders charge LMI — a market convention that really is 20%
    // however the user sets their own target. Allowing that exact idiom rather
    // than exempting whole files keeps the guard live everywhere else in them.
    const LMI_THRESHOLD_IDIOM = /\b20% deposit\b/g;

    for (const [file, source] of componentSources()) {
      const remaining = source.replace(LMI_THRESHOLD_IDIOM, '');
      expect(remaining, `${file} hardcodes "20%" — use percentCompact(depositPct)`).not.toMatch(
        /\b20%/,
      );
    }
  });

  it('no component hardcodes the loan term', () => {
    for (const [file, source] of componentSources()) {
      expect(source, `${file} hardcodes "30 years" — use the loanTermYears prop`).not.toMatch(
        /\b30 years\b/,
      );
    }
  });

  it('no component hardcodes the mortgage rate or cash rate', () => {
    for (const [file, source] of componentSources()) {
      expect(source, `${file} hardcodes a rate literal`).not.toMatch(/\b6\.2%|\b4\.35%/);
    }
  });
});

describe('percentCompact', () => {
  it('drops meaningless decimals but keeps meaningful ones', () => {
    expect(percentCompact(20)).toBe('20%');
    expect(percentCompact(10)).toBe('10%');
    expect(percentCompact(12.5)).toBe('12.5%');
    expect(percentCompact(5.5)).toBe('5.5%');
  });

  it('handles zero and negatives with a real minus sign', () => {
    expect(percentCompact(0)).toBe('0%');
    expect(percentCompact(-2)).toBe('−2%');
  });
});
