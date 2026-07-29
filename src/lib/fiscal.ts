import fiscalJson from '@/data/fiscal.json';
import { AKITA_CODE, DISCRETIONARY_RATIO } from './constants';
import type { FiscalDataset, PrefectureFiscal } from './types';

export const fiscalData = fiscalJson as FiscalDataset;

export function getPrefecture(code: string): PrefectureFiscal {
  const p = fiscalData.prefectures.find((x) => x.code === code);
  if (!p) throw new Error(`unknown prefecture code: ${code}`);
  return p;
}

export function getAkita(): PrefectureFiscal {
  return getPrefecture(AKITA_CODE);
}

/** 歳出総額（億円）。人口1人当たり円 × 人口 ÷ 1億 */
export function totalExpenseOku(p: PrefectureFiscal): number {
  return (p.expenseTotal * p.population) / 100_000_000;
}

/** 単年度で組み替え可能とみなす裁量枠（億円）。本モデルの仮定値 */
export function discretionaryBudgetOku(p: PrefectureFiscal): number {
  return totalExpenseOku(p) * DISCRETIONARY_RATIO;
}
