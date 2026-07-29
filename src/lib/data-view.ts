/**
 * 47 都道府県データ画面（/data）の表示用ヘルパー。
 *
 * 画面（React コンポーネント）から「計算」を切り離しておくための純関数だけを置く。
 * ここには DOM もチャートライブラリも持ち込まない。テストは tests/data-view.test.ts。
 *
 * 単位の扱い（混同しないこと）:
 *   - 財政データ  … 構成比は %、実数は「人口1人当たり円」
 *   - 産業データ  … 原数値は 100万円。画面には構成比(%)と差(ポイント)だけを出す
 *
 * 「全国平均」の定義はチャートごとに異なるため、必ず対で使う定数
 * FISCAL_AVERAGE_LABEL / INDUSTRY_AVERAGE_LABEL を画面に添えること。
 */
import { AKITA_CODE } from './constants';
import { fiscalData } from './fiscal';
import { industryData, sectorShares } from './industry';
import type { FiscalDataset, PrefectureFiscal } from './types';

export type DatasetMeta = FiscalDataset['meta'];

/** 財政データの「全国平均」＝47 都道府県の単純平均 */
export const FISCAL_AVERAGE_LABEL = '全国平均（47都道府県の単純平均）';
/** 産業データの「全国」＝47 都道府県の合計から算出した全国集計値 */
export const INDUSTRY_AVERAGE_LABEL = '全国（47都道府県の合計から算出）';

/* ------------------------------------------------------------------ */
/* 出典                                                                 */
/* ------------------------------------------------------------------ */

/**
 * チャートのすぐ脇に置く出典表記。必ず meta から組み立て、文字列を直書きしない。
 * （出典が更新されたとき、画面の表記が置き去りになるのを防ぐため）
 */
export function sourceLine(meta: DatasetMeta): string {
  return `${meta.source}（${meta.fiscalYear}）／${meta.license}`;
}

/* ------------------------------------------------------------------ */
/* 共通                                                                 */
/* ------------------------------------------------------------------ */

export function isAkita(code: string): boolean {
  return code === AKITA_CODE;
}

/** 平均。空配列なら 0 */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** 秋田県を除く 46 県の選択肢（都道府県コード昇順） */
export function otherPrefectureOptions(): { code: string; name: string }[] {
  return fiscalData.prefectures
    .filter((p) => !isAkita(p.code))
    .map((p) => ({ code: p.code, name: p.name }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

/* ------------------------------------------------------------------ */
/* 1. 歳入の散布図                                                       */
/* ------------------------------------------------------------------ */

export const REVENUE_X_KEY = '道府県税';
export const REVENUE_Y_KEY = '地方交付税';

export type RevenuePoint = {
  code: string;
  name: string;
  /** 道府県税の構成比(%) */
  tax: number;
  /** 地方交付税の構成比(%) */
  grant: number;
  akita: boolean;
};

/** 47 県の（道府県税, 地方交付税）構成比。並びは都道府県コード昇順 */
export function revenueScatterPoints(): RevenuePoint[] {
  return fiscalData.prefectures
    .map((p) => ({
      code: p.code,
      name: p.name,
      tax: p.revenueShare[REVENUE_X_KEY] ?? 0,
      grant: p.revenueShare[REVENUE_Y_KEY] ?? 0,
      akita: isAkita(p.code),
    }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

/** 歳入構成比の 47 県単純平均 */
export function meanRevenueShare(key: string): number {
  return mean(fiscalData.prefectures.map((p) => p.revenueShare[key] ?? 0));
}

/** 0 を切り上げた見やすい上限（散布図の軸用） */
export function axisMax(values: number[], step = 10): number {
  const max = Math.max(0, ...values);
  return Math.max(step, Math.ceil(max / step) * step);
}

/* ------------------------------------------------------------------ */
/* 2. 歳出のランキング                                                   */
/* ------------------------------------------------------------------ */

export type ExpenseMode = 'purpose' | 'nature';

export const EXPENSE_MODES: { mode: ExpenseMode; label: string; unit: string; note: string }[] = [
  {
    mode: 'purpose',
    label: '目的別歳出',
    unit: '人口1人当たり円',
    note: '何のために使ったか（教育・土木など）で分けた歳出額です。',
  },
  {
    mode: 'nature',
    label: '性質別歳出の構成比',
    unit: '%',
    note: '経費の性質（人件費・公債費など）で分けた歳出の構成比です。',
  },
];

function expenseRecord(p: PrefectureFiscal, mode: ExpenseMode): Record<string, number> {
  return mode === 'purpose' ? p.expenseByPurpose : p.expenseByNatureShare;
}

/**
 * 選べる区分。47 県すべてで 0 の区分（都道府県では消防費・公営企業費など）は、
 * 長さ 0 の棒しか描けないので落とす。
 */
export function expenseCategories(mode: ExpenseMode): string[] {
  // 1 県目のキーだけを見ると、その県にない区分を取りこぼす。全県の和を取る
  const keys: string[] = [];
  for (const p of fiscalData.prefectures) {
    for (const key of Object.keys(expenseRecord(p, mode))) {
      if (!keys.includes(key)) keys.push(key);
    }
  }
  return keys.filter((key) => fiscalData.prefectures.some((p) => (expenseRecord(p, mode)[key] ?? 0) !== 0));
}

export type ExpenseSort = 'desc' | 'asc' | 'code';

export const EXPENSE_SORTS: { sort: ExpenseSort; label: string }[] = [
  { sort: 'desc', label: '多い順' },
  { sort: 'asc', label: '少ない順' },
  { sort: 'code', label: '都道府県コード順' },
];

export type ExpenseRow = {
  code: string;
  name: string;
  value: number;
  /** 値の大きい順位（1 が最大）。表示順を変えても動かない */
  rank: number;
  akita: boolean;
};

/**
 * 47 県を 1 区分について並べる。順位は常に「値の大きい順」で確定させ、
 * 表示順（order）とは切り離す。同値はコード昇順で決める（乱数も不定順も使わない）。
 */
export function expenseRanking(
  mode: ExpenseMode,
  category: string,
  order: ExpenseSort = 'desc',
): ExpenseRow[] {
  const base = fiscalData.prefectures.map((p) => ({
    code: p.code,
    name: p.name,
    value: expenseRecord(p, mode)[category] ?? 0,
    akita: isAkita(p.code),
  }));

  const ranked = [...base]
    .sort((a, b) => b.value - a.value || a.code.localeCompare(b.code))
    .map((row, index) => ({ ...row, rank: index + 1 }));

  if (order === 'desc') return ranked;
  if (order === 'asc') return [...ranked].reverse();
  return [...ranked].sort((a, b) => a.code.localeCompare(b.code));
}

/** その区分の 47 県単純平均 */
export function expenseMean(mode: ExpenseMode, category: string): number {
  return mean(fiscalData.prefectures.map((p) => expenseRecord(p, mode)[category] ?? 0));
}

/* ------------------------------------------------------------------ */
/* 3. 産業構成                                                          */
/* ------------------------------------------------------------------ */

/** 年度の選択肢（昇順） */
export function industryYears(): string[] {
  return Object.keys(industryData.years).sort((a, b) => Number(a) - Number(b));
}

/**
 * 全国の業種別構成比(%)。47 県の業種別県内総生産を合計し、その合計で割る。
 *
 * 分母は「業種別の合計」であり、各県の gdpTotal の合計ではない。
 * sectorShares() と同じ分母を使わないと、県と全国で構成比が突き合わない。
 */
export function nationalSectorShares(year: string = industryData.latestYear): Record<string, number> {
  const list = industryData.years[year];
  if (!list) throw new Error(`unknown year: ${year}`);
  const sums: Record<string, number> = {};
  let total = 0;
  for (const p of list) {
    for (const [sector, value] of Object.entries(p.gdpBySector)) {
      sums[sector] = (sums[sector] ?? 0) + value;
      total += value;
    }
  }
  return Object.fromEntries(Object.entries(sums).map(([k, v]) => [k, (v / total) * 100]));
}

export type SectorDeviation = {
  sector: string;
  /** 軸に収まる短い表記。表とホバーには常に正式名称を出す */
  short: string;
  /** 対象県の構成比(%) */
  pref: number;
  /** 全国の構成比(%) */
  national: number;
  /** 対象県 − 全国（ポイント） */
  diff: number;
};

/** 業種名の短縮表記。軸ラベルにしか使わない */
export const SECTOR_SHORT: Record<string, string> = {
  '電気・ガス・水道・廃棄物処理業': '電気・ガス等',
  '宿泊・飲食サービス業': '宿泊・飲食',
  '専門・科学技術、業務支援サービス業': '専門・業務支援',
  '保健衛生・社会事業': '保健衛生・社会',
  'その他のサービス': 'その他サービス',
};

export function shortSector(sector: string): string {
  return SECTOR_SHORT[sector] ?? sector;
}

/** 並べ替えをせず、industryData.sectors の順で返す */
function rawDeviations(code: string, year: string): SectorDeviation[] {
  const list = industryData.years[year];
  if (!list) throw new Error(`unknown year: ${year}`);
  const p = list.find((x) => x.code === code);
  if (!p) throw new Error(`unknown prefecture code: ${code}`);

  const prefShares = sectorShares(p);
  const nationalShares = nationalSectorShares(year);

  return industryData.sectors.map((sector) => {
    const pref = prefShares[sector] ?? 0;
    const national = nationalShares[sector] ?? 0;
    return { sector, short: shortSector(sector), pref, national, diff: pref - national };
  });
}

/**
 * 業種の並び順。最新年度の差の大きい順で決め、どの年度を見ても同じ順にする。
 *
 * 年度ごとに並べ替えると、年度セレクタを動かすたびに行が入れ替わり、
 * 「値が変わったのか、行が入れ替わったのか」が見分けられなくなる。
 * 年度をまたいで比べることがこのグラフの目的なので、軸は固定する。
 */
export function sectorOrder(code: string): string[] {
  return rawDeviations(code, industryData.latestYear)
    .sort((a, b) => b.diff - a.diff || a.sector.localeCompare(b.sector))
    .map((d) => d.sector);
}

/**
 * ある県の業種別構成比と全国との差。
 * 並びは最新年度の差の大きい順で固定してあり、年度を変えても動かない。
 */
export function sectorDeviations(
  code: string,
  year: string = industryData.latestYear,
): SectorDeviation[] {
  const order = sectorOrder(code);
  return rawDeviations(code, year).sort(
    (a, b) => order.indexOf(a.sector) - order.indexOf(b.sector),
  );
}

export type SectorTrendRow = { year: string; pref: number; national: number };

/** 1 業種の構成比の推移（年度昇順） */
export function sectorTrend(code: string, sector: string): SectorTrendRow[] {
  return industryYears().map((year) => {
    const list = industryData.years[year];
    const p = list.find((x) => x.code === code);
    if (!p) throw new Error(`unknown prefecture code: ${code}`);
    return {
      year,
      pref: sectorShares(p)[sector] ?? 0,
      national: nationalSectorShares(year)[sector] ?? 0,
    };
  });
}

/* ------------------------------------------------------------------ */
/* 4. 2 県の比較                                                        */
/* ------------------------------------------------------------------ */

/** 歳入項目の短縮表記。軸ラベルにしか使わない */
export const REVENUE_SHORT: Record<string, string> = {
  '市町村たばこ税都道府県交付金': 'たばこ税交付金',
  '交通安全対策特別交付金': '交通安全交付金',
};

export function shortRevenue(key: string): string {
  return REVENUE_SHORT[key] ?? key;
}

export type CompareRow = {
  key: string;
  short: string;
  /** 秋田県の値 */
  a: number;
  /** 比較する県の値 */
  b: number;
};

/**
 * 47 県すべてで 0 の区分を落とした、固定のキー一覧。
 *
 * 「比較する 2 県のどちらかで 0 でない」を条件にすると、比較先を変えるたびに
 * 行が現れたり消えたりする（例: 寄附金は秋田県では 0 だが一部の県では 0 でない）。
 * カテゴリ軸が動くと、値の変化と行の入れ替わりが見分けられなくなるため、
 * 選択に依存しない条件で決める。
 */
function stableKeys(pick: (p: PrefectureFiscal) => Record<string, number>): string[] {
  const keys = new Set<string>();
  for (const p of fiscalData.prefectures) {
    for (const key of Object.keys(pick(p))) keys.add(key);
  }
  return [...keys].filter((key) => fiscalData.prefectures.some((p) => (pick(p)[key] ?? 0) !== 0));
}

/**
 * 2 県の内訳を並べる。行の集合は 47 県全体から決まるので、比較先を変えても動かない。
 * 並びは秋田県（第 1 引数）の値の降順で固定する。
 */
function compareRows(
  keys: string[],
  a: Record<string, number>,
  b: Record<string, number>,
  short: (key: string) => string,
): CompareRow[] {
  return keys
    .map((key) => ({ key, short: short(key), a: a[key] ?? 0, b: b[key] ?? 0 }))
    .sort((x, y) => y.a - x.a || x.key.localeCompare(y.key));
}

/** 歳入構成比(%)の比較 */
export function revenueCompareRows(a: PrefectureFiscal, b: PrefectureFiscal): CompareRow[] {
  return compareRows(stableKeys((p) => p.revenueShare), a.revenueShare, b.revenueShare, shortRevenue);
}

/** 目的別歳出（人口1人当たり円）の比較 */
export function purposeCompareRows(a: PrefectureFiscal, b: PrefectureFiscal): CompareRow[] {
  return compareRows(
    stableKeys((p) => p.expenseByPurpose),
    a.expenseByPurpose,
    b.expenseByPurpose,
    (key) => key,
  );
}

export type IndustryStackRow = {
  code: string;
  name: string;
  primary: number;
  secondary: number;
  tertiary: number;
};

export const INDUSTRY_THREE_LABELS: { key: 'primary' | 'secondary' | 'tertiary'; label: string }[] = [
  { key: 'primary', label: '第1次産業' },
  { key: 'secondary', label: '第2次産業' },
  { key: 'tertiary', label: '第3次産業' },
];

/** 第1次・第2次・第3次産業の比率(%)。2 県ぶんを表に並べる */
export function industryStackRows(a: PrefectureFiscal, b: PrefectureFiscal): IndustryStackRow[] {
  return [a, b].map((p) => ({
    code: p.code,
    name: p.name,
    primary: p.industryShare.primary,
    secondary: p.industryShare.secondary,
    tertiary: p.industryShare.tertiary,
  }));
}

export type ScaleRow = { label: string; unit: string; a: number; b: number; digits: number };

/** 人口・面積・人口密度 */
export function scaleRows(a: PrefectureFiscal, b: PrefectureFiscal): ScaleRow[] {
  return [
    { label: '人口', unit: '人', a: a.population, b: b.population, digits: 0 },
    { label: '面積', unit: 'k㎡', a: a.areaKm2, b: b.areaKm2, digits: 1 },
    {
      label: '人口密度',
      unit: '人/k㎡',
      a: a.population / a.areaKm2,
      b: b.population / b.areaKm2,
      digits: 1,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* 数値の表示                                                            */
/* ------------------------------------------------------------------ */

/** 構成比(%)。小数第1位まで */
export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

/** 全国との差（ポイント）。0 は符号なし */
export function formatPoint(value: number, digits = 1): string {
  const rounded = Number(value.toFixed(digits));
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded.toFixed(digits)} ポイント`;
}

/** 人口1人当たり円 */
export function formatYen(value: number): string {
  return `${Math.round(value).toLocaleString('ja-JP')} 円`;
}

/** 桁区切りの実数 */
export function formatNumber(value: number, digits = 0): string {
  return value.toLocaleString('ja-JP', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** 歳出ランキングの値。モードで単位が変わる */
export function formatExpenseValue(mode: ExpenseMode, value: number): string {
  return mode === 'purpose' ? formatYen(value) : formatPercent(value);
}
