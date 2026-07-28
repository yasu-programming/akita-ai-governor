import { describe, it, expect } from 'vitest';
import fiscal from '../src/data/fiscal.json';
import type { FiscalDataset } from '../src/lib/types';

const data = fiscal as FiscalDataset;

describe('fiscal.json', () => {
  it('covers all 47 prefectures with unique sequential codes', () => {
    expect(data.prefectures).toHaveLength(47);
    const codes = data.prefectures.map((p) => p.code);
    expect(new Set(codes).size).toBe(47);
    expect(codes[0]).toBe('01');
    expect(codes[46]).toBe('47');
  });

  it('records Akita at code 05', () => {
    const akita = data.prefectures.find((p) => p.code === '05');
    expect(akita?.name).toBe('秋田県');
    expect(akita?.population).toBeGreaterThan(800_000);
    expect(akita?.population).toBeLessThan(1_100_000);
  });

  it('has revenue shares summing to about 100% for every prefecture', () => {
    for (const p of data.prefectures) {
      const sum = Object.values(p.revenueShare).reduce((a, b) => a + b, 0);
      expect(sum, p.name).toBeGreaterThan(97);
      expect(sum, p.name).toBeLessThan(103);
    }
  });

  it('has expense-by-nature shares summing to about 100% for every prefecture', () => {
    for (const p of data.prefectures) {
      const sum = Object.values(p.expenseByNatureShare).reduce((a, b) => a + b, 0);
      expect(sum, p.name).toBeGreaterThan(97);
      expect(sum, p.name).toBeLessThan(103);
    }
  });

  it('records positive totals and non-negative components', () => {
    for (const p of data.prefectures) {
      expect(p.revenueTotal, p.name).toBeGreaterThan(0);
      expect(p.expenseTotal, p.name).toBeGreaterThan(0);
      expect(Object.values(p.expenseByPurpose).every((v) => v >= 0), p.name).toBe(true);
    }
  });

  it('cites its source and license', () => {
    expect(data.meta.source).toContain('総務省');
    expect(data.meta.license).toContain('政府標準利用規約');
    expect(data.meta.sourceUrl).toMatch(/^https:\/\/www\.soumu\.go\.jp\//);
  });
});
