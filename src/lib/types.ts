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
