export type PrefectureFiscal = {
  code: string;   // "05"
  name: string;   // "秋田県"
  population: number;      // 人
  areaKm2: number;         // k㎡
  industryShare: { primary: number; secondary: number; tertiary: number }; // %
  /** 人口1人当たり円 */
  revenue: Record<string, number>;
  revenueShare: Record<string, number>;   // %
  revenueTotal: number;                   // 人口1人当たり円
  /** 人口1人当たり円 */
  expenseByNature: Record<string, number>;
  expenseByNatureShare: Record<string, number>;  // %
  expenseTotal: number;                   // 人口1人当たり円
  /** 人口1人当たり円 */
  expenseByPurpose: Record<string, number>;
};

export type FiscalDataset = {
  meta: {
    fiscalYear: string;
    source: string;
    sourceUrl: string;
    license: string;
    fetchedAt: string;
  };
  prefectures: PrefectureFiscal[];
};

export type PrefectureIndustry = {
  code: string;
  name: string;
  /** 単位: 100万円 */
  gdpBySector: Record<string, number>;
  gdpTotal: number;
  primary: number;
  secondary: number;
  tertiary: number;
};

export type IndustryDataset = {
  meta: {
    fiscalYear: string;
    source: string;
    sourceUrl: string;
    license: string;
    fetchedAt: string;
  };
  sectors: string[];
  /** キーは年度の西暦（"2022" など）。最新年度が `latestYear` */
  latestYear: string;
  years: Record<string, PrefectureIndustry[]>;
};

export type AxisKey = 'population' | 'economy' | 'fiscal' | 'quality' | 'durability';

export type Weights = Record<AxisKey, number>;

export type Policy = {
  id: string;
  name: string;
  summary: string;
  /** 年あたりの想定コスト（億円）。本モデルの仮定値 */
  costOku: number;
  /** 対応する目的別歳出区分。fiscal.json の expenseByPurpose のキーと一致させる */
  expenseCategory: string;
  /** -10〜+10。本モデルの仮定値 */
  scores: Record<AxisKey, number>;
  rationale: string;
  sideEffects: string[];
  evidence: { label: string; url: string }[];
  /** 同じ値を持つカードは同時に採択されない */
  exclusiveGroup?: string;
  horizon: 'short' | 'medium' | 'long';
};
