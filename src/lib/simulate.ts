import type { AxisKey, Policy, Weights } from './types';
import { AXES } from './constants';

export type ScoredPolicy = { policy: Policy; score: number };

/**
 * カードが採択されなかった理由。
 * - 'score': 重み付けスコアが 0 以下で、その価値観では採る理由がない
 * - 'exclusive': 同じ exclusiveGroup の先行カードが既に採択済み
 * - 'budget': 採択すると単年度の裁量枠を超えるため見送った
 */
export type RejectionReason = 'score' | 'exclusive' | 'budget';

export type RejectedPolicy = ScoredPolicy & { reason: RejectionReason };

export type SimulationResult = {
  adopted: ScoredPolicy[];
  /** 採択されなかったカードをスコア降順で返す。各カードには却下理由 reason を付与する */
  rejected: RejectedPolicy[];
  totalCostOku: number;
  /** 目的別歳出区分ごとの採択コスト合計（億円） */
  costByCategory: Record<string, number>;
  /** 採択カードのスコアを軸ごとに合算した値。本モデルの仮定値 */
  effects: Record<AxisKey, number>;
};

function weightedScore(policy: Policy, weights: Weights): number {
  let total = 0;
  for (const axis of AXES) {
    total += (weights[axis.key] / 100) * policy.scores[axis.key];
  }
  return total;
}

/**
 * 価値観の重みから施策パッケージを組み立てる。
 *
 * 決定論的であること（同じ入力から常に同じ出力）を保証する。乱数を使わず、
 * スコアが同点の場合は id の辞書順で決める。
 * 採択されなかったカードには、なぜ採らなかったかの理由（reason）を添えて返す。
 *
 * @param weights  各軸 0〜100
 * @param policies 施策カードのプール
 * @param budgetOku 単年度の裁量枠（億円）
 */
export function simulate(
  weights: Weights,
  policies: Policy[],
  budgetOku: number,
): SimulationResult {
  const scored: ScoredPolicy[] = policies
    .map((policy) => ({ policy, score: weightedScore(policy, weights) }))
    .sort((a, b) => b.score - a.score || a.policy.id.localeCompare(b.policy.id));

  const adopted: ScoredPolicy[] = [];
  const rejected: RejectedPolicy[] = [];
  const usedGroups = new Set<string>();
  let totalCostOku = 0;

  for (const item of scored) {
    const { policy, score } = item;
    const group = policy.exclusiveGroup;

    // スコアが正でないカードは、その価値観では採る理由がない
    if (score <= 0) {
      rejected.push({ ...item, reason: 'score' });
      continue;
    }
    if (group && usedGroups.has(group)) {
      rejected.push({ ...item, reason: 'exclusive' });
      continue;
    }
    if (totalCostOku + policy.costOku > budgetOku) {
      rejected.push({ ...item, reason: 'budget' });
      continue;
    }

    adopted.push(item);
    totalCostOku += policy.costOku;
    if (group) usedGroups.add(group);
  }

  const costByCategory: Record<string, number> = {};
  const effects = Object.fromEntries(AXES.map((a) => [a.key, 0])) as Record<AxisKey, number>;

  for (const { policy } of adopted) {
    costByCategory[policy.expenseCategory] =
      (costByCategory[policy.expenseCategory] ?? 0) + policy.costOku;
    for (const axis of AXES) {
      effects[axis.key] += policy.scores[axis.key];
    }
  }

  return { adopted, rejected, totalCostOku, costByCategory, effects };
}
