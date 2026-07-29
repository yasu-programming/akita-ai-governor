import industryJson from '@/data/industry.json';
import type { IndustryDataset, PrefectureIndustry } from './types';

export const industryData = industryJson as IndustryDataset;

export function getIndustry(code: string, year = industryData.latestYear): PrefectureIndustry {
  const list = industryData.years[year];
  if (!list) throw new Error(`unknown year: ${year}`);
  const p = list.find((x) => x.code === code);
  if (!p) throw new Error(`unknown prefecture code: ${code}`);
  return p;
}

/** 業種別の構成比(%) に変換する */
export function sectorShares(p: PrefectureIndustry): Record<string, number> {
  const total = Object.values(p.gdpBySector).reduce((a, b) => a + b, 0);
  return Object.fromEntries(
    Object.entries(p.gdpBySector).map(([k, v]) => [k, (v / total) * 100]),
  );
}
