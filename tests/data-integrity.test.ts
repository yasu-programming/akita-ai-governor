import { describe, it, expect } from 'vitest';
import fiscal from '../src/data/fiscal.json';
import industry from '../src/data/industry.json';
import type { FiscalDataset, IndustryDataset } from '../src/lib/types';

const data = fiscal as FiscalDataset;
const ind = industry as IndustryDataset;

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

describe('industry.json', () => {
  it('exposes 2022 as the latest year', () => {
    expect(ind.latestYear).toBe('2022');
    expect(Object.keys(ind.years)).toContain('2011');
    expect(Object.keys(ind.years)).toContain('2022');
  });

  it('covers all 47 prefectures in every year', () => {
    for (const [year, list] of Object.entries(ind.years)) {
      expect(list, year).toHaveLength(47);
    }
  });

  it('lists 16 sectors', () => {
    expect(ind.sectors).toHaveLength(16);
    expect(ind.sectors).toContain('農林水産業');
    expect(ind.sectors).toContain('製造業');
    expect(ind.sectors).toContain('保健衛生・社会事業');
  });

  it('records Akita 2022 with a plausible gross product', () => {
    const akita = ind.years['2022'].find((p) => p.code === '05');
    expect(akita?.name).toBe('秋田県');
    // 単位は100万円。秋田県の県内総生産はおよそ3.6兆円
    expect(akita!.gdpTotal).toBeGreaterThan(3_000_000);
    expect(akita!.gdpTotal).toBeLessThan(4_500_000);
  });

  it('has primary + secondary + tertiary close to the sector subtotal', () => {
    for (const p of ind.years['2022']) {
      const three = p.primary + p.secondary + p.tertiary;
      const sectors = Object.values(p.gdpBySector).reduce((a, b) => a + b, 0);
      expect(Math.abs(three - sectors) / sectors, p.name).toBeLessThan(0.02);
    }
  });

  it('cites its source and license', () => {
    expect(ind.meta.source).toContain('県民経済計算');
    expect(ind.meta.license).toContain('政府標準利用規約');
  });
});
