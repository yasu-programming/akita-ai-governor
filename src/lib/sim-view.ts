/**
 * シミュレーター画面の表示用ヘルパー。
 *
 * 画面（React コンポーネント）から「計算」を切り離しておくための純関数だけを置く。
 * ここには DOM もチャートライブラリも持ち込まない。テストは tests/sim-view.test.ts。
 */
import type { RejectedPolicy, RejectionReason, ScoredPolicy } from './simulate';
import type { AxisKey, PrefectureFiscal, Weights } from './types';
import { AXES, PRESETS } from './constants';

/* ------------------------------------------------------------------ */
/* 却下理由 → 画面文言                                                  */
/* ------------------------------------------------------------------ */

/**
 * 選定エンジンが返す却下理由をそのまま文言に写す。
 * 画面側で理由を再判定してはならない（エンジンの判断と食い違う恐れがあるため）。
 */
export const REJECTION_REASON_TEXT: Record<RejectionReason, string> = {
  score: 'この価値観では優先度が立たない',
  exclusive: '同じ目的でより優先度の高い施策を選んだため',
  budget: '裁量枠を使い切ったため',
};

export function rejectionReasonText(reason: RejectionReason): string {
  return REJECTION_REASON_TEXT[reason];
}

/** 「切られた施策」として画面に出す上位 n 件。エンジンが返した順（スコア降順）を保つ。 */
export function topRejected(rejected: RejectedPolicy[], limit = 6): RejectedPolicy[] {
  return rejected.slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* 目的別歳出（人口1人当たり円 → 億円）                                  */
/* ------------------------------------------------------------------ */

export type PurposeExpense = { category: string; oku: number };

/** 人口1人当たり円 × 人口 ÷ 1億 = 億円 */
export function perCapitaYenToOku(perCapitaYen: number, population: number): number {
  return (perCapitaYen * population) / 100_000_000;
}

/**
 * 目的別歳出を億円に換算して降順に返す。
 * 0 円の区分（都道府県では消防費・普通財産取得費・公営企業費など）は、
 * 長さ 0 の棒を描いても情報がないので落とす。
 */
export function expenseByPurposeOku(p: PrefectureFiscal): PurposeExpense[] {
  return Object.entries(p.expenseByPurpose)
    .map(([category, perCapitaYen]) => ({
      category,
      oku: perCapitaYenToOku(perCapitaYen, p.population),
    }))
    .filter((row) => row.oku > 0)
    .sort((a, b) => b.oku - a.oku || a.category.localeCompare(b.category));
}

export type BudgetShiftRow = {
  category: string;
  /** 現状の目的別歳出（億円） */
  currentOku: number;
  /** 現状 + 採択施策の想定コスト（億円） */
  afterOku: number;
  /** 採択施策による上乗せ分（億円）。歳出を抑える施策も実施コストは正の値で載る */
  addedOku: number;
};

/**
 * 現状の目的別歳出に、採択された施策の想定コストを上乗せした比較行を作る。
 * costByCategory 側にしか現れない区分があっても取りこぼさない。
 *
 * 並び順は currentOku（現状の歳出、重みに依存しない）の降順で固定する。
 * afterOku で並べ替えると、重みを変えるたびに区分の順序が入れ替わり、
 * カテゴリ軸が動いてしまう（チャートの棒が行ごと入れ替わって見える）ため使わない。
 */
export function budgetShiftRows(
  p: PrefectureFiscal,
  costByCategory: Record<string, number>,
): BudgetShiftRow[] {
  const base = new Map<string, number>(
    expenseByPurposeOku(p).map((row) => [row.category, row.oku]),
  );
  for (const category of Object.keys(costByCategory)) {
    if (!base.has(category)) base.set(category, 0);
  }
  return [...base.entries()]
    .map(([category, currentOku]) => {
      const addedOku = costByCategory[category] ?? 0;
      return { category, currentOku, afterOku: currentOku + addedOku, addedOku };
    })
    .sort((a, b) => b.currentOku - a.currentOku || a.category.localeCompare(b.category));
}

/* ------------------------------------------------------------------ */
/* 裁量枠の使用率                                                        */
/* ------------------------------------------------------------------ */

/** 裁量枠に対する使用率（%）。枠が 0 以下なら 0 を返す。 */
export function budgetUsagePercent(totalCostOku: number, budgetOku: number): number {
  if (budgetOku <= 0) return 0;
  return (totalCostOku / budgetOku) * 100;
}

/* ------------------------------------------------------------------ */
/* 価値観の重みから文をつくる                                            */
/* ------------------------------------------------------------------ */

/** 重みが最大の軸。同点なら AXES の並び順すべてを返す。 */
export function topAxes(weights: Weights): { key: AxisKey; label: string }[] {
  const max = Math.max(...AXES.map((axis) => weights[axis.key]));
  return AXES.filter((axis) => weights[axis.key] === max).map((axis) => ({
    key: axis.key,
    label: axis.label,
  }));
}

export type Horizon = 'short' | 'medium' | 'long';

export const HORIZON_LABELS: Record<Horizon, string> = {
  short: '短期',
  medium: '中期',
  long: '長期',
};

const HORIZON_ORDER: Horizon[] = ['short', 'medium', 'long'];

export type HorizonGroup = { horizon: Horizon; label: string; names: string[] };

/** 採択カードを短期・中期・長期に分ける。空のグループは返さない。 */
export function horizonGroups(adopted: ScoredPolicy[]): HorizonGroup[] {
  return HORIZON_ORDER.map((horizon) => ({
    horizon,
    label: HORIZON_LABELS[horizon],
    names: adopted.filter((a) => a.policy.horizon === horizon).map((a) => a.policy.name),
  })).filter((group) => group.names.length > 0);
}

export type Statement = { lead: string; groups: HorizonGroup[] };

/**
 * 施政方針文を組み立てる。
 * 固定文＋カード名の列挙にとどめ、効果の断定表現は入れない。
 */
export function buildStatement(weights: Weights, adopted: ScoredPolicy[]): Statement {
  const groups = horizonGroups(adopted);
  if (adopted.length === 0) {
    return {
      lead: 'この価値観のもとでは、採択できる施策がありませんでした。いずれかの軸の重みを上げてください。',
      groups,
    };
  }
  const tops = topAxes(weights);
  const lead =
    tops.length === 1
      ? `この価値観のもとでは、${tops[0].label}を最上位に置き、${adopted.length}件の施策を選びました。`
      : `この価値観のもとでは、${tops
          .map((t) => t.label)
          .join('・')}を同率で最上位に置き、${adopted.length}件の施策を選びました。`;
  return { lead, groups };
}

/* ------------------------------------------------------------------ */
/* プリセットとの一致判定                                                */
/* ------------------------------------------------------------------ */

/** 現在の重みが完全一致するプリセットの id。一致しなければ null。 */
export function matchingPresetId(weights: Weights): string | null {
  const preset = PRESETS.find((p) => AXES.every((axis) => p.weights[axis.key] === weights[axis.key]));
  return preset ? preset.id : null;
}

/* ------------------------------------------------------------------ */
/* 効果（本モデルの仮定値の合計）                                        */
/* ------------------------------------------------------------------ */

export type EffectRow = { key: AxisKey; label: string; value: number };

/** effects を AXES の並び順に整える。単位はなく、相対的な指標として扱う。 */
export function effectRows(effects: Record<AxisKey, number>): EffectRow[] {
  return AXES.map((axis) => ({ key: axis.key, label: axis.label, value: effects[axis.key] }));
}

/* ------------------------------------------------------------------ */
/* 数値の表示                                                            */
/* ------------------------------------------------------------------ */

/** 億円の表示（小数第1位まで、整数なら小数を出さない） */
export function formatOku(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded)
    ? rounded.toLocaleString('ja-JP')
    : rounded.toLocaleString('ja-JP', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** 符号つきの相対指標の表示（0 は符号なし） */
export function formatSigned(value: number): string {
  if (value > 0) return `+${value.toLocaleString('ja-JP')}`;
  return value.toLocaleString('ja-JP');
}
